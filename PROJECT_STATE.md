# Project State

## Current Phase
Phase 9 — Reports and Phase 10 — responsive / accessibility / performance audit are CODE COMPLETE (Session 12): migration 0013, `/reports`, lazy routes, shell accessibility. All ten planned phases now exist in code. Migration 0013 has not been run anywhere, and nothing has been seen in a browser. Earlier: Phase 8 — Dashboard is CODE COMPLETE (Session 11): migration 0012, `/` page. Earlier: Phase 7 — Gold loan is CODE COMPLETE (Session 10): migration 0011, `goldInterest` service, `/gold-loans` page (see Last Completed Task). Phase 6 — Sheet rental is CODE COMPLETE (Session 9): migration 0010, types, service, engine, forms, hooks and the `/sheets` page with Rentals / Stock / Products tabs. Phase 5 Transport (5a-5e) is also code complete. The whole project compiles (`tsc`, `npm run build`) and migrations 0001-0010 apply cleanly in order on PostgreSQL 16 (Session 9). Nothing from 5a onward, and none of Phase 6, has been run against the real Supabase project or in a browser. Run live by the admin: 0001-0008 (0009 was to be run once); 0010 has not been run.

## Current Feature
None in progress. Next: run migrations 0010-0013 live and check every module in a browser (see TODO.md P0).

## Last Completed Task
Phase 9 Reports and Phase 10 audit (Session 12): migration 0013 (`ledger_links`, `report_breakdown()`, `report_outstanding()`), `features/reports/*`, `services/reportService.ts`, route `/reports`, D-027; audit changes in D-028 (lazy routes and vendor chunks, skip link, focus and title on navigation, mobile menu focus trap, arrow-key tabs, shared `StatTile`, Settings placeholder removed). Typecheck, build (no warnings) and 99 tests pass; not run live.

Before that: Phase 8 Dashboard (Session 11): migration 0012 `dashboard_counts()`, `services/dashboardService.ts`, `features/dashboard/*` (engine, hooks, page), route `/`, D-026. Typecheck, build, 93 tests and the PG16 SQL test pass; not run live. No charts by design.

Before that: Phase 7 gold loans (Session 10): migration 0011 (`gold_loans`, `gold_loan_payments`, view `gold_loan_payment_totals`, `save_gold_loan`, `save_gold_loan_payment`), `services/goldInterest.ts` (the one interest calculation), `features/gold/*` (engine, forms, hooks, list page, loan dialog, payments dialog), route `/gold-loans`, D-024 / D-025. Typecheck, build, 91 Vitest tests, PG16 migrations 0001-0011 and new SQL test pass. No UI tests (admin wants the complete app first); not run live.

Before that: Phase 6 sheet rental (Session 9): migration 0010 (`sheet_products`, `sheet_variants`, `sheet_rentals`, `sheet_rental_payments`, `sheet_returns`, views `sheet_variant_stock` and `sheet_rental_totals`, functions `save_sheet_variant`, `save_sheet_rental`, `cancel_sheet_rental`, `save_sheet_payment`, `record_sheet_return`, `delete_sheet_return`, helper `sheet_refresh_status`), Sheet rental page with Rentals (returns and payments dialogs per rental), Stock (variants with derived rented / damaged / missing / available) and Products tabs, `sheetEngine` formulas, D-022 / D-023. Typecheck and build pass; migration applied on PG16 and a compact SQL smoke test passes (`supabase/tests/0010_sheet_rental.test.sql`); no frontend tests (admin wants the complete app first).

Before that: Phase 5e transport profit (Session 8): migration 0009 (`vehicle_profit_totals`), Transport > Profit tab, three engine formulas, D-021. Typecheck and build pass; no new tests (admin wants the complete app first). Admin has run migrations 0005-0008 live. Before that: Phase 5d vehicle loans (Session 8): migration 0008 (`vehicle_loans`, `loan_payments`, `loan_payment_totals`, `save_vehicle_loan`, `save_loan_payment`), Transport > Loans tab with a Loan dialog and a Payments dialog, `loanEndDate`, 14 Vitest tests, a 64-check SQL test, D-020. The loan's amount received posts as `loan_received`; each payment posts as `loan_repayment` for the full amount, interest included (D-009). No outstanding balance is shown, because interest is not split from repayments. Also in Session 8: first successful `npm install`, `tsc --noEmit`, `npm run build`, full test run, and PG16 runs of migrations 0001-0008 plus the 0005 SQL test. Before that: Phase 5c: migration 0007 (`fuel_logs`, `tolls`, `trip_cost_totals`, `save_fuel_log`, `save_toll`, `save_trip` re-issued), Fuel and Tolls tabs/dialogs, trip operating profit in the Trips list, D-019. Written without compiling or testing (build first, test later). Before that: Phase 5b: migration 0006 (`trips`, `save_trip`, `sync_trip_ledger`), Trips tab and dialog, `tripRevenuePaise` / `tripMarginAfterDriverPaise`, D-018. Written without compiling or testing, at the admin's request (build first, test later). Before that: Phase 5a-2: migration 0005 (`save_vehicle`, vehicle purchase + container price posted to the ledger as `investment`, purchase date required, vehicles read-only from the browser). Before that, Phase 5a: migration 0004, Transport page with Vehicles / Drivers / Customers tabs, derived total investment, shared `MasterList`, D-016 / D-017.

## In Progress
Nothing in code. Outstanding: live checks of Transport (5a-5e) and Sheet rental in Supabase and a browser, and the deferred tests (5b/5c, Transport/Loans/Sheets UI).

## Completed
- Phase 0 docs; Phase 1 foundation/shell/palette; Phase 2 migration 0001 + admin auth (live-verified); Phase 3/3b financial engine + Add transaction form
- Phase 4: property rental (migration 0003, services, hooks, forms, list + detail with Rent / Advance / Tenant tabs)
- Auth hang fix: `lib/withTimeout.ts`, 10 s timeout on `getSession` / `checkIsAdmin` with a visible retry screen
- Phase 5a: `types/transport.ts`, `services/transportService.ts`, `features/transport/{transportEngine,transportForms,hooks,labels,submitError,useListControls,MasterList,VehicleDialog,DriverDialog,CustomerDialog,VehiclesTab,DriversTab,CustomersTab,TransportPage}`, migration 0004, route `/transport`
- Phase 6: sheet rental (migration 0010, `types/sheets.ts`, `services/sheetService.ts`, `features/sheets/*`, route `/sheets`)

## Known Issues
- **Phase 7 gold loans compile and migration 0011 applies on PG16 (Session 10) with a SQL test, but there are no UI tests and nothing has run live.** D-024 and D-025 are assumptions awaiting confirmation. Gold loans and payments cannot be deleted (edit instead). The estimated balance does not reduce interest for part payments (payments are not split, D-009); the bank statement is the authority. No gold valuation exists by design.
- **Phase 5c (fuel, tolls) compiles and its migration applies on PG16 (Session 8), but it has no tests (deferred by the admin) and has not been run live.** D-019 (fuel and tolls expensed when saved; fuel counts toward a trip only when linked) is an assumption awaiting confirmation. Fuel and tolls cannot be deleted (edit instead; amounts must stay above zero).
- **Phase 5b (trips) compiles and its migration applies on PG16 (Session 8), but it has no tests (deferred by the admin) and has not been run live.** D-018 (post revenue on completion, not on customer payment) is an assumption awaiting confirmation. Trips cannot be deleted (use Cancelled).
- Phase 5a compiled without errors on the first `npm run build` in Session 8; its UI has still not been seen in a browser.
- Migrations 0003 and 0004 and the Property / Transport screens are not confirmed against the real Supabase project or a browser.
- **Phase 5d (vehicle loans):** D-020 is an assumption awaiting confirmation (the amount received posts as `loan_received` on the start date). There is no outstanding balance by design (interest is not split, D-009). Loans and loan payments cannot be deleted. The optional vehicle link and optional tenure were added beyond the admin's minimum list. The Loans tab and its dialogs have no UI tests.
- Rent payments cannot be edited or deleted. Replacing a tenant overwrites the old tenant (D-012). A rent change applies only to months not yet created.
- Vehicles, drivers and customers can be edited but not deleted (trips will reference them). Customers without a mobile number can be duplicated by name (D-017).
- Vehicle investment entries follow the vehicle only (price edits update them; zero removes them). Deleting a vehicle is not possible yet.
- No UI tests for Property pages/dialogs, Transport tabs/dialogs, auth screens or the Transactions page.
- **Phase 9 Reports: migration 0013 applies on PG16 and its SQL test passes (Session 12); the admin has run it live.** D-027 is an assumption awaiting confirmation. Property deposits post to cash flow only (D-029, migrations 0014 + 0015, not yet run live). Entity filters count only linked ledger rows.
- Phase 10 was a code-level audit only: no browser, axe, Lighthouse or screen-reader check (D-028).
- D-015 resolved by D-029 (assumed option 2). Resolved: loan interest = part of repayment (D-009); vehicle prices = investment, date required, edit updates the entry (D-016).
- The GitHub repo `HOUSEWING01/Personal-Tracker` had only a README when checked in Session 6; the real code lives in the admin's local folder.
- **Phase 6 sheet rental compiles and its migration applies on PG16 (Session 9) with a smoke test, but it has no frontend tests (deferred by the admin) and has not been run live.** D-022 (one variant per rental; stock derived) and D-023 (payments post as customer payments; a payment can never exceed net rent; rent is typed, no per-day calculation) are assumptions awaiting confirmation.
- Sheet rental: payments cannot be deleted (edit instead); returns cannot be edited, only undone and re-entered; damaged or missing sheets cannot be recovered (repaired / found) yet; there are no charges for damaged or missing sheets (raise the rent by hand); a rental covers one size (two sizes = two rentals). The customer picker loads up to 1,000 customers.
- Advance on a sheet rental is a part-payment of the rent (revenue), not a refundable deposit (D-023), unlike property advance (D-015 / D-029).

## Database Status
Migrations 0001-0009 written (admin ran 0005-0008 live; run 0009 once); all apply cleanly in order on PostgreSQL 16 (Session 8). Run live by the admin: 0001-0004 only; run 0005, 0006, 0007 and 0008 in order. SQL tests run on PG16: 0001-0003, 0005 (30 checks, Session 8) and 0008 (64 checks, Session 8). SQL test 0004 is written but still not run; there are no SQL tests for 0006 or 0007. Tables: admin_users, customers, transactions, properties, tenants, rent_charges, rent_payments, advance_movements, vehicles, drivers, trips, fuel_logs, tolls, vehicle_loans, loan_payments. Views: property_overview, rent_charge_status, trip_cost_totals, loan_payment_totals. Functions: vehicle_profit_totals(), save_vehicle(), save_trip(), save_fuel_log(), save_toll(), save_vehicle_loan(), save_loan_payment(), is_admin(), transaction_totals(), ensure_rent_charges(), record_rent_payment(), record_advance_movement().
Migration 0010 added (Session 9; admin must run it after 0009). Tables: sheet_products, sheet_variants, sheet_rentals, sheet_rental_payments, sheet_returns. Views: sheet_variant_stock, sheet_rental_totals. Functions: save_sheet_variant(), save_sheet_rental(), cancel_sheet_rental(), save_sheet_payment(), record_sheet_return(), delete_sheet_return(). Migrations 0001-0010 apply cleanly in order on PG16; SQL smoke test for 0010 passes.

## UI Status
Reports (`/reports`: filters, summary tiles, By module, By month, CSV export). Not visually checked in a browser. Pages are lazy-loaded.
Gold loans (`/gold-loans`: list with interest so far, repaid and estimated balance, due pills; Add/Edit dialog; Payments dialog). Not visually checked in a browser.
Shell, auth screens, Transactions, Property list + detail, Transport (trips / fuel / tolls / loans / profit / vehicles / drivers / customers). Not visually checked in a browser.
Also Sheet rental (`/sheets`: Rentals with Returns and Payments dialogs, Stock, Products). Not visually checked in a browser.

## Testing Status
Session 12: `tsc --noEmit`, `npm run build` (no warnings) and 99 Vitest tests pass (6 new in `reportEngine.test.ts`). SQL: `0013_reports.test.sql` passes on PG16. No UI tests for Reports.
Session 11: typecheck, build and 93 Vitest tests pass (2 new in `dashboardEngine.test.ts`); SQL `0012_dashboard.test.sql` passes on PG16. No Dashboard UI tests.
Session 10: `tsc --noEmit`, `npm run build` and `vitest run` pass: 91 tests in 13 files (84 + 7 new in `services/goldInterest.test.ts`). SQL: `0011_gold_loans.test.sql` passes on PG16 after migrations 0001-0011. No UI tests for gold loans.
Session 8: `npm install`, `tsc --noEmit`, `npm run build` (bundle > 500 kB warning only) and `vitest run` all pass: 84 tests in 12 files (70 before + 14 new in `features/transport/loans.test.ts`). SQL: 0005 test 30/30 and 0008 test 64/64 on PG16. Not run: SQL test 0004; no tests exist for 0006/0007 or for the Transport and Loans UI.
Session 9: `tsc --noEmit` and `npm run build` pass after Phase 6 (bundle > 500 kB warning only). All 84 existing Vitest tests still pass (re-run after Phase 6). New: SQL smoke test `supabase/tests/0010_sheet_rental.test.sql` passes on PG16. No Vitest tests exist for sheet rental.

## Deployment Status
Pushed to GitHub and deployed to Vercel in an earlier session; Vercel showed "Supabase is not configured" until `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` were added and the site redeployed. Current live status unconfirmed.

## Next Task
000. (Admin) Run `0013_reports.sql` once (after 0012), open Reports and compare This month with the Dashboard and Finance. Confirm D-027.
0000. Browser pass over every screen at phone and desktop width, plus axe / keyboard checks (D-028).
00. (Admin) Run `0012_dashboard.sql` once (after 0011), then open the Dashboard and compare tiles with each module. Confirm D-026.
0. (Admin) Run `0011_gold_loans.sql` once in the Supabase SQL editor (after 0010). Open Gold loans: add a loan (Finance shows one Loan received), record a payment (Finance shows one Loan repayment), check Interest so far and Estimated balance against the bank statement, then close and release the loan. Confirm D-024 / D-025.
1. (Admin) Run `0010_sheet_rental.sql` once in the Supabase SQL editor (after 0009). Then open Sheet rental: add a product (Products), add a size with a total quantity (Stock), add a rental with an advance (Rentals), and check: Stock shows rented and available; Finance shows one Customer payment for the advance; record a partial return and check Stock and the rental's "still out"; record the rest and check the rental becomes Returned. Confirm D-022 / D-023.
2. (Admin) Still open from Session 8: run 0009 and check Transport > Profit (D-021); confirm D-018 to D-020.
3. Phase 8 Dashboard: active gold loans, amount borrowed, upcoming due dates, accrued interest (use `services/goldInterest.ts` and `goldEngine.dueState`), plus the other modules.
3b. Phase 9 Reports (read SESSION.md section 17 first), then Phase 10 audit.
4. Deferred tests: sheet rental UI/engine tests, 5b/5c SQL tests, Transport/Loans UI tests, SQL test 0004.

## Important Notes
- Gold loans: D-024 (model, ledger) and D-025 (interest). ALL interest arithmetic is in `services/goldInterest.ts`; never compute interest in a component or SQL.
- Brand palette fixed (SESSION.md 22A, D-005). Token classes only.
- Money: integer paise (D-003). Dates: IST business dates (D-004). Security: D-006. Module tables per phase: D-007. Amount sign: D-008. Formulas: D-009 / ARCHITECTURE.md. Server state: D-010. Forms: D-011. Property model: D-012..D-015. Transport masters: D-016, D-017; trips D-018; fuel/tolls D-019; vehicle loans D-020.
- Never compute money in components; call financeEngine / propertyEngine / transportEngine. Forms: schema -> toX() -> mutation -> service.
- Writes that touch the ledger go through database functions (D-014).
- Reuse `features/transport/MasterList` for simple master lists; `parseMoney` lives in `features/property/propertyForms` (move to `lib/` when a third module needs it).
- `en-IN` formats September as "Sept"; do not hardcode month abbreviations in tests.
- Sheet rental: D-022 (model, derived stock) and D-023 (money, ledger). Stock is never a stored counter. Every function that changes stock locks the variant row first, then the rental row. Reuse `features/transport/MasterList` for lists; the Sheets tabs use their own `useSheetListControls` (URL: tab, q, status, variant, page).
