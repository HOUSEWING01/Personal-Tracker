import { z } from 'zod'
import { isValidISODate, todayIST } from '../../lib/dates'
import { toPaise } from '../../lib/money'
import { BUSINESS_MODULES, MANUAL_TRANSACTION_TYPES } from '../../types/finance'
import type { NewTransaction } from '../../services/transactionService'

const MAX_PAISE = 99_999_999_999_999 // numeric(14,2)

function parseAmount(s: string): number | null {
  try {
    const p = toPaise(s)
    return Math.abs(p) <= MAX_PAISE ? p : null
  } catch { return null }
}

export const transactionFormSchema = z
  .object({
    type: z.enum(MANUAL_TRANSACTION_TYPES as [typeof MANUAL_TRANSACTION_TYPES[number], ...typeof MANUAL_TRANSACTION_TYPES[number][]]),
    module: z.enum(BUSINESS_MODULES),
    amount: z.string().trim().min(1, 'Enter an amount.').refine((s) => parseAmount(s) !== null, 'Enter a valid amount with up to 2 decimals.'),
    date: z.string().refine(isValidISODate, 'Enter a valid date.'),
    paymentMethod: z.string(),
    description: z.string().trim().max(200, 'Keep the description under 200 characters.'),
  })
  .superRefine((v, ctx) => {
    const paise = parseAmount(v.amount)
    if (paise === null) return
    if (v.type === 'adjustment') {
      if (paise === 0) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'An adjustment cannot be zero.' })
      if (!v.description) ctx.addIssue({ code: 'custom', path: ['description'], message: 'Explain the adjustment so it can be audited.' })
    } else if (paise <= 0) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Amount must be greater than zero.' })
    }
  })

export type TransactionFormValues = z.infer<typeof transactionFormSchema>

export function defaultFormValues(): TransactionFormValues {
  return { type: 'expense', module: 'general', amount: '', date: todayIST(), paymentMethod: '', description: '' }
}

/** Call only with values that passed the schema. */
export function toNewTransaction(v: TransactionFormValues): NewTransaction {
  return {
    type: v.type,
    module: v.module,
    amountPaise: toPaise(v.amount),
    date: v.date,
    paymentMethod: v.paymentMethod || undefined,
    description: v.description.trim() || undefined,
  }
}
