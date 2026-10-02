-- 0001_foundation.sql
-- Shared foundation: admin allowlist + RLS helper, enums, customers, transactions.
-- Module-specific tables are added by the migration of each module phase (see DECISIONS D-007).

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- admin allowlist (single admin, but extensible) ----------
create table public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- Intentionally NO policies: clients cannot read or write this table directly.

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------- enums ----------
create type public.business_module as enum ('property', 'transport', 'sheets', 'gold_loans', 'general');

create type public.transaction_type as enum (
  'income', 'expense', 'investment', 'loan_received',
  'loan_repayment', 'customer_payment', 'refund', 'adjustment'
);

-- ---------- customers (shared; reusable across modules) ----------
create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  mobile     text check (mobile is null or mobile ~ '^[0-9]{10}$'),
  address    text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index customers_mobile_key on public.customers (mobile) where mobile is not null;
create index customers_name_idx on public.customers (lower(name));
create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------- transactions (common financial ledger) ----------
-- Amount is always positive, direction is implied by `type`.
-- Exception: 'adjustment' may be negative (non-zero).
create table public.transactions (
  id               uuid primary key default gen_random_uuid(),
  type             public.transaction_type not null,
  amount           numeric(14, 2) not null,
  module           public.business_module not null,
  entity_type      text,
  entity_id        uuid,
  transaction_date date not null,
  payment_method   text,
  description      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint transactions_amount_check check (
    (type = 'adjustment' and amount <> 0) or (type <> 'adjustment' and amount > 0)
  ),
  constraint transactions_entity_pair_check check (
    (entity_type is null) = (entity_id is null)
  )
);
create index transactions_date_idx   on public.transactions (transaction_date desc);
create index transactions_module_idx on public.transactions (module, transaction_date desc);
create index transactions_type_idx   on public.transactions (type);
create index transactions_entity_idx on public.transactions (entity_type, entity_id);
create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------- RLS: authenticated admin only ----------
alter table public.customers    enable row level security;
alter table public.transactions enable row level security;

create policy customers_admin_all on public.customers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy transactions_admin_all on public.transactions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Defense in depth: anonymous role gets no table privileges at all.
revoke all on public.admin_users, public.customers, public.transactions from anon;
