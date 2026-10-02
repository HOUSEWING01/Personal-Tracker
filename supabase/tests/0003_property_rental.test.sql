-- Requires 00_supabase_stub.sql + migrations 0001, 0002, 0003 on a scratch DB.
-- Self-checking: prints PASS/FAIL per case and raises at the end if anything failed.
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

set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-0000000000aa';

do $$
declare
  v_prop uuid; v_start date := (date_trunc('month', (now() at time zone 'Asia/Kolkata')::date) - interval '2 months')::date;
  v_p1 date := v_start; v_pay uuid; n integer; v_tx record;
begin
  insert into public.properties (name, property_type, monthly_rent) values ('Shop 1', 'shop', 10000) returning id into v_prop;
  perform t_check('duplicate property name (case-insensitive) rejected', t_fails($q$insert into public.properties (name, monthly_rent) values (' shop 1 ', 5)$q$));
  perform t_check('zero monthly rent rejected', t_fails($q$insert into public.properties (name, monthly_rent) values ('Z', 0)$q$));
  insert into public.tenants (property_id, name, mobile, rental_start_date) values (v_prop, 'Ravi', '9876543210', v_start);
  perform t_check('second tenant for same property rejected', t_fails(format($q$insert into public.tenants (property_id, name, rental_start_date) values (%L, 'X', %L)$q$, v_prop, v_start)));
  perform t_check('invalid mobile rejected', t_fails(format($q$update public.tenants set mobile='123' where property_id=%L$q$, v_prop)));
  perform t_check('end date before start rejected', t_fails(format($q$update public.tenants set rental_end_date=%L where property_id=%L$q$, v_start - 1, v_prop)));

  n := public.ensure_rent_charges(v_prop);
  perform t_check('3 monthly charges created (start month .. current month)', n = 3);
  perform t_check('ensure_rent_charges is idempotent', public.ensure_rent_charges(v_prop) = 0);
  update public.properties set monthly_rent = 12000 where id = v_prop;
  perform t_check('rent change does not rewrite old charges', (select expected_amount from public.rent_charges where property_id=v_prop and period=v_p1) = 10000);

  v_pay := public.record_rent_payment(v_prop, v_p1, 6000, v_start + 4, 'upi', 'part');
  select * into v_tx from public.transactions where entity_id = v_pay;
  perform t_check('payment posts ledger entry (customer_payment/property/6000/rent_payment)',
    v_tx.type = 'customer_payment' and v_tx.module = 'property' and v_tx.amount = 6000 and v_tx.entity_type = 'rent_payment');
  perform t_check('payment links to its transaction', (select transaction_id from public.rent_payments where id = v_pay) = v_tx.id);
  perform t_check('charge status shows paid 6000', (select paid_amount from public.rent_charge_status where property_id=v_prop and period=v_p1) = 6000);
  perform t_check('overpayment of the month rejected (4000.01)', t_fails(format($q$select public.record_rent_payment(%L, %L, 4000.01, %L)$q$, v_prop, v_p1, v_start + 5)));
  perform t_check('exact remainder accepted', public.record_rent_payment(v_prop, v_p1, 4000, v_start + 6) is not null);
  perform t_check('any extra payment on a fully paid month rejected', t_fails(format($q$select public.record_rent_payment(%L, %L, 1, %L)$q$, v_prop, v_p1, v_start + 7)));
  perform t_check('zero / negative payment rejected', t_fails(format($q$select public.record_rent_payment(%L, %L, 0, %L)$q$, v_prop, v_p1, v_start)) and t_fails(format($q$select public.record_rent_payment(%L, %L, -5, %L)$q$, v_prop, v_p1, v_start)));
  perform t_check('payment for a month with no charge rejected', t_fails(format($q$select public.record_rent_payment(%L, %L, 10, %L)$q$, v_prop, '2000-01-01'::date, v_start)));
  perform t_check('ledger has exactly 2 rent entries, none from rejected attempts', (select count(*) from public.transactions where entity_type='rent_payment') = 2);

  perform t_check('direct insert into rent_payments denied', t_fails(format($q$insert into public.rent_payments (property_id, period, amount, payment_date, transaction_id) values (%L, %L, 1, %L, gen_random_uuid())$q$, v_prop, v_p1, v_start)));
  perform t_check('direct insert into rent_charges denied', t_fails(format($q$insert into public.rent_charges (property_id, period, expected_amount) values (%L, '2000-01-01', 1)$q$, v_prop)));
  perform t_check('direct insert into advance_movements denied', t_fails(format($q$insert into public.advance_movements (property_id, kind, amount, movement_date) values (%L, 'received', 1, %L)$q$, v_prop, v_start)));

  perform public.record_advance_movement(v_prop, 'received', 50000, v_start);
  perform public.record_advance_movement(v_prop, 'adjusted', 20000, v_start + 40);
  perform t_check('returning more than remaining advance rejected (30000.01)', t_fails(format($q$select public.record_advance_movement(%L, 'returned', 30000.01, %L)$q$, v_prop, v_start)));
  perform public.record_advance_movement(v_prop, 'returned', 30000, v_start + 50);
  perform t_check('adjusting from an exhausted advance rejected', t_fails(format($q$select public.record_advance_movement(%L, 'adjusted', 1, %L)$q$, v_prop, v_start)));
  perform t_check('invalid movement kind rejected', t_fails(format($q$select public.record_advance_movement(%L, 'bonus', 1, %L)$q$, v_prop, v_start)));
  perform t_check('overview sums: expected 30000 paid 10000 adv 50000/20000/30000',
    (select expected_total = 30000 and paid_total = 10000 and advance_received = 50000 and advance_adjusted = 20000 and advance_returned = 30000
       from public.property_overview where id = v_prop));
  perform t_check('overview shows tenant name', (select tenant_name from public.property_overview where id = v_prop) = 'Ravi');

  -- ended tenancy stops generating charges after its end month
  insert into public.properties (name, monthly_rent) values ('Godown 2', 800) returning id into v_prop;
  insert into public.tenants (property_id, name, rental_start_date, rental_end_date) values (v_prop, 'Sita', v_start, v_start + 40);
  perform t_check('ended tenancy: charges only through end month (2)', public.ensure_rent_charges(v_prop) = 2);
  update public.properties set status = 'inactive' where id = v_prop;
  perform t_check('all-properties sync skips inactive properties', public.ensure_rent_charges() = 0);
end $$;

reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-0000000000bb';
select t_check('non-admin: overview empty', (select count(*) from public.property_overview) = 0);
select t_check('non-admin: ensure_rent_charges refused', t_fails('select public.ensure_rent_charges()'));
select t_check('non-admin: record_rent_payment refused', t_fails($q$select public.record_rent_payment(gen_random_uuid(), '2026-01-01', 1, '2026-01-02')$q$));
select t_check('non-admin: record_advance_movement refused', t_fails($q$select public.record_advance_movement(gen_random_uuid(), 'received', 1, '2026-01-02')$q$));
select t_check('non-admin: cannot read properties/tenants', (select count(*) from public.properties) = 0 and (select count(*) from public.tenants) = 0);

reset role; set role anon;
select t_check('anon: property_overview denied', t_fails('select * from public.property_overview'));
select t_check('anon: rent_payments denied', t_fails('select * from public.rent_payments'));
select t_check('anon: functions denied', t_fails('select public.ensure_rent_charges()') and t_fails($q$select public.record_advance_movement(gen_random_uuid(), 'received', 1, '2026-01-02')$q$));

reset role;
select case when ok then 'PASS' else 'FAIL' end as result, label from public.t_results order by ok, label;
do $$ begin
  if exists (select 1 from public.t_results where not ok) then raise exception 'SQL tests FAILED'; end if;
  raise notice 'ALL % SQL CHECKS PASSED', (select count(*) from public.t_results);
end $$;
