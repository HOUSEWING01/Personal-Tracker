import type { Paise } from '../../lib/money'
import { currentMonthRangeIST, isValidISODate, todayIST } from '../../lib/dates'
import type { TransactionType } from '../../types/finance'
import { summarizeFromTotals, type FinanceSummary, type TotalsByType } from '../finance/financeEngine'

/** One row from `report_breakdown()`: a per-type total inside a bucket (month, module or 'all'). */
export interface BreakdownRow { bucket: string; type: TransactionType; totalPaise: Paise }

export const REPORT_KINDS = ['all', 'income', 'expense'] as const
export type ReportKind = (typeof REPORT_KINDS)[number]

export const REPORT_RANGES = ['month', 'lastmonth', 'fy', 'all', 'custom'] as const
export type ReportRange = (typeof REPORT_RANGES)[number]

export type MetricKey = 'revenue' | 'expenses' | 'netProfit' | 'investments' | 'loanReceived' | 'loanRepayments' | 'cashIn' | 'cashOut' | 'netCashFlow'

export const METRIC_LABELS: Record<MetricKey, string> = {
  revenue: 'Revenue', expenses: 'Expenses', netProfit: 'Net profit', investments: 'Investments',
  loanReceived: 'Loans received', loanRepayments: 'Loan repayments', cashIn: 'Cash in', cashOut: 'Cash out', netCashFlow: 'Net cash flow',
}

/**
 * Which figures each view shows. The income and expense views show only their own side, because profit and net cash flow
 * need both sides and would mislead on half the ledger.
 */
export function metricsFor(kind: ReportKind): MetricKey[] {
  switch (kind) {
    case 'income': return ['revenue', 'loanReceived', 'cashIn']
    case 'expense': return ['expenses', 'investments', 'loanRepayments', 'cashOut']
    default: return ['revenue', 'expenses', 'netProfit', 'investments', 'loanRepayments', 'netCashFlow']
  }
}

/** Group breakdown rows by bucket and apply the finance formulas (the only place they live). */
export function summariesByBucket(rows: readonly BreakdownRow[]): Map<string, FinanceSummary> {
  const totals = new Map<string, TotalsByType>()
  for (const r of rows) {
    const t = totals.get(r.bucket) ?? {}
    t[r.type] = (t[r.type] ?? 0) + r.totalPaise
    totals.set(r.bucket, t)
  }
  return new Map([...totals].map(([bucket, t]) => [bucket, summarizeFromTotals(t)]))
}

/** Outstanding = unpaid property rent + unpaid sheet rent. Loan balances are not tracked (D-009 / D-020). */
export const outstandingPaise = (rentPaise: Paise, sheetPaise: Paise): Paise => rentPaise + sheetPaise

const pad = (n: number) => String(n).padStart(2, '0')
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Indian financial year (1 April to 31 March) containing `now`, in IST. */
export function financialYearRangeIST(now: Date = new Date()): { from: string; to: string } {
  const [y, m] = todayIST(now).split('-').map(Number)
  const start = m >= 4 ? y : y - 1
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` }
}

export function lastMonthRangeIST(now: Date = new Date()): { from: string; to: string } {
  const [y, m] = todayIST(now).split('-').map(Number)
  const py = m === 1 ? y - 1 : y
  const pm = m === 1 ? 12 : m - 1
  return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(lastDayOf(py, pm))}` }
}

/** Resolve the range preset (or custom dates) to optional from/to business dates. */
export function resolveRange(range: ReportRange, from: string, to: string, now: Date = new Date()): { from?: string; to?: string } {
  switch (range) {
    case 'month': return currentMonthRangeIST(now)
    case 'lastmonth': return lastMonthRangeIST(now)
    case 'fy': return financialYearRangeIST(now)
    case 'all': return {}
    default: return { from: isValidISODate(from) ? from : undefined, to: isValidISODate(to) ? to : undefined }
  }
}

const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })
/** 'YYYY-MM' to a display month. */
export function monthLabel(bucket: string): string {
  return /^\d{4}-\d{2}$/.test(bucket) ? monthFmt.format(new Date(`${bucket}-01T00:00:00Z`)) : bucket
}

/** Integer paise to a plain rupee string for spreadsheets ("1234.50", "-5.00"), without floating point. */
export function paiseToPlain(paise: Paise): string {
  const abs = Math.abs(paise)
  return `${paise < 0 ? '-' : ''}${Math.trunc(abs / 100)}.${pad(abs % 100)}`
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/** CSV of one row per bucket with the given metric columns. Rows are ordered as given. */
export function reportCsv(
  firstColumn: string, rows: readonly { label: string; summary: FinanceSummary }[], metrics: readonly MetricKey[],
): string {
  const header = [firstColumn, ...metrics.map((m) => METRIC_LABELS[m])].map(csvCell).join(',')
  const lines = rows.map((r) => [csvCell(r.label), ...metrics.map((m) => paiseToPlain(r.summary[m]))].join(','))
  return [header, ...lines].join('\r\n')
}
