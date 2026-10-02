import { useUrlState } from '../../hooks/useUrlState'
import { currentMonthRangeIST, isValidISODate } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { buttonSecondary } from '../../components/ui/FullScreenMessage'
import { useVehicleProfit } from './hooks'
import { sumProfitTotals, vehicleAfterFinancingPaise, vehicleOperatingProfitPaise } from './transportEngine'
import { TRANSPORT_URL_DEFAULTS } from './useListControls'

const field = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm'

/** Negative amounts get a text minus, never colour alone. */
function Money({ paise, strong }: { paise: number; strong?: boolean }) {
  return <span className={`tabular-nums ${strong ? 'font-medium' : ''} ${paise < 0 ? 'text-danger' : ''}`}>{paise < 0 ? '−' : ''}{formatINR(Math.abs(paise))}</span>
}

export function ProfitTab() {
  const [p, update] = useUrlState(TRANSPORT_URL_DEFAULTS)
  const from = isValidISODate(p.from) ? p.from : ''
  const to = isValidISODate(p.to) ? p.to : ''
  const profit = useVehicleProfit(from, to)
  const rows = profit.data ?? []
  const total = sumProfitTotals(rows)

  const lines: { label: string; value: (r: typeof total) => number; strong?: boolean; sign?: '−' }[] = [
    { label: 'Revenue', value: (r) => r.revenuePaise },
    { label: 'Driver payments', value: (r) => r.driverPaise, sign: '−' },
    { label: 'Fuel', value: (r) => r.fuelPaise, sign: '−' },
    { label: 'Tolls', value: (r) => r.tollPaise, sign: '−' },
    { label: 'Operating profit', value: vehicleOperatingProfitPaise, strong: true },
    { label: 'Loan repayments', value: (r) => r.loanRepaidPaise, sign: '−' },
    { label: 'After loan repayments', value: vehicleAfterFinancingPaise, strong: true },
  ]

  return (
    <>
      <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()} aria-label="Period">
        <label className="text-sm font-medium">From<input type="date" value={from} onChange={(e) => update({ from: e.target.value })} className={field} /></label>
        <label className="text-sm font-medium">To<input type="date" value={to} onChange={(e) => update({ to: e.target.value })} className={field} /></label>
        <button type="button" className={buttonSecondary} onClick={() => { const m = currentMonthRangeIST(); update({ from: m.from, to: m.to }) }}>This month</button>
        <button type="button" className={buttonSecondary} onClick={() => update({ from: '', to: '' })}>All time</button>
      </form>
      <p className="mb-4 text-xs text-muted">
        Cash basis, from the ledger: a trip counts when completed, fuel and tolls when paid. Operating profit excludes loan repayments.
        Repayments include interest and principal, so the last line is cash left, not accounting profit. Fuel includes fuel not linked to a trip.
      </p>

      {profit.isError ? (
        <div role="alert" className="rounded-md border border-line bg-surface px-6 py-8 text-center">
          <p className="text-sm font-medium">Could not load profit</p>
          <button type="button" className={`${buttonSecondary} mt-4`} onClick={() => void profit.refetch()}>Try again</button>
        </div>
      ) : profit.isLoading ? (
        <p className="py-10 text-center text-sm text-muted" role="status">Loading profit…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-line bg-surface px-6 py-8 text-center text-sm text-muted">No transport activity in this period.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Vehicle</th>
                {lines.map((l) => <th key={l.label} scope="col" className="whitespace-nowrap px-4 py-2 text-right font-medium">{l.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.vehicleId ?? 'unlinked'} className="border-b border-line">
                  <td className="px-4 py-2.5"><span className="font-medium">{r.vehicleName}</span>{r.vehicleRegistration && <div className="text-xs text-muted">{r.vehicleRegistration}</div>}</td>
                  {lines.map((l) => <td key={l.label} className="whitespace-nowrap px-4 py-2.5 text-right"><Money paise={l.value(r)} strong={l.strong} /></td>)}
                </tr>
              ))}
              <tr className="bg-canvas">
                <th scope="row" className="px-4 py-2.5 text-left font-medium">All vehicles</th>
                {lines.map((l) => <td key={l.label} className="whitespace-nowrap px-4 py-2.5 text-right"><Money paise={l.value(total)} strong /></td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
