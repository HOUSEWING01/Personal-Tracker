\set ON_ERROR_STOP off
insert into auth.users values ('00000000-0000-0000-0000-0000000000aa','admin@x.com'),('00000000-0000-0000-0000-0000000000bb','other@x.com');
insert into public.admin_users values ('00000000-0000-0000-0000-0000000000aa');

\echo '--- A: admin can insert/select'
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-0000000000aa';
select public.is_admin() as is_admin;
insert into public.customers(name,mobile) values ('Ravi','9876543210');
select count(*) as admin_sees from public.customers;

\echo '--- B: non-admin blocked (expect 0 rows, insert fails)'
set request.jwt.sub = '00000000-0000-0000-0000-0000000000bb';
select public.is_admin() as is_admin;
select count(*) as other_sees from public.customers;
insert into public.customers(name) values ('Hacker');
select count(*) as admin_users_visible from public.admin_users;

\echo '--- C: anon blocked (expect permission denied)'
reset role; set role anon;
select count(*) from public.customers;

\echo '--- D: integrity constraints as admin (all should FAIL)'
reset role; set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-0000000000aa';
insert into public.customers(name,mobile) values ('Dup','9876543210');
insert into public.customers(name) values ('   ');
insert into public.customers(name,mobile) values ('Bad','12345');
insert into public.transactions(type,amount,module,transaction_date) values ('expense',-5,'transport',current_date);
insert into public.transactions(type,amount,module,transaction_date) values ('income',0,'general',current_date);
insert into public.transactions(type,amount,module,transaction_date,entity_type) values ('expense',10,'transport',current_date,'FUEL');
\echo '--- E: valid rows (should SUCCEED)'
insert into public.transactions(type,amount,module,entity_type,entity_id,transaction_date) values ('expense',6000,'transport','FUEL',gen_random_uuid(),current_date);
insert into public.transactions(type,amount,module,transaction_date) values ('adjustment',-250.50,'general',current_date);
update public.customers set name='Ravi K' where mobile='9876543210';
select name, updated_at > created_at as updated_at_moves from public.customers;
