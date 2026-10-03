-- 0021_trip_odometer.sql
-- 1. Trips record the odometer at the start and at the end. Distance = end - start (worked out in save_trip).
--    The end reading is filled in when the vehicle reaches the destination, so a trip can be saved with the start reading
--    only (distance 0 until then). A COMPLETED trip must have a distance above zero.
-- 2. A vehicle can have only one trip "in progress" (status planned) at a time. Complete or cancel it before the next trip.
-- Old trips without odometer readings keep their stored distance.

alter table public.trips add column if not exists odometer_start numeric(12, 2) check (odometer_start is null or odometer_start >= 0);
alter table public.trips add column if not exists odometer_end   numeric(12, 2) check (odometer_end is null or odometer_end >= 0);
alter table public.trips drop constraint if exists trips_distance_km_check;
alter table public.trips add constraint trips_distance_km_check check (distance_km >= 0);
alter table public.trips add constraint trips_odometer_order check (odometer_end is null or odometer_start is null or odometer_end > odometer_start);

drop function if exists public.save_trip(uuid, uuid, uuid, text, text, numeric, numeric, numeric, date, text, text, uuid);

create or replace function public.save_trip(
  p_vehicle_id uuid, p_driver_id uuid, p_customer_id uuid,
  p_from_location text, p_to_location text, p_distance_km numeric, p_rate_per_km numeric,
  p_driver_payment numeric, p_trip_date date, p_status text, p_notes text,
  p_id uuid default null,
  p_odometer_start numeric default null, p_odometer_end numeric default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id       uuid;
  old        public.trips%rowtype;
  v_status   text;
  v_distance numeric;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_trip_date is null then raise exception 'trip date is required'; end if;
  if p_rate_per_km is null or p_rate_per_km <= 0 then raise exception 'rate per km must be greater than zero'; end if;
  if p_driver_payment is null or p_driver_payment < 0 then raise exception 'driver payment cannot be negative'; end if;

  -- distance comes from the odometer when both readings are given
  if p_odometer_end is not null and p_odometer_start is null then raise exception 'starting odometer is required'; end if;
  if p_odometer_start is not null and p_odometer_end is not null then
    if p_odometer_end <= p_odometer_start then raise exception 'ending odometer must be more than the starting odometer'; end if;
    v_distance := p_odometer_end - p_odometer_start;
  else
    v_distance := coalesce(p_distance_km, 0);
  end if;
  if v_distance < 0 then raise exception 'distance cannot be negative'; end if;
  if p_status = 'completed' and v_distance <= 0 then raise exception 'ending odometer is required to complete a trip'; end if;

  if p_id is not null then
    select * into old from public.trips where id = p_id for update;
    if not found then raise exception 'trip not found'; end if;
  end if;

  if p_id is null or old.vehicle_id is distinct from p_vehicle_id then
    select status into v_status from public.vehicles where id = p_vehicle_id;
    if v_status is null then raise exception 'vehicle not found'; end if;
    if v_status <> 'active' then raise exception 'vehicle is not active'; end if;
  end if;
  if p_status = 'planned' and exists (
    select 1 from public.trips t where t.vehicle_id = p_vehicle_id and t.status = 'planned' and t.id is distinct from p_id
  ) then
    raise exception 'this vehicle already has a trip in progress';
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
                              rate_per_km, driver_payment, trip_date, status, notes, odometer_start, odometer_end)
    values (p_vehicle_id, p_driver_id, p_customer_id, btrim(p_from_location), btrim(p_to_location), v_distance,
            p_rate_per_km, p_driver_payment, p_trip_date, p_status, nullif(btrim(p_notes), ''), p_odometer_start, p_odometer_end)
    returning id into v_id;
  else
    update public.trips
       set vehicle_id = p_vehicle_id, driver_id = p_driver_id, customer_id = p_customer_id,
           from_location = btrim(p_from_location), to_location = btrim(p_to_location),
           distance_km = v_distance, rate_per_km = p_rate_per_km, driver_payment = p_driver_payment,
           trip_date = p_trip_date, status = p_status, notes = nullif(btrim(p_notes), ''),
           odometer_start = p_odometer_start, odometer_end = p_odometer_end
     where id = p_id
    returning id into v_id;
  end if;

  perform public.sync_trip_ledger(v_id);
  return v_id;
end $$;
revoke all on function public.save_trip(uuid, uuid, uuid, text, text, numeric, numeric, numeric, date, text, text, uuid, numeric, numeric) from public, anon;
grant execute on function public.save_trip(uuid, uuid, uuid, text, text, numeric, numeric, numeric, date, text, text, uuid, numeric, numeric) to authenticated;
