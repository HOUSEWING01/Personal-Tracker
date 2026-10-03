import { describe, expect, it } from 'vitest'
import { loanEmi, loanEndDate, loanInterestRate, loanTenureMonths } from './transportEngine'
import {
  defaultLoanPaymentValues, defaultLoanValues, loanFormSchema, loanPaymentFormSchema, toLoanInput, toLoanPaymentInput,
} from './transportForms'

const loan = (over: Record<string, string> = {}) => ({
  ...defaultLoanValues('2026-04-01'), lender: 'HDFC Bank', principal: '1500000', interestRate: '9.5', emi: '31250', tenureMonths: '60', ...over,
})
const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues.map((i) => i.message) ?? []

describe('loanEndDate', () => {
  it('adds the tenure in months, same day of the month', () => {
    expect(loanEndDate('2026-04-10', 60)).toBe('2031-04-10')
    expect(loanEndDate('2026-11-05', 3)).toBe('2027-02-05')
  })
  it('clamps to the last day of a shorter month', () => {
    expect(loanEndDate('2026-01-31', 1)).toBe('2026-02-28')
    expect(loanEndDate('2027-12-31', 2)).toBe('2028-02-29') // leap year
  })
  it('crosses year boundaries correctly', () => {
    expect(loanEndDate('2026-12-15', 1)).toBe('2027-01-15')
    expect(loanEndDate('2026-12-15', 12)).toBe('2027-12-15')
    expect(loanEndDate('2026-12-15', 25)).toBe('2029-01-15')
  })
  it('is null without a tenure or with a bad date', () => {
    expect(loanEndDate('2026-04-10', null)).toBeNull()
    expect(loanEndDate('not-a-date', 12)).toBeNull()
  })
})

describe('loanFormSchema', () => {
  it('accepts a complete record and converts to paise', () => {
    const r = loanFormSchema.safeParse(loan())
    expect(r.success).toBe(true)
    if (r.success) {
      const i = toLoanInput(r.data)
      expect(i).toEqual({
        vehicleId: null, lender: 'HDFC Bank', principalPaise: 150_000_000, startDate: '2026-04-01',
        interestRate: 9.5, emiPaise: 3_125_000, tenureMonths: 60, status: 'active', notes: null,
      })
    }
  })
  it('keeps an optional vehicle and notes', () => {
    const r = loanFormSchema.safeParse(loan({ vehicleId: 'v-1', notes: ' first loan ' }))
    expect(r.success).toBe(true)
    if (r.success) {
      const i = toLoanInput(r.data)
      expect(i.vehicleId).toBe('v-1')
      expect(i.tenureMonths).toBe(60)
      expect(i.notes).toBe('first loan')
    }
  })
  it('requires lender, amount received, EMI, tenure and the interest rate', () => {
    const m = messages(loanFormSchema.safeParse(loan({ lender: ' ', principal: '', emi: '', interestRate: '', tenureMonths: '' })))
    expect(m).toContain('Enter the lender.')
    expect(m).toContain('Enter the amount received.')
    expect(m).toContain('Enter the monthly instalment (EMI).')
    expect(m).toContain('Enter the interest rate (0 if none).')
    expect(m).toContain('Enter the tenure in months.')
  })
  it('allows an interest rate of 0 but not above 100 or with 3 decimals', () => {
    expect(loanFormSchema.safeParse(loan({ interestRate: '0' })).success).toBe(true)
    expect(loanFormSchema.safeParse(loan({ interestRate: '100' })).success).toBe(true)
    expect(messages(loanFormSchema.safeParse(loan({ interestRate: '100.01' })))).toContain('Rate cannot be more than 100%.')
    expect(loanFormSchema.safeParse(loan({ interestRate: '9.555' })).success).toBe(false)
    expect(loanFormSchema.safeParse(loan({ interestRate: '-1' })).success).toBe(false)
  })
  it('rejects zero or negative amounts and EMI', () => {
    expect(messages(loanFormSchema.safeParse(loan({ principal: '0' })))).toContain('Amount must be greater than zero.')
    expect(messages(loanFormSchema.safeParse(loan({ emi: '0' })))).toContain('EMI must be greater than zero.')
    expect(loanFormSchema.safeParse(loan({ principal: '-5' })).success).toBe(false)
  })
  it('limits tenure to whole months from 1 to 600', () => {
    expect(loanFormSchema.safeParse(loan({ tenureMonths: '600' })).success).toBe(true)
    expect(loanFormSchema.safeParse(loan({ tenureMonths: '601' })).success).toBe(false)
    expect(loanFormSchema.safeParse(loan({ tenureMonths: '0' })).success).toBe(false)
    expect(loanFormSchema.safeParse(loan({ tenureMonths: '12.5' })).success).toBe(false)
  })
  it('requires a valid start date', () => {
    expect(messages(loanFormSchema.safeParse(loan({ startDate: '' })))).toContain('Enter the loan start date.')
    expect(loanFormSchema.safeParse(loan({ startDate: '2026-02-30' })).success).toBe(false)
  })
})

describe('loanPaymentFormSchema', () => {
  it('accepts a payment and converts it to paise', () => {
    const r = loanPaymentFormSchema.safeParse({ paymentDate: '2026-05-01', amount: '31,250.50', notes: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(toLoanPaymentInput(r.data)).toEqual({ paymentDate: '2026-05-01', amountPaise: 3_125_050, notes: null })
  })
  it('rejects a missing date and a zero or missing amount', () => {
    expect(messages(loanPaymentFormSchema.safeParse({ paymentDate: '', amount: '1', notes: '' }))).toContain('Enter the payment date.')
    expect(messages(loanPaymentFormSchema.safeParse({ paymentDate: '2026-05-01', amount: '0', notes: '' }))).toContain('Amount must be greater than zero.')
    expect(messages(loanPaymentFormSchema.safeParse({ paymentDate: '2026-05-01', amount: '', notes: '' }))).toContain('Enter the amount paid.')
  })
  it('pre-fills a new payment with today and the EMI', () => {
    expect(defaultLoanPaymentValues('2026-05-01', 3_125_000)).toEqual({ paymentDate: '2026-05-01', amount: '31250.00', notes: '' })
    expect(defaultLoanPaymentValues('2026-05-01', 0).amount).toBe('')
  })
})

describe('linked loan figures', () => {
  const P = 100_000_000 // Rs 10,00,000 in paise
  it('rate, EMI and tenure agree with each other', () => {
    const emi = loanEmi(P, 9, 48) as number
    expect(emi / 100).toBeCloseTo(24885.0, -1)
    expect(loanInterestRate(P, emi, 48)).toBeCloseTo(9, 1)
    expect(loanTenureMonths(P, 9, emi)).toBe(48)
  })
  it('handles a zero rate', () => {
    expect(loanEmi(P, 0, 50)).toBe(2_000_000)
    expect(loanTenureMonths(P, 0, 2_000_000)).toBe(50)
  })
  it('rounds the tenure up and refuses an EMI that does not cover the interest', () => {
    expect(loanTenureMonths(P, 0, 3_000_000)).toBe(34)
    expect(loanTenureMonths(P, 12, 500_000)).toBeNull() // interest alone is Rs 10,000 a month
  })
  it('returns null for missing inputs', () => {
    expect(loanEmi(0, 9, 48)).toBeNull()
    expect(loanEmi(P, 9, 0)).toBeNull()
    expect(loanTenureMonths(P, 9, 0)).toBeNull()
  })
})
