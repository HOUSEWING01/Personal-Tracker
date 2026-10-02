-- 0002_transaction_totals.sql
-- Server-side totals per transaction type. SECURITY INVOKER (default) so RLS still applies:
-- a non-admin gets zero rows. Formulas (revenue, profit, cash flow) live ONLY in
-- src/features/finance/financeEngine.ts and are computed from these per-type totals.
create or replace function public.transaction_totals(
  p_from   date default null,
  p_to     date default null,
  p_module public.business_module default null
)
returns table (type public.transaction_type, total numeric)
language sql stable
as $$
  select t.type, sum(t.amount)
  from public.transactions t
  where (p_from is null or t.transaction_date >= p_from)
    and (p_to   is null or t.transaction_date <= p_to)
    and (p_module is null or t.module = p_module)
  group by t.type
$$;
revoke all on function public.transaction_totals(date, date, public.business_module) from public, anon;
grant execute on function public.transaction_totals(date, date, public.business_module) to authenticated;
