import type { BusinessModule, TransactionType } from '../../types/finance'
export const TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Income', expense: 'Expense', investment: 'Investment', loan_received: 'Loan received',
  loan_repayment: 'Loan repayment', customer_payment: 'Customer payment', refund: 'Refund', adjustment: 'Adjustment',
  deposit_received: 'Deposit received', deposit_returned: 'Deposit returned',
}
export const MODULE_LABELS: Record<BusinessModule, string> = {
  property: 'Property rental', transport: 'Transport', sheets: 'Sheet rental', gold_loans: 'Gold loans', general: 'General',
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
] as const
