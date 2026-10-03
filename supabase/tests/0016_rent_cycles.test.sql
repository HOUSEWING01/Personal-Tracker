-- Requires 00_supabase_stub.sql + migrations 0001..0016 on a FRESH scratch DB. Self-checking: ends with
-- "RENT CYCLE SQL CHECKS PASSED" or raises. Rent is billed per tenancy month counted from the joining day and falls due
-- when that month ends (D-033). Dates are relative to today (IST), so the test can run on any day.
\set ON_ERROR_STOP on
create function public.t_fails(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;
create table public.t_results (label text, ok boolean);
create function public.t_check(p_label text, p_ok boolean) returns void language sql as $$
  insert into public.t_results values (p_label, coalesce(p_ok, false)) $$;
grant all on public.t_results to anon, authenticated;
grant execute on function public.t_fails(text), public.t_check(text, boolean) to anon, authenticated;

insert into auth.users values ('00000000-0000-0000-0000-0000000000aa','admin@x.com'),('00000000-0000-0000-0000-0000000000bb','other@x.com');
insert into public.admin_users values ('00000000-0000-0000-0000-0000000000aa');

create function public.t_tenant(p_name text, p_start date, p_end date default null) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.properties (name, monthly_rent) values (p_name, 4000) returning id into v;
  insert into public.tenants (property_id, name, rental_start_date, rental_end_date) values (v, p_name, p_start, p_end);
  return v;
end $$;

grant execute on function public.t_tenant(text, date, date) to authenticated;

set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-0000000000aa';


do $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_p uuid; v_pay uuid; v_start date;
begin
  -- joined exactly one month ago: the first month is complete today, so its rent is due today
  v_start := (v_today - interval '1 month')::date;
  v_p := t_tenant('Due today', v_start);
  perform t_check('joined one month ago: exactly 1 charge', public.ensure_rent_charges(v_p) = 1);
  perform t_check('the charge period is the joining day, not the 1st of a month', (select period from public.rent_charges where property_id = v_p) = v_start);
  perform t_check('only one month (4000) is owed, not two calendar months', (select sum(expected_amount) from public.rent_charges where property_id = v_p) = 4000);
  perform t_check('ensure_rent_charges is idempotent', public.ensure_rent_charges(v_p) = 0);

  v_pay := public.record_rent_payment(v_p, v_start, 4000, v_today, 'cash', null);
  perform t_check('ledger description names the day the month starts',
    (select description from public.transactions where entity_id = v_pay) = 'Rent - Due today - month from ' || to_char(v_start, 'DD Mon YYYY'));
  perform t_check('overpaying the month is rejected', t_fails(format($q$select public.record_rent_payment(%L, %L, 1, %L)$q$, v_p, v_start, v_today)));

  -- the first month ends tomorrow: nothing is due yet
  v_p := t_tenant('Due tomorrow', (v_today - interval '1 month' + interval '1 day')::date);
  perform t_check('first month not complete yet: no charge', public.ensure_rent_charges(v_p) = 0);

  -- two complete months, and a third not yet complete
  v_p := t_tenant('Two months', (v_today - interval '2 months' - interval '1 day')::date);
  perform t_check('two complete months: 2 charges', public.ensure_rent_charges(v_p) = 2);

  -- joined on the 31st: month starts are counted from the original day (28/29 Feb, then 31 Mar), never drifting to the 28th
  v_p := t_tenant('Month end', date '2020-01-31');
  perform public.ensure_rent_charges(v_p);
  perform t_check('31 Jan start: second month starts on 29 Feb', exists (select 1 from public.rent_charges where property_id = v_p and period = date '2020-02-29'));
  perform t_check('31 Jan start: third month starts on 31 Mar', exists (select 1 from public.rent_charges where property_id = v_p and period = date '2020-03-31'));
  perform t_check('31 Jan start: no charge on the 28th/29th of March', not exists (select 1 from public.rent_charges where property_id = v_p and period in (date '2020-03-28', date '2020-03-29')));

  -- tenant has left: months starting up to the leaving date are billed, the last one in full, and none after
  v_p := t_tenant('Left', (v_today - interval '40 days')::date, (v_today - interval '5 days')::date);
  perform t_check('left 5 days ago after 40 days: 2 charges (the month they left in is billed)', public.ensure_rent_charges(v_p) = 2);
  perform t_check('no charge starts after the leaving date', not exists (select 1 from public.rent_charges where property_id = v_p and period > (v_today - interval '5 days')::date));

  -- a leaving date in the future does not bill early
  v_p := t_tenant('Leaving soon', (v_today - interval '10 days')::date, (v_today + interval '20 days')::date);
  perform t_check('future leaving date: nothing billed before the month ends', public.ensure_rent_charges(v_p) = 0);

  -- inactive godowns are skipped
  v_p := t_tenant('Inactive', (v_today - interval '3 months')::date);
  update public.properties set status = 'inactive' where id = v_p;
  perform t_check('inactive property: no charges', public.ensure_rent_charges(v_p) = 0);

  perform t_check('direct insert into rent_charges is still denied', t_fails(format($q$insert into public.rent_charges (property_id, period, expected_amount) values (%L, '2000-01-03', 1)$q$, v_p)));
end $$;

reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-0000000000bb';
select t_check('non-admin: ensure_rent_charges refused', t_fails('select public.ensure_rent_charges()'));
reset role; set role anon;
select t_check('anon: ensure_rent_charges refused', t_fails('select public.ensure_rent_charges()'));
reset role;

select label, case when ok then 'PASS' else 'FAIL' end as result from public.t_results order by ok, label;
do $$ begin
  if exists (select 1 from public.t_results where not ok) then raise exception 'SQL tests FAILED'; end if;
  raise notice 'RENT CYCLE SQL CHECKS PASSED (%)', (select count(*) from public.t_results);
end $$;
