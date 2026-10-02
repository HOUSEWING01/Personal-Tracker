# Changelog

## Session 13 - Themed dropdowns and date picker (D-031)
- New `components/forms/Select.tsx`, `DatePicker.tsx`, `Popover.tsx` and `lib/calendar.ts`. All 38 native `<select>` and 25 `type="date"` inputs replaced (27 files). Open list and calendar now follow the palette, open in a portal above dialogs, flip upward near the screen bottom, and are keyboard accessible.
- Dialog backdrop ignores the click that just closed a dropdown or calendar, so one stray click no longer discards a form.
- `index.css`: removed the old select chevron / date icon rules; search-field clear (x) themed.
- Tests: 13 new (Select 6, DatePicker 7) plus 7 for `calendar.ts`; the Type dropdown test in `AddTransactionDialog.test.tsx` now clicks instead of `selectOptions`. Docs: DESIGN_SYSTEM.md, DECISIONS.md (D-031).

## Session 12 - Phase 9 Reports and Phase 10 audit
- Theme for native controls (D-030): global CSS in `index.css` for select chevron, date icon, checkbox / radio accent, autofill, selection and scrollbars. Build clean.
- Fixed: LoginPage now shows "Not authorised" / the error and a button when the admin check fails, instead of silently showing the form again.
- Fixed: app stuck on "Loading…" forever when there is no stored session (expired, cleared or private window). The admin check was keyed on the access token, which is `undefined` both while loading and when signed out, so it never re-ran and never redirected to /login. `AuthProvider` now keys on loading / signed-out / token. Reproduced against a Supabase URL that never answers, then verified: redirects to /login.
- Deposits in cash flow (D-029, option 2): migration 0014 (ledger types `deposit_received`, `deposit_returned`) and 0015 (`advance_movements.transaction_id`, backfill, `record_advance_movement()` posts received / returned atomically, `ledger_links` includes advance entries). `financeEngine` cash in / out include deposits; profit unchanged. Deposit types are not offered in the manual Add transaction form. New SQL test `0015_advance_ledger.test.sql`; 100 Vitest tests; `tsc` and build clean. Not run live.
- Migration 0013: view `ledger_links`, functions `report_breakdown()` and `report_outstanding()` (read-only, SECURITY INVOKER). `/reports`: filters for period (this month, last month, financial year, all time, custom), module, income / expense view, vehicle, property and customer; summary tiles (revenue, expenses, net profit, outstanding, investments, loan repayments, net cash flow); By module and By month tables with inline bars; CSV export of the monthly table; link to the matching transactions. `reportEngine` (formulas via `financeEngine`, ranges, CSV). D-027.
- Phase 10 audit (D-028): lazy-loaded routes and vendor chunks (bundle warning gone); skip link, focus and title on navigation; mobile menu focus trap; arrow-key tabs on Property, Transport and Sheets; shared `StatTile` with a one-column layout on very narrow phones; larger close / menu touch targets; Settings placeholder removed from the menu.
- Verified: `tsc --noEmit`, `npm run build` (no warnings) and 99 Vitest tests (6 new in `reportEngine.test.ts`). Migrations 0001-0013 apply cleanly on PG16 and the new SQL test `0013_reports.test.sql` passes (linking, grouping, filters, outstanding, non-admin and anon refused). `00_supabase_stub.sql` made re-runnable. Nothing was run in a browser.

## Session 11 - Phase 8 Dashboard
- Migration 0012: `dashboard_counts()` (raw counts and sums, SECURITY INVOKER). `/` now shows the Dashboard: Needs attention, Financial, Property, Transport, Sheet rental and Gold loans sections, upcoming gold due dates, and a This month / All time switch. `dashboardEngine` (receivables, gold summary). D-026.
- Verified: `tsc --noEmit`, `npm run build`, 93 Vitest tests pass (2 new); migrations 0001-0012 apply on PG16; new SQL test `0012_dashboard.test.sql` passes (including non-admin sees zeros). Not run live or in a browser.

## Session 10 - Phase 7 gold loans
- Migration 0011: `gold_loans`, `gold_loan_payments`, view `gold_loan_payment_totals`, functions `save_gold_loan()` and `save_gold_loan_payment()`. The loan posts `loan_received` and each payment posts `loan_repayment` for the full amount, interest included (module `gold_loans`; D-009, D-024). Status active / closed / released with a closing date.
- `services/goldInterest.ts`: the single place interest is calculated (principal x annual rate x days / 365, integer paise, BigInt). `features/gold/goldEngine.ts`: total due, estimated balance, overdue / due-soon state (D-025).
- Gold loans page (`/gold-loans`): list with search and status filter, interest so far, repaid and estimated balance, due pills; Add / Edit dialog; Payments dialog to record, edit and review repayments. Reuses `MasterList`.
- Verified: `tsc --noEmit`, `npm run build`, 91 Vitest tests pass (7 new for interest and due logic); migrations 0001-0011 apply on PG16; new SQL test `0011_gold_loans.test.sql` passes. Not run live or in a browser.

## Session 9 - Phase 6 sheet rental
- Migration 0010: `sheet_products`, `sheet_variants` (dynamic sizes in feet), `sheet_rentals`, `sheet_rental_payments`, `sheet_returns`; views `sheet_variant_stock` (derived rented / damaged / missing / available) and `sheet_rental_totals`; functions `save_sheet_variant`, `save_sheet_rental`, `cancel_sheet_rental`, `save_sheet_payment`, `record_sheet_return`, `delete_sheet_return`. Stock can never go invalid: renting more than available is refused under a variant row lock; returns are capped at what is still out. Payments post `customer_payment` (module `sheets`) to the ledger (D-023).
- Sheet rental page (`/sheets`): Rentals (search, status incl. Overdue returns, size filter; Returns and Payments dialogs; cancel a mistaken rental), Stock (variants with derived figures), Products. New rental can add a new customer inline (shared `customers` table) and take an advance.
- `sheetEngine`: net rent, outstanding, still out, available, overdue, actual return date. Decisions D-022, D-023 (assumptions to confirm).
- Verified: `tsc --noEmit`, `npm run build`; migrations 0001-0010 apply on PG16 (this caught and fixed a duplicate constraint name in 0010); SQL smoke test `supabase/tests/0010_sheet_rental.test.sql` passes. No frontend tests at the admin's request (complete the app first).
## Session 8 - Phase 5e transport profit
- Migration 0009: `vehicle_profit_totals(from, to)` (raw per-vehicle ledger sums). Transport > Profit tab: per vehicle and total, revenue, driver, fuel, tolls, operating profit, loan repayments, after loan repayments, for any period. `transportEngine`: `vehicleOperatingProfitPaise`, `vehicleAfterFinancingPaise`, `sumProfitTotals`. D-021 (assumption to confirm). Typecheck and build pass; no new tests at the admin's request (complete the app first). Admin ran migrations 0005-0008 live.

## Session 8 - Phase 5d vehicle loans
- Migration 0008: `vehicle_loans`, `loan_payments`, view `loan_payment_totals`, `save_vehicle_loan()`, `save_loan_payment()`. The loan posts `loan_received` and each payment posts `loan_repayment` for the full amount, interest included (D-009, D-020, assumption to confirm). No outstanding balance is shown (interest is not split).
- Transport > Loans tab: list with search, status and vehicle filters; add/edit loan dialog (lender, amount received, start date, interest rate, EMI, optional vehicle and tenure); Payments dialog to record, edit and review repayments. `MasterList` gained an optional `rowActions`. `transportEngine.loanEndDate`.
- Verified this session: `npm install`, `tsc --noEmit`, `npm run build` and all 84 Vitest tests pass (14 new loan tests); migrations 0001-0008 apply cleanly on PostgreSQL 16; the new 0008 SQL test (64 checks) and the previously unrun 0005 SQL test (30 checks) pass. Not yet checked: 0004, 0006, 0007 SQL tests (0006/0007 tests do not exist), the Supabase project itself and a browser.

## Session 7 - Phase 5c fuel and tolls
- Migration 0007: `fuel_logs` (generated total), `tolls`, view `trip_cost_totals`, `save_fuel_log()`, `save_toll()`; each posts an `expense` to the ledger (D-019, assumption to confirm). `save_trip` re-issued so a trip's vehicle cannot change while fuel or tolls are linked.
- Transport > Fuel and Tolls tabs with add/edit dialogs and a shared vehicle filter. Trips list now shows Fuel, Toll and Operating profit (revenue - driver - fuel - toll). `transportEngine`: `fuelTotalPaise`, `tripOperatingProfitPaise`.
- Not compiled or tested at the admin's request (build first, test later).

## Session 7 - Phase 5b trips
- Migration 0006: `trips`, `save_trip()`, `sync_trip_ledger()`; a completed trip posts revenue (`income`) and driver payment (`expense`) to the ledger (D-018, assumption to confirm).
- Transport > Trips tab (now the default tab): list with search, status and vehicle filters, paging; add/edit dialog with live revenue preview. `transportEngine`: `tripRevenuePaise`, `tripMarginAfterDriverPaise`. Trip options refresh when vehicles, drivers or customers are saved.
- Not compiled or tested at the admin's request (build first, test later).

## Session 1 — 2026-10-03
- Created project from SESSION.md (no prior repository existed).
- Added Vite/React/TS/Tailwind v4/Phosphor/React Router scaffold.
- Added responsive AppShell, route placeholders, `useUrlState`, `lib/money.ts` with tests.
- Added all project-state documents.

## Session 1 (addendum) — 2026-10-03
- Applied brand palette 07 to theme tokens (`src/index.css`); renamed `accent*` tokens to `primary/sage/copper/gold`.
- Updated AppShell active-nav and focus-ring colours.
- Rewrote DESIGN_SYSTEM.md with palette, contrast table and component recipes; added D-005.
- Added SESSION.md section 22A (mandatory palette rules); saved reference image to `docs/design-reference/`.

## Session 2 — 2026-10-03
- Added migration 0001 (admin allowlist, `is_admin()`, enums, customers, transactions, RLS, triggers, indexes).
- Tested migration on real PostgreSQL 16 (RLS, anon denial, 6 integrity rules); saved tests in `supabase/tests/`.
- Added Supabase client, `authService`, `AuthProvider`, `RequireAdmin`, `LoginPage`, sign-out in shell, FullScreenMessage.
- Added docs/SUPABASE_SETUP.md; decisions D-006 to D-008; updated DATABASE_SCHEMA, ARCHITECTURE, DESIGN_SYSTEM.

## Session 3 — 2026-10-03
- Phase 3: added `financeEngine.ts` (single home of all money formulas) + 8 tests; `lib/dates.ts` (IST) + tests; `formatSignedINR`.
- Migration 0002 `transaction_totals()` (RLS-safe, tested on PG16).
- `transactionService` (list/filter/paginate, totals, createTransaction for modules), TanStack Query hooks.
- Finance > Transactions screen: summary tiles, URL-state filters (search/type/module/date/sort/page), table on desktop and cards on mobile, loading/empty/error states.
- Decisions D-009, D-010; formulas documented in ARCHITECTURE.md.

## Session 4 — 2026-10-03
- Phase 3b: Add transaction form (Finance > Transactions > Add transaction).
- New shared UI: `Dialog` (accessible modal/bottom sheet), `FormField`/`fieldA11y`.
- `transactionForm.ts` (Zod schema, defaults, `toNewTransaction`), `useCreateTransaction` (invalidates list + summary), `AddTransactionDialog`.
- Added react-hook-form, zod, @hookform/resolvers; dev: jsdom, @testing-library/react, user-event (DOM tests now possible).
- 12 new tests (28 total): schema rules, dialog a11y/focus/Esc, validation, paise submit, failure + retry, adjustment reason.
- Decision D-011.

## Session: repo re-verification (no feature work)
- Verified repo against docs: 28 tests pass, `npm run build` passes. Docs match code.
- Fixed docs/SUPABASE_SETUP.md: step 4 now lists migration 0002 as well as 0001.

## Session: Phase 4 — Property rental
- Migration 0003: properties, tenants (one per property), rent_charges, rent_payments, advance_movements; views property_overview and rent_charge_status; functions ensure_rent_charges, record_rent_payment, record_advance_movement. Client writes to charges/payments/advance are blocked by RLS; functions enforce the rules.
- Rent payments post to the ledger atomically (customer_payment, module property, entity link set).
- SQL tests: 35 self-checking cases on PG16 (`supabase/tests/0003_property_rental.test.sql`), all pass.
- Frontend: `types/property.ts`, `services/propertyService.ts`, `features/property/*` (engine, forms, hooks, dialogs, list page, detail page with Rent / Advance / Tenant tabs). Routes `/property` and `/property/:id`.
- 23 new frontend tests (51 total): engine formulas, form schemas, RentPaymentDialog. `npm run build` passes.
- Decisions D-012 to D-015. docs/SUPABASE_SETUP.md and supabase/tests/README.md updated.

## Session: deployment (GitHub + Vercel) and auth hang fix
- Pushed to github.com/HOUSEWING01/Personal-Tracker (main). Deployed to Vercel; Supabase Site URL and Redirect URL set to the Vercel URL.
- Vercel showed "Supabase is not configured": the VITE_ variables were missing from the build. Fixed on the Vercel side (env vars + redeploy), no code change.
- Local dev stuck on "Loading…" with no message: session and admin checks could hang silently. Added `lib/withTimeout.ts` (+3 tests); `getSession` and `checkIsAdmin` now fail after 10 s with a message and the existing "Try again" screen. Errors are also logged to the console as `[auth] …`.
- .gitignore: added `*.zip`.

## Session 6 — 2026-10-03
- Resumed from the uploaded repository (docs and code matched; auth timeout fix from the previous session already present).
- Phase 5a: Transport > Vehicles / Drivers / Customers. Migration 0004 (`vehicles`, `drivers`; customers reuse the shared table), `transportService`, hooks, Zod forms, `transportEngine` (derived total investment), shared `MasterList`, three add/edit dialogs, `/transport` route.
- Decisions D-016 (derived investment, no ledger posting yet) and D-017 (shared customers).
- New tests written: `transportEngine.test.ts` (5), `transportForms.test.ts` (10), SQL `0004_transport_masters.test.sql`.
- NOT verified this session: no `node_modules` and no PostgreSQL were available, so `npm test`, `npm run build` and the SQL test have not been run. Only a syntax check and the pure engine logic were run.
- Admin decisions: loan interest is part of the repayment (D-009); vehicle purchase and container prices are ledger investments (D-016, to be built in 5a-2).
- Phase 5a-2: vehicle purchase and container prices post to the ledger as `investment` (migration 0005). Purchase date now required; a price edit updates the existing entry. Vehicles are written only via `save_vehicle()`; browser has read-only access. `saveVehicle` service replaces create/update; the save refreshes Finance queries. Added 1 form test (purchase date required) and a 30-check SQL test. Admin confirmed 0003 and 0004 already ran live.
- Still unverified: no compiler or PostgreSQL this session.

