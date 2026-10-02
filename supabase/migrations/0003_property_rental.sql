-- 0003_property_rental.sql  (Phase 4)
-- Properties, one tenant per property, monthly rent charges, rent payments (posted to the
-- ledger atomically) and an advance history. See DECISIONS D-012..D-015.
--
-- Write model:
--   properties, tenants           -> admin full access (RLS)
--   rent_charges, rent_payments,
--   advance_movements             -> admin READ-ONLY via RLS; written only by the SECURITY DEFINER
--                                    functions below, which re-check is_admin() and enforce the rules.

create table public.properties (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) > 0),
  property_type text not null default 'shop' check (property_type in ('shop', 'godown', 'house', 'land', 'other')),
  address       text,
  description   text,
  status        text not null default 'active' check (status in ('active', 'inactive')),
  monthly_rent  numeric(14, 2) not null check (monthly_rent > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index properties_name_key on public.properties (lower(btrim(name)));
create trigger properties_set_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

-- One tenant per property (unique property_id). Rental dates describe the tenancy, so they live here.
create table public.tenants (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid not null unique references public.properties (id) on delete restrict,
  name              text not null check (length(btrim(name)) > 0),
  mobile            text check (mobile is null or mobile ~ '^[0-9]{10}$'),
  address           text,
  notes             text,
  rental_start_date date not null,
  rental_end_date   date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint tenants_dates_check check (rental_end_date is null or rental_end_date >= rental_start_date)
);
create trigger tenants_set_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();

-- One row per property per month: the rent expected for that month (a snapshot, so later rent
-- changes never rewrite history). `period` is always the first day of the month.
create table public.rent_charges (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties (id) on delete restrict,
  period          date not null check (extract(day from period) = 1),
  expected_amount numeric(14, 2) not null check (expected_amount > 0),
  created_at      timestamptz not null default now(),
  unique (property_id, period)
);

create table public.rent_payments (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null,
  period         date not null,
  amount         numeric(14, 2) not null check (amount > 0),
  payment_date   date not null,
  payment_method text check (payment_method is null or payment_method in ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
  notes          text,
  transaction_id uuid not null unique references public.transactions (id) on delete restrict,
  created_at     timestamptz not null default now(),
  foreign key (property_id, period) references public.rent_charges (property_id, period) on delete restrict
);
create index rent_payments_property_idx on public.rent_payments (property_id, period);

-- Advance history. Never a single mutable number: remaining = received - adjusted - returned.
create table public.advance_movements (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties (id) on delete restrict,
  kind          text not null check (kind in ('received', 'adjusted', 'returned')),
  amount        numeric(14, 2) not null check (amount > 0),
  movement_date date not null,
  notes         text,
  created_at    timestamptz not null default now()
);
create index advance_movements_property_idx on public.advance_movements (property_id, movement_date desc);

-- ---------- RLS ----------
alter table public.properties        enable row level security;
alter table public.tenants           enable row level security;
alter table public.rent_charges      enable row level security;
alter table public.rent_payments     enable row level security;
alter table public.advance_movements enable row level security;

create policy properties_admin_all on public.properties
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy tenants_admin_all on public.tenants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy rent_charges_admin_read on public.rent_charges
  for select to authenticated using (public.is_admin());
create policy rent_payments_admin_read on public.rent_payments
  for select to authenticated using (public.is_admin());
create policy advance_movements_admin_read on public.advance_movements
  for select to authenticated using (public.is_admin());

revoke all on public.properties, public.tenants, public.rent_charges, public.rent_payments, public.advance_movements from anon;

-- ---------- read models (SECURITY INVOKER: RLS applies) ----------
-- Sums only. Outstanding / remaining advance / status are derived in src/features/property/propertyEngine.ts.
create view public.property_overview with (security_invoker = true) as
select
  p.id, p.name, p.property_type, p.address, p.description, p.status, p.monthly_rent, p.created_at,
  t.name as tenant_name, t.rental_start_date, t.rental_end_date,
  coalesce((select sum(c.expected_amount) from public.rent_charges c where c.property_id = p.id), 0) as expected_total,
  coalesce((select sum(r.amount) from public.rent_payments r where r.property_id = p.id), 0) as paid_total,
  coalesce((select sum(a.amount) from public.advance_movements a where a.property_id = p.id and a.kind = 'received'), 0) as advance_received,
  coalesce((select sum(a.amount) from public.advance_movements a where a.property_id = p.id and a.kind = 'adjusted'), 0) as advance_adjusted,
  coalesce((select sum(a.amount) from public.advance_movements a where a.property_id = p.id and a.kind = 'returned'), 0) as advance_returned
from public.properties p
left join public.tenants t on t.property_id = p.id;

create view public.rent_charge_status with (security_invoker = true) as
select
  c.id, c.property_id, c.period, c.expected_amount,
  coalesce((select sum(r.amount) from public.rent_payments r where r.property_id = c.property_id and r.period = c.period), 0) as paid_amount,
  (select max(r.payment_date) from public.rent_payments r where r.property_id = c.property_id and r.period = c.period) as last_payment_date
from public.rent_charges c;

-- ---------- write functions (SECURITY DEFINER, admin re-checked inside) ----------

-- Creates any missing monthly charges, from the tenancy start month up to the current month (IST)
-- or the tenancy end month, at the property's CURRENT monthly rent. Idempotent. Returns rows added.
create or replace function public.ensure_rent_charges(p_property_id uuid default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_added integer;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  insert into public.rent_charges (property_id, period, expected_amount)
  select p.id, gs::date, p.monthly_rent
  from public.properties p
  join public.tenants t on t.property_id = p.id
  cross join lateral generate_series(
    date_trunc('month', t.rental_start_date),
    date_trunc('month', least(coalesce(t.rental_end_date, (now() at time zone 'Asia/Kolkata')::date),
                              (now() at time zone 'Asia/Kolkata')::date)),
    interval '1 month') as gs
  where p.status = 'active' and (p_property_id is null or p.id = p_property_id)
  on conflict (property_id, period) do nothing;
  get diagnostics v_added = row_count;
  return v_added;
end $$;

-- Records a rent payment and its ledger entry (customer_payment, module property) in ONE transaction.
-- Rejects payments above the month's outstanding. The charge row is locked to prevent double-spend races.
create or replace function public.record_rent_payment(
  p_property_id uuid, p_period date, p_amount numeric,
  p_payment_date date, p_payment_method text default null, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_charge  public.rent_charges%rowtype;
  v_paid    numeric;
  v_name    text;
  v_pay_id  uuid := gen_random_uuid();
  v_tx_id   uuid;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be greater than zero'; end if;
  select * into v_charge from public.rent_charges
    where property_id = p_property_id and period = p_period for update;
  if not found then raise exception 'no rent is due for that month'; end if;
  select coalesce(sum(amount), 0) into v_paid from public.rent_payments
    where property_id = p_property_id and period = p_period;
  if v_paid + p_amount > v_charge.expected_amount then
    raise exception 'payment exceeds the outstanding rent for that month';
  end if;
  select name into v_name from public.properties where id = p_property_id;
  insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, payment_method, description)
  values ('customer_payment', p_amount, 'property', 'rent_payment', v_pay_id, p_payment_date, p_payment_method,
          'Rent - ' || v_name || ' - ' || to_char(p_period, 'Mon YYYY'))
  returning id into v_tx_id;
  insert into public.rent_payments (id, property_id, period, amount, payment_date, payment_method, notes, transaction_id)
  values (v_pay_id, p_property_id, p_period, p_amount, p_payment_date, p_payment_method, nullif(btrim(p_notes), ''), v_tx_id);
  return v_pay_id;
end $$;

-- Appends to the advance history. Adjusted + returned can never exceed received (property row is locked).
-- Advance movements are NOT posted to the ledger in Phase 4 (open question D-015).
create or replace function public.record_advance_movement(
  p_property_id uuid, p_kind text, p_amount numeric, p_movement_date date, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_remaining numeric;
  v_id        uuid;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_kind not in ('received', 'adjusted', 'returned') then raise exception 'invalid advance movement kind'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be greater than zero'; end if;
  perform 1 from public.properties where id = p_property_id for update;
  if not found then raise exception 'property not found'; end if;
  if p_kind <> 'received' then
    select coalesce(sum(case kind when 'received' then amount else -amount end), 0) into v_remaining
      from public.advance_movements where property_id = p_property_id;
    if p_amount > v_remaining then raise exception 'amount exceeds the remaining advance'; end if;
  end if;
  insert into public.advance_movements (property_id, kind, amount, movement_date, notes)
  values (p_property_id, p_kind, p_amount, p_movement_date, nullif(btrim(p_notes), ''))
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.ensure_rent_charges(uuid) from public, anon;
revoke all on function public.record_rent_payment(uuid, date, numeric, date, text, text) from public, anon;
revoke all on function public.record_advance_movement(uuid, text, numeric, date, text) from public, anon;
grant execute on function public.ensure_rent_charges(uuid) to authenticated;
grant execute on function public.record_rent_payment(uuid, date, numeric, date, text, text) to authenticated;
grant execute on function public.record_advance_movement(uuid, text, numeric, date, text) to authenticated;
