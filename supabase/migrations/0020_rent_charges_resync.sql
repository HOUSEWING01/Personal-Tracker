-- Fixes stale rent months. When a tenant's joining date is edited (e.g. 3 Aug -> 14 Aug), the months built from the OLD
-- date stayed behind and were still counted as rent due. ensure_rent_charges now also removes UNPAID months that are no
-- longer on the tenant's current schedule. Months that have a payment are never touched.
create or replace function public.ensure_rent_charges(p_property_id uuid default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_added integer;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;

  create temporary table if not exists _rent_schedule (property_id uuid, period date, rent numeric) on commit drop;
  truncate _rent_schedule;
  insert into _rent_schedule
  select p.id, (t.rental_start_date + (k * interval '1 month'))::date, p.monthly_rent
  from public.properties p
  join public.tenants t on t.property_id = p.id
  cross join lateral generate_series(0, 599) as k
  where p.status = 'active' and (p_property_id is null or p.id = p_property_id)
    and (t.rental_end_date is null or (t.rental_start_date + (k * interval '1 month'))::date <= t.rental_end_date)
    and (
      (t.rental_start_date + ((k + 1) * interval '1 month'))::date <= v_today
      or (t.rental_end_date is not null and t.rental_end_date <= v_today)
    );

  -- drop unpaid months that are not on the current schedule
  delete from public.rent_charges c
   where (p_property_id is null or c.property_id = p_property_id)
     and exists (select 1 from public.tenants t where t.property_id = c.property_id)
     and not exists (select 1 from _rent_schedule s where s.property_id = c.property_id and s.period = c.period)
     and not exists (select 1 from public.rent_payments r where r.property_id = c.property_id and r.period = c.period);

  insert into public.rent_charges (property_id, period, expected_amount)
  select property_id, period, rent from _rent_schedule
  on conflict (property_id, period) do nothing;
  get diagnostics v_added = row_count;
  return v_added;
end $$;
revoke all on function public.ensure_rent_charges(uuid) from public, anon;
grant execute on function public.ensure_rent_charges(uuid) to authenticated;
