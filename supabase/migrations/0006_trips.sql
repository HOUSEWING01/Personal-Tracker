-- 0006_trips.sql  (Phase 5b)
-- Trips: vehicle + driver + customer, from/to, distance x rate per KM = revenue, driver payment per trip.
-- Revenue is DERIVED (round(distance_km * rate_per_km, 2)), never stored, so it cannot drift from its parts.
-- A COMPLETED trip posts to the ledger (DECISIONS D-018):
--   revenue        -> type 'income',  module 'transport', entity_type 'trip_revenue', entity_id = trip id
--   driver payment -> type 'expense', module 'transport', entity_type 'trip_driver',  entity_id = trip id
-- Both use the trip date. Planned and cancelled trips post nothing. Editing a completed trip updates its
-- entries; moving it away from completed removes them; a zero driver payment posts no expense.
-- Trips are written ONLY through save_trip() (same model as D-014 / D-016); the browser can read them.

create table public.trips (
  id             uuid primary key default gen_random_uuid(),
  vehicle_id     uuid not null references public.vehicles (id) on delete restrict,
  driver_id      uuid not null references public.drivers (id) on delete restrict,
  customer_id    uuid not null references public.customers (id) on delete restrict,
  from_location  text not null check (length(btrim(from_location)) > 0),
  to_location    text not null check (length(btrim(to_location)) > 0),
  distance_km    numeric(10, 2) not null check (distance_km > 0),
  rate_per_km    numeric(12, 2) not null check (rate_per_km > 0),
  driver_payment numeric(14, 2) not null default 0 check (driver_payment >= 0),
  trip_date      date not null,
  status         text not null default 'planned' check (status in ('planned', 'completed', 'cancelled')),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index trips_date_idx     on public.trips (trip_date desc, created_at desc);
create index trips_vehicle_idx  on public.trips (vehicle_id);
create index trips_driver_idx   on public.trips (driver_id);
create index trips_customer_idx on public.trips (customer_id);
create index trips_status_idx   on public.trips (status);
create trigger trips_set_updated_at before update on public.trips
  for each row execute function public.set_updated_at();

alter table public.trips enable row level security;
create policy trips_admin_read on public.trips
  for select to authenticated using (public.is_admin());
revoke all on public.trips from anon;

-- At most one ledger entry per trip part.
create unique index transactions_trip_key
  on public.transactions (entity_type, entity_id)
  where entity_type in ('trip_revenue', 'trip_driver');

-- ---------- internal: make the ledger match the trip ----------
-- Not callable from the browser (execute revoked below); only save_trip uses it.
create or replace function public.sync_trip_ledger(p_trip_id uuid)
returns void
language plpgsql set search_path = public as $$
declare
  t         public.trips%rowtype;
  veh_label text;
  part      record;
  v_tx      uuid;
begin
  select * into t from public.trips where id = p_trip_id;
  if not found then raise exception 'trip not found'; end if;

  select v.name || ' (' || v.registration_number || ')' into veh_label from public.vehicles v where v.id = t.vehicle_id;

  for part in
    select * from (values
      ('trip_revenue', 'income'::public.transaction_type,  round(t.distance_km * t.rate_per_km, 2), 'Trip revenue'),
      ('trip_driver',  'expense'::public.transaction_type, t.driver_payment,                          'Trip driver payment')
    ) as x(kind, ttype, amt, label)
  loop
    select id into v_tx from public.transactions where entity_type = part.kind and entity_id = t.id;

    if t.status = 'completed' and part.amt > 0 then
      if v_tx is null then
        insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, description)
        values (part.ttype, part.amt, 'transport', part.kind, t.id, t.trip_date,
                part.label || ' - ' || t.from_location || ' to ' || t.to_location || ' - ' || veh_label);
      else
        update public.transactions
           set amount = part.amt, transaction_date = t.trip_date,
               description = part.label || ' - ' || t.from_location || ' to ' || t.to_location || ' - ' || veh_label
         where id = v_tx;
      end if;
    elsif v_tx is not null then
      delete from public.transactions where id = v_tx;
    end if;
  end loop;
end $$;
revoke all on function public.sync_trip_ledger(uuid) from public, anon, authenticated;

-- ---------- save_trip: the only way the app writes trips ----------
-- p_id null = create, otherwise edit. Returns the trip id.
-- A NEW trip needs an active vehicle and driver; on edit this is checked only if the vehicle/driver is changed,
-- so an old trip stays editable after its vehicle or driver is made inactive.
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
revoke all on function public.save_trip(uuid, uuid, uuid, text, text, numeric, numeric, numeric, date, text, text, uuid) from public, anon;
grant execute on function public.save_trip(uuid, uuid, uuid, text, text, numeric, numeric, numeric, date, text, text, uuid) to authenticated;
