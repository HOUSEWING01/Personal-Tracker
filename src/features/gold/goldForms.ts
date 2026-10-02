import { z } from 'zod'
import { isValidISODate } from '../../lib/dates'
import { GOLD_LOAN_STATUSES } from '../../types/gold'
import { parseMoney } from '../property/propertyForms'
import { parseKmHundredths } from '../transport/transportForms'

const text = (max: number, msg: string) => z.string().trim().max(max, msg)
const MAX_RATE_HUNDREDTHS = 10_000 // 100.00 % (matches the database check)

/** Grams in thousandths ("12.5" -> 12500), or null if not a positive-format number with at most 3 decimals. */
export function parseGramsThousandths(s: string): number | null {
  const t = s.trim()
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null
  const [whole, frac = ''] = t.split('.')
  const n = Number(whole) * 1000 + Number(frac.padEnd(3, '0'))
  return Number.isSafeInteger(n) ? n : null
}

export const goldLoanFormSchema = z.object({
  personName: z.string().trim().min(1, 'Enter the person\'s name.').max(100, 'Keep the name under 100 characters.'),
  mobile: z.string().trim().refine((s) => s === '' || /^[0-9]{10}$/.test(s), 'Enter a 10-digit mobile number, or leave blank.'),
  goldDescription: z.string().trim().min(1, 'Describe the gold (for example, 2 bangles and a chain).').max(300, 'Keep the description under 300 characters.'),
  goldWeight: z.string().trim()
    .refine((s) => s === '' || parseGramsThousandths(s) !== null, 'Enter the weight in grams with up to 3 decimals, or leave blank.')
    .refine((s) => s === '' || (parseGramsThousandths(s) ?? 1) > 0, 'Weight must be greater than zero.')
    .refine((s) => s === '' || (parseGramsThousandths(s) ?? 0) <= 9_999_999_999, 'Weight is too large.'),
  bank: z.string().trim().min(1, 'Enter the bank.').max(100, 'Keep the bank name under 100 characters.'),
  pledgeDate: z.string().refine(isValidISODate, 'Enter the date the gold was pledged.'),
  dueDate: z.string().refine((s) => s === '' || isValidISODate(s), 'Enter a valid due date, or leave blank.'),
  principal: z.string().trim().min(1, 'Enter the amount received from the bank.')
    .refine((s) => parseMoney(s) !== null, 'Enter a valid amount with up to 2 decimals.')
    .refine((s) => (parseMoney(s) ?? 1) > 0, 'Amount must be greater than zero.'),
  annualRate: z.string().trim().min(1, 'Enter the interest rate (0 if none).')
    .refine((s) => parseKmHundredths(s) !== null, 'Enter a valid rate with up to 2 decimals.')
    .refine((s) => { const n = parseKmHundredths(s); return n === null || n <= MAX_RATE_HUNDREDTHS }, 'Rate cannot be more than 100%.'),
  status: z.enum(GOLD_LOAN_STATUSES),
  closedDate: z.string().refine((s) => s === '' || isValidISODate(s), 'Enter a valid closing date.'),
  notes: text(500, 'Keep the notes under 500 characters.'),
}).superRefine((v, ctx) => {
  if (v.dueDate && isValidISODate(v.pledgeDate) && v.dueDate < v.pledgeDate) {
    ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'The due date cannot be before the pledge date.' })
  }
  if (v.status !== 'active') {
    if (v.closedDate === '') ctx.addIssue({ code: 'custom', path: ['closedDate'], message: 'Enter the date the loan was closed.' })
    else if (isValidISODate(v.pledgeDate) && v.closedDate < v.pledgeDate) {
      ctx.addIssue({ code: 'custom', path: ['closedDate'], message: 'The closing date cannot be before the pledge date.' })
    }
  }
})
export type GoldLoanFormValues = z.infer<typeof goldLoanFormSchema>

export const defaultGoldLoanValues = (todayISO = ''): GoldLoanFormValues => ({
  personName: '', mobile: '', goldDescription: '', goldWeight: '', bank: '', pledgeDate: todayISO, dueDate: '',
  principal: '', annualRate: '', status: 'active', closedDate: '', notes: '',
})

export function toGoldLoanInput(v: GoldLoanFormValues) {
  const grams = v.goldWeight.trim() === '' ? null : (parseGramsThousandths(v.goldWeight) ?? 0) / 1000
  return {
    personName: v.personName.trim(),
    mobile: v.mobile.trim() || null,
    goldDescription: v.goldDescription.trim(),
    goldWeightGrams: grams,
    bank: v.bank.trim(),
    pledgeDate: v.pledgeDate,
    dueDate: v.dueDate || null,
    principalPaise: parseMoney(v.principal) ?? 0,
    annualRate: (parseKmHundredths(v.annualRate) ?? 0) / 100,
    status: v.status,
    closedDate: v.status === 'active' ? null : v.closedDate || null,
    notes: v.notes.trim() || null,
  }
}

/** The full amount paid, interest included (D-009). The loan comes from the dialog, not the form. */
export const goldPaymentFormSchema = z.object({
  paymentDate: z.string().refine(isValidISODate, 'Enter the payment date.'),
  amount: z.string().trim().min(1, 'Enter the amount paid.')
    .refine((s) => parseMoney(s) !== null, 'Enter a valid amount with up to 2 decimals.')
    .refine((s) => (parseMoney(s) ?? 1) > 0, 'Amount must be greater than zero.'),
  notes: text(500, 'Keep the notes under 500 characters.'),
})
export type GoldPaymentFormValues = z.infer<typeof goldPaymentFormSchema>
export const defaultGoldPaymentValues = (todayISO = ''): GoldPaymentFormValues => ({ paymentDate: todayISO, amount: '', notes: '' })
export function toGoldPaymentInput(v: GoldPaymentFormValues) {
  return { paymentDate: v.paymentDate, amountPaise: parseMoney(v.amount) ?? 0, notes: v.notes.trim() || null }
}
