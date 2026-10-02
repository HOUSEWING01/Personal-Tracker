import { describe, expect, it } from 'vitest'
import { advanceRemaining, chargeStatus, formatPeriod, isOccupied, isOverdue, outstanding, propertyTotals } from './propertyEngine'
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
  it('is overdue only for ended months that are not fully paid', () => {
    expect(isOverdue(charge(1000, 0, '2026-09-01'), '2026-10-03')).toBe(true)
    expect(isOverdue(charge(1000, 400, '2026-09-01'), '2026-10-03')).toBe(true)
    expect(isOverdue(charge(1000, 1000, '2026-09-01'), '2026-10-03')).toBe(false)
    expect(isOverdue(charge(1000, 0, '2026-10-01'), '2026-10-03')).toBe(false) // current month is due, not overdue
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
  it('formats a period', () => { expect(formatPeriod('2026-08-01')).toBe('Aug 2026') })
})
