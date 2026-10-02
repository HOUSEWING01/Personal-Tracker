import type { Paise } from '../lib/money'

export const BUSINESS_MODULES = ['property', 'transport', 'sheets', 'gold_loans', 'general'] as const
export type BusinessModule = (typeof BUSINESS_MODULES)[number]

export const TRANSACTION_TYPES = [
  'income', 'expense', 'investment', 'loan_received', 'loan_repayment', 'customer_payment', 'refund', 'adjustment',
  'deposit_received', 'deposit_returned',
] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

/** Deposit entries are posted by the Property advance screen only (D-029), never typed by hand. */
export const MANUAL_TRANSACTION_TYPES = TRANSACTION_TYPES.filter(
  (t) => t !== 'deposit_received' && t !== 'deposit_returned',
)

/** Domain model. Amounts are integer paise; `date` is a YYYY-MM-DD business date. */
export interface Transaction {
  id: string
  type: TransactionType
  amountPaise: Paise
  module: BusinessModule
  entityType: string | null
  entityId: string | null
  date: string
  paymentMethod: string | null
  description: string | null
  createdAt: string
}
