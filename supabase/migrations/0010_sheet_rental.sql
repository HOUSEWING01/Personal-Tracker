-- 0010_sheet_rental.sql  (Phase 6)
-- Roofing sheet rental (SESSION.md section 13, DECISIONS D-022 / D-023).
--   sheet_products          the rental product(s), admin-created (e.g. "Roofing Sheet")
--   sheet_variants          dynamic sizes in feet per product, with the total quantity owned
--   sheet_rentals           one rental = one customer + one variant + one quantity (admin-typed rent and discount)
--   sheet_rental_payments   advance and later payments; each posts customer_payment / module 'sheets' to the ledger
--   sheet_returns           return events: good + damaged + missing quantities (supports partial returns)
-- Stock is DERIVED, never stored as a mutable counter:
--   rented    = sum(rental quantity) - sum(returned + damaged + missing)      (cancelled rentals excluded)
--   damaged   = sum(damaged on returns), missing = sum(missing on returns)
--   available = total - rented - damaged - missing                            (never below zero: enforced here)
-- Rentals, payments, returns and variants are written ONLY through the functions below (SECURITY DEFINER,
-- admin re-checked). Every function that changes stock locks the variant row first, then the rental row.
-- Rent is admin-typed (no rate/day calculation). Net rent = rent - discount; outstanding = net - paid.

-- ---------- sheet_products ----------
create table public.sheet_products (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  status     text not null default 'active' check (status in ('active', 'inactive')),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index sheet_products_name_key on public.sheet_products (lower(btrim(name)));
create trigger sheet_products_set_updated_at before update on public.sheet_products
  for each row execute function public.set_updated_at();

-- ---------- sheet_variants ----------
create table public.sheet_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.sheet_products (id) on delete restrict,
  length_ft      numeric(6, 2) not null check (length_ft > 0),
  total_quantity integer not null default 0 check (total_quantity >= 0),
  status         text not null default 'active' check (status in ('active', 'inactive')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index sheet_variants_product_length_key on public.sheet_variants (product_id, length_ft);
create trigger sheet_variants_set_updated_at before update on public.sheet_variants
  for each row execute function public.set_updated_at();

-- ---------- sheet_rentals ----------
create table public.sheet_rentals (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references public.customers (id) on delete restrict,
  variant_id           uuid not null references public.sheet_variants (id) on delete restrict,
  quantity             integer not null check (quantity > 0),
  rental_date          date not null,
  expected_return_date date,
  rent_amount          numeric(14, 2) not null default 0 check (rent_amount >= 0),  -- base rental amount, typed by the admin
  discount             numeric(14, 2) not null default 0 check (discount >= 0),
  status               text not null default 'active' check (status in ('active', 'closed', 'cancelled')),
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint sheet_rentals_discount_le_rent_check check (discount <= rent_amount),
  constraint sheet_rentals_dates_check check (expected_return_date is null or expected_return_date >= rental_date)
);
create index sheet_rentals_date_idx     on public.sheet_rentals (rental_date desc, created_at desc);
create index sheet_rentals_variant_idx  on public.sheet_rentals (variant_id);
create index sheet_rentals_customer_idx on public.sheet_rentals (customer_id);
create index sheet_rentals_status_idx   on public.sheet_rentals (status, expected_return_date);
create trigger sheet_rentals_set_updated_at before update on public.sheet_rentals
  for each row execute function public.set_updated_at();

-- ---------- sheet_rental_payments ----------
create table public.sheet_rental_payments (
  id             uuid primary key default gen_random_uuid(),
  rental_id      uuid not null references public.sheet_rentals (id) on delete restrict,
  payment_date   date not null,
  amount         numeric(14, 2) not null check (amount > 0),
  payment_method text check (payment_method is null or payment_method in ('cash', 'upi', 'bank_transfer', 'cheque', 'other')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index sheet_payments_rental_idx on public.sheet_rental_payments (rental_id, payment_date desc, created_at desc);
create trigger sheet_rental_payments_set_updated_at before update on public.sheet_rental_payments
  for each row execute function public.set_updated_at();

-- ---------- sheet_returns ----------
create table public.sheet_returns (
  id                uuid primary key default gen_random_uuid(),
  rental_id         uuid not null references public.sheet_rentals (id) on delete restrict,
  return_date       date not null,
  returned_quantity integer not null default 0 check (returned_quantity >= 0),  -- came back in good condition
  damaged_quantity  integer not null default 0 check (damaged_quantity >= 0),   -- came back damaged
  missing_quantity  integer not null default 0 check (missing_quantity >= 0),   -- did not come back
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint sheet_returns_nonzero_check check (returned_quantity + damaged_quantity + missing_quantity > 0)
);
create index sheet_returns_rental_idx on public.sheet_returns (rental_id, return_date desc, created_at desc);
create trigger sheet_returns_set_updated_at before update on public.sheet_returns
  for each row execute function public.set_updated_at();

-- One ledger entry per payment.
create unique index transactions_sheet_payment_key
  on public.transactions (entity_type, entity_id)
  where entity_type = 'sheet_payment';

-- ---------- RLS: products are a plain master (browser writes); everything else is read-only from the browser ----------
alter table public.sheet_products        enable row level security;
alter table public.sheet_variants        enable row level security;
alter table public.sheet_rentals         enable row level security;
alter table public.sheet_rental_payments enable row level security;
alter table public.sheet_returns         enable row level security;

create policy sheet_products_admin_all on public.sheet_products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy sheet_variants_admin_read on public.sheet_variants        for select to authenticated using (public.is_admin());
create policy sheet_rentals_admin_read  on public.sheet_rentals         for select to authenticated using (public.is_admin());
create policy sheet_payments_admin_read on public.sheet_rental_payments for select to authenticated using (public.is_admin());
create policy sheet_returns_admin_read  on public.sheet_returns         for select to authenticated using (public.is_admin());

revoke all on public.sheet_products, public.sheet_variants, public.sheet_rentals,
              public.sheet_rental_payments, public.sheet_returns from anon;

-- ---------- derived stock per variant (raw numbers; available is computed here and in sheetEngine) ----------
create view public.sheet_variant_stock with (security_invoker = true) as
select v.id as variant_id,
       v.total_quantity,
       (
         coalesce((select sum(r.quantity) from public.sheet_rentals r
                    where r.variant_id = v.id and r.status <> 'cancelled'), 0)
         - coalesce((select sum(t.returned_quantity + t.damaged_quantity + t.missing_quantity)
                       from public.sheet_returns t join public.sheet_rentals r on r.id = t.rental_id
                      where r.variant_id = v.id and r.status <> 'cancelled'), 0)
       )::integer as rented_quantity,
       coalesce((select sum(t.damaged_quantity) from public.sheet_returns t join public.sheet_rentals r on r.id = t.rental_id
                  where r.variant_id = v.id and r.status <> 'cancelled'), 0)::integer as damaged_quantity,
       coalesce((select sum(t.missing_quantity) from public.sheet_returns t join public.sheet_rentals r on r.id = t.rental_id
                  where r.variant_id = v.id and r.status <> 'cancelled'), 0)::integer as missing_quantity,
       v.total_quantity - (
         coalesce((select sum(r.quantity) from public.sheet_rentals r
                    where r.variant_id = v.id and r.status <> 'cancelled'), 0)
         - coalesce((select sum(t.returned_quantity + t.damaged_quantity + t.missing_quantity)
                       from public.sheet_returns t join public.sheet_rentals r on r.id = t.rental_id
                      where r.variant_id = v.id and r.status <> 'cancelled'), 0)
       )::integer
       - coalesce((select sum(t.damaged_quantity) from public.sheet_returns t join public.sheet_rentals r on r.id = t.rental_id
                    where r.variant_id = v.id and r.status <> 'cancelled'), 0)::integer
       - coalesce((select sum(t.missing_quantity) from public.sheet_returns t join public.sheet_rentals r on r.id = t.rental_id
                    where r.variant_id = v.id and r.status <> 'cancelled'), 0)::integer as available_quantity
  from public.sheet_variants v;
revoke all on public.sheet_variant_stock from anon;

-- ---------- per-rental totals (raw sums only) ----------
create view public.sheet_rental_totals with (security_invoker = true) as
select r.id as rental_id,
       coalesce((select sum(t.returned_quantity) from public.sheet_returns t where t.rental_id = r.id), 0)::integer as returned_total,
       coalesce((select sum(t.damaged_quantity)  from public.sheet_returns t where t.rental_id = r.id), 0)::integer as damaged_total,
       coalesce((select sum(t.missing_quantity)  from public.sheet_returns t where t.rental_id = r.id), 0)::integer as missing_total,
       (select max(t.return_date) from public.sheet_returns t where t.rental_id = r.id)                          as last_return_date,
       coalesce((select sum(p.amount) from public.sheet_rental_payments p where p.rental_id = r.id), 0)           as paid_total,
       (select count(*) from public.sheet_rental_payments p where p.rental_id = r.id)                            as payment_count
  from public.sheet_rentals r;
revoke all on public.sheet_rental_totals from anon;

-- ---------- helper: bring a rental's status in line with its returns ----------
-- closed = every sheet is accounted for (returned, damaged or missing). Cancelled rentals are left alone.
create or replace function public.sheet_refresh_status(p_rental_id uuid)
returns void
language sql security definer set search_path = public as $$
  update public.sheet_rentals r
     set status = case
       when coalesce((select sum(t.returned_quantity + t.damaged_quantity + t.missing_quantity)
                        from public.sheet_returns t where t.rental_id = r.id), 0) >= r.quantity
       then 'closed' else 'active' end
   where r.id = p_rental_id and r.status <> 'cancelled';
$$;
revoke all on function public.sheet_refresh_status(uuid) from public, anon, authenticated;

-- ---------- save_sheet_variant ----------
-- p_id null = create. Total quantity cannot go below what is already rented, damaged or missing.
-- Once a variant has rentals, its product and size cannot change (history would mislabel).
create or replace function public.save_sheet_variant(
  p_product_id uuid, p_length_ft numeric, p_total_quantity integer, p_status text, p_notes text, p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid;
  v       public.sheet_variants%rowtype;
  s       public.sheet_variant_stock%rowtype;
  prod    public.sheet_products%rowtype;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_length_ft is null or p_length_ft <= 0 or p_length_ft > 9999.99 then raise exception 'length must be greater than zero'; end if;
  if p_total_quantity is null or p_total_quantity < 0 then raise exception 'total quantity cannot be negative'; end if;
  if p_status is null or p_status not in ('active', 'inactive') then raise exception 'invalid variant status'; end if;

  select * into prod from public.sheet_products where id = p_product_id;
  if not found then raise exception 'product not found'; end if;

  if p_id is null then
    if prod.status <> 'active' then raise exception 'product is not active'; end if;
    insert into public.sheet_variants (product_id, length_ft, total_quantity, status, notes)
    values (p_product_id, p_length_ft, p_total_quantity, p_status, nullif(btrim(p_notes), ''))
    returning id into v_id;
  else
    select * into v from public.sheet_variants where id = p_id for update;
    if not found then raise exception 'variant not found'; end if;
    if (v.product_id <> p_product_id or v.length_ft <> p_length_ft)
       and exists (select 1 from public.sheet_rentals where variant_id = p_id) then
      raise exception 'variant has rentals; its product and size cannot change';
    end if;
    select * into s from public.sheet_variant_stock where variant_id = p_id;
    if p_total_quantity < s.rented_quantity + s.damaged_quantity + s.missing_quantity then
      raise exception 'total quantity is below the sheets already rented, damaged or missing';
    end if;
    update public.sheet_variants
       set product_id = p_product_id, length_ft = p_length_ft, total_quantity = p_total_quantity,
           status = p_status, notes = nullif(btrim(p_notes), '')
     where id = p_id
    returning id into v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.save_sheet_variant(uuid, numeric, integer, text, text, uuid) from public, anon;
grant execute on function public.save_sheet_variant(uuid, numeric, integer, text, text, uuid) to authenticated;

-- ---------- save_sheet_rental ----------
-- p_id null = create (variant must be active, quantity must fit the available stock, optional advance posts a payment).
-- Edit: the variant cannot change; quantity cannot drop below what is already accounted for and an increase must fit
-- the available stock; net rent cannot drop below what is already paid; dates cannot move past existing returns/payments.
create or replace function public.save_sheet_rental(
  p_customer_id uuid, p_variant_id uuid, p_quantity integer, p_rental_date date, p_expected_return_date date,
  p_rent_amount numeric, p_discount numeric, p_notes text,
  p_advance numeric default 0, p_payment_method text default null, p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id       uuid;
  v          public.sheet_variants%rowtype;
  s          public.sheet_variant_stock%rowtype;
  old        public.sheet_rentals%rowtype;
  cust       public.customers%rowtype;
  v_accounted integer;
  v_paid     numeric;
  v_pay_id   uuid;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'quantity must be greater than zero'; end if;
  if p_rental_date is null then raise exception 'rental date is required'; end if;
  if p_expected_return_date is not null and p_expected_return_date < p_rental_date then raise exception 'expected return is before the rental date'; end if;
  if p_rent_amount is null or p_rent_amount < 0 then raise exception 'rent cannot be negative'; end if;
  if p_discount is null or p_discount < 0 then raise exception 'discount cannot be negative'; end if;
  if p_discount > p_rent_amount then raise exception 'discount is more than the rent'; end if;
  if p_advance is null or p_advance < 0 then raise exception 'advance cannot be negative'; end if;
  if p_payment_method is not null and p_payment_method not in ('cash', 'upi', 'bank_transfer', 'cheque', 'other') then
    raise exception 'invalid payment method';
  end if;

  select * into cust from public.customers where id = p_customer_id;
  if not found then raise exception 'customer not found'; end if;

  -- Lock order: variant, then rental.
  select * into v from public.sheet_variants where id = p_variant_id for update;
  if not found then raise exception 'variant not found'; end if;
  select * into s from public.sheet_variant_stock where variant_id = p_variant_id;

  if p_id is null then
    if v.status <> 'active' then raise exception 'variant is not active'; end if;
    if p_quantity > s.available_quantity then raise exception 'not enough sheets available'; end if;
    if p_advance > p_rent_amount - p_discount then raise exception 'advance is more than the net rent'; end if;

    insert into public.sheet_rentals (customer_id, variant_id, quantity, rental_date, expected_return_date, rent_amount, discount, notes)
    values (p_customer_id, p_variant_id, p_quantity, p_rental_date, p_expected_return_date, p_rent_amount, p_discount, nullif(btrim(p_notes), ''))
    returning id into v_id;

    if p_advance > 0 then
      v_pay_id := gen_random_uuid();
      insert into public.sheet_rental_payments (id, rental_id, payment_date, amount, payment_method, notes)
      values (v_pay_id, v_id, p_rental_date, p_advance, p_payment_method, 'Advance');
      insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, payment_method, description)
      values ('customer_payment', p_advance, 'sheets', 'sheet_payment', v_pay_id, p_rental_date, p_payment_method,
              'Sheet rental advance - ' || cust.name);
    end if;
  else
    select * into old from public.sheet_rentals where id = p_id for update;
    if not found then raise exception 'rental not found'; end if;
    if old.variant_id <> p_variant_id then raise exception 'rental belongs to a different variant'; end if;
    if old.status = 'cancelled' then raise exception 'rental is cancelled'; end if;

    select coalesce(sum(returned_quantity + damaged_quantity + missing_quantity), 0) into v_accounted
      from public.sheet_returns where rental_id = p_id;
    if p_quantity < v_accounted then raise exception 'quantity is below the sheets already returned'; end if;
    if p_quantity > old.quantity and (p_quantity - old.quantity) > s.available_quantity then
      raise exception 'not enough sheets available';
    end if;

    select coalesce(sum(amount), 0) into v_paid from public.sheet_rental_payments where rental_id = p_id;
    if p_rent_amount - p_discount < v_paid then raise exception 'net rent is below the amount already paid'; end if;

    if exists (select 1 from public.sheet_returns where rental_id = p_id and return_date < p_rental_date)
       or exists (select 1 from public.sheet_rental_payments where rental_id = p_id and payment_date < p_rental_date) then
      raise exception 'rental has returns or payments before that date';
    end if;

    update public.sheet_rentals
       set customer_id = p_customer_id, quantity = p_quantity, rental_date = p_rental_date,
           expected_return_date = p_expected_return_date, rent_amount = p_rent_amount, discount = p_discount,
           notes = nullif(btrim(p_notes), '')
     where id = p_id
    returning id into v_id;

    perform public.sheet_refresh_status(v_id);
    -- If the customer changed, keep the ledger descriptions in step.
    update public.transactions t set description = 'Sheet rental payment - ' || cust.name
     where t.entity_type = 'sheet_payment'
       and t.entity_id in (select p.id from public.sheet_rental_payments p where p.rental_id = v_id);
  end if;
  return v_id;
end $$;
revoke all on function public.save_sheet_rental(uuid, uuid, integer, date, date, numeric, numeric, text, numeric, text, uuid) from public, anon;
grant execute on function public.save_sheet_rental(uuid, uuid, integer, date, date, numeric, numeric, text, numeric, text, uuid) to authenticated;

-- ---------- cancel_sheet_rental ----------
-- Only a rental with no returns and no payments can be cancelled; its sheets become available again.
create or replace function public.cancel_sheet_rental(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.sheet_rentals%rowtype;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  select variant_id into r.variant_id from public.sheet_rentals where id = p_id;
  if not found then raise exception 'rental not found'; end if;
  perform 1 from public.sheet_variants where id = r.variant_id for update;
  select * into r from public.sheet_rentals where id = p_id for update;
  if r.status = 'cancelled' then raise exception 'rental is cancelled'; end if;
  if exists (select 1 from public.sheet_returns where rental_id = p_id)
     or exists (select 1 from public.sheet_rental_payments where rental_id = p_id) then
    raise exception 'rental has returns or payments';
  end if;
  update public.sheet_rentals set status = 'cancelled' where id = p_id;
end $$;
revoke all on function public.cancel_sheet_rental(uuid) from public, anon;
grant execute on function public.cancel_sheet_rental(uuid) to authenticated;

-- ---------- save_sheet_payment ----------
-- Posts customer_payment (module 'sheets'). Total paid can never exceed the net rent. Part payments are fine.
create or replace function public.save_sheet_payment(
  p_rental_id uuid, p_payment_date date, p_amount numeric, p_payment_method text, p_notes text, p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid;
  r       public.sheet_rentals%rowtype;
  old     public.sheet_rental_payments%rowtype;
  cust    public.customers%rowtype;
  v_other numeric;
  v_tx    uuid;
  v_desc  text;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_payment_date is null then raise exception 'payment date is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'payment amount must be greater than zero'; end if;
  if p_payment_method is not null and p_payment_method not in ('cash', 'upi', 'bank_transfer', 'cheque', 'other') then
    raise exception 'invalid payment method';
  end if;

  select * into r from public.sheet_rentals where id = p_rental_id for update;
  if not found then raise exception 'rental not found'; end if;
  if r.status = 'cancelled' then raise exception 'rental is cancelled'; end if;
  if p_payment_date < r.rental_date then raise exception 'payment is before the rental date'; end if;
  select * into cust from public.customers where id = r.customer_id;

  select coalesce(sum(amount), 0) into v_other from public.sheet_rental_payments
   where rental_id = p_rental_id and (p_id is null or id <> p_id);
  if v_other + p_amount > r.rent_amount - r.discount then raise exception 'payment is more than the outstanding rent'; end if;

  if p_id is null then
    insert into public.sheet_rental_payments (rental_id, payment_date, amount, payment_method, notes)
    values (p_rental_id, p_payment_date, p_amount, p_payment_method, nullif(btrim(p_notes), ''))
    returning id into v_id;
  else
    select * into old from public.sheet_rental_payments where id = p_id for update;
    if not found then raise exception 'payment not found'; end if;
    if old.rental_id <> p_rental_id then raise exception 'payment belongs to a different rental'; end if;
    update public.sheet_rental_payments
       set payment_date = p_payment_date, amount = p_amount, payment_method = p_payment_method, notes = nullif(btrim(p_notes), '')
     where id = p_id
    returning id into v_id;
  end if;

  v_desc := 'Sheet rental payment - ' || cust.name;
  select id into v_tx from public.transactions where entity_type = 'sheet_payment' and entity_id = v_id;
  if v_tx is null then
    insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, payment_method, description)
    values ('customer_payment', p_amount, 'sheets', 'sheet_payment', v_id, p_payment_date, p_payment_method, v_desc);
  else
    update public.transactions
       set amount = p_amount, transaction_date = p_payment_date, payment_method = p_payment_method, description = v_desc
     where id = v_tx;
  end if;
  return v_id;
end $$;
revoke all on function public.save_sheet_payment(uuid, date, numeric, text, text, uuid) from public, anon;
grant execute on function public.save_sheet_payment(uuid, date, numeric, text, text, uuid) to authenticated;

-- ---------- record_sheet_return ----------
-- One return event: good + damaged + missing sheets, at most what is still out on this rental (partial returns are fine).
-- Good sheets become available again; damaged and missing sheets stay out of stock. Closes the rental when all are accounted for.
create or replace function public.record_sheet_return(
  p_rental_id uuid, p_return_date date, p_returned integer, p_damaged integer, p_missing integer, p_notes text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id        uuid;
  r           public.sheet_rentals%rowtype;
  v_accounted integer;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_return_date is null then raise exception 'return date is required'; end if;
  if p_returned is null or p_damaged is null or p_missing is null or p_returned < 0 or p_damaged < 0 or p_missing < 0 then
    raise exception 'quantities cannot be negative';
  end if;
  if p_returned + p_damaged + p_missing <= 0 then raise exception 'enter at least one sheet'; end if;
  if p_return_date > (now() at time zone 'Asia/Kolkata')::date then raise exception 'return date is in the future'; end if;

  select variant_id into r.variant_id from public.sheet_rentals where id = p_rental_id;
  if not found then raise exception 'rental not found'; end if;
  perform 1 from public.sheet_variants where id = r.variant_id for update;
  select * into r from public.sheet_rentals where id = p_rental_id for update;
  if r.status = 'cancelled' then raise exception 'rental is cancelled'; end if;
  if p_return_date < r.rental_date then raise exception 'return is before the rental date'; end if;

  select coalesce(sum(returned_quantity + damaged_quantity + missing_quantity), 0) into v_accounted
    from public.sheet_returns where rental_id = p_rental_id;
  if p_returned + p_damaged + p_missing > r.quantity - v_accounted then
    raise exception 'more sheets than are still out on rent';
  end if;

  insert into public.sheet_returns (rental_id, return_date, returned_quantity, damaged_quantity, missing_quantity, notes)
  values (p_rental_id, p_return_date, p_returned, p_damaged, p_missing, nullif(btrim(p_notes), ''))
  returning id into v_id;

  perform public.sheet_refresh_status(p_rental_id);
  return v_id;
end $$;
revoke all on function public.record_sheet_return(uuid, date, integer, integer, integer, text) from public, anon;
grant execute on function public.record_sheet_return(uuid, date, integer, integer, integer, text) to authenticated;

-- ---------- delete_sheet_return ----------
-- Undo a mistaken return. Refused if the good sheets it released have since been rented out again.
create or replace function public.delete_sheet_return(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.sheet_returns%rowtype;
  r public.sheet_rentals%rowtype;
  s public.sheet_variant_stock%rowtype;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  select * into t from public.sheet_returns where id = p_id;
  if not found then raise exception 'return not found'; end if;
  select variant_id into r.variant_id from public.sheet_rentals where id = t.rental_id;
  perform 1 from public.sheet_variants where id = r.variant_id for update;
  perform 1 from public.sheet_rentals where id = t.rental_id for update;
  perform 1 from public.sheet_returns where id = p_id for update;
  if not found then raise exception 'return not found'; end if;

  select * into s from public.sheet_variant_stock where variant_id = r.variant_id;
  if t.returned_quantity > s.available_quantity then
    raise exception 'those sheets are already rented out again';
  end if;

  delete from public.sheet_returns where id = p_id;
  perform public.sheet_refresh_status(t.rental_id);
end $$;
revoke all on function public.delete_sheet_return(uuid) from public, anon;
grant execute on function public.delete_sheet_return(uuid) to authenticated;
