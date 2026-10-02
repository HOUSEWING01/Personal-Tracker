import { formatINR } from '../../lib/money'
import type { FinanceSummary } from './financeEngine'

const TILES: { key: keyof FinanceSummary; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'netProfit', label: 'Net profit' },
  { key: 'netCashFlow', label: 'Net cash flow' },
]

export function SummaryStrip({ summary, loading }: { summary?: FinanceSummary; loading: boolean }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy={loading}>
      {TILES.map(({ key, label }) => {
        const value = summary?.[key]
        const negative = value !== undefined && value < 0
        return (
          <div key={key} className="rounded-md border border-line bg-surface px-4 py-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className={`mt-1 text-lg font-semibold tabular-nums ${negative ? 'text-danger' : 'text-ink'}`}>
              {value === undefined ? '—' : formatINR(value)}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
