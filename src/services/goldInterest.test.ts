import { describe, expect, it } from 'vitest'
import { accruedInterestPaise, daysBetween, interestDays, interestToDueDatePaise, simpleInterestPaise } from './goldInterest'
import { dueState, estimatedBalancePaise } from '../features/gold/goldEngine'

const loan = { principalPaise: 10_000_000, annualRate: 12, pledgeDate: '2026-01-01', dueDate: '2027-01-01', status: 'active' as const, closedDate: null }

describe('gold loan interest', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30)
    expect(daysBetween('2026-01-31', '2026-01-01')).toBe(-30)
  })
  it('is principal x rate x days / 365', () => {
    // 1,00,000 at 12% for 365 days = 12,000
    expect(simpleInterestPaise(10_000_000, 12, 365)).toBe(1_200_000)
    // 1,00,000 at 9.5% for 100 days = 2,602.74 (rounded)
    expect(simpleInterestPaise(10_000_000, 9.5, 100)).toBe(260_274)
  })
  it('is zero for no days, no rate or no principal', () => {
    expect(simpleInterestPaise(10_000_000, 12, 0)).toBe(0)
    expect(simpleInterestPaise(10_000_000, 0, 100)).toBe(0)
    expect(simpleInterestPaise(0, 12, 100)).toBe(0)
  })
  it('accrues to today while active and stops at the closing date once closed', () => {
    expect(accruedInterestPaise(loan, '2026-04-11')).toBe(simpleInterestPaise(10_000_000, 12, 100))
    expect(accruedInterestPaise({ ...loan, status: 'closed', closedDate: '2026-02-10' }, '2026-12-31')).toBe(simpleInterestPaise(10_000_000, 12, 40))
    expect(accruedInterestPaise(loan, '2025-12-01')).toBe(0)
  })
  it('gives interest for the whole term, or null without a due date', () => {
    expect(interestToDueDatePaise(loan)).toBe(1_200_000)
    expect(interestToDueDatePaise({ ...loan, dueDate: null })).toBeNull()
  })
  it('estimates the balance and never goes below zero', () => {
    expect(estimatedBalancePaise(loan, 3_000_000, '2027-01-01')).toBe(10_000_000 + 1_200_000 - 3_000_000)
    expect(estimatedBalancePaise(loan, 99_000_000, '2027-01-01')).toBe(0)
  })
  it('flags overdue and due-soon only for active loans with a due date', () => {
    expect(dueState(loan, '2027-01-05')).toEqual({ kind: 'overdue', days: 4 })
    expect(dueState(loan, '2026-12-20')).toEqual({ kind: 'soon', days: 12 })
    expect(dueState(loan, '2026-06-01')).toBeNull()
    expect(dueState({ ...loan, status: 'closed' }, '2027-01-05')).toBeNull()
    expect(dueState({ ...loan, dueDate: null }, '2027-01-05')).toBeNull()
  })
})

describe('interestDays', () => {
  it('counts from the pledge date to today for an active loan', () => {
    expect(interestDays(loan, '2026-01-31')).toBe(30)
  })
  it('stops at the closing date for a closed loan, and never goes below zero', () => {
    expect(interestDays({ ...loan, status: 'closed', closedDate: '2026-02-01' }, '2026-06-01')).toBe(31)
    expect(interestDays(loan, '2025-12-01')).toBe(0)
  })
  it('matches the interest figure: Rs 1,10,000 at 0.8% for 292 days is Rs 704', () => {
    const l = { principalPaise: 11_000_000, annualRate: 0.8, pledgeDate: '2025-12-15', dueDate: '2026-11-14', status: 'active' as const, closedDate: null }
    expect(interestDays(l, '2026-10-03')).toBe(292)
    expect(accruedInterestPaise(l, '2026-10-03')).toBe(70_400)
    expect(interestToDueDatePaise(l)).toBe(80_526)
  })
})
