import type { Paise } from '../../lib/money'
import type { Transaction, TransactionType } from '../../types/finance'

/**
 * Central financial engine. Cash-basis, integer paise. See ARCHITECTURE.md "Financial formulas".
 *
 *   revenue        = income + customer_payment - refund
 *   expenses       = expense
 *   netProfit      = revenue - expenses            (operating; excludes investment, loan principal, adjustments)
 *   cashIn         = income + customer_payment + loan_received + deposit_received
 *   cashOut        = expense + investment + loan_repayment + refund + deposit_returned
 *   (deposits are refundable: they move cash but never revenue, expenses or profit; D-029)
 *   netCashFlow    = cashIn - cashOut + adjustments (adjustments are signed cash corrections)
 */
export type CashDirection = 'in' | 'out' | 'signed'

export const CASH_DIRECTION: Record<TransactionType, CashDirection> = {
  income: 'in',
  customer_payment: 'in',
  loan_received: 'in',
  expense: 'out',
  investment: 'out',
  loan_repayment: 'out',
  refund: 'out',
  deposit_received: 'in',
  deposit_returned: 'out',
  adjustment: 'signed',
}

export type TotalsByType = Partial<Record<TransactionType, Paise>>

export interface FinanceSummary {
  revenue: Paise
  expenses: Paise
  netProfit: Paise
  investments: Paise
  loanReceived: Paise
  loanRepayments: Paise
  adjustments: Paise
  cashIn: Paise
  cashOut: Paise
  netCashFlow: Paise
}

export function summarizeFromTotals(totals: TotalsByType): FinanceSummary {
  const t = (k: TransactionType): Paise => totals[k] ?? 0
  const revenue = t('income') + t('customer_payment') - t('refund')
  const expenses = t('expense')
  const cashIn = t('income') + t('customer_payment') + t('loan_received') + t('deposit_received')
  const cashOut = t('expense') + t('investment') + t('loan_repayment') + t('refund') + t('deposit_returned')
  return {
    revenue,
    expenses,
    netProfit: revenue - expenses,
    investments: t('investment'),
    loanReceived: t('loan_received'),
    loanRepayments: t('loan_repayment'),
    adjustments: t('adjustment'),
    cashIn,
    cashOut,
    netCashFlow: cashIn - cashOut + t('adjustment'),
  }
}

export function totalsFromTransactions(transactions: readonly Transaction[]): TotalsByType {
  const totals: TotalsByType = {}
  for (const tx of transactions) totals[tx.type] = (totals[tx.type] ?? 0) + tx.amountPaise
  return totals
}

export function summarize(transactions: readonly Transaction[]): FinanceSummary {
  return summarizeFromTotals(totalsFromTransactions(transactions))
}

/** Cash effect of one transaction: + in, - out, adjustments keep their own sign. */
export function signedCashAmount(tx: Pick<Transaction, 'type' | 'amountPaise'>): Paise {
  switch (CASH_DIRECTION[tx.type]) {
    case 'in': return tx.amountPaise
    case 'out': return -tx.amountPaise
    case 'signed': return tx.amountPaise
  }
}
