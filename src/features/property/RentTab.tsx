import { useState } from 'react'
import { EmptyState } from '../../components/ui/EmptyState'
import { buttonSecondary } from '../../components/ui/FullScreenMessage'
import { formatDate, todayIST } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { PAYMENT_METHODS } from '../finance/labels'
import { useRentCharges, useRentPayments, useRentSync } from './hooks'
import { chargeStatus, formatPeriod, isOverdue, outstanding } from './propertyEngine'
import { RentPaymentDialog } from './RentPaymentDialog'
import { ChargeStatusBadge } from './StatusBadge'

const methodLabel = (v: string | null) => PAYMENT_METHODS.find((m) => m.value === v)?.label ?? '—'

export function RentTab({ propertyId, hasTenant, onNotice }: { propertyId: string; hasTenant: boolean; onNotice: (m: string) => void }) {
  const sync = useRentSync(propertyId)
  const charges = useRentCharges(propertyId, sync.isSuccess)
  const payments = useRentPayments(propertyId)
  const [paying, setPaying] = useState<{ period: string; outstandingPaise: number } | null>(null)
  const today = todayIST()

  if (sync.isError || charges.isError) {
    return (
      <div role="alert" className="rounded-md border border-line bg-surface px-6 py-8 text-center">
        <p className="text-sm font-medium">Could not load rent</p>
        <button type="button" className={`${buttonSecondary} mt-3`} onClick={() => { if (sync.isError) void sync.refetch(); else void charges.refetch() }}>Try again</button>
      </div>
    )
  }
  if (sync.isLoading || charges.isLoading) return <p className="py-8 text-center text-sm text-muted" role="status">Loading rent…</p>
  const rows = charges.data ?? []
  if (rows.length === 0) {
    return (
      <EmptyState
        title={hasTenant ? 'No rent due yet' : 'No tenant yet'}
        description={hasTenant ? 'Rent is created for each month from the rental start date. Check the tenant’s start date and that the property is active.' : 'Add the tenant on the Tenant tab. Monthly rent starts from their rental start date.'}
      />
    )
  }
  return (
    <>
      <RentPaymentDialog
        open={paying !== null} propertyId={propertyId} period={paying?.period ?? ''} outstandingPaise={paying?.outstandingPaise ?? 0}
        onClose={() => setPaying(null)} onSaved={() => { setPaying(null); onNotice('Rent payment recorded and added to Transactions.') }}
      />
      <div className="hidden overflow-x-auto rounded-md border border-line bg-surface md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Month</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Expected</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Paid</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Outstanding</th>
              <th scope="col" className="px-4 py-2 font-medium">Status</th>
              <th scope="col" className="px-4 py-2 font-medium"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const out = outstanding(c.expectedPaise, c.paidPaise)
              return (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium">{formatPeriod(c.period)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatINR(c.expectedPaise)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatINR(c.paidPaise)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums">{formatINR(out)}</td>
                  <td className="px-4 py-2.5"><ChargeStatusBadge status={chargeStatus(c)} overdue={isOverdue(c, today)} /></td>
                  <td className="px-4 py-2.5 text-right">
                    {out > 0 && <button type="button" className={buttonSecondary} aria-label={`Record payment for ${formatPeriod(c.period)}`} onClick={() => setPaying({ period: c.period, outstandingPaise: out })}>Record payment</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((c) => {
          const out = outstanding(c.expectedPaise, c.paidPaise)
          return (
            <li key={c.id} className="rounded-md border border-line bg-surface px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">{formatPeriod(c.period)}</span>
                <ChargeStatusBadge status={chargeStatus(c)} overdue={isOverdue(c, today)} />
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-muted">Expected</dt><dd className="font-medium tabular-nums">{formatINR(c.expectedPaise)}</dd></div>
                <div><dt className="text-muted">Paid</dt><dd className="font-medium tabular-nums">{formatINR(c.paidPaise)}</dd></div>
                <div><dt className="text-muted">Outstanding</dt><dd className="font-medium tabular-nums">{formatINR(out)}</dd></div>
              </dl>
              {out > 0 && <button type="button" className={`${buttonSecondary} mt-3 w-full`} aria-label={`Record payment for ${formatPeriod(c.period)}`} onClick={() => setPaying({ period: c.period, outstandingPaise: out })}>Record payment</button>}
            </li>
          )
        })}
      </ul>

      <h3 className="mb-2 mt-8 text-sm font-semibold">Payment history</h3>
      {payments.isError ? (
        <p role="alert" className="text-sm text-danger">Could not load payments. <button type="button" className="underline" onClick={() => void payments.refetch()}>Try again</button></p>
      ) : payments.isLoading ? (
        <p className="text-sm text-muted" role="status">Loading payments…</p>
      ) : (payments.data ?? []).length === 0 ? (
        <p className="text-sm text-muted">No payments recorded yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          {payments.data?.map((pay) => (
            <li key={pay.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
              <span><span className="font-medium tabular-nums">{formatINR(pay.amountPaise)}</span> <span className="text-muted">for {formatPeriod(pay.period)}</span></span>
              <span className="text-xs text-muted">{formatDate(pay.paymentDate)} · {methodLabel(pay.paymentMethod)}{pay.notes ? ` · ${pay.notes}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
