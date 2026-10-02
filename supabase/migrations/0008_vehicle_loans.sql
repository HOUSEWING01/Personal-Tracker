-- 0008_vehicle_loans.sql  (Phase 5d)
-- Vehicle loans and their repayments (SESSION.md section 11, DECISIONS D-020).
--   loan received -> type 'loan_received',  module 'transport', entity_type 'vehicle_loan', entity_id = loan id, dated the start date
--   each payment  -> type 'loan_repayment', module 'transport', entity_type 'loan_payment', entity_id = payment id,
--                    for the FULL amount paid, interest included (D-009: interest is part of the repayment)
-- Because interest is not split out (D-009), the app cannot know the principal still owed, so no "outstanding"
-- figure is stored or derived. The loan shows what was received and what has been repaid so far.
-- Editing a loan or payment updates its ledger entry (same model as D-016 / D-018 / D-019).
-- Written ONLY through save_vehicle_loan() / save_loan_payment(); the browser can read these tables.
-- interest_rate is recorded for reference only. Nothing is calculated from it.

-- ---------- vehicle_loans ----------
create table public.vehicle_loans (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid references public.vehicles (id) on delete restrict, -- optional: which vehicle the loan financed
  lender        text not null check (length(btrim(lender)) > 0),
  principal     numeric(14, 2) not null check (principal > 0),            -- amount received
  start_date    date not null,
  interest_rate numeric(5, 2) not null check (interest_rate >= 0 and interest_rate <= 100), -- % per year, reference only
  emi           numeric(14, 2) not null check (emi > 0),                  -- monthly instalment, decided by the admin
  tenure_months integer check (tenure_months is null or (tenure_months >= 1 and tenure_months <= 600)),
  status        text not null default 'active' check (status in ('active', 'closed')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index vehicle_loans_start_idx   on public.vehicle_loans (start_date desc, created_at desc);
create index vehicle_loans_vehicle_idx on public.vehicle_loans (vehicle_id) where vehicle_id is not null;
create index vehicle_loans_status_idx  on public.vehicle_loans (status);
create trigger vehicle_loans_set_updated_at before update on public.vehicle_loans
  for each row execute function public.set_updated_at();

-- ---------- loan_payments ----------
create table public.loan_payments (
  id           uuid primary key default gen_random_uuid(),
  loan_id      uuid not null references public.vehicle_loans (id) on delete restrict,
  payment_date date not null,
  amount       numeric(14, 2) not null check (amount > 0),   -- full amount paid, interest included (D-009)
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index loan_payments_loan_idx on public.loan_payments (loan_id, payment_date desc, created_at desc);
create trigger loan_payments_set_updated_at before update on public.loan_payments
  for each row execute function public.set_updated_at();

-- ---------- RLS: browser can read, never write ----------
alter table public.vehicle_loans enable row level security;
alter table public.loan_payments enable row level security;
create policy vehicle_loans_admin_read on public.vehicle_loans for select to authenticated using (public.is_admin());
create policy loan_payments_admin_read on public.loan_payments for select to authenticated using (public.is_admin());
revoke all on public.vehicle_loans, public.loan_payments from anon;

-- One ledger entry per loan and per payment.
create unique index transactions_vehicle_loan_key
  on public.transactions (entity_type, entity_id)
  where entity_type in ('vehicle_loan', 'loan_payment');

-- ---------- per-loan repayment totals (raw sums only) ----------
create view public.loan_payment_totals with (security_invoker = true) as
select l.id as loan_id,
       coalesce((select sum(p.amount) from public.loan_payments p where p.loan_id = l.id), 0) as paid_total,
       (select count(*) from public.loan_payments p where p.loan_id = l.id)                  as payment_count,
       (select max(p.payment_date) from public.loan_payments p where p.loan_id = l.id)      as last_payment_date
  from public.vehicle_loans l;
revoke all on public.loan_payment_totals from anon;

-- ---------- save_vehicle_loan ----------
-- p_id null = create, otherwise edit. Posts / updates the loan_received entry in the same transaction.
-- The start date cannot move after an existing payment (a payment cannot precede the loan).
create or replace function public.save_vehicle_loan(
  p_vehicle_id uuid, p_lender text, p_principal numeric, p_start_date date, p_interest_rate numeric,
  p_emi numeric, p_tenure_months integer, p_status text, p_notes text, p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  v_tx   uuid;
  v_desc text;
  v      public.vehicles%rowtype;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_lender is null or length(btrim(p_lender)) = 0 then raise exception 'lender is required'; end if;
  if p_principal is null or p_principal <= 0 then raise exception 'amount received must be greater than zero'; end if;
  if p_start_date is null then raise exception 'start date is required'; end if;
  if p_interest_rate is null or p_interest_rate < 0 or p_interest_rate > 100 then raise exception 'interest rate must be between 0 and 100'; end if;
  if p_emi is null or p_emi <= 0 then raise exception 'EMI must be greater than zero'; end if;
  if p_tenure_months is not null and (p_tenure_months < 1 or p_tenure_months > 600) then raise exception 'tenure must be between 1 and 600 months'; end if;
  if p_status is null or p_status not in ('active', 'closed') then raise exception 'invalid loan status'; end if;

  if p_vehicle_id is not null then
    select * into v from public.vehicles where id = p_vehicle_id;
    if not found then raise exception 'vehicle not found'; end if;
  end if;

  if p_id is null then
    insert into public.vehicle_loans (vehicle_id, lender, principal, start_date, interest_rate, emi, tenure_months, status, notes)
    values (p_vehicle_id, btrim(p_lender), p_principal, p_start_date, p_interest_rate, p_emi, p_tenure_months, p_status, nullif(btrim(p_notes), ''))
    returning id into v_id;
  else
    perform 1 from public.vehicle_loans where id = p_id for update;
    if not found then raise exception 'loan not found'; end if;
    if exists (select 1 from public.loan_payments where loan_id = p_id and payment_date < p_start_date) then
      raise exception 'loan has payments before the start date';
    end if;
    update public.vehicle_loans
       set vehicle_id = p_vehicle_id, lender = btrim(p_lender), principal = p_principal, start_date = p_start_date,
           interest_rate = p_interest_rate, emi = p_emi, tenure_months = p_tenure_months, status = p_status,
           notes = nullif(btrim(p_notes), '')
     where id = p_id
    returning id into v_id;
  end if;

  v_desc := 'Vehicle loan received - ' || btrim(p_lender) || case when p_vehicle_id is null then '' else ' - ' || v.name || ' (' || v.registration_number || ')' end;
  select id into v_tx from public.transactions where entity_type = 'vehicle_loan' and entity_id = v_id;
  if v_tx is null then
    insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, description)
    values ('loan_received', p_principal, 'transport', 'vehicle_loan', v_id, p_start_date, v_desc);
  else
    update public.transactions set amount = p_principal, transaction_date = p_start_date, description = v_desc where id = v_tx;
  end if;
  -- If the lender was renamed, keep the repayment entries' descriptions in step.
  update public.transactions t set description = 'Loan repayment - ' || btrim(p_lender)
   where t.entity_type = 'loan_payment' and t.entity_id in (select p.id from public.loan_payments p where p.loan_id = v_id);
  return v_id;
end $$;
revoke all on function public.save_vehicle_loan(uuid, text, numeric, date, numeric, numeric, integer, text, text, uuid) from public, anon;
grant execute on function public.save_vehicle_loan(uuid, text, numeric, date, numeric, numeric, integer, text, text, uuid) to authenticated;

-- ---------- save_loan_payment ----------
-- The full amount paid (interest included) posts as ONE loan_repayment (D-009).
-- A NEW payment needs an active loan; an existing payment stays editable after the loan is closed.
-- A payment cannot be dated before the loan's start date. The loan of an existing payment cannot change.
create or replace function public.save_loan_payment(
  p_loan_id uuid, p_payment_date date, p_amount numeric, p_notes text, p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  l      public.vehicle_loans%rowtype;
  old    public.loan_payments%rowtype;
  v_tx   uuid;
  v_desc text;
begin
  if not public.is_admin() then raise exception 'not authorised' using errcode = '42501'; end if;
  if p_payment_date is null then raise exception 'payment date is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'payment amount must be greater than zero'; end if;

  select * into l from public.vehicle_loans where id = p_loan_id for update;
  if not found then raise exception 'loan not found'; end if;
  if p_payment_date < l.start_date then raise exception 'payment is before the loan start date'; end if;

  if p_id is null then
    if l.status <> 'active' then raise exception 'loan is closed'; end if;
    insert into public.loan_payments (loan_id, payment_date, amount, notes)
    values (p_loan_id, p_payment_date, p_amount, nullif(btrim(p_notes), ''))
    returning id into v_id;
  else
    select * into old from public.loan_payments where id = p_id for update;
    if not found then raise exception 'payment not found'; end if;
    if old.loan_id <> p_loan_id then raise exception 'payment belongs to a different loan'; end if;
    update public.loan_payments
       set payment_date = p_payment_date, amount = p_amount, notes = nullif(btrim(p_notes), '')
     where id = p_id
    returning id into v_id;
  end if;

  v_desc := 'Loan repayment - ' || l.lender;
  select id into v_tx from public.transactions where entity_type = 'loan_payment' and entity_id = v_id;
  if v_tx is null then
    insert into public.transactions (type, amount, module, entity_type, entity_id, transaction_date, description)
    values ('loan_repayment', p_amount, 'transport', 'loan_payment', v_id, p_payment_date, v_desc);
  else
    update public.transactions set amount = p_amount, transaction_date = p_payment_date, description = v_desc where id = v_tx;
  end if;
  return v_id;
end $$;
revoke all on function public.save_loan_payment(uuid, date, numeric, text, uuid) from public, anon;
grant execute on function public.save_loan_payment(uuid, date, numeric, text, uuid) to authenticated;
