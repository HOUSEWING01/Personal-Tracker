import { describe, expect, it } from 'vitest'
import { advanceRemaining, chargeStatus, formatCycle, addMonths, dueDate, cycleEnd, isOccupied, isOverdue, outstanding, propertyTotals } from './propertyEngine'
import type { PropertyOverview } from '../../types/property'

const charge = (expectedPaise: number, paidPaise: number, period = '2026-08-01') => ({ period, expectedPaise, paidPaise })

describe('rent outstanding', () => {
  it('is expected minus paid, never negative', () => {
    expect(outstanding(1_000_000, 600_000)).toBe(400_000)
    expect(outstanding(1_000_000, 1_000_000)).toBe(0)
    expect(outstanding(1_000_000, 1_000_001)).toBe(0)
  })
  it('keeps paise exact (no float drift)', () => {
    expect(outstanding(1_000_010, 300_005)).toBe(700_005)
  })
})

describe('charge status', () => {
  it('classifies paid / partial / unpaid', () => {
    expect(chargeStatus(charge(1000, 1000))).toBe('paid')
    expect(chargeStatus(charge(1000, 1))).toBe('partial')
    expect(chargeStatus(charge(1000, 0))).toBe('unpaid')
  })
  it('is overdue only after the due date has passed and the month is not fully paid', () => {
    expect(isOverdue(charge(1000, 0, '2026-09-03'), '2026-10-04')).toBe(true)
    expect(isOverdue(charge(1000, 400, '2026-09-03'), '2026-10-04')).toBe(true)
    expect(isOverdue(charge(1000, 1000, '2026-09-03'), '2026-10-04')).toBe(false)
    expect(isOverdue(charge(1000, 0, '2026-09-03'), '2026-10-03')).toBe(false) // on the due date rent is due, not overdue
  })
})

describe('tenancy months (D-033)', () => {
  it('rent for the month starting 3 Sep is due on 3 Oct and covers 3 Sep - 2 Oct', () => {
    expect(dueDate('2026-09-03')).toBe('2026-10-03')
    expect(cycleEnd('2026-09-03')).toBe('2026-10-02')
    expect(formatCycle('2026-09-03')).toMatch(/^3 Sep\w* – 2 Oct 2026$/)
  })
  it('a month starting on the 1st ends on the last day of the month', () => {
    expect(cycleEnd('2026-02-01')).toBe('2026-02-28')
    expect(formatCycle('2026-09-01')).toMatch(/^1 Sep\w* – 30 Sep\w* 2026$/)
  })
  it('shows both years when a month crosses New Year', () => {
    expect(formatCycle('2026-12-15')).toMatch(/^15 Dec 2026 – 14 Jan 2027$/)
  })
  it('clamps to the last day of a shorter month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30')
  })
})

describe('advance remaining', () => {
  it('is received - adjusted - returned', () => {
    expect(advanceRemaining(5_000_000, 2_000_000, 3_000_000)).toBe(0)
    expect(advanceRemaining(5_000_000, 2_000_000, 0)).toBe(3_000_000)
    expect(advanceRemaining(0, 0, 0)).toBe(0)
  })
})

describe('occupancy and property totals', () => {
  const base: PropertyOverview = {
    id: '1', name: 'Shop 1', type: 'shop', address: null, description: null, status: 'active', monthlyRentPaise: 1_000_000,
    tenantName: 'Ravi', rentalStartDate: '2026-01-01', rentalEndDate: null,
    expectedTotalPaise: 3_000_000, paidTotalPaise: 1_000_000, advanceReceivedPaise: 5_000_000, advanceAdjustedPaise: 1_000_000, advanceReturnedPaise: 0,
  }
  it('is occupied while the tenancy has not ended', () => {
    expect(isOccupied(base, '2026-10-03')).toBe(true)
    expect(isOccupied({ ...base, rentalEndDate: '2026-10-03' }, '2026-10-03')).toBe(true)
    expect(isOccupied({ ...base, rentalEndDate: '2026-10-02' }, '2026-10-03')).toBe(false)
    expect(isOccupied({ ...base, tenantName: null, rentalEndDate: null }, '2026-10-03')).toBe(false)
  })
  it('derives outstanding and advance remaining from the sums', () => {
    expect(propertyTotals(base)).toEqual({ outstandingPaise: 2_000_000, advanceRemainingPaise: 4_000_000 })
  })
})
