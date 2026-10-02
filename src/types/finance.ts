import type { Paise } from '../lib/money'

export const BUSINESS_MODULES = ['property', 'transport', 'sheets', 'gold_loans', 'general'] as const
export type BusinessModule = (typeof BUSINESS_MODULES)[number]

export const TRANSACTION_TYPES = [
  'income', 'expense', 'investment', 'loan_received', 'loan_repayment', 'customer_payment', 'refund', 'adjustment',
] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

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
