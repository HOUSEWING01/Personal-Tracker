# SQL tests (plain Postgres, no Supabase needed)
Run against an empty scratch database:
    psql -d scratch -f supabase/tests/00_supabase_stub.sql      # stubs auth schema + roles
    psql -v ON_ERROR_STOP=1 -d scratch -f supabase/migrations/0001_foundation.sql
    psql -d scratch -f supabase/tests/0001_foundation.test.sql  # read the output
Expected: section A succeeds; B and C error (RLS/permission denied); every statement in D errors; E succeeds.
Last verified: Session 2 on PostgreSQL 16.

Second test: after migration 0002, run `supabase/tests/0002_transaction_totals.test.sql` (expects: A income 1000.30/expense 499.00; B income 1000.30/expense 400.00; C zero rows for non-admin; D permission denied for anon). Last verified: Session 3, PG16.

Third test: after migration 0003, run `supabase/tests/0003_property_rental.test.sql`. It is self-checking: it prints PASS/FAIL per case and ends with `NOTICE: ALL 35 SQL CHECKS PASSED`, or raises `SQL tests FAILED`. Covers one-tenant rule, charge generation, ledger posting, overpayment, advance limits, RLS, and non-admin/anon denial. Last verified: Session 5, PG16.

Fourth test: after migration 0004, run `supabase/tests/0004_transport_masters.test.sql` (same self-checking style; expects `ALL 22 SQL CHECKS PASSED`). Written in Session 6 but **not yet run**: the session had no PostgreSQL. Run it on a scratch DB before relying on it, and correct the expected count here.

Fifth test: on a FRESH scratch DB (stub + migrations 0001..0005), run `supabase/tests/0005_vehicle_investment.test.sql`; expects `ALL 30 SQL CHECKS PASSED`. Not yet run (no PostgreSQL in Session 6). Do not run it on the same database as the 0004 test.

Fifth test, update: run in Session 8 on PG16 (fresh scratch DB, stub + migrations 0001..0005): `ALL 30 SQL CHECKS PASSED`.

Sixth test: on a FRESH scratch DB (stub + migrations 0001..0008), run `supabase/tests/0008_vehicle_loans.test.sql`; expects `ALL 64 SQL CHECKS PASSED`. Last verified: Session 8, PG16. (Tests 0004 and 0005 each need their own fresh DB.)

Seventh test: on a FRESH scratch DB (stub + migrations 0001..0010), run `psql -d scratch -f supabase/tests/0010_sheet_rental.test.sql`; expects `NOTICE: SHEET SMOKE CHECKS PASSED` and a final non-admin refusal. It is a compact smoke test (stock after rent / partial return / close, advance ledger entry, overpayment, discount, cancel rules, undo-return guard, total below committed, non-admin), not an exhaustive suite. Last verified: Session 9, PG16 (the same run caught and fixed a duplicate constraint name in 0010).

Eighth test: on a FRESH scratch DB (stub + migrations 0001..0011), run `psql -d scratch -f supabase/tests/0011_gold_loans.test.sql`; expects `NOTICE: GOLD LOAN SQL CHECKS PASSED` then `non-admin refused: OK`. Covers ledger posting and edits, payment totals, validation, close / release / reopen rules, description sync, one ledger entry per record. Last verified: Session 10, PG16.

Ninth test: on a FRESH scratch DB (stub + migrations 0001..0012), run `psql -d scratch -f supabase/tests/0012_dashboard.test.sql`; expects `DASHBOARD SQL CHECKS PASSED` and `non-admin sees zeros: OK`. Last verified: Session 11, PG16.

Tenth test: on a FRESH scratch DB (stub + migrations 0001..0013), run `psql -d scratch -f supabase/tests/0013_reports.test.sql`; expects `REPORTS SQL CHECKS PASSED`, `non-admin sees nothing: OK` and `anon refused: OK`. Covers `ledger_links` for every entity type (one row per transaction), `report_breakdown` totals, date, module and month grouping, vehicle / property / customer filters, and `report_outstanding` rules. Last verified: Session 12, PG16. The stub (`00_supabase_stub.sql`) can now be re-run when the roles already exist.

Eleventh test: on a FRESH scratch DB (stub + migrations 0001..0013), insert the PRE data described at the top of `supabase/tests/0015_advance_ledger.test.sql` (an admin, property 'Old Shop', advance received 50000 / adjusted 20000 / returned 10000), then run 0014 and 0015 (each as its own run), then the test; expects `ADVANCE LEDGER SQL CHECKS PASSED` and `non-admin refused: OK`. Covers backfill, atomic posting, adjusted posting nothing, limits, report_breakdown and ledger_links. Last verified: Session 13, PG16. 0003, 0010 and 0013 tests also pass with 0014 and 0015 applied.

Twelfth test: on a FRESH scratch DB (stub + migrations 0001..0016), run `psql -d scratch -f supabase/tests/0016_rent_cycles.test.sql`; expects `RENT CYCLE SQL CHECKS PASSED (18)`. Covers rent billed per tenancy month from the joining day (due when the month ends), month-end clamping, leaving rules, inactive godowns and non-admin / anon refusal. Last verified: Session 14, PG16. The 0012 and 0013 tests still pass with 0016 applied. The 0003 test describes the OLD calendar-month rules: run it on 0001..0003 (or up to 0015), not after 0016.

