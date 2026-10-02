import type { Paise } from '../../lib/money'
import { accruedInterestPaise, daysBetween, type InterestLoan } from '../../services/goldInterest'

/** A due date within this many days (and not yet passed) is flagged "due soon". */
export const DUE_SOON_DAYS = 30

/** Principal + accrued interest (simple interest; see services/goldInterest.ts). */
export function totalDuePaise(loan: InterestLoan, today: string): Paise {
  return loan.principalPaise + accruedInterestPaise(loan, today)
}

/**
 * ESTIMATED balance = principal + accrued interest - repaid so far, never below zero (D-025).
 * Repayments are not split into principal and interest (D-009), so this is an estimate; the bank's own figure rules.
 */
export function estimatedBalancePaise(loan: InterestLoan, paidPaise: Paise, today: string): Paise {
  return Math.max(0, totalDuePaise(loan, today) - paidPaise)
}

export type DueState = { kind: 'overdue' | 'soon'; days: number } | null

/** Only active loans with a due date can be due. Overdue = due date before today; soon = within DUE_SOON_DAYS. */
export function dueState(loan: { status: string; dueDate: string | null }, today: string): DueState {
  if (loan.status !== 'active' || !loan.dueDate) return null
  const d = daysBetween(today, loan.dueDate)
  if (d < 0) return { kind: 'overdue', days: -d }
  if (d <= DUE_SOON_DAYS) return { kind: 'soon', days: d }
  return null
}

export function dueLabel(s: NonNullable<DueState>): string {
  if (s.kind === 'overdue') return `Overdue by ${s.days} ${s.days === 1 ? 'day' : 'days'}`
  return s.days === 0 ? 'Due today' : `Due in ${s.days} ${s.days === 1 ? 'day' : 'days'}`
}

/** "12.5 g" / "12.345 g"; trailing zeros dropped. */
export function formatGrams(g: number | null): string {
  return g === null ? '' : `${Number(g.toFixed(3))} g`
}
