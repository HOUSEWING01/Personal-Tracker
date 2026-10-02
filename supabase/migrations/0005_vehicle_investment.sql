-- 0005_vehicle_investment.sql  (Phase 5a-2)
-- Vehicle purchase price and container price become `investment` entries in the ledger
-- (DECISIONS D-016, resolved by the admin). Vehicles are now written ONLY through save_vehicle(),
-- which saves the vehicle and keeps its ledger entries in step in ONE transaction (same model as D-014).
--
-- Ledger entries: type 'investment', module 'transport',
--   entity_type 'vehicle_purchase'  / entity_id = vehicle id  -> the purchase price
--   entity_type 'vehicle_container' / entity_id = vehicle id  -> the container price
-- Both use the vehicle's purchase date. Editing a price UPDATES its entry; setting a price to zero
-- removes its entry; setting it above zero again adds one.

-- ---------- purchase date is now required ----------
-- Rows saved before this migration without a date get the day they were created (IST) so the
-- constraint can be added. Check those dates in the app if you entered vehicles earlier.
update public.vehicles
   set purchase_date = (created_at at time zone 'Asia/Kolkata')::date
 where purchase_date is null;
alter table public.vehicles alter column purchase_date set not null;

-- At most one ledger entry per vehicle part.
create unique index transactions_vehicle_investment_key
  on public.transactions (entity_type, entity_id)
  where entity_type in ('vehicle_purchase', 'vehicle_container');

-- ---------- internal: make the ledger match the vehicle ----------
-- Not callable from the browser (execute revoked below); only save_vehicle and this migration use it.
create or replace function public.sync_vehicle_investments(p_vehicle_id uuid)
returns void
language plpgsql set search_path = public as $$
declare
  v    public.vehicles%rowtype;
  part record;
  v_tx uuid;
begin
  select * into v from public.vehicles where id = p_vehicle_id;
  if not found then raise exception 'vehicle not found'; end if;

  for part in
    select * from (values
      ('vehicle_purchase',  v.purchase_price,  'Vehicle purchase'),
      ('vehicle_container', v.container_price, 'Vehicle container')
    ) as t(kind, amt, label)
  loop
    select id into v_tx from public.transactions
      where entity_type = part.kind and entity_id = v.id;

    if part.amt > 0 then
      if v_tx is null then
        insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, description)
        values ('investment', part.amt, 'transport', part.kind, v.id, v.purchase_date,
                part.label || ' - ' || v.name || ' (' || v.registration_number || ')');
      else
        update public.transactions
           set amount = part.amt,
               transaction_date = v.purchase_date,
               description = part.label || ' - ' || v.name || ' (' || v.registration_number || ')'
         where id = v_tx;
      end if;
    elsif v_tx is not null then
      delete from public.transactions where id = v_tx;
    end if;
  end loop;
end $$;
revoke all on function public.sync_vehicle_investments(uuid) from public, anon, authenticated;

-- ---------- save_vehicle: the only way the app writes vehicles ----------
-- p_id null = create, otherwise edit. Returns the vehicle id.
create or replace function public.save_vehicle(
  p_name text, p_registration_number text, p_purchase_price numeric, p_purchase_date date,
  p_container_price numeric, p_container_details text, p_status text, p_notes text,
  p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_purchase_date is null then raise exception 'purchase date is required'; end if;
  if p_purchase_price is null or p_purchase_price < 0 then raise exception 'purchase price cannot be negative'; end if;
  if p_container_price is null or p_container_price < 0 then raise exception 'container price cannot be negative'; end if;

  if p_id is null then
    insert into public.vehicles (name, registration_number, purchase_price, purchase_date,
                                 container_price, container_details, status, notes)
    values (btrim(p_name), btrim(p_registration_number), p_purchase_price, p_purchase_date,
            p_container_price, nullif(btrim(p_container_details), ''), p_status, nullif(btrim(p_notes), ''))
    returning id into v_id;
  else
    perform 1 from public.vehicles where id = p_id for update;
    if not found then raise exception 'vehicle not found'; end if;
    update public.vehicles
       set name = btrim(p_name), registration_number = btrim(p_registration_number),
           purchase_price = p_purchase_price, purchase_date = p_purchase_date,
           container_price = p_container_price, container_details = nullif(btrim(p_container_details), ''),
           status = p_status, notes = nullif(btrim(p_notes), '')
     where id = p_id
    returning id into v_id;
  end if;

  perform public.sync_vehicle_investments(v_id);
  return v_id;
end $$;
revoke all on function public.save_vehicle(text, text, numeric, date, numeric, text, text, text, uuid) from public, anon;
grant execute on function public.save_vehicle(text, text, numeric, date, numeric, text, text, text, uuid) to authenticated;

-- ---------- browser can read vehicles but not write them ----------
drop policy vehicles_admin_all on public.vehicles;
create policy vehicles_admin_read on public.vehicles
  for select to authenticated using (public.is_admin());

-- ---------- vehicles saved before this migration: create their ledger entries now ----------
select public.sync_vehicle_investments(id) from public.vehicles;
