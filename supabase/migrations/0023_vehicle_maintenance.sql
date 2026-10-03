-- 0023_vehicle_maintenance.sql
-- Vehicle maintenance: service, repair, tyres, battery, insurance, permit / FC and other upkeep, recorded per vehicle.
-- Same model as fuel (D-019): a cash expense posted to the ledger when saved, kept in step on edit.
--   maintenance -> type 'expense', module 'transport', entity_type 'maintenance', entity_id = maintenance id
-- Written ONLY through save_maintenance(); the browser can read the table.
-- Maintenance is a vehicle-level cost: it reduces the vehicle's operating profit (Transport > Profit) but is NOT part of
-- any single trip's profit. An optional "next due date" feeds the maintenance_due view (the latest entry of each kind).

create table public.vehicle_maintenance (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references public.vehicles (id) on delete restrict,
  service_date  date not null,
  kind          text not null check (kind in ('service', 'repair', 'tyres', 'battery', 'insurance', 'permit', 'other')),
  vendor        text,
  amount        numeric(14, 2) not null check (amount > 0),
  odometer_km   integer check (odometer_km is null or odometer_km >= 0),
  next_due_date date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint vehicle_maintenance_due_after check (next_due_date is null or next_due_date >= service_date)
);
create index vehicle_maintenance_date_idx    on public.vehicle_maintenance (service_date desc, created_at desc);
create index vehicle_maintenance_vehicle_idx on public.vehicle_maintenance (vehicle_id, kind);
create trigger vehicle_maintenance_set_updated_at before update on public.vehicle_maintenance
  for each row execute function public.set_updated_at();

alter table public.vehicle_maintenance enable row level security;
create policy vehicle_maintenance_admin_read on public.vehicle_maintenance for select to authenticated using (public.is_admin());
revoke all on public.vehicle_maintenance from anon;

create unique index transactions_maintenance_key on public.transactions (entity_type, entity_id) where entity_type = 'maintenance';

-- ---------- save_maintenance ----------
create or replace function public.save_maintenance(
  p_vehicle_id uuid, p_service_date date, p_kind text, p_vendor text, p_amount numeric,
  p_odometer_km integer, p_next_due_date date, p_notes text, p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  old    public.vehicle_maintenance%rowtype;
  v      public.vehicles%rowtype;
  v_tx   uuid;
  v_desc text;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_service_date is null then raise exception 'date is required'; end if;
  if p_kind is null or p_kind not in ('service', 'repair', 'tyres', 'battery', 'insurance', 'permit', 'other') then raise exception 'invalid maintenance type'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be greater than zero'; end if;
  if p_odometer_km is not null and p_odometer_km < 0 then raise exception 'odometer cannot be negative'; end if;
  if p_next_due_date is not null and p_next_due_date < p_service_date then raise exception 'next due date is before the service date'; end if;

  if p_id is not null then
    select * into old from public.vehicle_maintenance where id = p_id for update;
    if not found then raise exception 'maintenance entry not found'; end if;
  end if;

  select * into v from public.vehicles where id = p_vehicle_id;
  if not found then raise exception 'vehicle not found'; end if;
  if (p_id is null or old.vehicle_id is distinct from p_vehicle_id) and v.status <> 'active' then
    raise exception 'vehicle is not active';
  end if;

  if p_id is null then
    insert into public.vehicle_maintenance (vehicle_id, service_date, kind, vendor, amount, odometer_km, next_due_date, notes)
    values (p_vehicle_id, p_service_date, p_kind, nullif(btrim(p_vendor), ''), p_amount, p_odometer_km, p_next_due_date, nullif(btrim(p_notes), ''))
    returning id into v_id;
  else
    update public.vehicle_maintenance
       set vehicle_id = p_vehicle_id, service_date = p_service_date, kind = p_kind, vendor = nullif(btrim(p_vendor), ''),
           amount = p_amount, odometer_km = p_odometer_km, next_due_date = p_next_due_date, notes = nullif(btrim(p_notes), '')
     where id = p_id
    returning id into v_id;
  end if;

  v_desc := 'Maintenance (' || p_kind || ') - ' || v.name || ' (' || v.registration_number || ')';
  select id into v_tx from public.transactions where entity_type = 'maintenance' and entity_id = v_id;
  if v_tx is null then
    insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, description)
    values ('expense', p_amount, 'transport', 'maintenance', v_id, p_service_date, v_desc);
  else
    update public.transactions set amount = p_amount, transaction_date = p_service_date, description = v_desc where id = v_tx;
  end if;
  return v_id;
end $$;
revoke all on function public.save_maintenance(uuid, date, text, text, numeric, integer, date, text, uuid) from public, anon;
grant execute on function public.save_maintenance(uuid, date, text, text, numeric, integer, date, text, uuid) to authenticated;

-- ---------- what is due next ----------
-- The latest entry (by service date) of each kind for each active vehicle, when it has a next due date. A newer entry of
-- the same kind replaces an older one, so a renewed insurance stops showing as due. Raw dates only; the "overdue / soon"
-- wording is worked out in transportEngine.ts.
create view public.maintenance_due with (security_invoker = true) as
select distinct on (m.vehicle_id, m.kind)
       m.id, m.vehicle_id, m.kind, m.service_date, m.next_due_date
  from public.vehicle_maintenance m
  join public.vehicles v on v.id = m.vehicle_id and v.status = 'active'
 order by m.vehicle_id, m.kind, m.service_date desc, m.created_at desc;
revoke all on public.maintenance_due from anon;

-- ---------- Reports: a maintenance entry belongs to its vehicle (ledger_links as in 0015, plus maintenance) ----------
create or replace view public.ledger_links with (security_invoker = true) as
select
  t.id as transaction_id,
  coalesce(tr.vehicle_id, fl.vehicle_id, tl.vehicle_id, vm.vehicle_id, vl.vehicle_id, vl2.vehicle_id, v.id) as vehicle_id,
  coalesce(rp.property_id, am.property_id)                                                  as property_id,
  coalesce(tr.customer_id, sr.customer_id)                                                   as customer_id
from public.transactions t
left join public.trips tr               on t.entity_type in ('trip_revenue', 'trip_driver') and tr.id = t.entity_id
left join public.fuel_logs fl           on t.entity_type = 'fuel_log' and fl.id = t.entity_id
left join public.tolls tl               on t.entity_type = 'toll' and tl.id = t.entity_id
left join public.vehicle_maintenance vm on t.entity_type = 'maintenance' and vm.id = t.entity_id
left join public.vehicle_loans vl       on t.entity_type = 'vehicle_loan' and vl.id = t.entity_id
left join public.loan_payments lpay     on t.entity_type = 'loan_payment' and lpay.id = t.entity_id
left join public.vehicle_loans vl2      on vl2.id = lpay.loan_id
left join public.vehicles v             on t.entity_type in ('vehicle_purchase', 'vehicle_container') and v.id = t.entity_id
left join public.rent_payments rp       on t.entity_type = 'rent_payment' and rp.id = t.entity_id
left join public.advance_movements am  on t.entity_type = 'advance_movement' and am.id = t.entity_id
left join public.sheet_rental_payments sp on t.entity_type = 'sheet_payment' and sp.id = t.entity_id
left join public.sheet_rentals sr       on sr.id = sp.rental_id;

-- ---------- Transport > Profit: one more column, so the function is re-created ----------
drop function public.vehicle_profit_totals(date, date);
create function public.vehicle_profit_totals(p_from date default null, p_to date default null)
returns table (vehicle_id uuid, revenue numeric, driver numeric, fuel numeric, toll numeric, maintenance numeric, loan_repaid numeric)
language sql stable as $$
  with parts as (
    select tr.vehicle_id, t.amount, t.transaction_date as d,
           case t.entity_type when 'trip_revenue' then 'revenue' else 'driver' end as part
      from public.transactions t join public.trips tr on tr.id = t.entity_id
     where t.entity_type in ('trip_revenue', 'trip_driver')
    union all
    select f.vehicle_id, t.amount, t.transaction_date, 'fuel'
      from public.transactions t join public.fuel_logs f on f.id = t.entity_id
     where t.entity_type = 'fuel_log'
    union all
    select o.vehicle_id, t.amount, t.transaction_date, 'toll'
      from public.transactions t join public.tolls o on o.id = t.entity_id
     where t.entity_type = 'toll'
    union all
    select m.vehicle_id, t.amount, t.transaction_date, 'maintenance'
      from public.transactions t join public.vehicle_maintenance m on m.id = t.entity_id
     where t.entity_type = 'maintenance'
    union all
    select l.vehicle_id, t.amount, t.transaction_date, 'loan'
      from public.transactions t
      join public.loan_payments p on p.id = t.entity_id
      join public.vehicle_loans l on l.id = p.loan_id
     where t.entity_type = 'loan_payment'
  )
  select pt.vehicle_id,
         coalesce(sum(pt.amount) filter (where pt.part = 'revenue'),     0),
         coalesce(sum(pt.amount) filter (where pt.part = 'driver'),      0),
         coalesce(sum(pt.amount) filter (where pt.part = 'fuel'),        0),
         coalesce(sum(pt.amount) filter (where pt.part = 'toll'),        0),
         coalesce(sum(pt.amount) filter (where pt.part = 'maintenance'), 0),
         coalesce(sum(pt.amount) filter (where pt.part = 'loan'),        0)
    from parts pt
   where (p_from is null or pt.d >= p_from) and (p_to is null or pt.d <= p_to)
   group by pt.vehicle_id
$$;
revoke all on function public.vehicle_profit_totals(date, date) from public, anon;
grant execute on function public.vehicle_profit_totals(date, date) to authenticated;
