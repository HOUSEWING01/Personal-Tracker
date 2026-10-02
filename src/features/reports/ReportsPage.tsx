import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DownloadSimple } from '@phosphor-icons/react'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatTile as Tile, statGrid } from '../../components/ui/StatTile'
import { EmptyState } from '../../components/ui/EmptyState'
import { buttonSecondary } from '../../components/ui/FullScreenMessage'
import { useUrlState } from '../../hooks/useUrlState'
import { formatDate } from '../../lib/dates'
import { formatINR, type Paise } from '../../lib/money'
import { BUSINESS_MODULES, type BusinessModule } from '../../types/finance'
import { MODULE_LABELS } from '../finance/labels'
import { summarizeFromTotals, type FinanceSummary } from '../finance/financeEngine'
import { useTripOptions } from '../transport/hooks'
import type { ReportFilters } from '../../services/reportService'
import { usePropertyChoices, useReportBreakdown, useReportOutstanding } from './hooks'
import { Select } from '../../components/forms/Select'
import { DatePicker } from '../../components/forms/DatePicker'
import {
  METRIC_LABELS, REPORT_KINDS, REPORT_RANGES, metricsFor, monthLabel, outstandingPaise, reportCsv, resolveRange, summariesByBucket,
  type MetricKey, type ReportKind, type ReportRange,
} from './reportEngine'

const DEFAULTS = { range: 'month', from: '', to: '', kind: 'all', module: 'all', vehicle: 'all', property: 'all', customer: 'all' }
const field = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm md:py-2'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const idOrUndefined = (v: string) => (UUID.test(v) ? v : undefined)

const RANGE_LABELS: Record<ReportRange, string> = { month: 'This month', lastmonth: 'Last month', fy: 'This financial year', all: 'All time', custom: 'Custom dates' }
const KIND_LABELS: Record<ReportKind, string> = { all: 'Income and expenses', income: 'Income side only', expense: 'Expense side only' }

const money = (v?: Paise) => (v === undefined ? '—' : formatINR(v))
const ZERO = summarizeFromTotals({})

function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-md border border-line bg-surface px-4 py-4 text-sm">
      Could not load this section. <button type="button" className="text-primary underline" onClick={onRetry}>Try again</button>
    </div>
  )
}

interface Row { key: string; label: string; summary: FinanceSummary }

function BreakdownTable({ caption, firstColumn, rows, metrics, bars }: {
  caption: string; firstColumn: string; rows: Row[]; metrics: MetricKey[]; bars?: boolean
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.summary.revenue, r.summary.expenses]))
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line text-left text-xs text-muted">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">{firstColumn}</th>
            {metrics.map((m) => <th key={m} scope="col" className="px-4 py-2 text-right font-medium">{METRIC_LABELS[m]}</th>)}
            {bars && <th scope="col" className="hidden w-40 px-4 py-2 font-medium lg:table-cell">Revenue and expenses</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-line last:border-0">
              <th scope="row" className="whitespace-nowrap px-4 py-2.5 text-left font-medium">{r.label}</th>
              {metrics.map((m) => (
                <td key={m} className={`whitespace-nowrap px-4 py-2.5 text-right tabular-nums ${r.summary[m] < 0 ? 'text-danger' : ''}`}>{formatINR(r.summary[m])}</td>
              ))}
              {bars && (
                <td className="hidden px-4 py-2.5 lg:table-cell" aria-hidden>
                  <div className="h-1.5 rounded bg-canvas"><div className="h-1.5 rounded bg-primary" style={{ width: `${Math.max(0, (r.summary.revenue / max) * 100)}%` }} /></div>
                  <div className="mt-1 h-1.5 rounded bg-canvas"><div className="h-1.5 rounded bg-copper" style={{ width: `${Math.max(0, (r.summary.expenses / max) * 100)}%` }} /></div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ReportsPage() {
  const [p, update] = useUrlState(DEFAULTS)
  const range: ReportRange = (REPORT_RANGES as readonly string[]).includes(p.range) ? (p.range as ReportRange) : 'month'
  const kind: ReportKind = (REPORT_KINDS as readonly string[]).includes(p.kind) ? (p.kind as ReportKind) : 'all'
  const module = (BUSINESS_MODULES as readonly string[]).includes(p.module) ? (p.module as BusinessModule) : undefined
  const vehicleId = idOrUndefined(p.vehicle)
  const propertyId = idOrUndefined(p.property)
  const customerId = idOrUndefined(p.customer)

  const dates = resolveRange(range, p.from, p.to)
  const rangeInvalid = Boolean(dates.from && dates.to && dates.from > dates.to)
  const filters: ReportFilters = { ...dates, module, vehicleId, propertyId, customerId }
  const entityFiltered = Boolean(vehicleId || propertyId || customerId)

  const options = useTripOptions()
  const properties = usePropertyChoices()
  const total = useReportBreakdown('total', filters, !rangeInvalid)
  const monthly = useReportBreakdown('month', filters, !rangeInvalid)
  const byModule = useReportBreakdown('module', filters, !rangeInvalid && !module)
  const outstanding = useReportOutstanding(filters, !rangeInvalid)

  const summary = total.data ? (summariesByBucket(total.data).get('all') ?? ZERO) : undefined
  const metrics = metricsFor(kind)
  const showOutstanding = kind !== 'expense'
  const outstandingApplies = !vehicleId
  const outstandingValue = outstanding.data && outstandingApplies ? outstandingPaise(outstanding.data.rentPaise, outstanding.data.sheetPaise) : undefined

  const monthRows: Row[] = monthly.data
    ? [...summariesByBucket(monthly.data)].sort(([a], [b]) => b.localeCompare(a)).map(([key, s]) => ({ key, label: monthLabel(key), summary: s }))
    : []
  const moduleRows: Row[] = byModule.data
    ? [...summariesByBucket(byModule.data)]
        .sort(([a], [b]) => BUSINESS_MODULES.indexOf(a as BusinessModule) - BUSINESS_MODULES.indexOf(b as BusinessModule))
        .map(([key, s]) => ({ key, label: MODULE_LABELS[key as BusinessModule] ?? key, summary: s }))
    : []

  const periodText = dates.from || dates.to
    ? `${dates.from ? formatDate(dates.from) : 'the beginning'} to ${dates.to ? formatDate(dates.to) : 'today'}`
    : 'all time'

  const exportCsv = () => {
    const csv = reportCsv('Month', monthRows.map((r) => ({ label: r.key, summary: r.summary })), metrics)
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${dates.from ?? 'start'}-to-${dates.to ?? 'today'}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const nothing = total.data && total.data.length === 0 && (!outstandingValue)
  const financeLink = !entityFiltered && !rangeInvalid
    ? `/finance?${new URLSearchParams({ ...(dates.from ? { from: dates.from } : {}), ...(dates.to ? { to: dates.to } : {}), ...(module ? { module } : {}) }).toString()}`
    : undefined

  return (
    <>
      <PageHeader
        title="Reports"
        description="Revenue, expenses, profit, outstanding, investments, loan repayments and cash flow for any period."
        actions={
          <button type="button" className={`${buttonSecondary} gap-1.5`} onClick={exportCsv} disabled={monthRows.length === 0}>
            <DownloadSimple size={16} aria-hidden /> Export months (CSV)
          </button>
        }
      />

      <form className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface p-3 md:grid-cols-4 md:p-4" onSubmit={(e) => e.preventDefault()} aria-label="Report filters">
        <label className="text-sm font-medium">Period
          <Select value={range} onChange={(v) => update({ range: v })} className={field}>
            {REPORT_RANGES.map((r) => <option key={r} value={r}>{RANGE_LABELS[r]}</option>)}
          </Select>
        </label>
        {range === 'custom' && (
          <>
            <label className="text-sm font-medium">From
              <DatePicker value={p.from} onChange={(v) => update({ from: v })} className={field} />
            </label>
            <label className="text-sm font-medium">To
              <DatePicker value={p.to} onChange={(v) => update({ to: v })} className={field} />
            </label>
          </>
        )}
        <label className="text-sm font-medium">Show
          <Select value={kind} onChange={(v) => update({ kind: v })} className={field}>
            {REPORT_KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </Select>
        </label>
        <label className="text-sm font-medium">Module
          <Select value={module ?? 'all'} onChange={(v) => update({ module: v })} className={field}>
            <option value="all">All modules</option>
            {BUSINESS_MODULES.map((m) => <option key={m} value={m}>{MODULE_LABELS[m]}</option>)}
          </Select>
        </label>
        <label className="text-sm font-medium">Vehicle
          <Select value={vehicleId ?? 'all'} onChange={(v) => update({ vehicle: v })} className={field}>
            <option value="all">All vehicles</option>
            {(options.data?.vehicles ?? []).map((v) => <option key={v.id} value={v.id}>{v.name} ({v.registrationNumber})</option>)}
          </Select>
        </label>
        <label className="text-sm font-medium">Property
          <Select value={propertyId ?? 'all'} onChange={(v) => update({ property: v })} className={field}>
            <option value="all">All properties</option>
            {(properties.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </label>
        <label className="text-sm font-medium">Customer
          <Select value={customerId ?? 'all'} onChange={(v) => update({ customer: v })} className={field}>
            <option value="all">All customers</option>
            {(options.data?.customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </label>
      </form>
      {(options.isError || properties.isError) && (
        <p role="alert" className="mt-2 text-sm text-danger">Could not load the vehicle, property or customer lists. Reload the page to try again.</p>
      )}

      {rangeInvalid ? (
        <p role="alert" className="mt-6 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">The From date is after the To date. Change one of them.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted" aria-live="polite">
            {RANGE_LABELS[range]}: {periodText}.
            {module ? ` ${MODULE_LABELS[module]} only.` : ''}
            {entityFiltered ? ' Only entries linked to the chosen vehicle, property or customer are counted.' : ''}
          </p>

          <section className="mt-4" aria-labelledby="rep-summary" aria-busy={total.isLoading}>
            <h2 id="rep-summary" className="sr-only">Summary</h2>
            {total.isError ? <SectionError onRetry={() => void total.refetch()} /> : (
              <dl className={statGrid}>
                {metrics.map((m) => (
                  <Tile key={m} label={METRIC_LABELS[m]} value={money(summary?.[m])} negative={(summary?.[m] ?? 0) < 0}
                    hint={m === 'loanRepayments' ? 'Includes interest' : m === 'netProfit' ? 'Revenue minus expenses' : m === 'netCashFlow' ? 'Cash in minus cash out' : undefined} />
                ))}
                {showOutstanding && (
                  <Tile
                    label="Outstanding"
                    value={outstandingApplies ? money(outstandingValue) : '—'}
                    hint={outstandingApplies ? 'Unpaid property rent and sheet rent, as of today' : 'Not tracked per vehicle'}
                  />
                )}
              </dl>
            )}
            {outstanding.isError && showOutstanding && <div className="mt-2"><SectionError onRetry={() => void outstanding.refetch()} /></div>}
          </section>

          {nothing && !total.isFetching ? (
            <div className="mt-6">
              <EmptyState title="No entries match these filters" description="Widen the period or clear a vehicle, property or customer filter." />
            </div>
          ) : (
            <>
              {!module && (
                <section className="mt-8" aria-labelledby="rep-modules" aria-busy={byModule.isLoading}>
                  <h2 id="rep-modules" className="mb-3 text-sm font-semibold">By module</h2>
                  {byModule.isError ? <SectionError onRetry={() => void byModule.refetch()} />
                    : byModule.isLoading ? <p role="status" className="py-6 text-center text-sm text-muted">Loading…</p>
                    : <BreakdownTable caption="Totals by module" firstColumn="Module" rows={moduleRows} metrics={metrics} />}
                </section>
              )}

              <section className="mt-8" aria-labelledby="rep-months" aria-busy={monthly.isLoading}>
                <h2 id="rep-months" className="mb-3 text-sm font-semibold">By month</h2>
                {monthly.isError ? <SectionError onRetry={() => void monthly.refetch()} />
                  : monthly.isLoading ? <p role="status" className="py-6 text-center text-sm text-muted">Loading…</p>
                  : <BreakdownTable caption="Totals by month" firstColumn="Month" rows={monthRows} metrics={metrics} bars={kind === 'all'} />}
              </section>
            </>
          )}

          <ReportNotes financeLink={financeLink} />
        </>
      )}
    </>
  )
}

function ReportNotes({ financeLink }: { financeLink?: string }): ReactNode {
  return (
    <div className="mt-8 rounded-md bg-canvas px-4 py-3 text-xs text-muted">
      <p>Figures are on a cash basis: they follow the date money moved, not the date a job was done. Revenue is income plus customer payments minus refunds; net profit is revenue minus expenses and leaves out investments and loan money; net cash flow adds loans received and takes away investments and loan repayments.</p>
      <p className="mt-1">Gold loan repayments include interest, and no loan balance is shown for vehicle loans because interest is not split from repayments.</p>
      {financeLink && <p className="mt-1"><Link to={financeLink} className="text-primary underline">See the individual transactions for this period</Link></p>}
    </div>
  )
}
