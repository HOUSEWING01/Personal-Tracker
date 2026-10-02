import { describe, expect, it } from 'vitest'
import { defaultFormValues, toNewTransaction, transactionFormSchema as schema } from './transactionForm'

const base = { ...defaultFormValues(), amount: '6000', date: '2026-10-03' }
const messages = (v: object) => {
  const r = schema.safeParse(v)
  return r.success ? [] : r.error.issues.map((i) => i.message)
}

describe('transaction form validation', () => {
  it('accepts a valid expense', () => expect(messages(base)).toEqual([]))
  it('rejects empty, zero, negative and over-precise amounts', () => {
    expect(messages({ ...base, amount: '' })).toContain('Enter an amount.')
    expect(messages({ ...base, amount: '0' })).toContain('Amount must be greater than zero.')
    expect(messages({ ...base, amount: '-5' })).toContain('Amount must be greater than zero.')
    expect(messages({ ...base, amount: '1.234' })).toContain('Enter a valid amount with up to 2 decimals.')
    expect(messages({ ...base, amount: 'abc' })).toContain('Enter a valid amount with up to 2 decimals.')
  })
  it('rejects amounts beyond numeric(14,2)', () => {
    expect(messages({ ...base, amount: '1000000000000' })).toContain('Enter a valid amount with up to 2 decimals.')
  })
  it('accepts a negative adjustment with a reason, rejects without', () => {
    expect(messages({ ...base, type: 'adjustment', amount: '-250.50', description: 'Cash count fix' })).toEqual([])
    expect(messages({ ...base, type: 'adjustment', amount: '-250.50', description: '' })).toContain('Explain the adjustment so it can be audited.')
    expect(messages({ ...base, type: 'adjustment', amount: '0', description: 'x' })).toContain('An adjustment cannot be zero.')
  })
  it('rejects invalid dates', () => expect(messages({ ...base, date: '2026-02-30' })).toContain('Enter a valid date.'))
  it('maps to a NewTransaction in paise', () => {
    expect(toNewTransaction({ ...base, amount: '₹6,000.50', paymentMethod: 'upi', description: '  Diesel  ' })).toEqual({
      type: 'expense', module: 'general', amountPaise: 600050, date: '2026-10-03', paymentMethod: 'upi', description: 'Diesel',
    })
    expect(toNewTransaction(base).paymentMethod).toBeUndefined()
  })
})
