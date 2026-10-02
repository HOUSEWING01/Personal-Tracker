import { describe, expect, it } from 'vitest'
import { financialYearRangeIST, lastMonthRangeIST, metricsFor, paiseToPlain, reportCsv, resolveRange, summariesByBucket } from './reportEngine'

describe('reportEngine', () => {
  it('applies the finance formulas per bucket', () => {
    const m = summariesByBucket([
      { bucket: '2026-09', type: 'income', totalPaise: 100000 },
      { bucket: '2026-09', type: 'expense', totalPaise: 30000 },
      { bucket: '2026-10', type: 'loan_repayment', totalPaise: 5000 },
    ])
    expect(m.get('2026-09')?.netProfit).toBe(70000)
    expect(m.get('2026-10')?.netCashFlow).toBe(-5000)
  })

  it('knows the Indian financial year and last month, including January', () => {
    expect(financialYearRangeIST(new Date('2026-10-03T06:00:00Z'))).toEqual({ from: '2026-04-01', to: '2027-03-31' })
    expect(financialYearRangeIST(new Date('2027-02-10T06:00:00Z'))).toEqual({ from: '2026-04-01', to: '2027-03-31' })
    expect(lastMonthRangeIST(new Date('2027-01-05T06:00:00Z'))).toEqual({ from: '2026-12-01', to: '2026-12-31' })
    expect(lastMonthRangeIST(new Date('2026-03-05T06:00:00Z'))).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('resolves custom and open ranges', () => {
    expect(resolveRange('all', '', '')).toEqual({})
    expect(resolveRange('custom', '2026-01-01', 'nonsense')).toEqual({ from: '2026-01-01', to: undefined })
  })

  it('formats paise for spreadsheets without floating point', () => {
    expect(paiseToPlain(123450)).toBe('1234.50')
    expect(paiseToPlain(-5)).toBe('-0.05')
    expect(paiseToPlain(0)).toBe('0.00')
  })

  it('writes CSV with the chosen columns and escapes text', () => {
    const [s] = [...summariesByBucket([{ bucket: 'a', type: 'income', totalPaise: 250 }]).values()]
    expect(reportCsv('Month', [{ label: 'Oct, "26"', summary: s }], ['revenue'])).toBe('Month,Revenue\r\n"Oct, ""26""",2.50')
  })

  it('shows only one side in the income and expense views', () => {
    expect(metricsFor('income')).not.toContain('netProfit')
    expect(metricsFor('expense')).not.toContain('revenue')
    expect(metricsFor('all')).toContain('netCashFlow')
  })
})
