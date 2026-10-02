import { EmptyState } from '../../components/ui/EmptyState'
import { buttonSecondary } from '../../components/ui/FullScreenMessage'
import { formatDate } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import type { PropertyOverview } from '../../types/property'
import { useAdvanceMovements } from './hooks'
import { ADVANCE_KIND_LABELS } from './labels'
import { propertyTotals } from './propertyEngine'

export function AdvanceTab({ property }: { property: PropertyOverview }) {
  const q = useAdvanceMovements(property.id)
  const stat = (label: string, paise: number, strong = false) => (
    <div className="rounded-md border border-line bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 tabular-nums ${strong ? 'text-lg font-semibold' : 'text-base font-medium'}`}>{formatINR(paise)}</dd>
    </div>
  )
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat('Original advance', property.advanceReceivedPaise)}
        {stat('Adjusted', property.advanceAdjustedPaise)}
        {stat('Returned', property.advanceReturnedPaise)}
        {stat('Remaining', propertyTotals(property).advanceRemainingPaise, true)}
      </dl>
      <h3 className="mb-2 mt-6 text-sm font-semibold">History</h3>
      {q.isError ? (
        <div role="alert" className="rounded-md border border-line bg-surface px-6 py-6 text-center">
          <p className="text-sm font-medium">Could not load advance history</p>
          <button type="button" className={`${buttonSecondary} mt-3`} onClick={() => void q.refetch()}>Try again</button>
        </div>
      ) : q.isLoading ? (
        <p className="text-sm text-muted" role="status">Loading history…</p>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState title="No advance recorded" description="Use “Add advance entry” to record the advance received, and later any part adjusted or returned." />
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          {q.data?.map((m) => (
            <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
              <span><span className="font-medium">{ADVANCE_KIND_LABELS[m.kind]}</span> <span className="tabular-nums">{formatINR(m.amountPaise)}</span></span>
              <span className="text-xs text-muted">{formatDate(m.date)}{m.notes ? ` · ${m.notes}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
