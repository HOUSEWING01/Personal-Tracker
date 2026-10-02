\set ON_ERROR_STOP on
set request.jwt.sub = '00000000-0000-0000-0000-0000000000a1';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'a@x');
insert into admin_users (user_id) values ('00000000-0000-0000-0000-0000000000a1');

create or replace function pg_temp.expect_fail(sql text, needle text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if position(needle in sqlerrm) = 0 then raise exception 'wrong error for [%]: %', sql, sqlerrm; end if;
    return;
  end;
  raise exception 'expected failure containing [%] but succeeded: %', needle, sql;
end $$;

do $$
declare
  l uuid; p1 uuid; p2 uuid; n numeric; c int; t record;
begin
  -- create: loan_received posts once, dated the pledge date, module gold_loans
  l := save_gold_loan('Ravi', '9876543210', '2 bangles', 25.5, 'SBI', date '2026-01-01', date '2027-01-01', 100000, 9.5, 'active', null, null);
  select count(*), sum(amount) into c, n from transactions where entity_type = 'gold_loan' and entity_id = l and type = 'loan_received' and module = 'gold_loans' and transaction_date = date '2026-01-01';
  if c <> 1 or n <> 100000 then raise exception 'loan ledger entry wrong'; end if;

  -- edit updates the same entry
  perform save_gold_loan('Ravi', null, '2 bangles', null, 'SBI', date '2026-01-01', null, 120000, 9.5, 'active', null, 'x', l);
  select count(*), sum(amount) into c, n from transactions where entity_type = 'gold_loan' and entity_id = l;
  if c <> 1 or n <> 120000 then raise exception 'loan edit did not update entry'; end if;

  -- payments post the full amount as loan_repayment
  p1 := save_gold_loan_payment(l, date '2026-03-01', 5000, null);
  p2 := save_gold_loan_payment(l, date '2026-04-01', 7000, 'n');
  select count(*), sum(amount) into c, n from transactions where type = 'loan_repayment' and module = 'gold_loans' and entity_type = 'gold_loan_payment';
  if c <> 2 or n <> 12000 then raise exception 'payment ledger wrong'; end if;
  perform save_gold_loan_payment(l, date '2026-04-02', 7500, null, p2);
  select sum(amount) into n from transactions where entity_type = 'gold_loan_payment' and entity_id = p2;
  if n <> 7500 then raise exception 'payment edit did not update entry'; end if;
  select * into t from gold_loan_payment_totals where loan_id = l;
  if t.paid_total <> 12500 or t.payment_count <> 2 or t.last_payment_date <> date '2026-04-02' then raise exception 'totals wrong: %', t; end if;

  -- validation
  perform pg_temp.expect_fail($q$select save_gold_loan_payment(null, date '2026-03-01', 1, null)$q$, 'loan not found');
  perform pg_temp.expect_fail(format($q$select save_gold_loan_payment(%L, date '2025-12-31', 1, null)$q$, l), 'before the pledge date');
  perform pg_temp.expect_fail(format($q$select save_gold_loan_payment(%L, date '2026-03-01', 0, null)$q$, l), 'greater than zero');
  perform pg_temp.expect_fail($q$select save_gold_loan('', null, 'g', null, 'SBI', date '2026-01-01', null, 1, 1, 'active', null, null)$q$, 'person name');
  perform pg_temp.expect_fail($q$select save_gold_loan('A', '123', 'g', null, 'SBI', date '2026-01-01', null, 1, 1, 'active', null, null)$q$, 'mobile');
  perform pg_temp.expect_fail($q$select save_gold_loan('A', null, 'g', null, 'SBI', date '2026-01-01', date '2025-01-01', 1, 1, 'active', null, null)$q$, 'due date');
  perform pg_temp.expect_fail($q$select save_gold_loan('A', null, 'g', null, 'SBI', date '2026-01-01', null, 1, 101, 'active', null, null)$q$, 'interest rate');
  perform pg_temp.expect_fail($q$select save_gold_loan('A', null, 'g', null, 'SBI', date '2026-01-01', null, 1, 1, 'closed', null, null)$q$, 'closing date is required');
  perform pg_temp.expect_fail(format($q$select save_gold_loan('Ravi', null, 'g', null, 'SBI', date '2026-05-01', null, 1, 1, 'active', null, null, %L)$q$, l), 'payments before the pledge date');
  perform pg_temp.expect_fail(format($q$select save_gold_loan('Ravi', null, 'g', null, 'SBI', date '2026-01-01', null, 1, 1, 'closed', date '2026-03-15', null, %L)$q$, l), 'payments after the closing date');

  -- close: no new payments, existing payments stay editable, no payment after closing date
  perform save_gold_loan('Ravi', null, '2 bangles', null, 'SBI', date '2026-01-01', null, 120000, 9.5, 'closed', date '2026-04-10', null, l);
  perform pg_temp.expect_fail(format($q$select save_gold_loan_payment(%L, date '2026-04-05', 1, null)$q$, l), 'loan is closed');
  perform save_gold_loan_payment(l, date '2026-04-03', 7600, null, p2);
  perform pg_temp.expect_fail(format($q$select save_gold_loan_payment(%L, date '2026-04-11', 7600, null, %L)$q$, l, p2), 'after the closing date');
  perform save_gold_loan('Ravi', null, '2 bangles', null, 'SBI', date '2026-01-01', null, 120000, 9.5, 'released', date '2026-04-12', null, l);
  if (select status from gold_loans where id = l) <> 'released' then raise exception 'release failed'; end if;
  -- reopen clears the closing date
  perform save_gold_loan('Ravi', null, '2 bangles', null, 'SBI', date '2026-01-01', null, 120000, 9.5, 'active', date '2026-04-12', null, l);
  if (select closed_date from gold_loans where id = l) is not null then raise exception 'closed_date not cleared'; end if;

  -- rename keeps repayment descriptions in step
  perform save_gold_loan('Ravi K', null, '2 bangles', null, 'HDFC', date '2026-01-01', null, 120000, 9.5, 'active', null, null, l);
  if exists (select 1 from transactions where entity_type = 'gold_loan_payment' and description <> 'Gold loan repayment - HDFC - Ravi K') then raise exception 'descriptions not synced'; end if;
  -- no duplicate ledger entries
  select count(*) into c from transactions where entity_type in ('gold_loan', 'gold_loan_payment');
  if c <> 3 then raise exception 'unexpected ledger entry count %', c; end if;
  raise notice 'GOLD LOAN SQL CHECKS PASSED';
end $$;

-- non-admin is refused
reset request.jwt.sub;
set request.jwt.sub = '00000000-0000-0000-0000-0000000000b2';
do $$ begin
  begin perform save_gold_loan('X', null, 'g', null, 'SBI', date '2026-01-01', null, 1, 1, 'active', null, null);
    raise exception 'non-admin was allowed';
  exception when insufficient_privilege then raise notice 'non-admin refused: OK'; end;
end $$;
