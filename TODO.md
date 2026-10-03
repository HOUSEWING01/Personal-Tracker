# TODO

## P0 — Critical
- [ ] (Admin) Migration 0013 is run; open Reports and compare This month with the Dashboard and Finance (same revenue, expenses, profit); try a vehicle, a property and a customer filter; confirm D-027
- [x] SQL test for 0013 written and passing on PG16 (Session 12)
- [ ] Phase 10 follow-up: open every screen at 360 px and at desktop width in a browser; run axe or Lighthouse; try the menu, dialogs and tabs with the keyboard and a screen reader (D-028 lists what was only reviewed in code)
- [ ] (Admin) Run `0014_deposit_types.sql` ALONE, then `0015_advance_ledger.sql` (after 0013); check Finance > Transactions shows Deposit received / returned for existing advances, and confirm D-029
- [ ] (Admin) Run migration 0012 after 0011; open the Dashboard and compare each tile with the module screens; confirm D-026
- [ ] (Admin) Run migration 0011 after 0010; try Gold loans (add a loan: loan received appears in Finance; add a payment: repayment appears; close then release); confirm D-024 and D-025 (simple interest, estimated balance)
- [ ] (Admin) Run migration 0010 after 0009; try Sheet rental (advance appears in Finance; partial return updates Stock); confirm D-022 and D-023
- [x] Verify Phase 5a-5d compile and tests: `npm install`, `tsc`, build and 84 tests passed in Session 8 (confirm on your machine)
- [ ] Run SQL test 0004 on PG16 (own scratch DB) and confirm its count in supabase/tests/README.md (0005 passed 30/30 in Session 8)
- [ ] (Admin) Run migration 0005 in Supabase; try Transport (vehicle investment entries appear in Finance). 0003 and 0004 already run.
- [ ] (Admin) Run migration 0008 after 0007; try Transport > Loans (loan received and repayment entries appear in Finance; profit unchanged); confirm D-020
- [ ] (Admin) Run migration 0006 then 0007; try Transport > Trips, Fuel, Tolls; confirm D-018 and D-019
- [ ] Tests for Phase 5b (deferred): `transportEngine` trip revenue cases, `tripFormSchema`, SQL test `0006_trips.test.sql` (save_trip, ledger sync, status changes, inactive vehicle/driver, RLS)

## P1 — Important
- [ ] Tests for the Reports page (deferred): filters in the URL, outstanding rules per filter, CSV download
- [ ] Reports: add a per-vehicle and per-customer breakdown table if the admin wants one; paginate By month if history grows beyond a few years
- [ ] Tests for Dashboard page (deferred)
- [ ] Tests for Phase 7 (deferred): Gold loan dialogs / page, `goldForms` schemas
- [ ] Delete / void a gold loan payment or a gold loan (needs the ledger entry removed in the same transaction)
- [ ] Tests for Phase 6 (deferred): `sheetEngine`, `sheetForms` schemas, Rentals/Returns/Payments dialogs, a fuller SQL test for 0010 (the smoke test exists)
- [ ] Recover damaged / missing sheets (repaired or found) so stock can go back up; needs a stock adjustment record
- [ ] Charge for damaged or missing sheets (today the admin raises the rent by hand)
- [ ] Delete / void a sheet payment (reverse the payment and its ledger entry together, via a DB function); edit a return
- [ ] Multi-size rentals (rental header + lines) if one rental per size proves awkward (D-022)
- [x] Loan interest = part of the repayment (D-009 resolved)
- [x] Phase 5a-2: vehicle purchase + container price posted as `investment` (code; unverified)
- [ ] (Admin) Run migration 0009; check Transport > Profit; confirm D-021
- [ ] Delete / void a loan payment or a loan (needs the ledger entry removed in the same transaction)
- [ ] Decide whether an outstanding loan balance is wanted (needs a principal/interest split or a typed balance; D-020)
- [ ] Tests for Loans UI (LoansTab, LoanDialog, LoanPaymentsDialog)
- [ ] Tests for Phase 5c (deferred): `fuelTotalPaise` / `tripOperatingProfitPaise`, `fuelFormSchema` / `tollFormSchema`, SQL test `0007_fuel_tolls.test.sql` (ledger sync, same-vehicle rule, trip vehicle lock, RLS)
- [ ] Delete fuel logs and tolls (needs the ledger entry removed in the same transaction)
- [ ] Delete / deactivate rules for vehicles, drivers, customers and trips (trips now reference them; cancelled is the only way to retire a trip)
- [ ] Tests for Transport tabs and dialogs (reuse the RentPaymentDialog test setup)
- [ ] Move `parseMoney` from property/propertyForms to `lib/` (now used by two modules)
- [x] Advance received/returned now in cash flow (D-029, Session 13)
- [ ] Void/correct a rent payment (reverse the payment and its ledger entry together, via a DB function)
- [ ] Tenant history when a tenant is replaced (D-012)
- [ ] Correct an existing month's expected rent
- [ ] UI tests for PropertyListPage, PropertyDetailPage, TenantDialog, AdvanceDialog
- [x] Shared list component: `features/transport/MasterList` (Property list still has its own table; migrate later)
- [ ] Frontend tests for auth states (RequireAdmin) (DOM test env now available)
- [ ] Edit/delete transaction (decide: manual entries only; module-generated ones are edited via their source record)

## P2 — Enhancement
- [ ] Decide whether to add a serif display face for brand moments (reference uses one)
- [ ] Visual/mobile check of shell on a real device
- [ ] ESLint config
- [ ] Code-split routes (bundle >500 kB warning) in Phase 10
- [ ] Password reset flow (not needed yet; admin can reset in Supabase dashboard)

## Completed
- [x] Phase 8: Dashboard, migration 0012, D-026 (code; typecheck + build + 93 Vitest + PG16 SQL test; no UI tests, not run live)
- [x] Phase 7: gold loans, migration 0011, D-024 / D-025 (code; typecheck + build + 91 Vitest + PG16 migration and SQL test; no UI tests, not run live)
- [x] Phase 6: sheet rental, migration 0010, D-022 / D-023 (code; typecheck + build + PG16 migration and smoke test; no frontend tests, not run live)
- [x] Phase 5e: transport profit, migration 0009, D-021 (code; typecheck + build only)
- [x] Phase 5d: vehicle loans, migration 0008, D-020, 14 Vitest tests + 64 SQL checks (code verified in the sandbox; not run live)
- [x] Phase 5c: fuel, tolls, trip operating profit, migration 0007, D-019 (code; unverified, no tests yet)
- [x] Phase 5b: trips, migration 0006, D-018 (code; unverified, no tests yet)
- [x] Phase 5a: vehicles, drivers, customers (code; unverified), migration 0004, D-016/D-017; 0004 run live by admin
- [x] Auth hang fix: 10 s timeout + visible retry (54 tests passed at that time)
- [x] Phase 4: property rental, migration 0003, 35 SQL checks + 23 new frontend tests (51 pass)
- [x] (Admin) Supabase setup per docs/SUPABASE_SETUP.md reported done
- [x] Phase 3b: Add transaction form, Dialog, FormField, DOM tests (28 pass)
- [x] Phase 3: financial engine, totals function, Transactions screen, tests (16 pass)
- [x] Phase 2 code: migration 0001, RLS, auth, protected routes, SQL tests (PG16)
- [x] Apply brand palette 07 to theme + docs
- [x] Phase 0 docs
- [x] Phase 1 foundation and app shell
- [ ] Vehicle maintenance (migration 0023): run it on the live database and a scratch PG, and add a SQL test (ledger posting and edit, `maintenance_due` latest-per-kind, `vehicle_profit_totals` maintenance column, RLS). Not yet run anywhere. Due reminders are by date only (no km-based due).
