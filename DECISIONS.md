# Decisions

## D-001 Tailwind v4 with CSS `@theme` tokens
### Context
Need a design-token system without extra config.
### Decision
Use Tailwind v4 via `@tailwindcss/vite`; tokens live in `src/index.css`.
### Reason
Fewer files, tokens are the single source of truth.
### Alternatives
Tailwind v3 + `tailwind.config.js`.

## D-002 Data router (`createBrowserRouter`)
### Context
SESSION.md requires scroll restoration and natural Back/Forward.
### Decision
Use `createBrowserRouter` + `<ScrollRestoration />`; list state lives in URL query params via `useUrlState`.
### Reason
`ScrollRestoration` needs a data router.
### Alternatives
`BrowserRouter` with manual scroll handling.

## D-003 Money as integer paise
### Context
Float arithmetic is unsafe for financial totals.
### Decision
DB: `numeric(14,2)` INR. App: integer paise via `lib/money.ts`. Display via `formatINR`.
### Reason
Exact arithmetic, simple to test.
### Alternatives
decimal.js (extra dependency, not needed yet).

## D-004 Dates and timezone
### Decision
Business dates (rent month, trip date, pledge date) are Postgres `date`. Audit columns are `timestamptz`. Business timezone is Asia/Kolkata; "today"/"this month" are computed in that zone.
### Reason
Avoids off-by-one day errors near midnight UTC.
### Alternatives
All timestamps in UTC only.

## D-005 Brand colour palette "07"
### Context
Admin supplied an approved palette (6D9773, 0C3B2E, BB8A52, FFBA00) as the app theme. Initial Phase 1 used a placeholder teal accent.
### Decision
Adopt the four colours as the fixed brand palette. Deep green `#0C3B2E` is the primary action/ink colour; sage, copper and gold are supporting. Tokens defined in `src/index.css`; rules recorded in SESSION.md 22A and DESIGN_SYSTEM.md.
### Reason
White on sage (`#6D9773`) is only 3.3:1, which fails WCAG for normal text, so sage cannot be the primary button colour with white text as in the reference mockup. Deep green gives 12.5:1 and still matches the look.
### Alternatives
Sage as primary button with white text (rejected: contrast); darkening sage (rejected: departs from approved palette).

## D-006 Admin access via `admin_users` allowlist + `is_admin()`
### Context
Single admin today; RLS must restrict everything to that admin, and sign-ups must not grant access.
### Decision
Allowlist table with no client policies, read only through a SECURITY DEFINER `is_admin()`. All table policies call it. The frontend also calls `is_admin()` to decide admin vs "Not authorised".
### Reason
A valid login alone grants nothing. Extra admins later = one insert. The frontend check is UX only; RLS is the real enforcement.
### Alternatives
Hardcode the admin UUID in policies (brittle); rely on "sign-ups disabled" only (one dashboard toggle away from open access).

## D-007 Module tables are created in each module's phase
### Context
Phase 2 is "database + migrations", but module schemas are best designed with their features.
### Decision
Migration 0001 holds only the shared foundation (customers, transactions, security). Property/Transport/Sheets/Gold tables ship in their own migrations.
### Reason
Smaller, testable migrations; avoids designing tables before their workflows exist.
### Alternatives
One large Phase 2 migration for everything.

## D-008 Transaction amount sign rule
### Decision
`amount` is positive for all types, direction is implied by `type`. `adjustment` is the only type that may be negative (never 0).
### Reason
Prevents sign mistakes in aggregation; adjustments need a way to correct either direction.
### Alternatives
Signed amounts everywhere; separate debit/credit columns.

## D-009 Cash-basis financial formulas
### Context
SESSION.md lists 8 transaction types but not how each feeds profit and cash flow. `income` vs `customer_payment` overlap.
### Decision
Cash-basis. Revenue = income + customer_payment - refund. Investments, loan received and loan repayments never affect profit (they move cash/liability only). Adjustments are signed cash corrections: included in net cash flow only. Full formulas in ARCHITECTURE.md.
### Reason
Matches the app's purpose (tracking money in/out); keeps profit free of capital and financing items; one reversible place to change (financeEngine.ts).
### Alternatives
Accrual basis; treating adjustments as revenue/expense; excluding customer_payment from revenue (would double count if modules also post income).
### Resolved (admin, Session 6)
Loan interest is **part of the repayment**: vehicle-loan and gold-loan payments post as `loan_repayment` for the full amount paid, so interest never appears as a separate expense and does not reduce operating profit. Consequence: the app will not split a payment into principal and interest in the ledger; if a split is wanted later it needs a new decision.

## D-010 TanStack Query + database-side totals
### Decision
Use TanStack Query for server state (loading/error/retry/caching, `keepPreviousData` for paging). Totals come from a SECURITY INVOKER Postgres function so RLS still applies.
### Reason
Avoids loading thousands of rows; consistent async states; RLS-safe.
### Alternatives
Client-side summing of all rows; SECURITY DEFINER function (would bypass RLS).

## D-011 Form pattern and manual-entry rules
### Decision
Forms use React Hook Form + a Zod schema that validates raw strings; a separate `toNewTransaction()` converts to integer paise (no Zod transforms, keeps typing simple and testable). Shared `FormField` + `fieldA11y` provide labels, hints and `role="alert"` errors. Modals use the shared `Dialog`.
Manual transactions: any type and module allowed; `adjustment` is the only type that may be negative or require a reason (description mandatory, for audit); amount capped to numeric(14,2). Payment method stored as a lowercase key (`cash`, `upi`, `bank_transfer`, `cheque`, `other`); display labels live in `labels.ts`. Manual entries have no entity link (`entity_type/entity_id` null); module-generated entries will set them.
### Reason
Same rules in UI (Zod), service and database (constraints) per SESSION.md section 27; consistent accessible forms for all later modules.
### Alternatives
Zod transforms to paise inside the schema; free-text payment method.

## D-012 Property rental data model
### Context
SESSION.md lists rental start/end under Property, but a vacant property has no rental dates, and one property has exactly one tenant.
### Decision
`tenants.property_id` is unique (one tenant per property). Rental start/end dates are stored on the tenant row because they describe the tenancy. `monthly_rent` stays on the property. Property status is `active`/`inactive`; "occupied" is derived from the tenant and end date. Replacing a tenant edits the one tenant row (previous tenant details are not kept yet, see TODO).
### Reason
Matches the stated rule with the fewest tables, and avoids nullable tenancy columns on properties.
### Alternatives
Dates on the property; a tenancies history table (more correct for tenant changes, larger than Phase 4 needs).

## D-013 Monthly rent as per-month charges, created lazily
### Context
"Expected rent" must stay correct after the rent is changed, and outstanding must be exact.
### Decision
`rent_charges` stores one row per property-month with the expected amount copied from the rent at creation. `ensure_rent_charges()` creates missing months (start month through the current IST month, or the tenancy end month). A rent change only affects months not yet created. A month counts as due from the 1st.
### Reason
No cron job needed; history never silently changes; outstanding = sum(expected) - sum(paid) is trivial and testable.
### Alternatives
Compute expected on the fly from the current rent (rewrites history when rent changes); scheduled job (extra infrastructure).

## D-014 Ledger-linked writes go through database functions
### Context
A rent payment must create a ledger entry and a payment record together, never one without the other, and must not exceed the month's outstanding.
### Decision
`rent_payments`, `rent_charges` and `advance_movements` are read-only to clients (RLS). `record_rent_payment` writes the transaction and the payment atomically, locking the charge row; `record_advance_movement` locks the property row. Functions are SECURITY DEFINER with an explicit `is_admin()` check. Rent posts as `customer_payment` / module `property` / `entity_type='rent_payment'`.
### Reason
Atomic, race-safe, and the rules cannot be bypassed from the browser. Same rules are also checked in the Zod schemas for fast feedback.
### Alternatives
Two client calls (`createTransaction` then insert; can leave orphans); triggers (harder to read and test).

## D-015 Advance is history only, not in the ledger (SUPERSEDED by D-029)
### Context
An advance is a refundable deposit, not revenue. The ledger has no deposit type, and posting it as `customer_payment` or `income` would inflate revenue.
### Decision
Phase 4 records advance received / adjusted / returned in `advance_movements` only. Nothing is posted to transactions. Cash flow therefore does not yet include advance money.
### Open question for admin
Should advance received/returned appear in cash flow? That needs a new ledger treatment (for example a deposit type that moves cash but not profit). Decide before Reports (Phase 9).
### Alternatives
Post as `income`/`customer_payment` (wrong for profit); post as `loan_received`/`loan_repayment` (wrong meaning).

## D-016 Transport master data (vehicles, drivers) and derived investment
### Context
SESSION.md says total investment "should be derived from the underlying investment values", driver pay is per trip, and the registration number identifies a vehicle.
### Decision
`vehicles` stores purchase price, container price and container details; **total investment is not stored**. It is derived in `transportEngine.vehicleTotalInvestmentPaise` (purchase + container) so later investment parts are added in one place. `drivers` has no salary column. Registration numbers are unique ignoring case, spaces and hyphens (`vehicles_registration_key`); the app saves them upper-cased with single spaces. Driver mobile is unique when given. Vehicle status is `active` / `inactive` / `sold`. Vehicle purchase and container prices are **not** posted to the ledger yet (see open question).
### Reason
A stored total could disagree with its parts. Duplicate vehicles and drivers corrupt later trip and profit figures.
### Resolved (admin, Session 6) and built (Phase 5a-2, migration 0005)
Both the purchase price and the container price are **investments in the ledger** (`investment`, module `transport`, `entity_type` `vehicle_purchase` / `vehicle_container`, `entity_id` = vehicle id). Rules chosen by the admin: the **purchase date is required** (both entries use it), and **editing a price updates the existing entry** rather than adding an adjustment. A price set to zero removes its entry; set above zero again it adds one. Vehicles are written only through `save_vehicle()` (SECURITY DEFINER, admin re-checked), which saves the vehicle and syncs the ledger in one transaction, as in D-014. The browser can read `vehicles` but not write it. A unique index allows one ledger row per vehicle part. Vehicles saved before 0005 without a date were given their creation date (IST) so the column could become NOT NULL.
### Alternatives
Stored `total_investment` column or generated column (cannot include later parts); adding a separate adjustment entry on each price edit (rejected by the admin: the update is simpler and keeps totals right).

## D-017 Customers are one shared table; Transport edits it directly
### Context
SESSION.md: customers must be reusable and duplicates avoided. `customers` already exists (0001) with a unique mobile number.
### Decision
The Transport > Customers tab reads and writes the shared `customers` table. No transport-only copy. Duplicates are prevented by the unique mobile index, shown as a clear message; customers without a mobile number can still be duplicated by name, so the list is searchable before adding. Customers cannot be deleted yet (trips will reference them).
### Reason
One person, one record across Transport and Sheet rental.
### Alternatives
Per-module customer tables (duplicates); unique name (blocks two real people with the same name).


## D-018 Trips: revenue is derived; a completed trip posts to the ledger (ASSUMED, please confirm)
### Context
SESSION.md: revenue = distance x rate per KM (no fixed-trip pricing); driver payment is per trip; fuel and toll come later. D-009 makes profit cash-basis, and there is no customer-payment tracking for trips yet.
### Decision
`trips` stores vehicle, driver, customer, from, to, distance (KM, 2 decimals), rate per KM (> 0), driver payment (>= 0), trip date and status (`planned` / `completed` / `cancelled`). **Revenue is not stored**; it is `round(distance x rate, 2)` in `transportEngine.tripRevenuePaise` (and the same rounding in SQL). A **completed** trip posts two ledger entries on the trip date, module `transport`: revenue as `income` (`entity_type` `trip_revenue`) and the driver payment as `expense` (`trip_driver`, only if above zero). Planned and cancelled trips post nothing. Editing a completed trip updates its entries; changing it away from completed removes them. Trips are written only through `save_trip()` (SECURITY DEFINER, admin re-checked), the browser can only read them, and a unique index allows one ledger row per trip part. A new trip needs an active vehicle and driver; an old trip stays editable if its vehicle or driver later becomes inactive. Trips cannot be deleted yet; Cancelled is the way to retire a mistaken trip.
### Reason
Same model as D-014 / D-016: the trip and its ledger entries are saved together and cannot drift. Posting on completion lets Finance and the later Dashboard show transport revenue and expenses without a separate payments feature.
### Assumption to confirm
Revenue is recorded when the trip is **completed**, not when the customer pays. If you want it recorded only when money is received, trips would instead need customer payments (as rent has) and revenue would post as `customer_payment`. That is a change to `sync_trip_ledger` plus a payments table.
### Alternatives
Store `revenue` on the trip (can disagree with distance x rate); post on creation regardless of status (cancelled trips would count); driver payment as a stored salary (SESSION.md says per trip).

## D-019 Fuel and tolls: cash expenses posted when saved; trip operating profit (ASSUMED, please confirm)
### Context
SESSION.md: fuel is recorded at vehicle level with an optional trip link (litres, price per litre, total, odometer); a toll belongs to a trip. Trip operating profit = revenue - driver cost - applicable fuel - toll.
### Decision
`fuel_logs` and `tolls` are cash expenses, so each posts an `expense` (module `transport`, `entity_type` `fuel_log` / `toll`) on its own date **when saved**, with no status. Editing updates the entry. Both are written only through `save_fuel_log()` / `save_toll()` (SECURITY DEFINER, admin re-checked); the browser can only read them. The fuel **total is a generated column** (round(litres x price, 2)), never typed. A fuel log linked to a trip must be for the trip's vehicle. A toll requires a trip and takes the trip's vehicle, so they can never disagree; for the same reason a trip's vehicle cannot be changed while fuel or tolls are linked to it (`save_trip` re-issued in 0007). A new fuel log needs an active vehicle.
**Trip operating profit** = revenue - driver payment - fuel linked to that trip - tolls of that trip, in `transportEngine.tripOperatingProfitPaise`. Per-trip fuel and toll sums come from the view `trip_cost_totals` (raw sums only). Fuel with no trip link is vehicle-level cost: it is in Finance but in no trip's profit (it joins vehicle profit in 5e). The profit shown on a trip does not wait for the trip to be Completed; a Planned or Cancelled trip still shows revenue minus its costs, but only Completed trips post revenue to Finance (D-018).
### Reason
Same one-transaction model as D-014 / D-016 / D-018. Money spent on fuel and tolls has left the business whether or not the trip completes, so it is not tied to trip status.
### Assumption to confirm
Fuel and tolls are expensed when paid (cash basis), and fuel costs are charged to a trip only when you link them.
### Alternatives
Allocate unlinked fuel to trips by distance (not asked for, hides real spending); store the fuel total (can disagree with litres x price); let a toll's vehicle be chosen separately (can disagree with the trip).

## D-020 Vehicle loans: loan received and repayments post to the ledger; no outstanding figure (ASSUMED, please confirm)
### Context
SESSION.md: a vehicle loan tracks lender, principal, start date, monthly repayment, tenure, end date, status and payment history, and says not to invent extra loan calculations. D-009 says interest is part of the repayment (the full amount paid posts as `loan_repayment`, no principal/interest split). The admin asked for at least: lender, amount received, start date, interest rate, EMI.
### Decision
`vehicle_loans` stores an optional vehicle link, lender, **principal (the amount received)**, start date, **interest rate (% per year, 0 allowed)**, EMI, optional tenure in months, status (`active` / `closed`) and notes. `loan_payments` stores loan, payment date, amount (> 0) and notes. Both are written only through `save_vehicle_loan()` / `save_loan_payment()` (SECURITY DEFINER, admin re-checked); the browser can only read them.
Ledger (module `transport`, one entry each, edits update the entry): the loan posts **`loan_received`** for the principal, dated the start date (`entity_type` `vehicle_loan`); each payment posts **`loan_repayment`** for the full amount paid, interest included (`loan_payment`). Neither touches profit (D-009); both move cash.
Rules: a payment cannot be dated before the loan's start date; a new payment needs an **active** loan (existing payments stay editable after closing; set the loan back to Active to add more); the start date cannot move after an existing payment; payments and loans cannot be deleted. The **interest rate is reference only: nothing is calculated from it.** The end date shown on the Loans tab is derived (`transportEngine.loanEndDate`: start date + tenure months) and not stored.
**No outstanding balance is shown.** Because interest is not split from repayments (D-009), the principal still owed cannot be known, so the loan shows what was received and what has been repaid so far (raw sums from the view `loan_payment_totals`), not "outstanding". If an outstanding figure is wanted later it needs a new decision (a principal/interest split per payment, or a typed balance).
### Reason
Same one-transaction model as D-014 / D-016 / D-018 / D-019. Posting the amount received keeps cash flow right (the vehicle purchase is already an `investment`); showing no outstanding avoids a number the data cannot support.
### Assumptions to confirm
(1) The amount received is recorded in Finance as `loan_received` on the start date. (2) The optional vehicle link was added so Phase 5e can show vehicle-level figures; it was not in the admin's minimum list.
### Alternatives
Do not post the amount received (cash flow would miss the loan inflow); compute outstanding from an EMI amortisation (invents a calculation SESSION.md says not to, and would disagree with real statements); store tenure-derived end date (can drift).

## D-021 Transport profit: per-vehicle, operating vs after loan repayments (ASSUMED, please confirm)
### Context
SESSION.md section 12: trip operating profit is revenue - driver - applicable fuel - toll; vehicle/business profitability may also include loan repayments and other vehicle expenses, and operating profit must be clearly distinguished. D-009 keeps loan repayments out of business net profit.
### Decision
Transport > Profit shows one row per vehicle (plus a row for loans not linked to a vehicle, and an All-vehicles total) for a chosen period (any From/To, default all time). Figures are cash-basis sums read from the transport entries in the ledger by `vehicle_profit_totals(from, to)` (migration 0009, raw sums only, SECURITY INVOKER), so they always agree with Finance. The formulas live in `transportEngine`: **operating profit = revenue - driver payments - fuel - tolls**, and **after loan repayments = operating profit - loan repayments**. Fuel here is all fuel for the vehicle, including fuel not linked to a trip (unlike trip operating profit, which counts only linked fuel, D-019). Vehicle purchase and loan received are not part of either figure. Because repayments include the principal (D-009, no split), the last line is cash left after repaying, not accounting profit; the screen says so.
### Reason
Keeps operating profit clean and shows the financing effect separately, as SESSION.md asks, without inventing a principal/interest split.
### Assumption to confirm
That "after financing" = operating profit minus the full repayments paid in the period. The D-009 net profit in Finance is unchanged (repayments still never reduce it).
### Alternatives
Deduct only the interest part (needs a split, rejected in D-009); accrue EMI by month instead of by payment date; include depreciation (not asked).

## D-022 Sheet rental model: one variant per rental; stock is derived (ASSUMED, please confirm)
### Context
SESSION.md section 13: dynamic variants in feet (never hardcoded); inventory of total / available / rented / damaged / missing that must never become invalid; a rental lists one product, variant and quantity; partial returns (rented 100, returned 97, missing or damaged 3); actual return date; customers include name, address and mobile.
### Decision
`sheet_products` (admin-created, e.g. "Roofing Sheet") and `sheet_variants` (product + length in feet, unique per product, `total_quantity` owned, active / inactive). **Rented, damaged, missing and available are never stored**: the view `sheet_variant_stock` derives them: rented = rental quantities - everything accounted for on returns (cancelled rentals excluded); damaged / missing = sums on returns; available = total - rented - damaged - missing. A **rental** is one customer + one variant + one quantity, with rental date, optional expected return date, admin-typed rent and discount, and status `active` / `closed` / `cancelled`. A **return** is one event with good, damaged and missing quantities (each at least 0, together at least 1, never more than is still out); good sheets go back into stock, damaged and missing stay out. A rental becomes `closed` when every sheet is accounted for, and the **actual return date is the date of its last return**. Returns can be undone (deleted) but not edited; an undo is refused if the released sheets have been rented out again. A rental with no returns and no payments can be cancelled, which frees its sheets. Every function that can change stock locks the variant row first, then the rental row, so two rentals cannot both take the last sheets. Variants and rentals are written only through database functions (SECURITY DEFINER, admin re-checked); the browser can only read them. A variant's total cannot drop below rented + damaged + missing, and its product and size cannot change once it has rentals. The customer is the shared `customers` row (D-017); the rental form can create one inline.
### Reason
A stored counter can drift from the records behind it; deriving it keeps "inventory never invalid" true by construction, and the lock closes the race. One variant per rental matches the field list in SESSION.md and keeps outstanding and returns simple.
### Assumptions to confirm
(1) A rental covers one size; two sizes means two rentals. (2) The expected return date is optional; "overdue" means active with sheets still out and an expected date before today (IST). (3) A returned-damaged sheet is counted as damaged stock, not available, and damaged / missing sheets cannot be recovered yet (see TODO).
### Alternatives
Rental header + line items (more flexible, bigger UI; keep for later if needed); stored rented / available counters updated by triggers (can drift); free-text sizes (not dynamic variants).

## D-023 Sheet rental money: typed rent, payments are cash-basis customer payments (ASSUMED, please confirm)
### Context
SESSION.md: pricing is admin-controlled; base rental - discount = net; net - paid = outstanding; the rental has "Advance/payment". D-009 makes rent-like receipts `customer_payment` revenue on the cash basis; D-015 treats a property advance as a deposit, which sheets do not mention.
### Decision
**Rent is a typed amount** (no rate x days calculation is invented); it may be 0 at first and edited later, for example when the sheets come back. Net rent = rent - discount; **outstanding = net rent - paid**, in `sheetEngine`. Discount cannot exceed rent. Each payment (including an optional advance entered when the rental is created, dated the rental date) is a row in `sheet_rental_payments` and posts one `customer_payment` (module `sheets`, `entity_type` `sheet_payment`) to the ledger in the same transaction; editing a payment updates its entry. **Total paid can never exceed the net rent** (as with property rent), so the admin raises the rent first if more is owed; net rent cannot be lowered below what is already paid. Payments cannot be deleted yet. The advance is treated as a part-payment of the rent (revenue), not a refundable deposit.
### Reason
Same one-transaction model as D-014 / D-020; avoids inventing pricing; keeps overpayment impossible as SESSION.md section 27 asks.
### Assumptions to confirm
(1) The advance is part of the rent, not a refundable deposit. If a deposit is wanted, it needs a separate treatment like D-015. (2) Rent is typed per rental, not computed from days or rates.
### Alternatives
Rate per sheet per day x quantity x days (invents a calculation); allow overpayment as credit (not requested); post revenue when the rental is created (the app is cash-basis).

## D-024 Gold loans: bank-pledged; loan received and repayments post to the ledger (ASSUMED, please confirm)
### Context
SESSION.md section 14: this is NOT a lending business. The owner pledges gold to a BANK and receives a loan; track person, mobile where required, gold description and weight (if provided), bank, pledge date, due date, amount received, annual rate, status, notes. Flow: pledged, loan received, interest accrues, repayment, loan closed, gold released. "Do not invent gold valuation logic." D-009 already says gold-loan payments post as `loan_repayment` for the full amount, interest included.
### Decision
Migration 0011: `gold_loans`, `gold_loan_payments`, view `gold_loan_payment_totals`, functions `save_gold_loan()` and `save_gold_loan_payment()` (browser read-only, same model as D-020). The loan posts **`loan_received`** (module `gold_loans`, entity `gold_loan`) dated the pledge date; each payment posts **`loan_repayment`** (entity `gold_loan_payment`) for the full amount. Neither touches profit (D-009).
Person name and mobile are typed on the loan (the person may be family or the owner, not a customer); mobile is optional, 10 digits. Weight is optional (grams, 3 decimals) and never used in any calculation. Due date is optional.
**Status: active, closed (loan repaid, gold still with the bank), released (gold back).** Closed and released need a `closed_date`; interest stops accruing on it. A new payment needs an Active loan; a payment cannot precede the pledge date or follow the closing date. Loans and payments cannot be deleted yet.
### Assumptions to confirm
(1) Typed person name instead of the shared customers table. (2) Closed and Released as two steps. (3) Due date optional.
### Alternatives
Link to `customers`; a single closed status; a stored interest column (would go stale).

## D-025 Gold loan interest: one central service, simple interest, estimated balance (ASSUMED, please confirm)
### Context
SESSION.md: interest is an annual percentage; "Interest = Principal x Annual Rate x Time / 365"; keep it in a centralized service so the method can change. D-020 declined an "outstanding" for vehicle loans because interest is not split from repayments (D-009).
### Decision
`src/services/goldInterest.ts` is the only place interest is calculated: **interest = principal x annual rate x days / 365**, simple interest on the full principal, whole calendar days from the pledge date to today (Active) or to the closing date (Closed / Released), rounded half up to the paisa, in integer paise via BigInt. Nothing is stored in the database. `features/gold/goldEngine.ts` builds on it: total due = principal + interest; **estimated balance = total due - repaid so far, never below zero**; due state (Overdue when the due date has passed; Due soon within 30 days; Active loans only).
Unlike vehicle loans (D-020) the gold screens DO show an estimated balance, because the admin gave an explicit interest formula. It is labelled an estimate: payments are not split into principal and interest, so a part payment does not reduce the interest base, and the bank's own statement is the authority.
### Assumptions to confirm
(1) Simple interest on the full principal, no compounding, no reduction for part payments. (2) Day count is pledge date to today (end day not counted twice). (3) The 30-day due-soon window.
### Alternatives
Interest only on the unpaid principal (needs a principal/interest split, rejected in D-009); monthly or compound interest (change `goldInterest.ts` only).

## D-026 Dashboard: raw counts from one database function, formulas in the engines (ASSUMED, please confirm)
### Context
SESSION.md section 16 lists the metrics and says not to fill the dashboard with decorative charts; every chart must answer a useful business question. SESSION.md also says never duplicate financial calculations across screens.
### Decision
Migration 0012 adds `dashboard_counts(today, month_from, month_to)`: SECURITY INVOKER, raw counts and sums only (active / occupied properties, unpaid rent, active vehicles, trips this month, sheet totals, overdue returns, unpaid sheet rent). Money figures come from the existing ledger totals (`transaction_totals` + `financeEngine`), module-filtered for Transport. Gold figures come from the Active loans through `goldInterest` / `goldEngine`. `dashboardEngine` only combines (receivables, gold summary, upcoming dues). A **This month / All time** switch (URL `?period=`) applies to the money tiles; "Trips this month" is always the current IST month.
**Loan liabilities:** vehicle-loan principal still owed cannot be known (D-009 / D-020), so the Dashboard shows Loans received and Loan repayments (repayments include interest) instead of an invented liability. Gold shows an estimated balance (D-025).
**No charts in this phase.** None answers a question the tiles do not; trend charts belong to Reports (Phase 9).
### Assumptions to confirm
(1) Receivables = unpaid property rent + unpaid sheet rent, all time. (2) Occupied counts Active properties with a current tenant. (3) Trips this month excludes cancelled. (4) Sheet totals count Active sizes only.
### Alternatives
Compute everything in the browser from full lists (slow, duplicates formulas); a stored snapshot table (goes stale).

## D-027 Reports: raw sums from two database functions, formulas in the engines, cash basis (ASSUMED, please confirm)
### Context
SESSION.md section 17: filter by date range, module, income/expense, vehicle, property and customer; cover revenue, expenses, profit, outstanding, investments, loan repayments and cash flow. Section 15 and D-009: formulas live in one place. D-026 left trend views for this phase. D-015 (advance not in the ledger) was an open question for this phase.
### Decision
Migration 0013 adds the view `ledger_links` (ledger row to vehicle / property / customer, derived from `entity_type` + `entity_id`), `report_breakdown(group, from, to, module, vehicle, property, customer)` (per-type sums grouped by `total`, `month` or `module`) and `report_outstanding(...)`. All are SECURITY INVOKER. `reportEngine.summariesByBucket` applies `financeEngine.summarizeFromTotals` to each bucket, so Reports, Dashboard and Finance always agree. Periods: This month, Last month, This financial year (1 April to 31 March), All time, Custom. **Income / expense filter** is a view, not a data filter: the income view shows revenue, loans received and cash in; the expense view shows expenses, investments, loan repayments and cash out. Profit and net cash flow appear only when both sides are shown, because half a ledger would mislead. **Entity filters** count only ledger rows linked to the chosen vehicle (trips, fuel, tolls, vehicle loans and their payments, vehicle purchase and container), property (rent payments) or customer (trips, sheet payments); unlinked rows (general entries, gold loans) drop out. **Outstanding** = unpaid property rent for months in the range + unpaid sheet rent for rentals dated in the range, as of today, with payments counted whenever made. A vehicle filter shows no outstanding; a property filter excludes sheet rent; a customer filter excludes property rent. CSV export covers the By month table. **No chart library**: By month has inline bars beside the figures, which always carry the numbers.
### D-015 (advance) is still unresolved
Advance money stays out of the ledger, so Reports cash flow excludes advance received and returned. The Reports footnote states the basis. Decide before relying on cash flow for property.
### Assumptions to confirm
(1) Financial year runs April to March. (2) Outstanding is as of today for the chosen range. (3) The income/expense view hides profit and net cash flow. (4) Linked-entry filtering is acceptable even though trips post revenue on completion (D-018).
### Alternatives
A new Reports table or stored snapshots (go stale); computing in the browser from full transaction lists (slow, duplicates formulas); a chart library (extra weight with nothing the table does not already say).

## D-028 Phase 10 audit: what changed and what was deliberately left (Session 12)
### Context
SESSION.md sections 22, 23, 29 and 30 set the bar for responsive behaviour, accessibility and performance. No browser was available, so the audit is by code reading, scripted scans and the build; nothing was checked visually or with a screen reader.
### Done
Performance: every page is a lazy route chunk and vendor code is split (react, supabase, tanstack), so the 500 kB bundle warning is gone; the entry chunk is about 45 kB. Accessibility: skip link; focus moves to the page content and the document title changes on navigation; the mobile menu traps Tab, returns focus to its button and locks background scroll; the three tab sets follow the WAI-ARIA tab pattern (arrow keys, Home / End, one tab stop) and their panels are focusable; decorative icons are hidden from assistive tech; close and menu buttons have 40 px touch targets. Responsive: the stat tiles (Dashboard, Finance, Reports) are one column on very narrow phones and wrap long rupee amounts; Reports tables scroll inside a focusable region. A scripted scan found no unlabelled inputs, selects or textareas and no icon-only buttons without a label. The empty Settings menu item was removed (it only said "planned for Phase 10" and nothing in the spec defines it).
### Left, on purpose
No Lighthouse or axe run, no screen-reader pass, no contrast measurement beyond the palette (muted text on white is about 7:1 by calculation), no visual check of any screen at phone width. Server-side pagination already exists on lists; the Reports By month table is not paginated (one row per month). See TODO.md.

## D-029 Property deposits post to the ledger as cash-only entries (option 2 for D-015; ASSUMED from "proceed", please confirm)
### Context
D-015 left property advance money out of the ledger, so Reports, Finance and Dashboard cash flow ignored deposits held. The admin was offered two options and answered "proceed" to the recommended one (cash flow matches the money held; profit unchanged).
### Decision
Migration 0014 adds ledger types `deposit_received` (cash in) and `deposit_returned` (cash out). Migration 0015 links `advance_movements.transaction_id` and rewrites `record_advance_movement()` so **received** and **returned** post one entry each (module `property`, entity `advance_movement`) in the same database transaction. **Adjusted** (deposit kept against rent or damage) moves no cash and posts nothing. Existing movements are backfilled by 0015. `financeEngine`: `cashIn` includes `deposit_received`, `cashOut` includes `deposit_returned`; revenue, expenses and net profit are unchanged. The manual Add transaction form cannot create deposit types. `ledger_links` now links advance entries to the property, so the Reports property filter includes them.
### Not changed
The kept (adjusted) part of a deposit is not turned into revenue. If it should be, record it as income separately; this decision does not invent that. Deposits are shown in cash flow only, with no separate "deposits held" tile.
### Assumptions to confirm
(1) Option 2 was intended. (2) Adjusted deposits stay out of revenue. (3) Backfilled entries are dated the movement date.
### Alternatives
Leave deposits out (option 1); post as income / loan types (wrong for profit or meaning).

## D-031 Own Select and DatePicker instead of styled native controls (supersedes the select and date parts of D-030)
### Context
D-030 tinted the native `<select>` and date input with CSS, but the open dropdown list and the calendar popup are drawn by the browser and OS, so they stayed off-theme and looked different on every device.
### Decision
New `components/forms/Select`, `DatePicker` and `Popover`. All 38 selects and 25 date inputs across Finance, Property, Transport, Sheets, Gold and Reports now use them. Form values are unchanged (`'YYYY-MM-DD'` strings, option value strings), so schemas, services and the database are untouched. The form versions plug into react-hook-form with `useController`. Search-field clear (x) is themed in CSS. The select chevron / date icon CSS from D-030 is removed.
### Trade-offs
Typing a date by hand into the field is no longer possible (pick from the calendar; Today is one click). More code to maintain than CSS. Tests do `click` on the field then `click` on the option, not `selectOptions`.
### Not changed
Two `title` tooltips on truncated text remain native.

