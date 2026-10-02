-- 0009_transport_profit.sql  (Phase 5e)
-- Raw per-vehicle sums for the Transport > Profit tab (DECISIONS D-021). Cash basis, read from the ledger so the
-- figures always agree with Finance. Profit itself is computed in transportEngine.ts, never here.
-- One row per vehicle with activity in the period, plus one row with vehicle_id NULL for repayments of loans that are
-- not linked to a vehicle. SECURITY INVOKER: RLS applies, so a non-admin gets no rows.
create or replace function public.vehicle_profit_totals(p_from date default null, p_to date default null)
returns table (vehicle_id uuid, revenue numeric, driver numeric, fuel numeric, toll numeric, loan_repaid numeric)
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
    select l.vehicle_id, t.amount, t.transaction_date, 'loan'
      from public.transactions t
      join public.loan_payments p on p.id = t.entity_id
      join public.vehicle_loans l on l.id = p.loan_id
     where t.entity_type = 'loan_payment'
  )
  select pt.vehicle_id,
         coalesce(sum(pt.amount) filter (where pt.part = 'revenue'), 0),
         coalesce(sum(pt.amount) filter (where pt.part = 'driver'),  0),
         coalesce(sum(pt.amount) filter (where pt.part = 'fuel'),    0),
         coalesce(sum(pt.amount) filter (where pt.part = 'toll'),    0),
         coalesce(sum(pt.amount) filter (where pt.part = 'loan'),    0)
    from parts pt
   where (p_from is null or pt.d >= p_from) and (p_to is null or pt.d <= p_to)
   group by pt.vehicle_id
$$;
revoke all on function public.vehicle_profit_totals(date, date) from public, anon;
grant execute on function public.vehicle_profit_totals(date, date) to authenticated;
