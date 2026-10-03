/**
 * The ONE place gold-loan interest is calculated (ARCHITECTURE.md, D-025). To change the method later
 * (compounding, monthly rests, a bank's own day count) change this file only; no component or database
 * function does interest arithmetic.
 *
 *   interest = principal x annual rate x days / 365      (simple interest, on the full principal)
 *
 * Money is integer paise (D-003). Dates are IST business dates 'YYYY-MM-DD' (D-004).
 */
import type { Paise } from '../lib/money'
import { isValidISODate } from '../lib/dates'

const DAY_MS = 86_400_000

/** Whole calendar days from `from` to `to` (to - from). Negative if `to` is earlier. Invalid dates give 0. */
export function daysBetween(from: string, to: string): number {
  if (!isValidISODate(from) || !isValidISODate(to)) return 0
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

/**
 * Simple interest in paise, rounded half up to the nearest paisa.
 * `annualRatePercent` is e.g. 9.5 (at most 2 decimals). Zero for zero/negative days or non-positive principal.
 * Uses BigInt so large principals x long periods cannot lose precision.
 */
export function simpleInterestPaise(principalPaise: Paise, annualRatePercent: number, days: number): Paise {
  if (!(principalPaise > 0) || !(days > 0) || !(annualRatePercent > 0)) return 0
  const rateHundredths = BigInt(Math.round(annualRatePercent * 100))
  const num = BigInt(principalPaise) * rateHundredths * BigInt(Math.floor(days))
  const den = 10_000n * 365n // 100 for percent, 100 for hundredths, 365 days
  return Number((2n * num + den) / (2n * den))
}

export interface InterestLoan {
  principalPaise: Paise
  annualRate: number
  pledgeDate: string
  dueDate: string | null
  status: 'active' | 'closed' | 'released'
  closedDate: string | null
}

/** Date interest runs up to: the closing date for a closed / released loan, otherwise today. Never before the pledge date. */
export function interestEndDate(loan: Pick<InterestLoan, 'status' | 'closedDate' | 'pledgeDate'>, today: string): string {
  const end = loan.status !== 'active' && loan.closedDate ? loan.closedDate : today
  return end < loan.pledgeDate ? loan.pledgeDate : end
}

/** Days interest has run: pledge date to today (active) or to the closing date (closed / released). */
export function interestDays(loan: Pick<InterestLoan, 'status' | 'closedDate' | 'pledgeDate'>, today: string): number {
  return daysBetween(loan.pledgeDate, interestEndDate(loan, today))
}

/** Interest accrued from the pledge date to today (active) or to the closing date (closed / released). */
export function accruedInterestPaise(loan: InterestLoan, today: string): Paise {
  const days = daysBetween(loan.pledgeDate, interestEndDate(loan, today))
  return simpleInterestPaise(loan.principalPaise, loan.annualRate, days)
}

/** Interest for the whole term, pledge date to due date. Null when the loan has no due date. */
export function interestToDueDatePaise(loan: InterestLoan): Paise | null {
  if (!loan.dueDate) return null
  return simpleInterestPaise(loan.principalPaise, loan.annualRate, daysBetween(loan.pledgeDate, loan.dueDate))
}
