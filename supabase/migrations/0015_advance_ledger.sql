-- 0015_advance_ledger.sql  (D-029, option 2 for D-015)
-- Property advance received / returned now post a deposit_received / deposit_returned ledger entry in the same transaction,
-- so cash flow matches the money actually held. They never touch revenue, expenses or profit. 'adjusted' (deposit kept
-- against rent or damage) moves no cash and posts nothing. Run AFTER 0014 has completed.

alter table public.advance_movements add column transaction_id uuid unique references public.transactions (id) on delete restrict;

-- Backfill: one ledger entry per existing received / returned movement (module property, dated the movement date).
do $$
declare
  r    record;
  v_tx uuid;
begin
  for r in
    select a.id, a.kind, a.amount, a.movement_date, p.name
      from public.advance_movements a join public.properties p on p.id = a.property_id
     where a.kind in ('received', 'returned') and a.transaction_id is null
     order by a.created_at
  loop
    insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, description)
    values ((case r.kind when 'received' then 'deposit_received' else 'deposit_returned' end)::public.transaction_type,
            r.amount, 'property', 'advance_movement', r.id, r.movement_date,
            case r.kind when 'received' then 'Advance received - ' else 'Advance returned - ' end || r.name)
    returning id into v_tx;
    update public.advance_movements set transaction_id = v_tx where id = r.id;
  end loop;
end $$;

alter table public.advance_movements add constraint advance_movements_ledger_check
  check ((kind = 'adjusted') = (transaction_id is null));

-- Reports: the property filter must also see advance entries.
create or replace view public.ledger_links with (security_invoker = true) as
select
  t.id as transaction_id,
  coalesce(tr.vehicle_id, fl.vehicle_id, tl.vehicle_id, vl.vehicle_id, vl2.vehicle_id, v.id) as vehicle_id,
  coalesce(rp.property_id, am.property_id)                                                  as property_id,
  coalesce(tr.customer_id, sr.customer_id)                                                   as customer_id
from public.transactions t
left join public.trips tr               on t.entity_type in ('trip_revenue', 'trip_driver') and tr.id = t.entity_id
left join public.fuel_logs fl           on t.entity_type = 'fuel_log' and fl.id = t.entity_id
left join public.tolls tl               on t.entity_type = 'toll' and tl.id = t.entity_id
left join public.vehicle_loans vl       on t.entity_type = 'vehicle_loan' and vl.id = t.entity_id
left join public.loan_payments lpay     on t.entity_type = 'loan_payment' and lpay.id = t.entity_id
left join public.vehicle_loans vl2      on vl2.id = lpay.loan_id
left join public.vehicles v             on t.entity_type in ('vehicle_purchase', 'vehicle_container') and v.id = t.entity_id
left join public.rent_payments rp       on t.entity_type = 'rent_payment' and rp.id = t.entity_id
left join public.advance_movements am  on t.entity_type = 'advance_movement' and am.id = t.entity_id
left join public.sheet_rental_payments sp on t.entity_type = 'sheet_payment' and sp.id = t.entity_id
left join public.sheet_rentals sr       on sr.id = sp.rental_id;

-- Same rules as before; received / returned now also post the deposit entry atomically.
create or replace function public.record_advance_movement(
  p_property_id uuid, p_kind text, p_amount numeric, p_movement_date date, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_remaining numeric;
  v_name      text;
  v_id        uuid := gen_random_uuid();
  v_tx        uuid;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_kind not in ('received', 'adjusted', 'returned') then raise exception 'invalid advance movement kind'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be greater than zero'; end if;
  select name into v_name from public.properties where id = p_property_id for update;
  if not found then raise exception 'property not found'; end if;
  if p_kind <> 'received' then
    select coalesce(sum(case kind when 'received' then amount else -amount end), 0) into v_remaining
      from public.advance_movements where property_id = p_property_id;
    if p_amount > v_remaining then raise exception 'amount exceeds the remaining advance'; end if;
  end if;
  if p_kind <> 'adjusted' then
    insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, description)
    values ((case p_kind when 'received' then 'deposit_received' else 'deposit_returned' end)::public.transaction_type,
            p_amount, 'property', 'advance_movement', v_id, p_movement_date,
            case p_kind when 'received' then 'Advance received - ' else 'Advance returned - ' end || v_name)
    returning id into v_tx;
  end if;
  insert into public.advance_movements (id, property_id, kind, amount, movement_date, notes, transaction_id)
  values (v_id, p_property_id, p_kind, p_amount, p_movement_date, nullif(btrim(p_notes), ''), v_tx);
  return v_id;
end $$;
