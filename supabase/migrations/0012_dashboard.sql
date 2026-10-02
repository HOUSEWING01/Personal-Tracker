-- 0012_dashboard.sql  (Phase 8)
-- One read-only function for the Dashboard: RAW counts and sums only (D-026). SECURITY INVOKER, so RLS applies
-- (a non-admin gets zeros). Every formula (occupancy, outstanding, profit, interest) stays in the app engines.
--   p_today       IST business date
--   p_month_from  first day of the current IST month, p_month_to its last day
create or replace function public.dashboard_counts(p_today date, p_month_from date, p_month_to date)
returns table (
  active_properties      bigint,
  occupied_properties    bigint,
  rent_outstanding       numeric,   -- sum over rent charges of max(0, expected - paid)
  active_vehicles        bigint,
  trips_this_month       bigint,    -- planned + completed, not cancelled
  sheets_total           bigint,    -- active sizes only
  sheets_rented          bigint,
  sheets_damaged         bigint,
  sheets_missing         bigint,
  sheets_available       bigint,
  overdue_rentals        bigint,    -- active rentals past the expected return date
  sheet_outstanding      numeric    -- sum over non-cancelled rentals of max(0, rent - discount - paid)
)
language sql stable security invoker set search_path = public as $$
  select
    (select count(*) from public.properties where status = 'active'),
    (select count(*) from public.property_overview o
      where o.status = 'active' and o.tenant_name is not null and (o.rental_end_date is null or o.rental_end_date >= p_today)),
    (select coalesce(sum(greatest(0, c.expected_amount - c.paid_amount)), 0) from public.rent_charge_status c),
    (select count(*) from public.vehicles where status = 'active'),
    (select count(*) from public.trips where status <> 'cancelled' and trip_date between p_month_from and p_month_to),
    (select coalesce(sum(s.total_quantity), 0) from public.sheet_variant_stock s join public.sheet_variants v on v.id = s.variant_id where v.status = 'active'),
    (select coalesce(sum(s.rented_quantity), 0) from public.sheet_variant_stock s join public.sheet_variants v on v.id = s.variant_id where v.status = 'active'),
    (select coalesce(sum(s.damaged_quantity), 0) from public.sheet_variant_stock s join public.sheet_variants v on v.id = s.variant_id where v.status = 'active'),
    (select coalesce(sum(s.missing_quantity), 0) from public.sheet_variant_stock s join public.sheet_variants v on v.id = s.variant_id where v.status = 'active'),
    (select coalesce(sum(s.available_quantity), 0) from public.sheet_variant_stock s join public.sheet_variants v on v.id = s.variant_id where v.status = 'active'),
    (select count(*) from public.sheet_rentals r join public.sheet_rental_totals t on t.rental_id = r.id
      where r.status = 'active' and r.expected_return_date is not null and r.expected_return_date < p_today
        and r.quantity - t.returned_total - t.damaged_total - t.missing_total > 0),
    (select coalesce(sum(greatest(0, r.rent_amount - r.discount - t.paid_total)), 0)
       from public.sheet_rentals r join public.sheet_rental_totals t on t.rental_id = r.id where r.status <> 'cancelled');
$$;
revoke all on function public.dashboard_counts(date, date, date) from public, anon;
grant execute on function public.dashboard_counts(date, date, date) to authenticated;
