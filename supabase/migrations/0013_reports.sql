-- 0013_reports.sql  (Phase 9)
-- Read-only support for the Reports page (DECISIONS D-027). Raw sums only: every formula (revenue, profit, cash flow)
-- stays in src/features/finance/financeEngine.ts. SECURITY INVOKER everywhere, so RLS applies and a non-admin gets nothing.

-- Which vehicle / property / customer a ledger row belongs to, derived from entity_type + entity_id (see 0005-0011).
-- Rows with no such link (general entries, gold loans) have NULLs, so an entity filter excludes them.
create or replace view public.ledger_links with (security_invoker = true) as
select
  t.id as transaction_id,
  coalesce(tr.vehicle_id, fl.vehicle_id, tl.vehicle_id, vl.vehicle_id, vl2.vehicle_id, v.id) as vehicle_id,
  rp.property_id                                                                            as property_id,
  coalesce(tr.customer_id, sr.customer_id)                                                   as customer_id
from public.transactions t
left join public.trips tr               on t.entity_type in ('trip_revenue', 'trip_driver') and tr.id = t.entity_id
left join public.fuel_logs fl           on t.entity_type = 'fuel_log' and fl.id = t.entity_id
left join public.tolls tl               on t.entity_type = 'toll' and tl.id = t.entity_id
left join public.vehicle_loans vl       on t.entity_type = 'vehicle_loan' and vl.id = t.entity_id
left join public.loan_payments lpay     on t.entity_type = 'loan_payment' and lpay.id = t.entity_id
left join public.vehicle_loans vl2      on vl2.id = lpay.loan_id
left join public.vehicles v             on t.entity_type in ('vehicle_purchase', 'vehicle_container') and v.id = t.entity_id
left join public.rent_payments rp       on t.entity_type = 'rent_payment' and rp.id = t.entity_id
left join public.sheet_rental_payments sp on t.entity_type = 'sheet_payment' and sp.id = t.entity_id
left join public.sheet_rentals sr       on sr.id = sp.rental_id;

-- Per-type totals, optionally grouped by calendar month (IST business date) or by module, with the entity filters.
--   p_group: 'total' (one bucket 'all'), 'month' (bucket 'YYYY-MM') or 'module' (bucket = module name)
create or replace function public.report_breakdown(
  p_group    text,
  p_from     date default null,
  p_to       date default null,
  p_module   public.business_module default null,
  p_vehicle  uuid default null,
  p_property uuid default null,
  p_customer uuid default null
)
returns table (bucket text, type public.transaction_type, total numeric)
language sql stable security invoker set search_path = public as $$
  select
    case p_group
      when 'month'  then to_char(t.transaction_date, 'YYYY-MM')
      when 'module' then t.module::text
      else 'all'
    end as bucket,
    t.type,
    sum(t.amount)
  from public.transactions t
  left join public.ledger_links l on l.transaction_id = t.id
  where (p_from is null or t.transaction_date >= p_from)
    and (p_to   is null or t.transaction_date <= p_to)
    and (p_module   is null or t.module = p_module)
    and (p_vehicle  is null or l.vehicle_id  = p_vehicle)
    and (p_property is null or l.property_id = p_property)
    and (p_customer is null or l.customer_id = p_customer)
  group by 1, 2
$$;
revoke all on function public.report_breakdown(text, date, date, public.business_module, uuid, uuid, uuid) from public, anon;
grant execute on function public.report_breakdown(text, date, date, public.business_module, uuid, uuid, uuid) to authenticated;

-- Money still to collect (as of now), for rent charges whose month falls in the range and sheet rentals dated in the range.
-- Payments count whenever they were made. Property rent has no customer and sheet rent has no property or vehicle, so an
-- entity filter that cannot apply to a source excludes that source. Module 'property' / 'sheets' keeps only that source;
-- any other module gives zero.
create or replace function public.report_outstanding(
  p_from     date default null,
  p_to       date default null,
  p_module   public.business_module default null,
  p_vehicle  uuid default null,
  p_property uuid default null,
  p_customer uuid default null
)
returns table (rent_outstanding numeric, sheet_outstanding numeric)
language sql stable security invoker set search_path = public as $$
  select
    case when p_vehicle is null and p_customer is null and (p_module is null or p_module = 'property') then
      (select coalesce(sum(greatest(0, c.expected_amount - c.paid_amount)), 0)
         from public.rent_charge_status c
        where (p_from is null or c.period >= date_trunc('month', p_from)::date)
          and (p_to   is null or c.period <= p_to)
          and (p_property is null or c.property_id = p_property))
    else 0 end,
    case when p_vehicle is null and p_property is null and (p_module is null or p_module = 'sheets') then
      (select coalesce(sum(greatest(0, r.rent_amount - r.discount - t.paid_total)), 0)
         from public.sheet_rentals r join public.sheet_rental_totals t on t.rental_id = r.id
        where r.status <> 'cancelled'
          and (p_from is null or r.rental_date >= p_from)
          and (p_to   is null or r.rental_date <= p_to)
          and (p_customer is null or r.customer_id = p_customer))
    else 0 end
$$;
revoke all on function public.report_outstanding(date, date, public.business_module, uuid, uuid, uuid) from public, anon;
grant execute on function public.report_outstanding(date, date, public.business_module, uuid, uuid, uuid) to authenticated;
