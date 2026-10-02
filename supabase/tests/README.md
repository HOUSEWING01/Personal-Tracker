# SQL tests (plain Postgres, no Supabase needed)
Run against an empty scratch database:
    psql -d scratch -f supabase/tests/00_supabase_stub.sql      # stubs auth schema + roles
    psql -v ON_ERROR_STOP=1 -d scratch -f supabase/migrations/0001_foundation.sql
    psql -d scratch -f supabase/tests/0001_foundation.test.sql  # read the output
Expected: section A succeeds; B and C error (RLS/permission denied); every statement in D errors; E succeeds.
Last verified: Session 2 on PostgreSQL 16.

Second test: after migration 0002, run `supabase/tests/0002_transaction_totals.test.sql` (expects: A income 1000.30/expense 499.00; B income 1000.30/expense 400.00; C zero rows for non-admin; D permission denied for anon). Last verified: Session 3, PG16.

Third test: after migration 0003, run `supabase/tests/0003_property_rental.test.sql`. It is self-checking: it prints PASS/FAIL per case and ends with `NOTICE: ALL 35 SQL CHECKS PASSED`, or raises `SQL tests FAILED`. Covers one-tenant rule, charge generation, ledger posting, overpayment, advance limits, RLS, and non-admin/anon denial. Last verified: Session 5, PG16.
