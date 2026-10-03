-- 0016_rent_cycles.sql
-- Rent is billed per TENANCY month counted from the day the tenant joined, and each month's rent falls due when that
-- month ends (paid in arrears). A tenant who joined on 3 Sep owes the first month (3 Sep - 2 Oct) from 3 Oct, the next
-- (3 Oct - 2 Nov) from 3 Nov, and so on. Before: one charge per calendar month, due from the 1st. See DECISIONS D-033.
--
-- `period` is now the FIRST DAY OF THE TENANCY MONTH (any day), no longer always the 1st.
-- If the tenant leaves, the month they leave in is billed in full from the day they leave.
-- Rent payments keep pointing at (property_id, period), so nothing else changes.

alter table public.rent_charges drop constraint if exists rent_charges_period_check;

-- Existing UNPAID charges were built on calendar months and would clash with the new periods: drop them. They are
-- recreated by ensure_rent_charges on the next screen load. Charges that already have a payment are kept as they are.
delete from public.rent_charges c
 where not exists (select 1 from public.rent_payments r where r.property_id = c.property_id and r.period = c.period);

create or replace function public.ensure_rent_charges(p_property_id uuid default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_added integer;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  insert into public.rent_charges (property_id, period, expected_amount)
  select p.id, (t.rental_start_date + (k * interval '1 month'))::date, p.monthly_rent
  from public.properties p
  join public.tenants t on t.property_id = p.id
  cross join lateral generate_series(0, 599) as k
  where p.status = 'active' and (p_property_id is null or p.id = p_property_id)
    -- no tenancy month starts after the tenant has left
    and (t.rental_end_date is null or (t.rental_start_date + (k * interval '1 month'))::date <= t.rental_end_date)
    and (
      -- the month is complete, so its rent is due
      (t.rental_start_date + ((k + 1) * interval '1 month'))::date <= v_today
      -- or the tenant has left: the month they left in is billed in full
      or (t.rental_end_date is not null and t.rental_end_date <= v_today)
    )
  on conflict (property_id, period) do nothing;
  get diagnostics v_added = row_count;
  return v_added;
end $$;

-- Same function as 0003, with the ledger description naming the day the tenancy month starts ("from 03 Sep 2026").
create or replace function public.record_rent_payment(
  p_property_id uuid, p_period date, p_amount numeric,
  p_payment_date date, p_payment_method text default null, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_charge  public.rent_charges%rowtype;
  v_paid    numeric;
  v_name    text;
  v_pay_id  uuid := gen_random_uuid();
  v_tx_id   uuid;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be greater than zero'; end if;
  select * into v_charge from public.rent_charges
    where property_id = p_property_id and period = p_period for update;
  if not found then raise exception 'no rent is due for that month'; end if;
  select coalesce(sum(amount), 0) into v_paid from public.rent_payments
    where property_id = p_property_id and period = p_period;
  if v_paid + p_amount > v_charge.expected_amount then
    raise exception 'payment exceeds the outstanding rent for that month';
  end if;
  select name into v_name from public.properties where id = p_property_id;
  insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, payment_method, description)
  values ('customer_payment', p_amount, 'property', 'rent_payment', v_pay_id, p_payment_date, p_payment_method,
          'Rent - ' || v_name || ' - month from ' || to_char(p_period, 'DD Mon YYYY'))
  returning id into v_tx_id;
  insert into public.rent_payments (id, property_id, period, amount, payment_date, payment_method, notes, transaction_id)
  values (v_pay_id, p_property_id, p_period, p_amount, p_payment_date, p_payment_method, nullif(btrim(p_notes), ''), v_tx_id);
  return v_pay_id;
end $$;
revoke all on function public.record_rent_payment(uuid, date, numeric, date, text, text) from public, anon;
grant execute on function public.record_rent_payment(uuid, date, numeric, date, text, text) to authenticated;
revoke all on function public.ensure_rent_charges(uuid) from public, anon;
grant execute on function public.ensure_rent_charges(uuid) to authenticated;
