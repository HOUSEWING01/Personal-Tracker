\set ON_ERROR_STOP on
-- Self-checking test for migrations 0014 + 0015 (advance deposits in the ledger, D-029).
-- Run on a FRESH scratch DB: stub + migrations 0001..0013, then run the PRE block below, then 0014, then 0015, then this file.
-- PRE (before 0014): create admin a1, property 'Old Shop', and call record_advance_movement for received 50000, adjusted 20000, returned 10000.
-- Expects: "ADVANCE LEDGER SQL CHECKS PASSED", "non-admin refused: OK".
set request.jwt.sub = '00000000-0000-0000-0000-0000000000a1';
do $$
declare
  old_prop uuid; prop uuid; id1 uuid; id2 uuid; id3 uuid; r record; n int;
begin
  -- backfill of the pre-existing movements (50000 received, 20000 adjusted, 10000 returned)
  select id into old_prop from properties where name = 'Old Shop';
  select count(*) into n from advance_movements where property_id = old_prop and kind <> 'adjusted' and transaction_id is not null;
  if n <> 2 then raise exception 'backfill: expected 2 linked movements, got %', n; end if;
  select count(*) into n from advance_movements where property_id = old_prop and kind = 'adjusted' and transaction_id is null;
  if n <> 1 then raise exception 'backfill: adjusted must stay unlinked'; end if;
  select count(*) into n from transactions where type = 'deposit_received' and amount = 50000 and module = 'property' and entity_type = 'advance_movement';
  if n <> 1 then raise exception 'backfill: deposit_received missing'; end if;
  select count(*) into n from transactions where type = 'deposit_returned' and amount = 10000;
  if n <> 1 then raise exception 'backfill: deposit_returned missing'; end if;

  -- new flow
  insert into properties (name, monthly_rent) values ('New Shop', 8000) returning id into prop;
  id1 := record_advance_movement(prop, 'received', 50000, date '2026-10-01');
  id2 := record_advance_movement(prop, 'adjusted', 8000, date '2026-10-20');
  id3 := record_advance_movement(prop, 'returned', 42000, date '2026-10-25');
  select count(*) into n from transactions where entity_type = 'advance_movement' and entity_id in (id1, id2, id3);
  if n <> 2 then raise exception 'expected 2 ledger entries (adjusted posts none), got %', n; end if;
  if exists (select 1 from advance_movements where id = id1 and transaction_id is null) then raise exception 'received not linked'; end if;
  if exists (select 1 from advance_movements where id = id2 and transaction_id is not null) then raise exception 'adjusted wrongly linked'; end if;

  -- limits still enforced and nothing posted on a rejected call
  begin
    perform record_advance_movement(prop, 'returned', 1, date '2026-10-26');
    raise exception 'over-return was accepted';
  exception when others then
    if sqlerrm not like '%exceeds the remaining advance%' then raise; end if;
  end;
  select count(*) into n from transactions where entity_type = 'advance_movement' and entity_id in (select id from advance_movements where property_id = prop);
  if n <> 2 then raise exception 'rejected call left a ledger entry'; end if;

  -- totals: deposits show as their own types; revenue/expense types are untouched
  select coalesce(sum(total) filter (where type = 'deposit_received'), 0) as dr,
         coalesce(sum(total) filter (where type = 'deposit_returned'), 0) as dret,
         coalesce(sum(total) filter (where type in ('income','customer_payment','expense','refund')), 0) as opex
    into r from report_breakdown('total', null, null, 'property', null, prop, null);
  if r.dr <> 50000 or r.dret <> 42000 or r.opex <> 0 then raise exception 'report_breakdown wrong for property filter: %', r; end if;

  -- ledger_links sees the property for advance entries
  select count(*) into n from ledger_links l join transactions t on t.id = l.transaction_id
   where t.entity_type = 'advance_movement' and l.property_id is null;
  if n <> 0 then raise exception 'ledger_links missing property for advance entries'; end if;

  -- ledger link constraint: cannot unlink a received movement
  begin
    update advance_movements set transaction_id = null where id = id1;
    raise exception 'unlinking a received movement was allowed';
  exception when others then
    if sqlerrm not like '%advance_movements_ledger_check%' and sqlerrm not like '%permission denied%' then raise; end if;
  end;
  raise notice 'ADVANCE LEDGER SQL CHECKS PASSED';
end $$;

-- non-admin
reset request.jwt.sub;
set request.jwt.sub = '00000000-0000-0000-0000-0000000000b2';
do $$ begin
  begin
    perform record_advance_movement(gen_random_uuid(), 'received', 1, date '2026-10-01');
    raise exception 'non-admin accepted';
  exception when others then
    if sqlerrm not like '%not authorised%' then raise; end if;
  end;
  raise notice 'non-admin refused: OK';
end $$;
