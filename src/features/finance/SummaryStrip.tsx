import { StatTile, statGrid } from '../../components/ui/StatTile'
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
    <dl className={statGrid} aria-busy={loading}>
      {TILES.map(({ key, label }) => {
        const value = summary?.[key]
        return <StatTile key={key} label={label} value={value === undefined ? '—' : formatINR(value)} negative={value !== undefined && value < 0} />
      })}
    </dl>
  )
}
