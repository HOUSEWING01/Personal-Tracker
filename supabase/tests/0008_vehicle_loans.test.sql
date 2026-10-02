-- Requires 00_supabase_stub.sql + migrations 0001..0008 on a FRESH scratch database (do not reuse the 0004 test DB:
-- that test inserts vehicles directly, which 0005 forbids).
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
  veh uuid; l uuid; l2 uuid; l3 uuid; p1 uuid; p2 uuid; tx_before uuid; n_before integer; n_upd integer;
begin
  veh := public.save_vehicle('Lorry 1', 'TN 38 AB 1234', 2500000, '2026-03-10', 0, null, 'active', null);

  -- create: loan received posted to the ledger
  l := public.save_vehicle_loan(veh, 'HDFC Bank', 1500000, '2026-04-01', 9.5, 31250, 60, 'active', null);
  perform t_check('loan received posted (loan_received/transport/1500000/start date)',
    exists (select 1 from public.transactions where entity_type = 'vehicle_loan' and entity_id = l
            and type = 'loan_received' and module = 'transport' and amount = 1500000 and transaction_date = '2026-04-01'));
  perform t_check('exactly one ledger entry for the loan', (select count(*) from public.transactions where entity_id = l) = 1);
  perform t_check('entry description names lender and vehicle',
    (select description from public.transactions where entity_type = 'vehicle_loan' and entity_id = l) like '%HDFC Bank%Lorry 1%TN 38 AB 1234%');
  perform t_check('loan stored with rate, EMI, tenure and status',
    exists (select 1 from public.vehicle_loans where id = l and interest_rate = 9.5 and emi = 31250 and tenure_months = 60 and status = 'active'));

  -- loan with no vehicle and no tenure
  l2 := public.save_vehicle_loan(null, 'Friend', 100000, '2026-05-01', 0, 5000, null, 'active', 'informal');
  perform t_check('loan without vehicle or tenure saves, rate 0 allowed',
    exists (select 1 from public.vehicle_loans where id = l2 and vehicle_id is null and tenure_months is null and interest_rate = 0));

  -- edit principal: same ledger row updated, not duplicated
  select id into tx_before from public.transactions where entity_type = 'vehicle_loan' and entity_id = l;
  perform public.save_vehicle_loan(veh, 'HDFC Bank', 1600000, '2026-04-01', 9.5, 31250, 60, 'active', null, l);
  perform t_check('principal edit updates the same ledger row',
    (select id from public.transactions where entity_type = 'vehicle_loan' and entity_id = l) = tx_before
    and (select amount from public.transactions where id = tx_before) = 1600000);
  perform t_check('still one ledger entry after edit', (select count(*) from public.transactions where entity_id = l) = 1);

  -- edit start date moves the entry
  perform public.save_vehicle_loan(veh, 'HDFC Bank', 1600000, '2026-03-25', 9.5, 31250, 60, 'active', null, l);
  perform t_check('start date edit moves the ledger entry',
    (select transaction_date from public.transactions where id = tx_before) = '2026-03-25');

  -- payments: full amount, interest included, ONE repayment entry each
  p1 := public.save_loan_payment(l, '2026-04-30', 31250, 'April EMI');
  perform t_check('payment posted (loan_repayment/transport/full amount/date)',
    exists (select 1 from public.transactions where entity_type = 'loan_payment' and entity_id = p1
            and type = 'loan_repayment' and module = 'transport' and amount = 31250 and transaction_date = '2026-04-30'));
  perform t_check('exactly one ledger entry per payment (no separate interest entry)', (select count(*) from public.transactions where entity_id = p1) = 1);
  perform t_check('payment description names the lender',
    (select description from public.transactions where entity_type = 'loan_payment' and entity_id = p1) like '%HDFC Bank%');
  p2 := public.save_loan_payment(l, '2026-05-31', 31250.50, null);

  -- edit payment: same ledger row updated
  select id into tx_before from public.transactions where entity_type = 'loan_payment' and entity_id = p2;
  perform public.save_loan_payment(l, '2026-05-30', 32000, 'May EMI + late fee', p2);
  perform t_check('payment edit updates the same ledger row',
    (select id from public.transactions where entity_type = 'loan_payment' and entity_id = p2) = tx_before
    and (select amount from public.transactions where id = tx_before) = 32000
    and (select transaction_date from public.transactions where id = tx_before) = '2026-05-30');
  perform t_check('ledger repayments equal the sum of payments',
    (select sum(amount) from public.transactions where type = 'loan_repayment') = (select sum(amount) from public.loan_payments));
  perform t_check('payment notes and amount stored',
    exists (select 1 from public.loan_payments where id = p2 and amount = 32000 and notes = 'May EMI + late fee'));

  -- totals view
  perform t_check('loan_payment_totals: paid, count, last date',
    exists (select 1 from public.loan_payment_totals where loan_id = l and paid_total = 63250 and payment_count = 2 and last_payment_date = '2026-05-30'));
  perform t_check('loan_payment_totals: loan with no payments is zero',
    exists (select 1 from public.loan_payment_totals where loan_id = l2 and paid_total = 0 and payment_count = 0 and last_payment_date is null));
  perform t_check('transaction_totals sees loan_received and loan_repayment',
    (select total from public.transaction_totals(null, null, 'transport') where type = 'loan_received') = 1700000
    and (select total from public.transaction_totals(null, null, 'transport') where type = 'loan_repayment') = 63250);

  -- payment rules
  select count(*) into n_before from public.transactions;
  perform t_check('payment before the loan start date rejected', t_fails(format($q$select public.save_loan_payment(%L, '2026-03-24', 100, null)$q$, l)));
  perform t_check('zero payment rejected', t_fails(format($q$select public.save_loan_payment(%L, '2026-06-01', 0, null)$q$, l)));
  perform t_check('negative payment rejected', t_fails(format($q$select public.save_loan_payment(%L, '2026-06-01', -5, null)$q$, l)));
  perform t_check('payment without a date rejected', t_fails(format($q$select public.save_loan_payment(%L, null, 100, null)$q$, l)));
  perform t_check('payment for an unknown loan rejected', t_fails($q$select public.save_loan_payment(gen_random_uuid(), '2026-06-01', 100, null)$q$));
  perform t_check('editing an unknown payment rejected', t_fails(format($q$select public.save_loan_payment(%L, '2026-06-01', 100, null, gen_random_uuid())$q$, l)));
  perform t_check('a payment cannot be moved to another loan', t_fails(format($q$select public.save_loan_payment(%L, '2026-06-01', 100, null, %L)$q$, l2, p1)));
  perform t_check('failed payments leave the ledger unchanged', (select count(*) from public.transactions) = n_before);

  -- start date cannot move after an existing payment
  perform t_check('start date after an existing payment rejected',
    t_fails(format($q$select public.save_vehicle_loan(%L, 'HDFC Bank', 1600000, '2026-05-01', 9.5, 31250, 60, 'active', null, %L)$q$, veh, l)));
  perform t_check('rejected start-date edit left the loan alone', (select start_date from public.vehicle_loans where id = l) = '2026-03-25');

  -- closed loans: no new payments, existing ones stay editable, reopening works
  perform public.save_vehicle_loan(veh, 'HDFC Bank', 1600000, '2026-03-25', 9.5, 31250, 60, 'closed', null, l);
  perform t_check('new payment on a closed loan rejected', t_fails(format($q$select public.save_loan_payment(%L, '2026-06-30', 100, null)$q$, l)));
  perform public.save_loan_payment(l, '2026-04-30', 31300, 'corrected', p1);
  perform t_check('existing payment still editable on a closed loan', (select amount from public.loan_payments where id = p1) = 31300);
  perform public.save_vehicle_loan(veh, 'HDFC Bank', 1600000, '2026-03-25', 9.5, 31250, 60, 'active', null, l);
  l3 := (select public.save_loan_payment(l, '2026-06-30', 31250, null));
  perform t_check('payment accepted again after reopening', exists (select 1 from public.loan_payments where id = l3));

  -- renaming the lender keeps repayment descriptions in step
  perform public.save_vehicle_loan(veh, 'HDFC Bank Ltd', 1600000, '2026-03-25', 9.5, 31250, 60, 'active', null, l);
  perform t_check('lender rename updates the loan entry description',
    (select description from public.transactions where entity_type = 'vehicle_loan' and entity_id = l) like '%HDFC Bank Ltd%');
  perform t_check('lender rename updates repayment descriptions',
    (select count(*) from public.transactions where entity_type = 'loan_payment' and entity_id in (p1, p2, l3) and description like '%HDFC Bank Ltd%') = 3);
  perform t_check('other loans repayments untouched by the rename', not exists (select 1 from public.transactions t join public.loan_payments p on p.id = t.entity_id where t.entity_type = 'loan_payment' and p.loan_id = l2 and t.description like '%HDFC%'));

  -- loan validation (all atomic)
  select count(*) into n_before from public.transactions;
  perform t_check('blank lender rejected', t_fails($q$select public.save_vehicle_loan(null, '  ', 100, '2026-01-01', 5, 10, null, 'active', null)$q$));
  perform t_check('zero amount received rejected', t_fails($q$select public.save_vehicle_loan(null, 'X', 0, '2026-01-01', 5, 10, null, 'active', null)$q$));
  perform t_check('zero EMI rejected', t_fails($q$select public.save_vehicle_loan(null, 'X', 100, '2026-01-01', 5, 0, null, 'active', null)$q$));
  perform t_check('missing start date rejected', t_fails($q$select public.save_vehicle_loan(null, 'X', 100, null, 5, 10, null, 'active', null)$q$));
  perform t_check('negative interest rate rejected', t_fails($q$select public.save_vehicle_loan(null, 'X', 100, '2026-01-01', -1, 10, null, 'active', null)$q$));
  perform t_check('interest rate above 100 rejected', t_fails($q$select public.save_vehicle_loan(null, 'X', 100, '2026-01-01', 100.5, 10, null, 'active', null)$q$));
  perform t_check('tenure 0 rejected', t_fails($q$select public.save_vehicle_loan(null, 'X', 100, '2026-01-01', 5, 10, 0, 'active', null)$q$));
  perform t_check('tenure above 600 rejected', t_fails($q$select public.save_vehicle_loan(null, 'X', 100, '2026-01-01', 5, 10, 601, 'active', null)$q$));
  perform t_check('unknown status rejected', t_fails($q$select public.save_vehicle_loan(null, 'X', 100, '2026-01-01', 5, 10, null, 'defaulted', null)$q$));
  perform t_check('unknown vehicle rejected', t_fails($q$select public.save_vehicle_loan(gen_random_uuid(), 'X', 100, '2026-01-01', 5, 10, null, 'active', null)$q$));
  perform t_check('editing an unknown loan rejected', t_fails($q$select public.save_vehicle_loan(null, 'X', 100, '2026-01-01', 5, 10, null, 'active', null, gen_random_uuid())$q$));
  perform t_check('failed loan saves leave the ledger unchanged', (select count(*) from public.transactions) = n_before);

  -- ledger guards
  perform t_check('duplicate vehicle_loan ledger row rejected',
    t_fails(format($q$insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date) values ('loan_received', 1, 'transport', 'vehicle_loan', %L, '2026-01-01')$q$, l)));
  perform t_check('duplicate loan_payment ledger row rejected',
    t_fails(format($q$insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date) values ('loan_repayment', 1, 'transport', 'loan_payment', %L, '2026-01-01')$q$, p1)));

  -- browser cannot write the tables directly
  perform t_check('direct insert into vehicle_loans denied', t_fails($q$insert into public.vehicle_loans (lender, principal, start_date, interest_rate, emi) values ('D', 1, '2026-01-01', 1, 1)$q$));
  perform t_check('direct insert into loan_payments denied', t_fails(format($q$insert into public.loan_payments (loan_id, payment_date, amount) values (%L, '2026-06-01', 1)$q$, l)));
  begin
    update public.vehicle_loans set principal = 1 where id = l;
    get diagnostics n_upd = row_count;
  exception when others then n_upd := 0;
  end;
  perform t_check('direct update of vehicle_loans changes no rows', n_upd = 0);
  begin
    delete from public.loan_payments where id = p1;
    get diagnostics n_upd = row_count;
  exception when others then n_upd := 0;
  end;
  perform t_check('direct delete of loan_payments removes no rows', n_upd = 0);
  perform t_check('loan principal unchanged after attempted direct update', (select principal from public.vehicle_loans where id = l) = 1600000);
  perform t_check('admin can read loans and payments',
    (select count(*) from public.vehicle_loans) = 2 and (select count(*) from public.loan_payments) = 3);

  -- a loan referenced by payments or a vehicle with a loan cannot be hard-deleted even by a privileged role
  perform t_check('vehicle with a loan cannot be deleted', t_fails(format($q$delete from public.vehicles where id = %L$q$, veh)) or (select count(*) from public.vehicles where id = veh) = 1);
end $$;

-- non-admin
set request.jwt.sub = '00000000-0000-0000-0000-0000000000bb';
select t_check('non-admin sees no loans', (select count(*) from public.vehicle_loans) = 0);
select t_check('non-admin sees no payments', (select count(*) from public.loan_payments) = 0);
select t_check('non-admin sees no totals rows', (select count(*) from public.loan_payment_totals) = 0);
select t_check('non-admin save_vehicle_loan refused', t_fails($q$select public.save_vehicle_loan(null, 'N', 1, '2026-01-01', 1, 1, null, 'active', null)$q$));
select t_check('non-admin save_loan_payment refused', t_fails($q$select public.save_loan_payment(gen_random_uuid(), '2026-01-01', 1, null)$q$));

-- anon
reset role; set role anon;
select t_check('anon save_vehicle_loan denied', t_fails($q$select public.save_vehicle_loan(null, 'N', 1, '2026-01-01', 1, 1, null, 'active', null)$q$));
select t_check('anon save_loan_payment denied', t_fails($q$select public.save_loan_payment(gen_random_uuid(), '2026-01-01', 1, null)$q$));
select t_check('anon cannot read vehicle_loans', t_fails($q$select * from public.vehicle_loans$q$));
select t_check('anon cannot read loan_payments', t_fails($q$select * from public.loan_payments$q$));
select t_check('anon cannot read loan_payment_totals', t_fails($q$select * from public.loan_payment_totals$q$));

reset role;
do $$
declare bad integer; total integer; r record;
begin
  select count(*) filter (where not ok), count(*) into bad, total from public.t_results;
  for r in select * from public.t_results loop raise notice '% %', case when r.ok then 'PASS' else 'FAIL' end, r.label; end loop;
  if bad > 0 then raise exception 'SQL tests FAILED: % of % checks', bad, total; end if;
  raise notice 'ALL % SQL CHECKS PASSED', total;
end $$;
