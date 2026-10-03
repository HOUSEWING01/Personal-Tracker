import type { Paise } from '../../lib/money'
import { accruedInterestPaise } from '../../services/goldInterest'
import type { GoldLoan } from '../../types/gold'
import { dueState, estimatedBalancePaise, type DueState } from '../gold/goldEngine'

/** Outstanding receivables = rent still unpaid + sheet rent still unpaid (each from its module's expected-vs-paid records). */
export function receivablesPaise(rentOutstanding: Paise, sheetOutstanding: Paise): Paise {
  return rentOutstanding + sheetOutstanding
}

export interface UpcomingDue { loan: GoldLoan; due: NonNullable<DueState> }

export interface GoldSummary {
  activeLoans: number
  borrowedPaise: Paise
  accruedInterestPaise: Paise
  estimatedBalancePaise: Paise
  /** Active loans overdue or due within 30 days, soonest first (overdue first). */
  upcoming: UpcomingDue[]
  /** How many of the upcoming loans are already past their due date. */
  overdueCount: number
}

/** Dashboard gold figures for the Active loans. Interest comes only from services/goldInterest.ts. */
export function summarizeGold(active: readonly GoldLoan[], today: string): GoldSummary {
  let borrowed = 0, interest = 0, balance = 0, overdueCount = 0
  const upcoming: UpcomingDue[] = []
  for (const l of active) {
    borrowed += l.principalPaise
    interest += accruedInterestPaise(l, today)
    balance += estimatedBalancePaise(l, l.paidPaise, today)
    const due = dueState(l, today)
    if (due) {
      upcoming.push({ loan: l, due })
      if (due.kind === 'overdue') overdueCount += 1
    }
  }
  upcoming.sort((a, b) => (a.loan.dueDate ?? '').localeCompare(b.loan.dueDate ?? ''))
  return { activeLoans: active.length, borrowedPaise: borrowed, accruedInterestPaise: interest, estimatedBalancePaise: balance, upcoming, overdueCount }
}

/**
 * Total debt (an estimate) = vehicle loans still owed + gold loans still owed.
 * Vehicle loans: amount received minus everything repaid so far, never below zero. Interest is not split out of the
 * repayments (D-009), so this can understate what is left; it is an estimate, not a lender's figure.
 * Gold loans: the estimated balance of the active loans (principal plus accrued interest, less payments).
 */
export function debtParts(vehicleLoanReceived: Paise, vehicleLoanRepaid: Paise, goldEstimatedBalance: Paise): { vehiclePaise: Paise; goldPaise: Paise; totalPaise: Paise } {
  const vehiclePaise = Math.max(0, vehicleLoanReceived - vehicleLoanRepaid)
  const goldPaise = Math.max(0, goldEstimatedBalance)
  return { vehiclePaise, goldPaise, totalPaise: vehiclePaise + goldPaise }
}

export function totalDebtPaise(vehicleLoanReceived: Paise, vehicleLoanRepaid: Paise, goldEstimatedBalance: Paise): Paise {
  return debtParts(vehicleLoanReceived, vehicleLoanRepaid, goldEstimatedBalance).totalPaise
}
