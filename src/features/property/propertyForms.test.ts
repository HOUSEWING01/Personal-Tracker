import { describe, expect, it } from 'vitest'
import {
  godownFormSchema, makeLeavingSchema, toGodownInput, toLeavingInput,
  defaultRentPaymentValues, makeAdvanceSchema, makeRentPaymentSchema, propertyFormSchema, tenantFormSchema, toPropertyInput, toRentPaymentInput,
} from './propertyForms'

const msgs = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.success ? [] : r.error!.issues.map((i) => i.message))

describe('propertyFormSchema', () => {
  const ok = { name: ' Shop 1 ', type: 'shop', status: 'active', monthlyRent: '12,500.50', address: '', description: '' } as const
  it('accepts a valid property and converts rent to integer paise', () => {
    expect(propertyFormSchema.safeParse(ok).success).toBe(true)
    expect(toPropertyInput(propertyFormSchema.parse(ok))).toMatchObject({ name: 'Shop 1', monthlyRentPaise: 1_250_050, address: null })
  })
  it('rejects empty name, zero or malformed rent', () => {
    expect(msgs(propertyFormSchema.safeParse({ ...ok, name: '  ' }))).toContain('Enter a property name.')
    expect(msgs(propertyFormSchema.safeParse({ ...ok, monthlyRent: '0' }))).toContain('Amount must be greater than zero.')
    expect(msgs(propertyFormSchema.safeParse({ ...ok, monthlyRent: '10.999' }))).toContain('Enter a valid amount with up to 2 decimals.')
    expect(msgs(propertyFormSchema.safeParse({ ...ok, monthlyRent: '' }))).toContain('Enter the monthly rent.')
  })
})

describe('tenantFormSchema', () => {
  const ok = { name: 'Ravi', mobile: '9876543210', address: '', notes: '', rentalStartDate: '2026-04-01', rentalEndDate: '' }
  it('accepts a valid tenant and an empty mobile', () => {
    expect(tenantFormSchema.safeParse(ok).success).toBe(true)
    expect(tenantFormSchema.safeParse({ ...ok, mobile: '' }).success).toBe(true)
  })
  it('validates mobile, dates and end-before-start', () => {
    expect(msgs(tenantFormSchema.safeParse({ ...ok, mobile: '12345' }))).toContain('Enter a 10-digit mobile number.')
    expect(msgs(tenantFormSchema.safeParse({ ...ok, rentalStartDate: '2026-02-30' }))).toContain('Enter the rental start date.')
    expect(msgs(tenantFormSchema.safeParse({ ...ok, rentalEndDate: '2026-03-31' }))).toContain('End date cannot be before the start date.')
  })
})

describe('rent payment schema', () => {
  const schema = makeRentPaymentSchema(400_000) // ₹4,000.00 outstanding
  const ok = { amount: '1500', paymentDate: '2026-10-03', paymentMethod: 'upi', notes: '' }
  it('accepts part and exact payments', () => {
    expect(schema.safeParse(ok).success).toBe(true)
    expect(schema.safeParse({ ...ok, amount: '4000.00' }).success).toBe(true)
    expect(toRentPaymentInput(schema.parse(ok))).toMatchObject({ amountPaise: 150_000, paymentMethod: 'upi', notes: null })
  })
  it('rejects zero, negative, over-outstanding amounts and unknown methods', () => {
    expect(msgs(schema.safeParse({ ...ok, amount: '0' }))).toContain('Amount must be greater than zero.')
    expect(msgs(schema.safeParse({ ...ok, amount: '-5' }))).toContain('Amount must be greater than zero.')
    expect(msgs(schema.safeParse({ ...ok, amount: '4000.01' }))).toContain('Amount is more than the rent outstanding for this month.')
    expect(schema.safeParse({ ...ok, paymentMethod: 'barter' }).success).toBe(false)
  })
  it('defaults the amount to the outstanding balance', () => {
    expect(defaultRentPaymentValues(400_050).amount).toBe('4000.50')
  })
})

describe('advance schema', () => {
  const schema = makeAdvanceSchema(300_000) // ₹3,000.00 remaining
  const ok = { kind: 'returned', amount: '3000', date: '2026-10-03', notes: '' } as const
  it('allows returning or adjusting up to the remaining advance', () => {
    expect(schema.safeParse(ok).success).toBe(true)
    expect(msgs(schema.safeParse({ ...ok, amount: '3000.01' }))).toContain('Amount is more than the advance remaining.')
    expect(msgs(schema.safeParse({ ...ok, kind: 'adjusted', amount: '3500' }))).toContain('Amount is more than the advance remaining.')
  })
  it('does not cap newly received advance', () => {
    expect(schema.safeParse({ ...ok, kind: 'received', amount: '99999' }).success).toBe(true)
  })
})

describe('godownFormSchema', () => {
  const ok = { name: ' Ravi Traders ', mobile: '', monthlyRent: '15,000', rentalStartDate: '2026-10-01', address: '', advance: '' }
  it('accepts a godown with no advance and converts to integer paise', () => {
    expect(godownFormSchema.safeParse(ok).success).toBe(true)
    expect(toGodownInput(godownFormSchema.parse(ok))).toMatchObject({ name: 'Ravi Traders', monthlyRentPaise: 1_500_000, advancePaise: 0, mobile: null, address: null })
  })
  it('reads the advance in paise', () => {
    expect(toGodownInput(godownFormSchema.parse({ ...ok, advance: '50000.50' })).advancePaise).toBe(5_000_050)
  })
  it('rejects a missing name, zero rent, a bad mobile and a negative advance', () => {
    expect(msgs(godownFormSchema.safeParse({ ...ok, name: ' ' }))).toContain('Enter the tenant name.')
    expect(msgs(godownFormSchema.safeParse({ ...ok, monthlyRent: '0' }))).toContain('Amount must be greater than zero.')
    expect(msgs(godownFormSchema.safeParse({ ...ok, mobile: '12345' }))).toContain('Enter a 10-digit mobile number.')
    expect(msgs(godownFormSchema.safeParse({ ...ok, advance: '-5' }))).toContain('Enter a valid amount with up to 2 decimals.')
  })
})

describe('makeLeavingSchema', () => {
  const schema = makeLeavingSchema(5_000_000, '2026-01-01')
  it('allows returning all, part or none of the advance', () => {
    expect(schema.safeParse({ leaveDate: '2026-10-03', returnAmount: '50000' }).success).toBe(true)
    expect(schema.safeParse({ leaveDate: '2026-10-03', returnAmount: '20000' }).success).toBe(true)
    expect(toLeavingInput(schema.parse({ leaveDate: '2026-10-03', returnAmount: '' }))).toEqual({ leaveDate: '2026-10-03', returnPaise: 0 })
  })
  it('rejects returning more than is held, and leaving before the start date', () => {
    expect(msgs(schema.safeParse({ leaveDate: '2026-10-03', returnAmount: '50000.01' }))).toContain('Amount is more than the advance held.')
    expect(msgs(schema.safeParse({ leaveDate: '2025-12-31', returnAmount: '' }))).toContain('Leaving date cannot be before the rental start date.')
  })
})
