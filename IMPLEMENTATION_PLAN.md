# Implementation Plan

0. Architecture and requirements — DONE
1. Foundation + design system + app shell — DONE
2. Database + Supabase + migrations + RLS + admin auth — DONE (live-verified by admin)
3. Financial engine — DONE
4. Property rental — DONE (code); live check pending
5. Transport (vehicles/drivers/customers → trips → fuel/toll → loans → profit)
6. Sheet rental (dynamic variants, inventory, partial returns)
7. Gold loan (bank-pledged; central interest service)
8. Dashboard
9. Reports
10. UX / responsive / accessibility / performance audit

Formulas to document when built: revenue = distance × rate/km; trip operating profit = revenue − driver − fuel − toll; sheet outstanding = (base − discount) − paid; gold interest = principal × annual rate × days / 365.
