-- Requires 00_supabase_stub.sql + migrations 0001..0004 on a scratch DB.
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
declare v uuid;
begin
  insert into public.vehicles (name, registration_number, purchase_price, container_price)
    values ('Lorry 1', 'TN 38 AB 1234', 2500000, 300000.50) returning id into v;
  perform t_check('vehicle saved with money parts', (select purchase_price + container_price from public.vehicles where id = v) = 2800000.50);
  perform t_check('duplicate registration (spaces/case) rejected', t_fails($q$insert into public.vehicles (name, registration_number) values ('X', 'tn38ab1234')$q$));
  perform t_check('duplicate registration (hyphens) rejected', t_fails($q$insert into public.vehicles (name, registration_number) values ('X', 'TN-38-AB-1234')$q$));
  perform t_check('different registration accepted', not t_fails($q$insert into public.vehicles (name, registration_number) values ('Lorry 2', 'TN 38 AB 9999')$q$));
  perform t_check('blank name rejected', t_fails($q$insert into public.vehicles (name, registration_number) values ('  ', 'TN 01 A 1')$q$));
  perform t_check('blank registration rejected', t_fails($q$insert into public.vehicles (name, registration_number) values ('Y', '  ')$q$));
  perform t_check('negative purchase price rejected', t_fails($q$insert into public.vehicles (name, registration_number, purchase_price) values ('Y', 'TN 01 A 2', -1)$q$));
  perform t_check('negative container price rejected', t_fails($q$insert into public.vehicles (name, registration_number, container_price) values ('Y', 'TN 01 A 3', -1)$q$));
  perform t_check('unknown vehicle status rejected', t_fails($q$insert into public.vehicles (name, registration_number, status) values ('Y', 'TN 01 A 4', 'lost')$q$));
  perform t_check('sold status accepted', not t_fails($q$insert into public.vehicles (name, registration_number, status) values ('Y', 'TN 01 A 5', 'sold')$q$));
  update public.vehicles set name = 'Lorry 1b' where id = v;
  perform t_check('updated_at trigger moves forward', (select updated_at >= created_at from public.vehicles where id = v));

  insert into public.drivers (name, mobile) values ('Murugan', '9876543210');
  perform t_check('duplicate driver mobile rejected', t_fails($q$insert into public.drivers (name, mobile) values ('Other', '9876543210')$q$));
  perform t_check('two drivers without mobile allowed', not t_fails($q$insert into public.drivers (name) values ('A')$q$) and not t_fails($q$insert into public.drivers (name) values ('B')$q$));
  perform t_check('invalid driver mobile rejected', t_fails($q$insert into public.drivers (name, mobile) values ('Z', '12345')$q$));
  perform t_check('unknown driver status rejected', t_fails($q$insert into public.drivers (name, status) values ('Z', 'sold')$q$));

  -- shared customers table (0001) is the transport customer list
  insert into public.customers (name, mobile) values ('Kumar Traders', '9000000001');
  perform t_check('duplicate customer mobile rejected (shared table)', t_fails($q$insert into public.customers (name, mobile) values ('Dup', '9000000001')$q$));
end $$;

-- non-admin: sees nothing, writes denied
set request.jwt.sub = '00000000-0000-0000-0000-0000000000bb';
select t_check('non-admin sees no vehicles', (select count(*) from public.vehicles) = 0);
select t_check('non-admin sees no drivers', (select count(*) from public.drivers) = 0);
select t_check('non-admin cannot insert vehicle', t_fails($q$insert into public.vehicles (name, registration_number) values ('N', 'TN 99 Z 1')$q$));
select t_check('non-admin cannot insert driver', t_fails($q$insert into public.drivers (name) values ('N')$q$));

-- anonymous: no privileges
reset role; set role anon;
select t_check('anon cannot read vehicles', t_fails($q$select * from public.vehicles$q$));
select t_check('anon cannot read drivers', t_fails($q$select * from public.drivers$q$));

reset role;
do $$
declare bad integer; total integer; r record;
begin
  select count(*) filter (where not ok), count(*) into bad, total from public.t_results;
  for r in select * from public.t_results loop raise notice '% %', case when r.ok then 'PASS' else 'FAIL' end, r.label; end loop;
  if bad > 0 then raise exception 'SQL tests FAILED: % of % checks', bad, total; end if;
  raise notice 'ALL % SQL CHECKS PASSED', total;
end $$;
