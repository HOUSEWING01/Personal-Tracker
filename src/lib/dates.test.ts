import { describe, expect, it } from 'vitest'
import { currentMonthRangeIST, formatDate, isValidISODate, todayIST } from './dates'
import { formatSignedINR } from './money'

describe('dates (IST)', () => {
  it('rolls over to next day in IST while still previous day in UTC', () => {
    expect(todayIST(new Date('2026-01-31T19:00:00Z'))).toBe('2026-02-01')
    expect(todayIST(new Date('2026-01-31T17:00:00Z'))).toBe('2026-01-31')
  })
  it('month range handles leap February', () => {
    expect(currentMonthRangeIST(new Date('2028-02-10T06:00:00Z'))).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(currentMonthRangeIST(new Date('2026-10-03T06:00:00Z'))).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })
  it('validates ISO dates', () => {
    expect(isValidISODate('2026-02-29')).toBe(false)
    expect(isValidISODate('2028-02-29')).toBe(true)
    expect(isValidISODate('03/10/2026')).toBe(false)
  })
  it('formats for display', () => {
    expect(formatDate('2026-10-03')).toBe('03 Oct 2026')
  })
  it('formats signed money', () => {
    expect(formatSignedINR(-600000)).toBe('−₹6,000.00')
    expect(formatSignedINR(50)).toBe('+₹0.50')
  })
})
