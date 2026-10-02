import { describe, expect, it } from 'vitest'
import { addDays, addMonths, daysInMonth, monthGrid, parseISO, toISO, weekday } from './calendar'

describe('calendar', () => {
  it('round-trips ISO dates', () => {
    expect(toISO(parseISO('2026-10-03'))).toBe('2026-10-03')
    expect(toISO({ y: 987, m: 1, d: 5 })).toBe('0987-01-05')
  })
  it('knows month lengths, including leap years', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2026, 10)).toBe(31)
  })
  it('finds the weekday (Sunday = 0)', () => {
    expect(weekday('2026-10-03')).toBe(6) // Saturday
    expect(weekday('2026-10-04')).toBe(0)
  })
  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-10-03', 7)).toBe('2026-10-10')
  })
  it('adds months and clamps the day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15')
    expect(addMonths('2026-10-03', 12)).toBe('2027-10-03')
  })
  it('builds a 6-week Sunday-first grid', () => {
    const g = monthGrid(2026, 10)
    expect(g).toHaveLength(42)
    expect(g[0]).toBe('2026-09-27') // 1 Oct 2026 is a Thursday
    expect(g.includes('2026-10-01')).toBe(true)
    expect(g[41]).toBe('2026-11-07')
    expect(weekday(g[0])).toBe(0)
  })
  it('starts the grid on the 1st when it is a Sunday', () => {
    expect(monthGrid(2026, 2)[0]).toBe('2026-02-01')
  })
})
