-- Requires 00_supabase_stub.sql + migrations 0001..0005 on a scratch DB (a fresh one; the 0004 test
-- inserts vehicles directly, which 0005 forbids, so do not run both on the same database).
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
  v uuid; v2 uuid; tx_before uuid; n_before integer; n_upd integer;
begin
  -- create: both parts posted
  v := public.save_vehicle('Lorry 1', 'TN 38 AB 1234', 2500000, '2026-03-10', 300000.50, 'Reefer box', 'active', null);
  perform t_check('purchase entry posted (investment/transport/2500000/date)',
    exists (select 1 from public.transactions where entity_type = 'vehicle_purchase' and entity_id = v
            and type = 'investment' and module = 'transport' and amount = 2500000 and transaction_date = '2026-03-10'));
  perform t_check('container entry posted (300000.50)',
    exists (select 1 from public.transactions where entity_type = 'vehicle_container' and entity_id = v
            and type = 'investment' and amount = 300000.50 and transaction_date = '2026-03-10'));
  perform t_check('exactly 2 ledger entries for the vehicle', (select count(*) from public.transactions where entity_id = v) = 2);
  perform t_check('entry description names the vehicle',
    (select description from public.transactions where entity_type = 'vehicle_purchase' and entity_id = v) like '%Lorry 1%TN 38 AB 1234%');

  -- edit price: same entry updated, not duplicated
  select id into tx_before from public.transactions where entity_type = 'vehicle_purchase' and entity_id = v;
  perform public.save_vehicle('Lorry 1', 'TN 38 AB 1234', 2600000, '2026-03-10', 300000.50, 'Reefer box', 'active', null, v);
  perform t_check('price edit updates the same ledger row',
    (select id from public.transactions where entity_type = 'vehicle_purchase' and entity_id = v) = tx_before
    and (select amount from public.transactions where id = tx_before) = 2600000);
  perform t_check('still 2 entries after edit', (select count(*) from public.transactions where entity_id = v) = 2);

  -- edit date: both entries move
  perform public.save_vehicle('Lorry 1', 'TN 38 AB 1234', 2600000, '2026-03-12', 300000.50, 'Reefer box', 'active', null, v);
  perform t_check('date edit moves both entries', (select count(*) from public.transactions where entity_id = v and transaction_date = '2026-03-12') = 2);

  -- container to zero removes its entry; back above zero adds one
  perform public.save_vehicle('Lorry 1', 'TN 38 AB 1234', 2600000, '2026-03-12', 0, null, 'active', null, v);
  perform t_check('container price 0 removes container entry',
    not exists (select 1 from public.transactions where entity_type = 'vehicle_container' and entity_id = v)
    and exists (select 1 from public.transactions where entity_type = 'vehicle_purchase' and entity_id = v));
  perform public.save_vehicle('Lorry 1', 'TN 38 AB 1234', 2600000, '2026-03-12', 50000, null, 'active', null, v);
  perform t_check('container price back above 0 adds an entry again',
    (select amount from public.transactions where entity_type = 'vehicle_container' and entity_id = v) = 50000);

  -- vehicle with no prices posts nothing
  v2 := public.save_vehicle('Van', 'TN 01 A 1', 0, '2026-01-01', 0, null, 'active', null);
  perform t_check('zero prices post no ledger entries', (select count(*) from public.transactions where entity_id = v2) = 0);

  -- name/status edits leave amounts alone
  perform public.save_vehicle('Lorry 1 (sold)', 'TN 38 AB 1234', 2600000, '2026-03-12', 50000, null, 'sold', null, v);
  perform t_check('non-money edit keeps entries and amounts',
    (select count(*) from public.transactions where entity_id = v) = 2
    and (select sum(amount) from public.transactions where entity_id = v) = 2650000);

  -- rejections are atomic: nothing is left behind
  select count(*) into n_before from public.transactions;
  perform t_check('duplicate registration rejected', t_fails($q$select public.save_vehicle('Dup', 'tn-38-ab-1234', 100, '2026-01-01', 100, null, 'active', null)$q$));
  perform t_check('failed save leaves the ledger unchanged', (select count(*) from public.transactions) = n_before);
  perform t_check('missing purchase date rejected', t_fails($q$select public.save_vehicle('X', 'TN 02 B 2', 100, null, 0, null, 'active', null)$q$));
  perform t_check('negative purchase price rejected', t_fails($q$select public.save_vehicle('X', 'TN 02 B 3', -1, '2026-01-01', 0, null, 'active', null)$q$));
  perform t_check('negative container price rejected', t_fails($q$select public.save_vehicle('X', 'TN 02 B 4', 0, '2026-01-01', -1, null, 'active', null)$q$));
  perform t_check('blank name rejected', t_fails($q$select public.save_vehicle('  ', 'TN 02 B 5', 0, '2026-01-01', 0, null, 'active', null)$q$));
  perform t_check('unknown status rejected', t_fails($q$select public.save_vehicle('X', 'TN 02 B 6', 0, '2026-01-01', 0, null, 'lost', null)$q$));
  perform t_check('editing an unknown vehicle rejected', t_fails($q$select public.save_vehicle('X', 'TN 02 B 7', 0, '2026-01-01', 0, null, 'active', null, gen_random_uuid())$q$));
  perform t_check('failed edit does not change the ledger', (select count(*) from public.transactions) = n_before);

  -- ledger guard: a second entry for the same vehicle part is impossible
  perform t_check('duplicate vehicle_purchase ledger row rejected',
    t_fails(format($q$insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date) values ('investment', 1, 'transport', 'vehicle_purchase', %L, '2026-01-01')$q$, v)));

  -- direct writes to vehicles are closed to the browser
  perform t_check('direct insert into vehicles denied', t_fails($q$insert into public.vehicles (name, registration_number, purchase_date) values ('D', 'TN 03 C 1', '2026-01-01')$q$));
  begin
    update public.vehicles set purchase_price = 1 where id = v;
    get diagnostics n_upd = row_count;
  exception when others then n_upd := 0;
  end;
  perform t_check('direct update of vehicles changes no rows', n_upd = 0);
  perform t_check('vehicle price unchanged after attempted direct update', (select purchase_price from public.vehicles where id = v) = 2600000);
  perform t_check('admin can still read vehicles', (select count(*) from public.vehicles) = 2);

  -- internal sync function is not callable by the browser
  perform t_check('sync_vehicle_investments not callable', t_fails(format($q$select public.sync_vehicle_investments(%L)$q$, v)));
end $$;

-- non-admin
set request.jwt.sub = '00000000-0000-0000-0000-0000000000bb';
select t_check('non-admin sees no vehicles', (select count(*) from public.vehicles) = 0);
select t_check('non-admin save_vehicle refused', t_fails($q$select public.save_vehicle('N', 'TN 99 Z 1', 1, '2026-01-01', 0, null, 'active', null)$q$));

-- anon
reset role; set role anon;
select t_check('anon save_vehicle denied', t_fails($q$select public.save_vehicle('N', 'TN 99 Z 2', 1, '2026-01-01', 0, null, 'active', null)$q$));
select t_check('anon cannot read vehicles', t_fails($q$select * from public.vehicles$q$));

reset role;
do $$
declare bad integer; total integer; r record;
begin
  select count(*) filter (where not ok), count(*) into bad, total from public.t_results;
  for r in select * from public.t_results loop raise notice '% %', case when r.ok then 'PASS' else 'FAIL' end, r.label; end loop;
  if bad > 0 then raise exception 'SQL tests FAILED: % of % checks', bad, total; end if;
  raise notice 'ALL % SQL CHECKS PASSED', total;
end $$;
