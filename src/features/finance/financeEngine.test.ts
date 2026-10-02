import { describe, expect, it } from 'vitest'
import { signedCashAmount, summarize, summarizeFromTotals } from './financeEngine'
import type { Transaction, TransactionType } from '../../types/finance'

const tx = (type: TransactionType, amountPaise: number): Transaction => ({
  id: crypto.randomUUID(), type, amountPaise, module: 'general', entityType: null, entityId: null,
  date: '2026-10-01', paymentMethod: null, description: null, createdAt: '2026-10-01T00:00:00Z',
})

describe('financeEngine', () => {
  it('returns zeros for no data', () => {
    const s = summarize([])
    expect(Object.values(s).every((v) => v === 0)).toBe(true)
  })

  it('computes revenue, expenses and profit', () => {
    const s = summarize([tx('income', 1000000), tx('customer_payment', 500000), tx('expense', 600000)])
    expect(s.revenue).toBe(1500000)
    expect(s.netProfit).toBe(900000)
  })

  it('refund reduces revenue and is cash out', () => {
    const s = summarize([tx('income', 100000), tx('refund', 30000)])
    expect(s.revenue).toBe(70000)
    expect(s.cashOut).toBe(30000)
    expect(s.netCashFlow).toBe(70000)
  })

  it('investment and loan principal never affect profit but do affect cash', () => {
    const s = summarize([tx('income', 100000), tx('investment', 5000000), tx('loan_received', 4000000), tx('loan_repayment', 250000)])
    expect(s.netProfit).toBe(100000)
    expect(s.netCashFlow).toBe(100000 - 5000000 + 4000000 - 250000)
  })

  it('adjustments are signed, affect cash flow only', () => {
    const s = summarize([tx('income', 100000), tx('adjustment', -2550)])
    expect(s.netProfit).toBe(100000)
    expect(s.netCashFlow).toBe(97450)
  })

  it('has no float drift (paise integers)', () => {
    const s = summarize([tx('income', 10), tx('income', 20)])
    expect(s.revenue).toBe(30)
  })

  it('summarizeFromTotals matches summarize', () => {
    const list = [tx('income', 500), tx('expense', 200), tx('loan_received', 900)]
    expect(summarizeFromTotals({ income: 500, expense: 200, loan_received: 900 })).toEqual(summarize(list))
  })

  it('signedCashAmount', () => {
    expect(signedCashAmount(tx('income', 100))).toBe(100)
    expect(signedCashAmount(tx('expense', 100))).toBe(-100)
    expect(signedCashAmount(tx('adjustment', -100))).toBe(-100)
  })
})
