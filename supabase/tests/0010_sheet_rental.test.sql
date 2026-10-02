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
  prod uuid; var uuid; cust uuid; r1 uuid; r2 uuid; pay uuid; ret1 uuid; ret2 uuid;
  s record; n numeric; c int;
begin
  insert into sheet_products (name) values ('Roofing Sheet') returning id into prod;
  var := save_sheet_variant(prod, 8, 100, 'active', null);
  insert into customers (name, mobile) values ('Ravi', '9876543210') returning id into cust;

  -- rent 60 of 100, advance 500 against net 2000
  r1 := save_sheet_rental(cust, var, 60, current_date, current_date + 10, 2500, 500, null, 500, 'cash');
  select * into s from sheet_variant_stock where variant_id = var;
  if s.rented_quantity <> 60 or s.available_quantity <> 40 then raise exception 'stock after rental wrong: %', s; end if;
  select count(*), sum(amount) into c, n from transactions where entity_type = 'sheet_payment' and type = 'customer_payment' and module = 'sheets';
  if c <> 1 or n <> 500 then raise exception 'advance ledger wrong'; end if;

  perform pg_temp.expect_fail(format('select save_sheet_rental(%L,%L,41,current_date,null,100,0,null,0,null)', cust, var), 'not enough sheets available');
  perform pg_temp.expect_fail(format('select save_sheet_rental(%L,%L,5,current_date,null,100,200,null,0,null)', cust, var), 'discount is more than the rent');
  perform pg_temp.expect_fail(format('select save_sheet_payment(%L,current_date,1600,null,null)', r1), 'more than the outstanding');

  -- partial return: 50 good, 3 damaged, 2 missing => 5 still out
  ret1 := record_sheet_return(r1, current_date, 50, 3, 2, null);
  select * into s from sheet_variant_stock where variant_id = var;
  if s.rented_quantity <> 5 or s.damaged_quantity <> 3 or s.missing_quantity <> 2 or s.available_quantity <> 90 then raise exception 'stock after partial wrong: %', s; end if;
  if (select status from sheet_rentals where id = r1) <> 'active' then raise exception 'should still be active'; end if;
  perform pg_temp.expect_fail(format('select record_sheet_return(%L,current_date,6,0,0,null)', r1), 'more sheets than are still out');
  perform pg_temp.expect_fail(format('select save_sheet_variant(%L,8,4,%L,null,%L)', prod, 'active', var), 'total quantity is below');

  -- finish the return; rental closes
  ret2 := record_sheet_return(r1, current_date, 5, 0, 0, null);
  if (select status from sheet_rentals where id = r1) <> 'closed' then raise exception 'should be closed'; end if;
  select * into s from sheet_variant_stock where variant_id = var;
  if s.rented_quantity <> 0 or s.available_quantity <> 95 then raise exception 'stock after close wrong: %', s; end if;

  -- rent them again (90 of 95), then undoing the 50-good return must be refused
  r2 := save_sheet_rental(cust, var, 90, current_date, null, 0, 0, null, 0, null);
  perform pg_temp.expect_fail(format('select delete_sheet_return(%L)', ret1), 'already rented out again');

  -- payment edit updates the ledger entry, no duplicate
  pay := save_sheet_payment(r1, current_date, 700, 'upi', 'balance');
  perform save_sheet_payment(r1, current_date, 800, 'upi', 'balance', pay);
  select count(*), sum(amount) into c, n from transactions where entity_type = 'sheet_payment' and entity_id = pay;
  if c <> 1 or n <> 800 then raise exception 'payment edit ledger wrong'; end if;
  if (select outstanding from (select (rent_amount - discount) - (select sum(amount) from sheet_rental_payments where rental_id = r1) as outstanding from sheet_rentals where id = r1) q) <> 700 then raise exception 'outstanding wrong'; end if;
  perform pg_temp.expect_fail(format('select save_sheet_rental(%L,%L,60,current_date,null,1000,0,null,0,null,%L)', cust, var, r1), 'net rent is below the amount already paid');

  -- cancel rules: r1 has payments (refused); r2 has none (ok) and frees stock
  perform pg_temp.expect_fail(format('select cancel_sheet_rental(%L)', r1), 'returns or payments');
  perform cancel_sheet_rental(r2);
  select * into s from sheet_variant_stock where variant_id = var;
  if s.available_quantity <> 95 then raise exception 'cancel did not free stock: %', s; end if;

  -- undo the last 5-good return reopens r1
  perform delete_sheet_return(ret2);
  if (select status from sheet_rentals where id = r1) <> 'active' then raise exception 'undo should reopen'; end if;

  raise notice 'SHEET SMOKE CHECKS PASSED';
end $$;

-- non-admin is refused
set request.jwt.sub = '00000000-0000-0000-0000-0000000000b2';
select pg_temp.expect_fail($q$select save_sheet_variant(gen_random_uuid(), 8, 1, 'active', null)$q$, 'not authorised');
