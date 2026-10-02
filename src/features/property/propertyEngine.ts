import type { Paise } from '../../lib/money'
import type { PropertyOverview, RentCharge } from '../../types/property'

/**
 * Property formulas live ONLY here (SESSION.md: no duplicated financial calculations).
 *
 *   month outstanding   = expected - paid                       (never below 0; the DB rejects overpayment)
 *   property outstanding = sum(expected) - sum(paid)
 *   advance remaining    = received - adjusted - returned
 *   occupied             = a tenant exists and the tenancy has not ended (end date empty or >= today)
 */
export const outstanding = (expected: Paise, paid: Paise): Paise => Math.max(0, expected - paid)

export const advanceRemaining = (received: Paise, adjusted: Paise, returned: Paise): Paise => received - adjusted - returned

export type ChargeStatus = 'paid' | 'partial' | 'unpaid'

export function chargeStatus(c: Pick<RentCharge, 'expectedPaise' | 'paidPaise'>): ChargeStatus {
  if (outstanding(c.expectedPaise, c.paidPaise) === 0) return 'paid'
  return c.paidPaise > 0 ? 'partial' : 'unpaid'
}

/** Overdue = rent for a month that has already ended and is not fully paid. `today` is a YYYY-MM-DD IST date. */
export function isOverdue(c: Pick<RentCharge, 'period' | 'expectedPaise' | 'paidPaise'>, today: string): boolean {
  return c.period.slice(0, 7) < today.slice(0, 7) && outstanding(c.expectedPaise, c.paidPaise) > 0
}

export function isOccupied(p: Pick<PropertyOverview, 'tenantName' | 'rentalEndDate'>, today: string): boolean {
  return p.tenantName !== null && (p.rentalEndDate === null || p.rentalEndDate >= today)
}

export function propertyTotals(p: PropertyOverview) {
  return {
    outstandingPaise: outstanding(p.expectedTotalPaise, p.paidTotalPaise),
    advanceRemainingPaise: advanceRemaining(p.advanceReceivedPaise, p.advanceAdjustedPaise, p.advanceReturnedPaise),
  }
}

/** "2026-08-01" -> "Aug 2026" */
export function formatPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)))
}
