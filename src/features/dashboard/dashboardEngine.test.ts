import { describe, expect, it } from 'vitest'
import type { GoldLoan } from '../../types/gold'
import { receivablesPaise, summarizeGold } from './dashboardEngine'

const base: GoldLoan = {
  id: 'a', personName: 'Ravi', mobile: null, goldDescription: 'chain', goldWeightGrams: null, bank: 'SBI',
  pledgeDate: '2026-01-01', dueDate: '2027-01-01', principalPaise: 10_000_000, annualRate: 12, status: 'active',
  closedDate: null, notes: null, paidPaise: 0, paymentCount: 0, lastPaymentDate: null,
}

describe('dashboard engine', () => {
  it('adds receivables', () => expect(receivablesPaise(500, 700)).toBe(1200))
  it('summarises active gold loans and orders upcoming dues', () => {
    const late = { ...base, id: 'b', dueDate: '2026-12-01', principalPaise: 5_000_000 }
    const far = { ...base, id: 'c', dueDate: '2030-01-01' }
    const s = summarizeGold([base, late, far], '2026-12-10')
    expect(s.activeLoans).toBe(3)
    expect(s.borrowedPaise).toBe(25_000_000)
    expect(s.upcoming.map((u) => u.loan.id)).toEqual(['b', 'a'])
    expect(s.overdueCount).toBe(1)
    expect(s.accruedInterestPaise).toBeGreaterThan(0)
  })
})
