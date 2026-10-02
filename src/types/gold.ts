import type { Paise } from '../lib/money'

export const GOLD_LOAN_STATUSES = ['active', 'closed', 'released'] as const
export type GoldLoanStatus = (typeof GOLD_LOAN_STATUSES)[number]

/**
 * A bank-pledged gold loan (D-024). `principalPaise` is the amount received from the bank.
 * Accrued interest is never stored; it comes from `services/goldInterest.ts` (D-025).
 * `paidPaise` / `paymentCount` / `lastPaymentDate` are raw sums from the view `gold_loan_payment_totals`.
 */
export interface GoldLoan {
  id: string
  personName: string
  mobile: string | null
  goldDescription: string
  /** Grams, up to 3 decimals; optional. */
  goldWeightGrams: number | null
  bank: string
  pledgeDate: string
  dueDate: string | null
  principalPaise: Paise
  /** Percent per year, e.g. 9.5. */
  annualRate: number
  status: GoldLoanStatus
  /** Set when the loan is closed or the gold released; interest stops accruing on this date. */
  closedDate: string | null
  notes: string | null
  paidPaise: Paise
  paymentCount: number
  lastPaymentDate: string | null
}

/** One repayment: the full amount paid, interest included (D-009). */
export interface GoldLoanPayment {
  id: string
  loanId: string
  paymentDate: string
  amountPaise: Paise
  notes: string | null
}
