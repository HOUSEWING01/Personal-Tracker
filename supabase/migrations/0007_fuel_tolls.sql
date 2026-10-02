-- 0007_fuel_tolls.sql  (Phase 5c)
-- Fuel is recorded at VEHICLE level with an optional trip link; a toll belongs to a trip (SESSION.md section 11).
-- Both are cash expenses, posted to the ledger when saved (DECISIONS D-019):
--   fuel -> type 'expense', module 'transport', entity_type 'fuel_log', entity_id = fuel log id
--   toll -> type 'expense', module 'transport', entity_type 'toll',     entity_id = toll id
-- Editing updates the entry (same model as D-016 / D-018). Written ONLY through save_fuel_log() / save_toll();
-- the browser can read these tables. The fuel TOTAL is a generated column (litres x price), so it cannot drift.
-- Trip operating profit = revenue - driver payment - fuel linked to the trip - tolls of the trip. It is computed
-- in transportEngine.ts from the per-trip totals in the view `trip_cost_totals`.

-- ---------- fuel_logs ----------
create table public.fuel_logs (
  id              uuid primary key default gen_random_uuid(),
  vehicle_id      uuid not null references public.vehicles (id) on delete restrict,
  trip_id         uuid references public.trips (id) on delete restrict,
  fuel_date       date not null,
  litres          numeric(10, 2) not null check (litres > 0 and litres <= 100000),
  price_per_litre numeric(10, 2) not null check (price_per_litre > 0 and price_per_litre <= 10000),
  total           numeric(14, 2) generated always as (round(litres * price_per_litre, 2)) stored,
  odometer_km     integer check (odometer_km is null or odometer_km >= 0),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint fuel_logs_total_positive check (total > 0)
);
create index fuel_logs_date_idx    on public.fuel_logs (fuel_date desc, created_at desc);
create index fuel_logs_vehicle_idx on public.fuel_logs (vehicle_id);
create index fuel_logs_trip_idx    on public.fuel_logs (trip_id) where trip_id is not null;
create trigger fuel_logs_set_updated_at before update on public.fuel_logs
  for each row execute function public.set_updated_at();

-- ---------- tolls ----------
create table public.tolls (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete restrict,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict, -- always the trip's vehicle (set by save_toll)
  toll_date  date not null,
  amount     numeric(14, 2) not null check (amount > 0),
  location   text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tolls_date_idx    on public.tolls (toll_date desc, created_at desc);
create index tolls_vehicle_idx on public.tolls (vehicle_id);
create index tolls_trip_idx    on public.tolls (trip_id);
create trigger tolls_set_updated_at before update on public.tolls
  for each row execute function public.set_updated_at();

-- ---------- RLS: browser can read, never write ----------
alter table public.fuel_logs enable row level security;
alter table public.tolls     enable row level security;
create policy fuel_logs_admin_read on public.fuel_logs for select to authenticated using (public.is_admin());
create policy tolls_admin_read     on public.tolls     for select to authenticated using (public.is_admin());
revoke all on public.fuel_logs, public.tolls from anon;

-- One ledger entry per fuel log / toll.
create unique index transactions_fuel_toll_key
  on public.transactions (entity_type, entity_id)
  where entity_type in ('fuel_log', 'toll');

-- ---------- per-trip cost totals (raw sums only; profit is computed in transportEngine.ts) ----------
create view public.trip_cost_totals with (security_invoker = true) as
select t.id as trip_id,
       coalesce((select sum(f.total)  from public.fuel_logs f where f.trip_id = t.id), 0) as fuel_total,
       coalesce((select sum(o.amount) from public.tolls o     where o.trip_id = t.id), 0) as toll_total
  from public.trips t;
revoke all on public.trip_cost_totals from anon;

-- ---------- save_fuel_log ----------
-- p_id null = create, otherwise edit. A NEW log (or a changed vehicle) needs an active vehicle.
-- A linked trip must belong to the same vehicle.
create or replace function public.save_fuel_log(
  p_vehicle_id uuid, p_trip_id uuid, p_fuel_date date, p_litres numeric, p_price_per_litre numeric,
  p_odometer_km integer, p_notes text, p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid;
  old      public.fuel_logs%rowtype;
  v_trip_vehicle uuid;
  v        public.vehicles%rowtype;
  f        public.fuel_logs%rowtype;
  v_tx     uuid;
  v_desc   text;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_fuel_date is null then raise exception 'fuel date is required'; end if;
  if p_litres is null or p_litres <= 0 then raise exception 'litres must be greater than zero'; end if;
  if p_price_per_litre is null or p_price_per_litre <= 0 then raise exception 'price per litre must be greater than zero'; end if;
  if round(p_litres * p_price_per_litre, 2) <= 0 then raise exception 'fuel total must be greater than zero'; end if;
  if p_odometer_km is not null and p_odometer_km < 0 then raise exception 'odometer cannot be negative'; end if;

  if p_id is not null then
    select * into old from public.fuel_logs where id = p_id for update;
    if not found then raise exception 'fuel log not found'; end if;
  end if;

  select * into v from public.vehicles where id = p_vehicle_id;
  if not found then raise exception 'vehicle not found'; end if;
  if (p_id is null or old.vehicle_id is distinct from p_vehicle_id) and v.status <> 'active' then
    raise exception 'vehicle is not active';
  end if;

  if p_trip_id is not null then
    select vehicle_id into v_trip_vehicle from public.trips where id = p_trip_id;
    if not found then raise exception 'trip not found'; end if;
    if v_trip_vehicle <> p_vehicle_id then raise exception 'trip belongs to a different vehicle'; end if;
  end if;

  if p_id is null then
    insert into public.fuel_logs (vehicle_id, trip_id, fuel_date, litres, price_per_litre, odometer_km, notes)
    values (p_vehicle_id, p_trip_id, p_fuel_date, p_litres, p_price_per_litre, p_odometer_km, nullif(btrim(p_notes), ''))
    returning id into v_id;
  else
    update public.fuel_logs
       set vehicle_id = p_vehicle_id, trip_id = p_trip_id, fuel_date = p_fuel_date, litres = p_litres,
           price_per_litre = p_price_per_litre, odometer_km = p_odometer_km, notes = nullif(btrim(p_notes), '')
     where id = p_id
    returning id into v_id;
  end if;

  select * into f from public.fuel_logs where id = v_id;
  v_desc := 'Fuel - ' || v.name || ' (' || v.registration_number || ')';
  select id into v_tx from public.transactions where entity_type = 'fuel_log' and entity_id = v_id;
  if v_tx is null then
    insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, description)
    values ('expense', f.total, 'transport', 'fuel_log', v_id, f.fuel_date, v_desc);
  else
    update public.transactions set amount = f.total, transaction_date = f.fuel_date, description = v_desc where id = v_tx;
  end if;
  return v_id;
end $$;
revoke all on function public.save_fuel_log(uuid, uuid, date, numeric, numeric, integer, text, uuid) from public, anon;
grant execute on function public.save_fuel_log(uuid, uuid, date, numeric, numeric, integer, text, uuid) to authenticated;

-- ---------- save_toll ----------
-- The toll's vehicle is always the trip's vehicle, so the two can never disagree.
create or replace function public.save_toll(
  p_trip_id uuid, p_toll_date date, p_amount numeric, p_location text, p_notes text, p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  tr     public.trips%rowtype;
  v      public.vehicles%rowtype;
  v_tx   uuid;
  v_desc text;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_toll_date is null then raise exception 'toll date is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'toll amount must be greater than zero'; end if;

  select * into tr from public.trips where id = p_trip_id;
  if not found then raise exception 'trip not found'; end if;
  select * into v from public.vehicles where id = tr.vehicle_id;

  if p_id is null then
    insert into public.tolls (trip_id, vehicle_id, toll_date, amount, location, notes)
    values (p_trip_id, tr.vehicle_id, p_toll_date, p_amount, nullif(btrim(p_location), ''), nullif(btrim(p_notes), ''))
    returning id into v_id;
  else
    perform 1 from public.tolls where id = p_id for update;
    if not found then raise exception 'toll not found'; end if;
    update public.tolls
       set trip_id = p_trip_id, vehicle_id = tr.vehicle_id, toll_date = p_toll_date, amount = p_amount,
           location = nullif(btrim(p_location), ''), notes = nullif(btrim(p_notes), '')
     where id = p_id
    returning id into v_id;
  end if;

  v_desc := 'Toll - ' || coalesce(nullif(btrim(p_location), '') || ' - ', '') || v.name || ' (' || v.registration_number || ')';
  select id into v_tx from public.transactions where entity_type = 'toll' and entity_id = v_id;
  if v_tx is null then
    insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, description)
    values ('expense', p_amount, 'transport', 'toll', v_id, p_toll_date, v_desc);
  else
    update public.transactions set amount = p_amount, transaction_date = p_toll_date, description = v_desc where id = v_tx;
  end if;
  return v_id;
end $$;
revoke all on function public.save_toll(uuid, date, numeric, text, text, uuid) from public, anon;
grant execute on function public.save_toll(uuid, date, numeric, text, text, uuid) to authenticated;

-- ---------- save_trip, re-issued: a trip's vehicle cannot change while fuel or tolls are linked to it ----------
-- (otherwise a fuel log or toll could end up on a different vehicle than its trip). Same grants as 0006.
create or replace function public.save_trip(
  p_vehicle_id uuid, p_driver_id uuid, p_customer_id uuid,
  p_from_location text, p_to_location text, p_distance_km numeric, p_rate_per_km numeric,
  p_driver_payment numeric, p_trip_date date, p_status text, p_notes text,
  p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id      uuid;
  old       public.trips%rowtype;
  v_status  text;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_trip_date is null then raise exception 'trip date is required'; end if;
  if p_distance_km is null or p_distance_km <= 0 then raise exception 'distance must be greater than zero'; end if;
  if p_rate_per_km is null or p_rate_per_km <= 0 then raise exception 'rate per km must be greater than zero'; end if;
  if p_driver_payment is null or p_driver_payment < 0 then raise exception 'driver payment cannot be negative'; end if;

  if p_id is not null then
    select * into old from public.trips where id = p_id for update;
    if not found then raise exception 'trip not found'; end if;
    if old.vehicle_id is distinct from p_vehicle_id
       and (exists (select 1 from public.fuel_logs where trip_id = p_id) or exists (select 1 from public.tolls where trip_id = p_id)) then
      raise exception 'trip has fuel or toll entries';
    end if;
  end if;

  if p_id is null or old.vehicle_id is distinct from p_vehicle_id then
    select status into v_status from public.vehicles where id = p_vehicle_id;
    if v_status is null then raise exception 'vehicle not found'; end if;
    if v_status <> 'active' then raise exception 'vehicle is not active'; end if;
  end if;
  if p_id is null or old.driver_id is distinct from p_driver_id then
    select status into v_status from public.drivers where id = p_driver_id;
    if v_status is null then raise exception 'driver not found'; end if;
    if v_status <> 'active' then raise exception 'driver is not active'; end if;
  end if;
  perform 1 from public.customers where id = p_customer_id;
  if not found then raise exception 'customer not found'; end if;

  if p_id is null then
    insert into public.trips (vehicle_id, driver_id, customer_id, from_location, to_location, distance_km,
                              rate_per_km, driver_payment, trip_date, status, notes)
    values (p_vehicle_id, p_driver_id, p_customer_id, btrim(p_from_location), btrim(p_to_location), p_distance_km,
            p_rate_per_km, p_driver_payment, p_trip_date, p_status, nullif(btrim(p_notes), ''))
    returning id into v_id;
  else
    update public.trips
       set vehicle_id = p_vehicle_id, driver_id = p_driver_id, customer_id = p_customer_id,
           from_location = btrim(p_from_location), to_location = btrim(p_to_location),
           distance_km = p_distance_km, rate_per_km = p_rate_per_km, driver_payment = p_driver_payment,
           trip_date = p_trip_date, status = p_status, notes = nullif(btrim(p_notes), '')
     where id = p_id
    returning id into v_id;
  end if;

  perform public.sync_trip_ledger(v_id);
  return v_id;
end $$;
