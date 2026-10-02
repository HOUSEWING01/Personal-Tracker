\set ON_ERROR_STOP on
set request.jwt.sub = '00000000-0000-0000-0000-0000000000a1';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'a@x');
insert into admin_users (user_id) values ('00000000-0000-0000-0000-0000000000a1');
do $$
declare r record; prod uuid; var uuid; cust uuid; rent uuid; prop uuid; veh uuid;
begin
  select * into r from dashboard_counts(current_date, date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date);
  if r.active_properties <> 0 or r.sheets_total <> 0 or r.rent_outstanding <> 0 then raise exception 'empty db not zero: %', r; end if;

  insert into sheet_products (name) values ('Roof') returning id into prod;
  var := save_sheet_variant(prod, 8, 100, 'active', null);
  insert into customers (name, mobile) values ('Ravi', '9876543210') returning id into cust;
  rent := save_sheet_rental(cust, var, 60, current_date - 10, current_date - 2, 2500, 500, null, 500, 'cash');
  select * into r from dashboard_counts(current_date, current_date, current_date);
  if r.sheets_total <> 100 or r.sheets_rented <> 60 or r.sheets_available <> 40 then raise exception 'sheet counts wrong: %', r; end if;
  if r.overdue_rentals <> 1 then raise exception 'overdue wrong: %', r; end if;
  if r.sheet_outstanding <> 1500 then raise exception 'sheet outstanding wrong: %', r; end if;
  perform record_sheet_return(rent, current_date, 60, 0, 0, null);
  select * into r from dashboard_counts(current_date, current_date, current_date);
  if r.overdue_rentals <> 0 or r.sheets_available <> 100 then raise exception 'after return wrong: %', r; end if;
  raise notice 'DASHBOARD SQL CHECKS PASSED';
end $$;
set role authenticated;
set request.jwt.sub = '00000000-0000-0000-0000-0000000000b2';
do $$ declare r record; begin
  select * into r from dashboard_counts(current_date, current_date, current_date);
  if r.sheets_total <> 0 or r.active_properties <> 0 then raise exception 'non-admin saw data: %', r; end if;
  raise notice 'non-admin sees zeros: OK';
end $$;
