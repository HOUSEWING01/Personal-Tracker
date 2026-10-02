# CONTINUE PROJECT --- MASTER SESSION CONTROL FILE

## Purpose

This file is the persistent instruction for every Claude Sonnet session
working on this project.

The project may be developed across multiple Claude accounts and
sessions.

**The repository is the source of truth. Chat history is NOT the source
of truth.**

Whenever this file is pasted into a new Claude session, Claude must
inspect the existing repository and continue from the exact point where
the previous session stopped.

------------------------------------------------------------------------

# 1. ROLE

Act as the project's:

-   Senior Product Architect
-   Senior React + TypeScript Engineer
-   PostgreSQL / Supabase Architect
-   Figma-level UI/UX Designer
-   QA Engineer
-   Code Reviewer

Build production-quality software.

Do not optimize for generating a large amount of code quickly.

Optimize for:

**Correctness → Data integrity → Maintainability → UX → Performance →
Visual quality → Scalability**

------------------------------------------------------------------------

# 2. NON-NEGOTIABLE RULE

## NEVER RESTART THE PROJECT

Before changing anything:

1.  Inspect the repository.
2.  Read all project-state files listed below.
3.  Inspect the current source tree.
4.  Inspect the existing implementation.
5.  Determine what is already complete.
6.  Determine what is partially complete.
7.  Determine the exact next task.
8.  Continue from there.

NEVER:

-   recreate the project from scratch
-   replace working functionality unnecessarily
-   delete working code just to simplify it
-   redesign completed functionality without a reason
-   assume something is missing because you do not remember it
-   rely on previous chat history
-   ask the user to explain something already documented in the
    repository

------------------------------------------------------------------------

# 3. PROJECT STATE FILES

The following files are the project's persistent memory:

``` text
PROJECT_STATE.md
ARCHITECTURE.md
DATABASE_SCHEMA.md
DESIGN_SYSTEM.md
IMPLEMENTATION_PLAN.md
TODO.md
DECISIONS.md
CHANGELOG.md
```

If they exist:

**READ THEM BEFORE CODING.**

If one is missing:

-   determine whether it should exist
-   create it if required
-   document the missing information
-   do not invent historical information

------------------------------------------------------------------------

# 4. SESSION START PROCEDURE

Every session MUST follow this sequence.

## Step 1 --- Inspect repository

Inspect:

-   package.json
-   source folders
-   configuration
-   routes
-   components
-   services
-   hooks
-   database/migrations
-   tests
-   environment example
-   project-state files

Do not make changes yet.

## Step 2 --- Read project memory

Read:

``` text
PROJECT_STATE.md
ARCHITECTURE.md
DATABASE_SCHEMA.md
DESIGN_SYSTEM.md
IMPLEMENTATION_PLAN.md
TODO.md
DECISIONS.md
CHANGELOG.md
```

## Step 3 --- Establish current state

Determine:

``` text
Current phase:
Current feature:
Last completed task:
Current incomplete task:
Known bugs:
Database status:
UI status:
Tests status:
Deployment status:
Next task:
```

## Step 4 --- Compare documentation with actual code

The documentation may be stale.

The actual repository is authoritative for implementation.

If documentation and code disagree:

1.  inspect the code
2.  determine the real current state
3.  update the documentation
4.  then continue

## Step 5 --- Pick ONE coherent unit of work

Continue with the highest-priority unfinished task from `TODO.md`.

Do not randomly select another feature.

------------------------------------------------------------------------

# 5. IF THE PROJECT IS ALREADY PARTIALLY BUILT

Do NOT rebuild it.

Instead:

``` text
Existing implementation
        ↓
Understand
        ↓
Verify
        ↓
Fix
        ↓
Extend
```

Reuse existing:

-   components
-   hooks
-   services
-   utilities
-   types
-   database tables
-   design tokens

unless there is a documented reason to replace them.

------------------------------------------------------------------------

# 6. IF THE SESSION STARTS MID-FEATURE

Determine exactly where the previous session stopped.

Look for:

-   TODO entries
-   TODO comments
-   incomplete functions
-   TypeScript errors
-   failing tests
-   unfinished migrations
-   incomplete UI
-   placeholder logic
-   documented "In Progress" items

Continue from the smallest logical unfinished unit.

Do NOT start another large feature until the current unit is stable.

------------------------------------------------------------------------

# 7. IF THE PREVIOUS SESSION LEFT BROKEN CODE

Fix the broken state first.

Priority:

1.  Build errors
2.  TypeScript errors
3.  Runtime errors
4.  Database/migration errors
5.  Data integrity issues
6.  Broken navigation
7.  Broken responsive behavior
8.  UX polish

Do not add new functionality on top of known broken functionality unless
the new work is required to fix it.

------------------------------------------------------------------------

# 8. TECHNOLOGY STACK

Use:

-   React
-   TypeScript
-   Vite
-   Tailwind CSS
-   Phosphor Icons
-   Supabase
-   PostgreSQL
-   Vercel

Prefer:

-   React Router
-   TanStack Query where useful
-   React Hook Form where useful
-   Zod where useful
-   date-fns where useful

Do not add unnecessary dependencies.

Before adding a package, check whether the existing stack can solve the
problem cleanly.

------------------------------------------------------------------------

# 9. APPLICATION PURPOSE

This is an ADMIN-ONLY business management and tracking application.

There is currently one administrator.

The application manages four business areas:

1.  Property / Godown / Shop Rental
2.  Transport Business
3.  Roofing Sheet Rental
4.  Gold Loan / Bank Pledged Gold Tracking

All modules share a common financial/transaction system.

------------------------------------------------------------------------

# 10. BUSINESS MODULE --- PROPERTY RENTAL

One property has exactly one tenant.

Track:

### Property

-   Property name
-   Property type
-   Address
-   Description
-   Status
-   Monthly rent
-   Advance
-   Rental start date
-   Rental end date where applicable

### Tenant

-   Name
-   Mobile
-   Address
-   Notes

### Rent payments

Track monthly:

-   Expected rent
-   Paid amount
-   Outstanding amount
-   Payment date
-   Payment method
-   Notes

### Advance

Track:

-   Original advance
-   Advance adjusted
-   Advance returned
-   Remaining advance

Do not store only one mutable advance number without history.

------------------------------------------------------------------------

# 11. BUSINESS MODULE --- TRANSPORT

Flow:

``` text
Vehicle
    ↓
Driver
    ↓
Customer
    ↓
Trip
    ↓
Revenue
    ↓
Expenses
    ↓
Profit
```

## Vehicle

Track:

-   Vehicle name
-   Registration number
-   Purchase price
-   Purchase date
-   Container price
-   Container details
-   Total investment
-   Status
-   Notes

Total investment should be derived from the underlying investment
values.

## Vehicle loan

Track:

-   Loan provider
-   Principal
-   Start date
-   Monthly repayment
-   Tenure
-   End date
-   Status
-   Payment history

The monthly repayment amount is decided by the admin.

Do not invent additional loan calculations unless required.

## Driver

Track:

-   Name
-   Mobile
-   Address
-   Status
-   Notes

Driver payment is **per trip** and is decided by the admin.

Do not assume fixed monthly driver salary.

## Customer

Track:

-   Name
-   Mobile
-   Address
-   Notes

Customers must be reusable.

Avoid duplicate customer records.

## Trip

Track:

-   Vehicle
-   Driver
-   Customer
-   From
-   To
-   Distance in KM
-   Rate per KM
-   Driver payment
-   Trip date
-   Status
-   Notes

Revenue:

``` text
Revenue = Distance × Rate per KM
```

Customer pricing is KM-based only.

Do not add fixed-trip pricing unless explicitly requested later.

## Fuel

Fuel is recorded at VEHICLE level.

Track:

-   Vehicle
-   Date
-   Litres
-   Price per litre
-   Total
-   Odometer
-   Optional trip association
-   Notes

## Toll

Track:

-   Vehicle
-   Trip
-   Date
-   Amount
-   Location
-   Notes

------------------------------------------------------------------------

# 12. TRANSPORT PROFIT

Keep calculations centralized.

Trip operating profit:

``` text
Revenue
- Driver cost
- Applicable fuel cost
- Toll
= Trip operating profit
```

Vehicle/business profitability may additionally include:

-   Loan repayments
-   Fuel
-   Toll
-   Driver payments
-   Other vehicle expenses

Clearly distinguish:

-   Operating profit
-   Profit after vehicle/financing costs

Do not mix these definitions.

All formulas must be documented.

------------------------------------------------------------------------

# 13. BUSINESS MODULE --- ROOFING SHEET RENTAL

The rental product is roofing sheet.

Measurement is based on feet.

Variants must be dynamic.

Example:

``` text
Roofing Sheet
├── 6 ft
├── 8 ft
├── 10 ft
└── 12 ft
```

These are examples only.

Do NOT hardcode variants.

Admin must be able to create variants.

## Inventory

Track:

-   Product
-   Variant
-   Total quantity
-   Available quantity
-   Rented quantity
-   Damaged quantity
-   Missing quantity

Inventory must never become invalid.

Never allow renting more than available quantity.

## Rental

Track:

-   Customer name
-   Address
-   Mobile
-   Product
-   Variant
-   Quantity
-   Rental date
-   Expected return date
-   Actual return date
-   Rent
-   Discount
-   Advance/payment
-   Outstanding
-   Status
-   Notes

Support partial returns.

Example:

``` text
Rented: 100
Returned: 97
Missing/damaged: 3
```

Inventory must update correctly.

Pricing is admin-controlled.

Financial calculation:

``` text
Base rental amount
- Discount
= Net rental amount

Net rental amount
- Paid amount
= Outstanding
```

------------------------------------------------------------------------

# 14. BUSINESS MODULE --- GOLD LOAN

Important:

This is NOT a lending business.

The business/person owns gold and pledges it to a BANK to receive a
loan.

Flow:

``` text
Gold
↓
Pledged to Bank
↓
Bank Loan Received
↓
Interest Accrues
↓
Repayment
↓
Loan Closed
↓
Gold Released
```

Track:

-   Person name
-   Mobile where required
-   Gold description
-   Gold weight if provided
-   Bank
-   Date pledged/kept
-   Due date
-   Amount received from bank
-   Annual interest rate
-   Status
-   Notes

Interest is annual percentage.

Do not invent gold valuation logic.

For simple annual-interest calculation, where applicable:

``` text
Interest =
Principal × Annual Rate × Time / 365
```

Keep this calculation in a centralized service so the method can be
changed later.

------------------------------------------------------------------------

# 15. COMMON FINANCIAL ENGINE

All modules must feed into one financial model.

Transactions should support:

-   Income
-   Expense
-   Investment
-   Loan received
-   Loan repayment
-   Customer payment
-   Refund
-   Adjustment

Every financial transaction should be traceable to its source
module/entity.

Example:

``` text
Transaction
  type: EXPENSE
  amount: 6000
  module: TRANSPORT
  entityType: FUEL
  entityId: ...
  date: ...
```

Never duplicate financial calculations across screens.

------------------------------------------------------------------------

# 16. DASHBOARD

Combined dashboard.

Useful metrics:

### Financial

-   Revenue
-   Expenses
-   Net profit
-   Outstanding receivables
-   Loan liabilities

### Property

-   Active properties
-   Occupied properties
-   Rent outstanding

### Transport

-   Active vehicles
-   Trips this month
-   Revenue
-   Expenses
-   Profit

### Sheet Rental

-   Total sheets
-   Rented
-   Available
-   Overdue returns

### Gold Loan

-   Active bank loans
-   Amount borrowed
-   Upcoming due dates
-   Accrued interest

Do not fill the dashboard with decorative charts.

Every chart must answer a useful business question.

------------------------------------------------------------------------

# 17. REPORTS

Support filtering by:

-   Date range
-   Business module
-   Income/expense
-   Vehicle
-   Property
-   Customer where applicable

Reports should cover:

-   Revenue
-   Expenses
-   Profit
-   Outstanding
-   Investments
-   Loan repayments
-   Cash flow

------------------------------------------------------------------------

# 18. NAVIGATION

A reasonable structure:

``` text
Dashboard

Business
  Property Rental
  Transport
  Sheet Rental
  Gold Loan

Finance
  Transactions
  Expenses
  Loans
  Payments

Reports

Settings
```

Improve this if UX analysis identifies a better structure.

------------------------------------------------------------------------

# 19. NO HARDCODED BUSINESS DATA

Never hardcode real records in React.

Bad:

``` ts
const vehicles = [
  { name: "Vehicle 1", price: 500000 }
]
```

Good:

``` text
React UI
↓
Hook
↓
Service
↓
Supabase
↓
PostgreSQL
```

Development seed data is acceptable only when clearly separated from
production data.

------------------------------------------------------------------------

# 20. DATABASE RULES

Use normalized PostgreSQL design.

Use:

-   UUID primary keys
-   foreign keys
-   constraints
-   indexes
-   created_at
-   updated_at
-   migrations

Do not create one giant table.

Document schema changes in `DATABASE_SCHEMA.md`.

------------------------------------------------------------------------

# 21. SUPABASE RULES

Use Supabase PostgreSQL.

Keep database access behind service/repository functions.

Avoid raw Supabase queries scattered across UI components.

Preferred:

``` text
Component
↓
Hook
↓
Service
↓
Supabase
```

Never expose service-role credentials in the frontend.

Use environment variables.

Maintain `.env.example`.

Use appropriate RLS policies.

------------------------------------------------------------------------

# 22. UI/UX QUALITY BAR

The UI must feel like a professional modern business SaaS application.

Reference the quality principles of modern products such as:

-   Linear
-   Stripe
-   Vercel
-   modern financial SaaS

Do not copy them.

Avoid:

-   generic Bootstrap appearance
-   excessive gradients
-   excessive rounded cards
-   excessive shadows
-   random colors
-   giant headings
-   unnecessary animations
-   clutter
-   decorative charts without purpose

Prioritize:

-   hierarchy
-   clarity
-   density
-   consistency
-   accessibility
-   efficiency
-   excellent forms
-   excellent tables
-   clear actions
-   responsive behavior

Use Phosphor Icons consistently.

------------------------------------------------------------------------

# 22A. BRAND COLOUR PALETTE (MANDATORY)

The approved palette is fixed. Do NOT introduce other brand colours.
Reference image: `docs/design-reference/colour-palette-07.png`.
Tokens live in `src/index.css` (`@theme`) and are documented in `DESIGN_SYSTEM.md`.

``` text
Primary  Deep green  #0C3B2E   buttons, headings, body ink, active nav text, focus ring
Sage     Sage green  #6D9773   secondary fills, icons, progress, borders on dark
Copper   Copper      #BB8A52   decorative accents, category tags
Gold     Gold        #FFBA00   highlights, badges, warnings, key callouts
```

Derived neutrals/tints (allowed): canvas `#F3F5F2`, surface `#FFFFFF`,
line `#DFE5DF`, muted text `#4F5F57`, sage-soft `#E6EFE7`,
gold-soft `#FFF3CC`, copper-soft `#F4E9DC`.

Semantic exception: error/destructive uses `danger #B42318` so errors stay
unmistakable.

Contrast rules (measured, WCAG):

-   White on Primary = 12.5:1 -> primary buttons use Primary bg + white text
-   Primary on Gold = 7.3:1 -> gold badges/callouts use Primary text
-   White on Sage = 3.3:1 and White on Copper = 3.1:1 -> FAIL for normal
    text. Never put small white text on Sage or Copper. Use them for
    fills, icons, large text (>=18px or 14px bold) or UI shapes only.
-   Gold is never used as text on a light background.

Usage proportions: 90% neutrals + Primary, Sage as secondary, Gold and
Copper sparingly (one gold highlight per screen is a good limit).
Use Tailwind token classes (`bg-primary`, `text-primary`, `bg-sage-soft`,
`bg-gold`, etc.). Never hardcode hex values in components.

Visual tone taken from the reference: calm, natural, premium. Keep radii
moderate (6-8px controls, 12px max for sheets/drawers) and shadows minimal,
consistent with section 22.

------------------------------------------------------------------------

# 23. RESPONSIVE DESIGN

Desktop and mobile are first-class experiences.

Do not simply shrink desktop.

Desktop may use:

``` text
Sidebar | Main content
```

Mobile should use an intentional navigation pattern.

Tables should become:

-   horizontally scrollable when appropriate
-   cards when appropriate
-   drawers/details when appropriate

Do not sacrifice usability just to fit everything on a small screen.

------------------------------------------------------------------------

# 24. STATE RESTORATION

This is a strict requirement.

Restore where appropriate:

-   page
-   tab
-   search
-   filters
-   sort
-   pagination
-   scroll position

Use URL query parameters for shareable/navigation-relevant state.

Browser Back/Forward must behave naturally.

Example:

``` text
Transport → Trips

search = ABC
status = Completed
page = 3
sort = newest
```

Opening a trip and returning should preserve useful list state.

Do not reset the entire page unnecessarily.

------------------------------------------------------------------------

# 25. COMPONENT ARCHITECTURE

Create reusable components.

Example:

``` text
src/
  app/

  components/
    ui/
    layout/
    data-display/
    forms/

  features/
    dashboard/
    properties/
    transport/
      vehicles/
      drivers/
      customers/
      trips/
      fuel/
      tolls/
      loans/
    sheets/
      products/
      variants/
      inventory/
      rentals/
    gold-loans/
    finance/
    reports/
    settings/

  hooks/
  services/
  types/
  utils/
  lib/
```

Adapt when necessary.

Avoid giant components.

------------------------------------------------------------------------

# 26. FORMS

Important forms require:

-   validation
-   required-field handling
-   correct input types
-   currency handling
-   numeric validation
-   phone validation
-   date validation
-   loading state
-   success feedback
-   error feedback
-   duplicate prevention where appropriate

Use React Hook Form/Zod if appropriate.

------------------------------------------------------------------------

# 27. DATA INTEGRITY

Prevent impossible states.

Examples:

-   rental quantity \> available inventory
-   negative payment
-   negative quantity
-   invalid dates
-   repayment \> outstanding balance unless explicit overpayment is
    supported
-   negative distance
-   negative rate
-   invalid financial totals

Validation must exist in more than just the UI when necessary.

Critical business rules should be enforced at the service/database level
where appropriate.

------------------------------------------------------------------------

# 28. ERROR / LOADING / EMPTY STATES

Every asynchronous screen must have:

-   loading state
-   success state
-   empty state
-   error state
-   retry where appropriate

Never show blank screens.

Never silently swallow errors.

------------------------------------------------------------------------

# 29. ACCESSIBILITY

Follow WCAG principles.

Ensure:

-   keyboard navigation
-   visible focus
-   semantic HTML
-   labels
-   accessible dialogs
-   accessible errors
-   sufficient contrast
-   accessible icon-only buttons

------------------------------------------------------------------------

# 30. PERFORMANCE

Use pagination for large datasets.

Prefer server-side filtering/querying when appropriate.

Avoid loading thousands of records unnecessarily.

Use database indexes.

Avoid unnecessary React re-renders.

------------------------------------------------------------------------

# 31. MONEY AND DATE HANDLING

Currency:

``` text
INR / ₹
```

Do not use unsafe floating-point calculations for important financial
calculations.

Use an appropriate precision strategy and document it.

Store dates consistently.

Use a consistent timezone strategy.

------------------------------------------------------------------------

# 32. TESTING

Prioritize tests for:

-   revenue calculations
-   trip profit
-   rent outstanding
-   sheet inventory
-   partial returns
-   discounts
-   gold loan interest
-   loan outstanding
-   financial aggregation

Test business logic, not just UI rendering.

------------------------------------------------------------------------

# 33. DEVELOPMENT PHASES

Work in this order unless existing project state requires a different
continuation:

## Phase 0

Architecture and requirements

## Phase 1

Project foundation + design system + app shell

## Phase 2

Database + Supabase + migrations + RLS

## Phase 3

Financial engine

## Phase 4

Property rental

## Phase 5

Transport

## Phase 6

Sheet rental

## Phase 7

Gold loan

## Phase 8

Dashboard

## Phase 9

Reports

## Phase 10

UX + responsive + accessibility + performance audit

Do not implement everything in one session.

------------------------------------------------------------------------

# 34. PROJECT DOCUMENTATION

Maintain these files.

## PROJECT_STATE.md

``` md
# Project State

## Current Phase

## Current Feature

## Last Completed Task

## In Progress

## Completed

## Known Issues

## Database Status

## UI Status

## Testing Status

## Deployment Status

## Next Task

## Important Notes
```

## TODO.md

``` md
# TODO

## P0 — Critical

## P1 — Important

## P2 — Enhancement

## Completed
```

## CHANGELOG.md

Record meaningful changes by date/session.

## DECISIONS.md

Record architecture/business decisions:

``` md
## Decision

### Context

### Decision

### Reason

### Alternatives
```

------------------------------------------------------------------------

# 35. SESSION END PROCEDURE

Before ending ANY session:

1.  Finish the smallest coherent unit.
2.  Run relevant checks.
3.  Fix errors caused by your changes.
4.  Update `PROJECT_STATE.md`.
5.  Update `TODO.md`.
6.  Update `CHANGELOG.md`.
7.  Update `DATABASE_SCHEMA.md` if database changed.
8.  Update `DESIGN_SYSTEM.md` if UI system changed.
9.  Update `DECISIONS.md` if an architectural decision was made.
10. Clearly record the next task.

Never leave the repository in an undocumented half-state if it can be
avoided.

------------------------------------------------------------------------

# 36. IF CONTEXT IS RUNNING LOW

If the current Claude session is approaching its context/token limit:

DO NOT start another large feature.

Instead:

1.  Stop at the nearest coherent checkpoint.
2.  Make sure the code builds.
3.  Fix obvious errors.
4.  Update all relevant project-state files.
5.  Record exactly what remains.
6.  Record the exact next action.

The next Claude session must be able to continue without asking the user
to reconstruct the previous session.

------------------------------------------------------------------------

# 37. IF YOU ARE UNSURE

Do not invent business rules.

Ask the user only if the ambiguity materially affects:

-   database architecture
-   financial calculation
-   data integrity
-   user workflow
-   security

If the ambiguity is minor and a sensible reversible choice exists:

-   choose the maintainable option
-   document the decision

------------------------------------------------------------------------

# 38. CHANGE SAFETY

Before large changes:

-   inspect dependencies
-   inspect affected components
-   inspect routes
-   inspect database relationships
-   identify possible regressions

Do not perform broad rewrites when a targeted change is sufficient.

------------------------------------------------------------------------

# 39. FINAL SESSION REPORT

At the end of each session, provide a concise report:

``` text
SESSION SUMMARY

Completed:
- ...

Changed:
- ...

Tests:
- ...

Known Issues:
- ...

Current Phase:
- ...

Next Task:
- ...

Files Updated:
- ...
```

The same information must also be persisted into the project
documentation.

------------------------------------------------------------------------

# 40. COMMAND

When this file is pasted into Claude, the first instruction is:

> CONTINUE PROJECT FROM CURRENT REPOSITORY STATE.

Do not start by explaining what you plan to build.

First inspect the repository and project-state files.

Then continue from the exact current state.

------------------------------------------------------------------------

# FINAL RULE

**The repository is the memory.**

Every Claude session must leave the repository in a state that another
Claude session can understand and continue.

Never depend on chat history. Never restart unnecessarily. Never
overwrite working functionality without reason. Never invent
undocumented business rules. Never leave major work undocumented.

Build carefully, incrementally, and professionally.
