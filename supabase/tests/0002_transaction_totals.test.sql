-- Requires 00_supabase_stub.sql + migrations 0001, 0002 on a scratch DB.
\set ON_ERROR_STOP off
insert into auth.users values ('00000000-0000-0000-0000-0000000000aa','admin@x.com'),('00000000-0000-0000-0000-0000000000bb','other@x.com');
insert into public.admin_users values ('00000000-0000-0000-0000-0000000000aa');
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-0000000000aa';
insert into public.transactions(type,amount,module,transaction_date) values
 ('income',1000.10,'transport','2026-10-05'),('income',0.20,'transport','2026-10-06'),
 ('expense',400,'transport','2026-10-07'),('expense',99,'property','2026-10-08'),
 ('income',5,'general','2026-09-30');
\echo '--- A: admin, October only -> income 1000.30, expense 499.00 (income 5 on 30 Sep excluded)'
select type, total from public.transaction_totals('2026-10-01','2026-10-31') order by type;
\echo '--- B: admin, transport only -> income 1000.30, expense 400.00'
select type, total from public.transaction_totals(null,null,'transport') order by type;
\echo '--- C: non-admin -> 0 rows'
set request.jwt.sub = '00000000-0000-0000-0000-0000000000bb';
select count(*) as rows_for_non_admin from public.transaction_totals();
\echo '--- D: anon -> permission denied'
reset role; set role anon;
select * from public.transaction_totals();
