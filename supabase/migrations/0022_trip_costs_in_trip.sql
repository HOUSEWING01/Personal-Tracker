-- 0022_trip_costs_in_trip.sql  (run after 0021)
-- Fuel and toll are now entered inside the trip itself (one fuel entry and one toll amount per trip), so the separate
-- Fuel and Tolls screens are gone. save_trip now also writes the trip's fuel log, toll and their ledger entries in the
-- same database transaction. The tables, ledger rows, trip_cost_totals and the profit views are unchanged.
--   p_fuel_litres / p_fuel_price : null = leave the trip's fuel as it is; 0 (or blank) = no fuel; both > 0 = save fuel.
--   p_toll_amount                : null = leave the toll as it is; 0 = no toll; > 0 = save toll.
-- Fuel and toll use the trip date and the trip's vehicle. A trip that already has SEVERAL fuel (or toll) entries from
-- before is never rewritten: the app passes null for it.
-- This also restores the vehicle-change handling lost in 0021: changing a trip's vehicle moves its fuel and toll to the new one.

drop function if exists public.save_trip(uuid, uuid, uuid, text, text, numeric, numeric, numeric, date, text, text, uuid);
drop function if exists public.save_trip(uuid, uuid, uuid, text, text, numeric, numeric, numeric, date, text, text, uuid, numeric, numeric);

create or replace function public.save_trip(
  p_vehicle_id uuid, p_driver_id uuid, p_customer_id uuid,
  p_from_location text, p_to_location text, p_distance_km numeric, p_rate_per_km numeric,
  p_driver_payment numeric, p_trip_date date, p_status text, p_notes text,
  p_id uuid default null,
  p_odometer_start numeric default null, p_odometer_end numeric default null,
  p_fuel_litres numeric default null, p_fuel_price numeric default null, p_toll_amount numeric default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id       uuid;
  old        public.trips%rowtype;
  v_status   text;
  v_distance numeric;
  veh        public.vehicles%rowtype;
  v_n        integer;
  v_cost_id  uuid;
  v_total    numeric;
  v_tx       uuid;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_trip_date is null then raise exception 'trip date is required'; end if;
  if p_rate_per_km is null or p_rate_per_km <= 0 then raise exception 'rate per km must be greater than zero'; end if;
  if p_driver_payment is null or p_driver_payment < 0 then raise exception 'driver payment cannot be negative'; end if;

  if p_odometer_end is not null and p_odometer_start is null then raise exception 'starting odometer is required'; end if;
  if p_odometer_start is not null and p_odometer_end is not null then
    if p_odometer_end <= p_odometer_start then raise exception 'ending odometer must be more than the starting odometer'; end if;
    v_distance := p_odometer_end - p_odometer_start;
  else
    v_distance := coalesce(p_distance_km, 0);
  end if;
  if v_distance < 0 then raise exception 'distance cannot be negative'; end if;
  if p_status = 'completed' and v_distance <= 0 then raise exception 'ending odometer is required to complete a trip'; end if;
  if coalesce(p_fuel_litres, 0) < 0 or coalesce(p_fuel_price, 0) < 0 or coalesce(p_toll_amount, 0) < 0 then
    raise exception 'fuel and toll cannot be negative';
  end if;

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
    if old.vehicle_id is distinct from p_vehicle_id then
      update public.fuel_logs set vehicle_id = p_vehicle_id where trip_id = v_id;
      update public.tolls     set vehicle_id = p_vehicle_id where trip_id = v_id;
    end if;
  end if;

  perform public.sync_trip_ledger(v_id);
  select * into veh from public.vehicles where id = p_vehicle_id;

  -- ---------- fuel (one entry per trip) ----------
  if p_fuel_litres is not null then
    if p_fuel_litres = 0 then
      delete from public.transactions where entity_type = 'fuel_log' and entity_id in (select id from public.fuel_logs where trip_id = v_id);
      delete from public.fuel_logs where trip_id = v_id;
    else
      if p_fuel_price is null or p_fuel_price <= 0 then raise exception 'price per litre must be greater than zero'; end if;
      select count(*) into v_n from public.fuel_logs where trip_id = v_id;
      if v_n > 1 then raise exception 'trip has several fuel entries'; end if;
      if v_n = 0 then
        insert into public.fuel_logs (vehicle_id, trip_id, fuel_date, litres, price_per_litre)
        values (p_vehicle_id, v_id, p_trip_date, p_fuel_litres, p_fuel_price) returning id, total into v_cost_id, v_total;
      else
        update public.fuel_logs set vehicle_id = p_vehicle_id, fuel_date = p_trip_date, litres = p_fuel_litres, price_per_litre = p_fuel_price
         where trip_id = v_id returning id, total into v_cost_id, v_total;
      end if;
      select id into v_tx from public.transactions where entity_type = 'fuel_log' and entity_id = v_cost_id;
      if v_tx is null then
        insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, description)
        values ('expense', v_total, 'transport', 'fuel_log', v_cost_id, p_trip_date, 'Fuel - ' || veh.name || ' (' || veh.registration_number || ')');
      else
        update public.transactions set amount = v_total, transaction_date = p_trip_date,
               description = 'Fuel - ' || veh.name || ' (' || veh.registration_number || ')' where id = v_tx;
      end if;
    end if;
  end if;

  -- ---------- toll (one amount per trip) ----------
  if p_toll_amount is not null then
    if p_toll_amount = 0 then
      delete from public.transactions where entity_type = 'toll' and entity_id in (select id from public.tolls where trip_id = v_id);
      delete from public.tolls where trip_id = v_id;
    else
      select count(*) into v_n from public.tolls where trip_id = v_id;
      if v_n > 1 then raise exception 'trip has several toll entries'; end if;
      if v_n = 0 then
        insert into public.tolls (trip_id, vehicle_id, toll_date, amount) values (v_id, p_vehicle_id, p_trip_date, p_toll_amount) returning id into v_cost_id;
      else
        update public.tolls set vehicle_id = p_vehicle_id, toll_date = p_trip_date, amount = p_toll_amount
         where trip_id = v_id returning id into v_cost_id;
      end if;
      select id into v_tx from public.transactions where entity_type = 'toll' and entity_id = v_cost_id;
      if v_tx is null then
        insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, description)
        values ('expense', p_toll_amount, 'transport', 'toll', v_cost_id, p_trip_date, 'Toll - ' || veh.name || ' (' || veh.registration_number || ')');
      else
        update public.transactions set amount = p_toll_amount, transaction_date = p_trip_date,
               description = 'Toll - ' || veh.name || ' (' || veh.registration_number || ')' where id = v_tx;
      end if;
    end if;
  end if;

  return v_id;
end $$;
revoke all on function public.save_trip(uuid, uuid, uuid, text, text, numeric, numeric, numeric, date, text, text, uuid, numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.save_trip(uuid, uuid, uuid, text, text, numeric, numeric, numeric, date, text, text, uuid, numeric, numeric, numeric, numeric, numeric) to authenticated;
