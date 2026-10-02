\set ON_ERROR_STOP on
-- Self-checking test for migration 0013 (Reports). Run on a FRESH scratch DB: stub + migrations 0001..0013.
-- Expects: "REPORTS SQL CHECKS PASSED" then "non-admin sees nothing: OK".
set request.jwt.sub = '00000000-0000-0000-0000-0000000000a1';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'a@x');
insert into admin_users (user_id) values ('00000000-0000-0000-0000-0000000000a1');
do $$
declare
  d0 date := date '2026-09-10';         -- inside the report window
  d1 date := date '2026-10-05';
  veh1 uuid; veh2 uuid; drv uuid; cust uuid; cust2 uuid; trip uuid; prop uuid; prop2 uuid;
  prod uuid; var uuid; linked uuid; rent uuid; loan uuid; r record; n numeric;
  chk int := 0;
  function_dummy int;
begin
  -- empty database
  select count(*) into function_dummy from report_breakdown('total');
  if function_dummy <> 0 then raise exception 'empty breakdown not empty'; end if;
  select * into r from report_outstanding();
  if r.rent_outstanding <> 0 or r.sheet_outstanding <> 0 then raise exception 'empty outstanding not zero: %', r; end if;

  -- fixtures
  veh1 := save_vehicle('Lorry A', 'TN 66 A 1111', 500000, d0, 100000, null, 'active', null);
  veh2 := save_vehicle('Lorry B', 'TN 66 B 2222', 300000, d0, 0, null, 'active', null);
  insert into drivers (name) values ('Kumar') returning id into drv;
  insert into customers (name, mobile) values ('Ravi', '9876543210') returning id into cust;
  insert into customers (name, mobile) values ('Sita', '9876543211') returning id into cust2;

  -- trip on veh1 for Ravi: revenue 1000 km * 20 = 20000, driver 3000; completed so it posts
  trip := save_trip(veh1, drv, cust, 'A', 'B', 1000, 20, 3000, d0, 'completed', null);
  perform save_fuel_log(veh1, trip, d0, 100, 90, null, null);          -- 9000
  perform save_toll(trip, d0, 500, 'plaza', null);                      -- 500
  loan := save_vehicle_loan(veh1, 'Bank', 200000, d0, 10, 5000, 24, 'active', null);   -- loan_received 200000 (veh1)
  perform save_loan_payment(loan, d1, 5000, null);                      -- loan_repayment 5000 (veh1, via payment -> loan)

  -- property rent: rent 8000/month, tenant since Aug 2026, pay 8000 for Sept only
  insert into properties (name, monthly_rent) values ('Shop 1', 8000) returning id into prop;
  insert into properties (name, monthly_rent) values ('Shop 2', 5000) returning id into prop2;
  insert into tenants (property_id, name, rental_start_date) values (prop, 'T1', date '2026-09-01');
  perform ensure_rent_charges(prop);
  perform record_rent_payment(prop, date '2026-09-01', 8000, d0, 'cash', null);

  -- sheet rental for Sita: rent 2500 discount 500 advance 500 (payment is a customer_payment)
  insert into sheet_products (name) values ('Roof') returning id into prod;
  var := save_sheet_variant(prod, 8, 100, 'active', null);
  rent := save_sheet_rental(cust2, var, 10, d0, null, 2500, 500, null, 500, 'cash');

  -- general ledger rows (no link)
  insert into transactions (type, amount, module, transaction_date, description) values ('expense', 700, 'general', d0, 'office');
  insert into transactions (type, amount, module, transaction_date, description) values ('income', 100, 'general', date '2026-01-15', 'old');

  -- A. ledger_links maps every entity type
  select vehicle_id into strict linked from ledger_links l join transactions t on t.id = l.transaction_id
   where t.entity_type = 'vehicle_container' and t.entity_id = veh1;
  if linked <> veh1 then raise exception 'A1 container link wrong'; end if;
  perform 1 from ledger_links l join transactions t on t.id = l.transaction_id where t.entity_type = 'vehicle_purchase' and t.entity_id = veh1 and l.vehicle_id = veh1;
  if not found then raise exception 'A2 purchase link'; end if;
  perform 1 from ledger_links l join transactions t on t.id = l.transaction_id where t.entity_type = 'trip_revenue' and l.vehicle_id = veh1 and l.customer_id = cust;
  if not found then raise exception 'A3 trip revenue link (vehicle + customer)'; end if;
  perform 1 from ledger_links l join transactions t on t.id = l.transaction_id where t.entity_type = 'trip_driver' and l.vehicle_id = veh1;
  if not found then raise exception 'A4 driver link'; end if;
  perform 1 from ledger_links l join transactions t on t.id = l.transaction_id where t.entity_type = 'fuel_log' and l.vehicle_id = veh1;
  if not found then raise exception 'A5 fuel link'; end if;
  perform 1 from ledger_links l join transactions t on t.id = l.transaction_id where t.entity_type = 'toll' and l.vehicle_id = veh1;
  if not found then raise exception 'A6 toll link'; end if;
  perform 1 from ledger_links l join transactions t on t.id = l.transaction_id where t.entity_type = 'vehicle_loan' and l.vehicle_id = veh1;
  if not found then raise exception 'A7 loan link'; end if;
  perform 1 from ledger_links l join transactions t on t.id = l.transaction_id where t.entity_type = 'loan_payment' and l.vehicle_id = veh1;
  if not found then raise exception 'A8 loan payment link'; end if;
  perform 1 from ledger_links l join transactions t on t.id = l.transaction_id where t.entity_type = 'rent_payment' and l.property_id = prop and l.vehicle_id is null;
  if not found then raise exception 'A9 rent link'; end if;
  perform 1 from ledger_links l join transactions t on t.id = l.transaction_id where t.entity_type = 'sheet_payment' and l.customer_id = cust2 and l.property_id is null;
  if not found then raise exception 'A10 sheet payment link'; end if;
  select count(*) into function_dummy from ledger_links;
  select count(*) into n from transactions;
  if function_dummy <> n then raise exception 'A11 ledger_links must have exactly one row per transaction (% vs %)', function_dummy, n; end if;
  raise notice 'A ledger_links OK';

  -- B. report_breakdown: totals and grouping
  select total into n from report_breakdown('total') where type = 'income';
  if n <> 20000 + 100 then raise exception 'B1 income total wrong: %', n; end if;
  select total into n from report_breakdown('total') where type = 'customer_payment';
  if n <> 8000 + 500 then raise exception 'B2 customer payments wrong: %', n; end if;
  select total into n from report_breakdown('total', d0, d1) where type = 'income';
  if n <> 20000 then raise exception 'B3 date range should exclude the January row: %', n; end if;
  select total into n from report_breakdown('total', d0, d0) where type = 'loan_repayment';
  if n is not null then raise exception 'B4 repayment dated d1 must be outside d0..d0: %', n; end if;
  select total into n from report_breakdown('month', null, null, null) where bucket = '2026-10' and type = 'loan_repayment';
  if n <> 5000 then raise exception 'B5 monthly bucket wrong: %', n; end if;
  select total into n from report_breakdown('month') where bucket = '2026-01' and type = 'income';
  if n <> 100 then raise exception 'B6 January bucket wrong: %', n; end if;
  select total into n from report_breakdown('module') where bucket = 'transport' and type = 'income';
  if n <> 20000 then raise exception 'B7 module bucket wrong: %', n; end if;
  select total into n from report_breakdown('total', null, null, 'general') where type = 'expense';
  if n <> 700 then raise exception 'B8 module filter wrong: %', n; end if;
  select total into n from report_breakdown('total', null, null, null, null, null, null) where type = 'investment';
  if n <> 500000 + 100000 + 300000 then raise exception 'B9 investments wrong: %', n; end if;
  raise notice 'B report_breakdown totals OK';

  -- C. entity filters
  select total into n from report_breakdown('total', null, null, null, veh1) where type = 'investment';
  if n <> 600000 then raise exception 'C1 vehicle investment wrong: %', n; end if;
  select total into n from report_breakdown('total', null, null, null, veh1) where type = 'loan_repayment';
  if n <> 5000 then raise exception 'C2 vehicle loan repayment wrong: %', n; end if;
  select total into n from report_breakdown('total', null, null, null, veh1) where type = 'expense';
  if n <> 3000 + 9000 + 500 then raise exception 'C3 vehicle expenses (driver+fuel+toll) wrong: %', n; end if;
  select total into n from report_breakdown('total', null, null, null, veh1) where type = 'loan_received';
  if n <> 200000 then raise exception 'C3b vehicle loan received wrong: %', n; end if;
  select count(*) into function_dummy from report_breakdown('total', null, null, null, veh2) where type in ('income','expense','loan_repayment');
  if function_dummy <> 0 then raise exception 'C4 vehicle B should have no operating rows'; end if;
  select total into n from report_breakdown('total', null, null, null, null, prop) where type = 'customer_payment';
  if n <> 8000 then raise exception 'C5 property filter wrong: %', n; end if;
  select count(*) into function_dummy from report_breakdown('total', null, null, null, null, prop2);
  if function_dummy <> 0 then raise exception 'C6 other property should be empty'; end if;
  select total into n from report_breakdown('total', null, null, null, null, null, cust) where type = 'income';
  if n <> 20000 then raise exception 'C7 customer trip revenue wrong: %', n; end if;
  select total into n from report_breakdown('total', null, null, null, null, null, cust2) where type = 'customer_payment';
  if n <> 500 then raise exception 'C8 customer sheet payment wrong: %', n; end if;
  select count(*) into function_dummy from report_breakdown('total', null, null, null, null, null, cust2) where type = 'income';
  if function_dummy <> 0 then raise exception 'C9 customer filter must exclude other customers'' trips'; end if;
  select count(*) into function_dummy from report_breakdown('total', null, null, null, veh1, prop);
  if function_dummy <> 0 then raise exception 'C10 vehicle AND property together must be empty'; end if;
  raise notice 'C entity filters OK';

  -- D. report_outstanding
  select * into r from report_outstanding();
  -- rent: Sept expected 8000 paid 8000 = 0; Oct expected 8000 unpaid (charges exist through the current month)
  if r.sheet_outstanding <> 1500 then raise exception 'D1 sheet outstanding (2500-500-500) wrong: %', r.sheet_outstanding; end if;
  if r.rent_outstanding < 0 then raise exception 'D2 negative rent outstanding'; end if;
  select * into r from report_outstanding(null, null, null, veh1);
  if r.rent_outstanding <> 0 or r.sheet_outstanding <> 0 then raise exception 'D3 vehicle filter must give zero: %', r; end if;
  select * into r from report_outstanding(null, null, null, null, prop);
  if r.sheet_outstanding <> 0 then raise exception 'D4 property filter must exclude sheets: %', r; end if;
  select * into r from report_outstanding(null, null, null, null, null, cust2);
  if r.rent_outstanding <> 0 or r.sheet_outstanding <> 1500 then raise exception 'D5 customer filter: %', r; end if;
  select * into r from report_outstanding(null, null, null, null, null, cust);
  if r.sheet_outstanding <> 0 then raise exception 'D6 other customer has no sheet rent: %', r; end if;
  select * into r from report_outstanding(null, null, 'sheets');
  if r.rent_outstanding <> 0 or r.sheet_outstanding <> 1500 then raise exception 'D7 module sheets: %', r; end if;
  select * into r from report_outstanding(null, null, 'transport');
  if r.rent_outstanding <> 0 or r.sheet_outstanding <> 0 then raise exception 'D8 module transport must be zero: %', r; end if;
  select * into r from report_outstanding(date '2026-09-01', date '2026-09-30');
  if r.rent_outstanding <> 0 then raise exception 'D9 September rent is fully paid: %', r; end if;
  select * into r from report_outstanding(date '2026-10-01', date '2026-10-31');
  if r.sheet_outstanding <> 0 then raise exception 'D10 sheet rental dated Sept is outside October: %', r; end if;
  raise notice 'D report_outstanding OK';

  raise notice 'REPORTS SQL CHECKS PASSED';
end $$;

set role authenticated;
set request.jwt.sub = '00000000-0000-0000-0000-0000000000b2';
do $$ declare c int; r record; begin
  select count(*) into c from report_breakdown('total');
  select * into r from report_outstanding();
  if c <> 0 or r.rent_outstanding <> 0 or r.sheet_outstanding <> 0 then raise exception 'non-admin saw data'; end if;
  select count(*) into c from ledger_links;
  if c <> 0 then raise exception 'non-admin saw ledger_links'; end if;
  raise notice 'non-admin sees nothing: OK';
end $$;
reset role;
set role anon;
do $$ begin
  begin perform * from report_breakdown('total'); raise exception 'anon could call report_breakdown'; exception when insufficient_privilege then null; end;
  raise notice 'anon refused: OK';
end $$;
