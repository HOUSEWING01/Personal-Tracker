import { z } from 'zod'
import { isValidISODate, todayIST } from '../../lib/dates'
import { toPaise } from '../../lib/money'
import { PROPERTY_TYPES } from '../../types/property'
import { PAYMENT_METHODS } from '../finance/labels'

const MAX_PAISE = 99_999_999_999_999 // numeric(14,2)

export function parseMoney(s: string): number | null {
  try {
    const p = toPaise(s)
    return Math.abs(p) <= MAX_PAISE ? p : null
  } catch { return null }
}

const money = (required = 'Enter an amount.') =>
  z.string().trim().min(1, required).refine((s) => parseMoney(s) !== null, 'Enter a valid amount with up to 2 decimals.')
const positiveMoney = (required?: string) =>
  money(required).refine((s) => (parseMoney(s) ?? 0) > 0, 'Amount must be greater than zero.')
const optionalText = (max: number, msg: string) => z.string().trim().max(max, msg)
const date = (msg = 'Enter a valid date.') => z.string().refine(isValidISODate, msg)

// ---------- property ----------
export const propertyFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a property name.').max(100, 'Keep the name under 100 characters.'),
  type: z.enum(PROPERTY_TYPES),
  status: z.enum(['active', 'inactive']),
  monthlyRent: positiveMoney('Enter the monthly rent.'),
  address: optionalText(300, 'Keep the address under 300 characters.'),
  description: optionalText(500, 'Keep the description under 500 characters.'),
})
export type PropertyFormValues = z.infer<typeof propertyFormSchema>
export const defaultPropertyValues = (): PropertyFormValues =>
  ({ name: '', type: 'shop', status: 'active', monthlyRent: '', address: '', description: '' })
export function toPropertyInput(v: PropertyFormValues) {
  return {
    name: v.name.trim(), type: v.type, status: v.status, monthlyRentPaise: toPaiseStrict(v.monthlyRent),
    address: v.address.trim() || null, description: v.description.trim() || null,
  }
}

// ---------- tenant ----------
export const tenantFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter the tenant name.').max(100, 'Keep the name under 100 characters.'),
  mobile: z.string().trim().refine((s) => s === '' || /^[0-9]{10}$/.test(s), 'Enter a 10-digit mobile number.'),
  address: optionalText(300, 'Keep the address under 300 characters.'),
  notes: optionalText(500, 'Keep the notes under 500 characters.'),
  rentalStartDate: date('Enter the rental start date.'),
  rentalEndDate: z.string().refine((s) => s === '' || isValidISODate(s), 'Enter a valid date.'),
}).superRefine((v, ctx) => {
  if (v.rentalEndDate && isValidISODate(v.rentalStartDate) && v.rentalEndDate < v.rentalStartDate)
    ctx.addIssue({ code: 'custom', path: ['rentalEndDate'], message: 'End date cannot be before the start date.' })
})
export type TenantFormValues = z.infer<typeof tenantFormSchema>
export const defaultTenantValues = (): TenantFormValues =>
  ({ name: '', mobile: '', address: '', notes: '', rentalStartDate: todayIST(), rentalEndDate: '' })
export function toTenantInput(v: TenantFormValues) {
  return {
    name: v.name.trim(), mobile: v.mobile.trim() || null, address: v.address.trim() || null, notes: v.notes.trim() || null,
    rentalStartDate: v.rentalStartDate, rentalEndDate: v.rentalEndDate || null,
  }
}

// ---------- rent payment (the cap is the month's outstanding; the database enforces it again) ----------
export function makeRentPaymentSchema(outstandingPaise: number) {
  return z.object({
    amount: positiveMoney(),
    paymentDate: date(),
    paymentMethod: z.enum(['', ...PAYMENT_METHODS.map((m) => m.value)] as [string, ...string[]]),
    notes: optionalText(200, 'Keep the notes under 200 characters.'),
  }).superRefine((v, ctx) => {
    const p = parseMoney(v.amount)
    if (p !== null && p > outstandingPaise)
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Amount is more than the rent outstanding for this month.' })
  })
}
export type RentPaymentFormValues = z.infer<ReturnType<typeof makeRentPaymentSchema>>
export const defaultRentPaymentValues = (outstandingPaise: number): RentPaymentFormValues =>
  ({ amount: (outstandingPaise / 100).toFixed(2), paymentDate: todayIST(), paymentMethod: '', notes: '' })
export function toRentPaymentInput(v: RentPaymentFormValues) {
  return { amountPaise: toPaiseStrict(v.amount), paymentDate: v.paymentDate, paymentMethod: v.paymentMethod || null, notes: v.notes.trim() || null }
}

// ---------- advance movement (cap = remaining advance for adjusted/returned) ----------
export function makeAdvanceSchema(remainingPaise: number) {
  return z.object({
    kind: z.enum(['received', 'adjusted', 'returned']),
    amount: positiveMoney(),
    date: date(),
    notes: optionalText(200, 'Keep the notes under 200 characters.'),
  }).superRefine((v, ctx) => {
    const p = parseMoney(v.amount)
    if (v.kind !== 'received' && p !== null && p > remainingPaise)
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Amount is more than the advance remaining.' })
  })
}
export type AdvanceFormValues = z.infer<ReturnType<typeof makeAdvanceSchema>>
export const defaultAdvanceValues = (): AdvanceFormValues => ({ kind: 'received', amount: '', date: todayIST(), notes: '' })
export function toAdvanceInput(v: AdvanceFormValues) {
  return { kind: v.kind, amountPaise: toPaiseStrict(v.amount), date: v.date, notes: v.notes.trim() || null }
}

/** Call only with values that passed the schemas. */
function toPaiseStrict(s: string): number {
  return toPaise(s)
}
