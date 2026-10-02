-- 0011_gold_loans.sql  (Phase 7)
-- Bank-pledged gold loans (SESSION.md section 14, DECISIONS D-024 / D-025).
-- This is NOT a lending business: the owner pledges gold to a BANK and receives a loan.
--   loan received -> type 'loan_received',  module 'gold_loans', entity_type 'gold_loan', entity_id = loan id, dated the pledge date
--   each payment  -> type 'loan_repayment', module 'gold_loans', entity_type 'gold_loan_payment', entity_id = payment id,
--                    for the FULL amount paid, interest included (D-009)
-- Accrued interest is NOT stored. It is calculated in one place in the app (services/goldInterest.ts):
--   interest = principal x annual rate x days / 365. No gold valuation logic exists anywhere.
-- Status flow: active -> closed (loan repaid, gold still with the bank) -> released (gold back with the owner).
-- Written ONLY through save_gold_loan() / save_gold_loan_payment(); the browser can read these tables.

-- ---------- gold_loans ----------
create table public.gold_loans (
  id                uuid primary key default gen_random_uuid(),
  person_name       text not null check (length(btrim(person_name)) > 0),
  mobile            text check (mobile is null or mobile ~ '^[0-9]{10}$'),
  gold_description  text not null check (length(btrim(gold_description)) > 0),
  gold_weight_grams numeric(10, 3) check (gold_weight_grams is null or gold_weight_grams > 0),
  bank              text not null check (length(btrim(bank)) > 0),
  pledge_date       date not null,
  due_date          date,
  principal         numeric(14, 2) not null check (principal > 0),               -- amount received from the bank
  annual_rate       numeric(5, 2) not null check (annual_rate >= 0 and annual_rate <= 100), -- % per year
  status            text not null default 'active' check (status in ('active', 'closed', 'released')),
  closed_date       date,                                                         -- interest stops accruing here
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint gold_loans_due_check check (due_date is null or due_date >= pledge_date),
  constraint gold_loans_closed_check check (
    (status = 'active' and closed_date is null)
    or (status <> 'active' and closed_date is not null and closed_date >= pledge_date)
  )
);
create index gold_loans_pledge_idx on public.gold_loans (pledge_date desc, created_at desc);
create index gold_loans_status_idx on public.gold_loans (status);
create index gold_loans_due_idx    on public.gold_loans (due_date) where status = 'active' and due_date is not null;
create trigger gold_loans_set_updated_at before update on public.gold_loans
  for each row execute function public.set_updated_at();

-- ---------- gold_loan_payments ----------
create table public.gold_loan_payments (
  id           uuid primary key default gen_random_uuid(),
  loan_id      uuid not null references public.gold_loans (id) on delete restrict,
  payment_date date not null,
  amount       numeric(14, 2) not null check (amount > 0),   -- full amount paid, interest included (D-009)
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index gold_loan_payments_loan_idx on public.gold_loan_payments (loan_id, payment_date desc, created_at desc);
create trigger gold_loan_payments_set_updated_at before update on public.gold_loan_payments
  for each row execute function public.set_updated_at();

-- ---------- RLS: browser can read, never write ----------
alter table public.gold_loans enable row level security;
alter table public.gold_loan_payments enable row level security;
create policy gold_loans_admin_read on public.gold_loans for select to authenticated using (public.is_admin());
create policy gold_loan_payments_admin_read on public.gold_loan_payments for select to authenticated using (public.is_admin());
revoke all on public.gold_loans, public.gold_loan_payments from anon;

-- One ledger entry per loan and per payment.
create unique index transactions_gold_loan_key
  on public.transactions (entity_type, entity_id)
  where entity_type in ('gold_loan', 'gold_loan_payment');

-- ---------- per-loan repayment totals (raw sums only) ----------
create view public.gold_loan_payment_totals with (security_invoker = true) as
select l.id as loan_id,
       coalesce((select sum(p.amount) from public.gold_loan_payments p where p.loan_id = l.id), 0) as paid_total,
       (select count(*) from public.gold_loan_payments p where p.loan_id = l.id)                  as payment_count,
       (select max(p.payment_date) from public.gold_loan_payments p where p.loan_id = l.id)      as last_payment_date
  from public.gold_loans l;
revoke all on public.gold_loan_payment_totals from anon;

-- ---------- save_gold_loan ----------
-- p_id null = create, otherwise edit. Posts / updates the loan_received entry in the same transaction.
-- Rules: pledge date cannot move after an existing payment; closing date cannot precede the last payment.
create or replace function public.save_gold_loan(
  p_person_name text, p_mobile text, p_gold_description text, p_gold_weight_grams numeric, p_bank text,
  p_pledge_date date, p_due_date date, p_principal numeric, p_annual_rate numeric, p_status text,
  p_closed_date date, p_notes text, p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid;
  v_tx     uuid;
  v_desc   text;
  v_closed date;
  v_mobile text := nullif(btrim(p_mobile), '');
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_person_name is null or length(btrim(p_person_name)) = 0 then raise exception 'person name is required'; end if;
  if v_mobile is not null and v_mobile !~ '^[0-9]{10}$' then raise exception 'mobile must be 10 digits'; end if;
  if p_gold_description is null or length(btrim(p_gold_description)) = 0 then raise exception 'gold description is required'; end if;
  if p_gold_weight_grams is not null and p_gold_weight_grams <= 0 then raise exception 'gold weight must be greater than zero'; end if;
  if p_bank is null or length(btrim(p_bank)) = 0 then raise exception 'bank is required'; end if;
  if p_pledge_date is null then raise exception 'pledge date is required'; end if;
  if p_due_date is not null and p_due_date < p_pledge_date then raise exception 'due date is before the pledge date'; end if;
  if p_principal is null or p_principal <= 0 then raise exception 'amount received must be greater than zero'; end if;
  if p_annual_rate is null or p_annual_rate < 0 or p_annual_rate > 100 then raise exception 'interest rate must be between 0 and 100'; end if;
  if p_status is null or p_status not in ('active', 'closed', 'released') then raise exception 'invalid loan status'; end if;

  v_closed := case when p_status = 'active' then null else p_closed_date end;
  if p_status <> 'active' then
    if v_closed is null then raise exception 'closing date is required'; end if;
    if v_closed < p_pledge_date then raise exception 'closing date is before the pledge date'; end if;
  end if;

  if p_id is null then
    insert into public.gold_loans (person_name, mobile, gold_description, gold_weight_grams, bank, pledge_date, due_date,
                                   principal, annual_rate, status, closed_date, notes)
    values (btrim(p_person_name), v_mobile, btrim(p_gold_description), p_gold_weight_grams, btrim(p_bank), p_pledge_date, p_due_date,
            p_principal, p_annual_rate, p_status, v_closed, nullif(btrim(p_notes), ''))
    returning id into v_id;
  else
    perform 1 from public.gold_loans where id = p_id for update;
    if not found then raise exception 'loan not found'; end if;
    if exists (select 1 from public.gold_loan_payments where loan_id = p_id and payment_date < p_pledge_date) then
      raise exception 'loan has payments before the pledge date';
    end if;
    if v_closed is not null and exists (select 1 from public.gold_loan_payments where loan_id = p_id and payment_date > v_closed) then
      raise exception 'loan has payments after the closing date';
    end if;
    update public.gold_loans
       set person_name = btrim(p_person_name), mobile = v_mobile, gold_description = btrim(p_gold_description),
           gold_weight_grams = p_gold_weight_grams, bank = btrim(p_bank), pledge_date = p_pledge_date, due_date = p_due_date,
           principal = p_principal, annual_rate = p_annual_rate, status = p_status, closed_date = v_closed,
           notes = nullif(btrim(p_notes), '')
     where id = p_id
    returning id into v_id;
  end if;

  v_desc := 'Gold loan received - ' || btrim(p_bank) || ' - ' || btrim(p_person_name);
  select id into v_tx from public.transactions where entity_type = 'gold_loan' and entity_id = v_id;
  if v_tx is null then
    insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, description)
    values ('loan_received', p_principal, 'gold_loans', 'gold_loan', v_id, p_pledge_date, v_desc);
  else
    update public.transactions set amount = p_principal, transaction_date = p_pledge_date, description = v_desc where id = v_tx;
  end if;
  -- If the bank or person was renamed, keep the repayment entries' descriptions in step.
  update public.transactions t set description = 'Gold loan repayment - ' || btrim(p_bank) || ' - ' || btrim(p_person_name)
   where t.entity_type = 'gold_loan_payment'
     and t.entity_id in (select p.id from public.gold_loan_payments p where p.loan_id = v_id);
  return v_id;
end $$;
revoke all on function public.save_gold_loan(text, text, text, numeric, text, date, date, numeric, numeric, text, date, text, uuid) from public, anon;
grant execute on function public.save_gold_loan(text, text, text, numeric, text, date, date, numeric, numeric, text, date, text, uuid) to authenticated;

-- ---------- save_gold_loan_payment ----------
-- The full amount paid (interest included) posts as ONE loan_repayment (D-009).
-- A NEW payment needs an active loan; an existing payment stays editable after the loan is closed.
-- A payment cannot be dated before the pledge date, or after the closing date of a closed loan.
create or replace function public.save_gold_loan_payment(
  p_loan_id uuid, p_payment_date date, p_amount numeric, p_notes text, p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  l      public.gold_loans%rowtype;
  old    public.gold_loan_payments%rowtype;
  v_tx   uuid;
  v_desc text;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_payment_date is null then raise exception 'payment date is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'payment amount must be greater than zero'; end if;

  select * into l from public.gold_loans where id = p_loan_id for update;
  if not found then raise exception 'loan not found'; end if;
  if p_payment_date < l.pledge_date then raise exception 'payment is before the pledge date'; end if;
  if l.closed_date is not null and p_payment_date > l.closed_date then raise exception 'payment is after the closing date'; end if;

  if p_id is null then
    if l.status <> 'active' then raise exception 'loan is closed'; end if;
    insert into public.gold_loan_payments (loan_id, payment_date, amount, notes)
    values (p_loan_id, p_payment_date, p_amount, nullif(btrim(p_notes), ''))
    returning id into v_id;
  else
    select * into old from public.gold_loan_payments where id = p_id for update;
    if not found then raise exception 'payment not found'; end if;
    if old.loan_id <> p_loan_id then raise exception 'payment belongs to a different loan'; end if;
    update public.gold_loan_payments
       set payment_date = p_payment_date, amount = p_amount, notes = nullif(btrim(p_notes), '')
     where id = p_id
    returning id into v_id;
  end if;

  v_desc := 'Gold loan repayment - ' || l.bank || ' - ' || l.person_name;
  select id into v_tx from public.transactions where entity_type = 'gold_loan_payment' and entity_id = v_id;
  if v_tx is null then
    insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, description)
    values ('loan_repayment', p_amount, 'gold_loans', 'gold_loan_payment', v_id, p_payment_date, v_desc);
  else
    update public.transactions set amount = p_amount, transaction_date = p_payment_date, description = v_desc where id = v_tx;
  end if;
  return v_id;
end $$;
revoke all on function public.save_gold_loan_payment(uuid, date, numeric, text, uuid) from public, anon;
grant execute on function public.save_gold_loan_payment(uuid, date, numeric, text, uuid) to authenticated;
