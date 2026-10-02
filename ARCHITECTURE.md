# Architecture

Admin-only SPA. Layering (strict): Component → Hook → Service → Supabase → PostgreSQL. No Supabase calls in components.

```
src/
  app/            router
  components/     ui/ layout/ (data-display/ forms/ added when needed)
  features/       one folder per module (added from Phase 4)
  hooks/          useUrlState
  lib/            navigation, money (supabase client from Phase 2)
  pages/          route-level screens (placeholders until each module's phase)
  services/ types/ utils/   created when first used
supabase/migrations/        SQL migrations (Phase 2+)
```

Rules: all financial calculations live in one place (Phase 3 financial engine); gold-loan interest lives in its own service; list state in URL params; service-role key never in frontend.

Stack: React, TypeScript, Vite, Tailwind v4, Phosphor Icons, React Router, Supabase, Vercel.

## Auth (Phase 2)
`AuthProvider` (features/auth) holds session + admin status (`loading | config-missing | signed-out | forbidden | admin | error`). `RequireAdmin` guards all app routes; `/login` is public. All Supabase calls go through `services/authService.ts`. Never call Supabase inside `onAuthStateChange` callbacks (set state, react in an effect).

## Financial formulas (Phase 3, cash-basis, integer paise)
All formulas live ONLY in `src/features/finance/financeEngine.ts`. The database returns per-type totals (`transaction_totals()`), the engine applies the formulas. Screens never compute money themselves.

```
revenue     = income + customer_payment - refund
expenses    = expense
netProfit   = revenue - expenses        (operating; excludes investment, loan principal, adjustments)
cashIn      = income + customer_payment + loan_received
cashOut     = expense + investment + loan_repayment + refund
netCashFlow = cashIn - cashOut + adjustments   (adjustment = signed cash correction)
```
Outstanding receivables (rent, sheet rentals) are NOT derived from transactions; they come from each module's expected-vs-paid records (Phases 4-6). Trip/vehicle/gold formulas are added with their modules.

## Forms (Phase 3b)
Schema + helpers in `features/<area>/<thing>Form.ts` (pure, unit-tested) -> dialog/page component using `useForm(zodResolver(schema))` -> mutation hook (`useMutation`, invalidates affected query keys) -> service. Double-submit guarded by `isPending`; errors shown in-form with a retryable message; success shown via a polite live region.

## Data access (Phase 3)
TanStack Query hooks (`features/finance/hooks.ts`) -> `services/transactionService.ts` -> Supabase. List state (type, module, from, to, q, sort, page) lives in URL params via `useUrlState`. Lists are paginated server-side (25/page); totals are computed in Postgres, never by loading all rows.

## Property rental formulas (Phase 4, `features/property/propertyEngine.ts`)
```
month outstanding    = expected - paid                 (>= 0; the database rejects overpayment)
property outstanding = sum(expected) - sum(paid)
advance remaining    = received - adjusted - returned
occupied             = tenant exists and (end date empty or >= today IST)
overdue month        = month already ended and outstanding > 0
```
Rent payments post to the ledger as `customer_payment` (module `property`), so they count as revenue (D-009). Rent is cash-basis revenue; outstanding rent is tracked in `rent_charges` vs `rent_payments`, not derived from transactions.

Monthly charges are created lazily by `ensure_rent_charges`, called when the property list or a property's Rent tab loads (idempotent). Screens wait for it before reading rent figures.

Property screens: `PropertyListPage` (URL state: q, status, page) -> `PropertyDetailPage` (URL state: tab = rent | advance | tenant; back link restores the list's filters). Hooks in `features/property/hooks.ts`, service in `services/propertyService.ts`.

## Transport masters (Phase 5a, `features/transport/`)
```
vehicle total investment = purchase price + container price      (derived, never stored; D-016)
```
`TransportPage` (URL state: tab = vehicles | drivers | customers; each tab adds q, status, page) -> `VehiclesTab` / `DriversTab` / `CustomersTab` -> shared `MasterList` (search, optional status filter, table on desktop / cards on mobile, paging, loading/empty/error) and an add/edit dialog each (`VehicleDialog`, `DriverDialog`, `CustomerDialog`; schema -> toX() -> mutation -> service). `useListControls` owns the debounced search and URL params. Service: `services/transportService.ts`; hooks: `features/transport/hooks.ts`; money rules: `transportEngine.ts`. `MasterList` is the reusable list for later masters (sheet variants, etc.).

Vehicle writes (Phase 5a-2): `VehicleDialog` -> `useSaveVehicle` -> `transportService.saveVehicle` -> `save_vehicle()` RPC, which also writes the `investment` ledger entries. After a save the hook refreshes `vehicles`, `transactions` and `finance-summary`. Investments never affect profit (D-009); they appear in `cashOut`.


Trips (Phase 5b): `TransportPage` has a Trips tab (the default). `TripsTab` (search by place/notes, status and vehicle filters in the URL, paging) -> `TripDialog` -> `useSaveTrip` -> `transportService.saveTrip` -> `save_trip()` RPC, which also writes the ledger entries of a completed trip. Revenue = distance x rate per KM and "after driver payment" = revenue - driver payment live in `transportEngine` (`tripRevenuePaise`, `tripMarginAfterDriverPaise`); Phase 5c deducts fuel and toll to give the trip operating profit. `useTripOptions` feeds the vehicle / driver / customer pickers and is refreshed when any of them is saved. After a trip save the hook refreshes `trips`, `transactions` and `finance-summary`.

Fuel and tolls (Phase 5c): `TransportPage` tabs Trips / Fuel / Tolls / Vehicles / Drivers / Customers. `FuelTab` / `TollsTab` (vehicle filter in the URL via `VehicleFilter`, search, paging) -> `FuelDialog` / `TollDialog` -> `useSaveFuelLog` / `useSaveToll` -> `save_fuel_log()` / `save_toll()` RPCs, which also write the `expense` ledger entries. Formulas live in `transportEngine`: `fuelTotalPaise` (litres x price), `tripOperatingProfitPaise` (revenue - driver - fuel - toll). `listTrips` adds each trip's fuel and toll sums from `trip_cost_totals`. `useTripChoices` feeds the trip pickers. After a fuel or toll save the hooks refresh fuel, tolls, trips, `transactions` and `finance-summary`.

Vehicle loans (Phase 5d): `TransportPage` tab Loans. `LoansTab` (search by lender/notes, status and vehicle filters in the URL, paging, via `MasterList` with a `rowActions` "Payments" button) -> `LoanDialog` (add/edit loan) / `LoanPaymentsDialog` (loan summary, record or edit a payment, payment history) -> `useSaveLoan` / `useSaveLoanPayment` -> `saveVehicleLoan` / `saveLoanPayment` -> `save_vehicle_loan()` / `save_loan_payment()` RPCs, which also write the `loan_received` / `loan_repayment` ledger entries. `listLoans` adds each loan's repaid total, count and last payment date from `loan_payment_totals` (raw sums). The payments dialog reads the loan from the freshly loaded list, so its totals update after a save. After a save the hooks refresh `loans`, `loan-payments`, `transactions` and `finance-summary`. The only loan formula is `transportEngine.loanEndDate` (start date + tenure months, reference only). There is deliberately no outstanding balance (D-020). Loan repayments are not part of trip operating profit; they join vehicle-level profit in Phase 5e.

Transport profit (Phase 5e): `TransportPage` tab Profit. `ProfitTab` (From/To in the URL, "This month", "All time") -> `useVehicleProfit` -> `listVehicleProfitTotals` -> `vehicle_profit_totals()` RPC (raw ledger sums per vehicle). Formulas in `transportEngine`: `vehicleOperatingProfitPaise` (revenue - driver - fuel - tolls), `vehicleAfterFinancingPaise` (operating - loan repayments), `sumProfitTotals`. Every transport save that posts to the ledger also refreshes `vehicle-profit`.

## Sheet rental (Phase 6, `features/sheets/`)
```
net rent      = rent - discount                              (rent is typed by the admin; D-023)
outstanding   = net rent - paid                              (>= 0; the database rejects overpayment)
still out     = quantity - returned - damaged - missing      (per rental)
available     = total - rented - damaged - missing           (per variant; derived by the view sheet_variant_stock)
overdue       = status active, sheets still out, expected return date before today (IST)
actual return = date of the last return, once every sheet is accounted for
```
`SheetsPage` (URL state: tab = rentals | stock | products; each tab adds q, status, variant, page via `useSheetListControls`) -> `RentalsTab` / `StockTab` / `ProductsTab`, all on the shared `transport/MasterList`. `RentalsTab` filters by status (including a virtual "Overdue returns") and size, and opens `RentalDialog` (new / edit, inline new customer, optional advance, cancel), `RentalReturnsDialog` (summary, record a partial or full return, history with undo) and `RentalPaymentsDialog` (summary, record or edit a payment, history). `StockTab` -> `VariantDialog`; `ProductsTab` -> `ProductDialog`. Hooks: `features/sheets/hooks.ts`; service: `services/sheetService.ts` (`save_sheet_*`, `record_sheet_return`, `delete_sheet_return`, `cancel_sheet_rental` RPCs); formulas: `sheetEngine.ts`; schemas: `sheetForms.ts` (schema -> toX() -> mutation -> service). A rental or return refreshes rentals, variants, variant choices, returns and payments; anything that posts a payment also refreshes `transactions` and `finance-summary`. Stock is derived in the database, never in components (D-022).

## Gold loan formulas (Phase 7, D-024 / D-025)
All interest arithmetic lives ONLY in `src/services/goldInterest.ts`: **interest = principal x annual rate x days / 365** (simple, whole days, from the pledge date to today or the closing date, integer paise). `features/gold/goldEngine.ts`: total due = principal + interest; estimated balance = total due - repaid (min 0); due state from the due date. Payments are not split into principal and interest (D-009), so the balance is an estimate.
