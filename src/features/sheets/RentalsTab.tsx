import { useState } from 'react'
import { formatDate, todayIST } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { buttonSecondary } from '../../components/ui/FullScreenMessage'
import { RENTAL_STATUSES, type RentalStatus, type SheetRental } from '../../types/sheets'
import { MasterList, type Column } from '../transport/MasterList'
import { useRentals } from './hooks'
import { RENTAL_STATUS_LABELS } from './labels'
import { RentalDialog } from './RentalDialog'
import { RentalPaymentsDialog } from './RentalPaymentsDialog'
import { RentalReturnsDialog } from './RentalReturnsDialog'
import { actualReturnDate, isRentalOverdue, netRentPaise, rentalOutstandingPaise, stillOutQuantity, variantLabel } from './sheetEngine'
import { StatusPill } from './StatusPill'
import { useSheetListControls } from './useSheetListControls'
import { VariantFilter } from './VariantFilter'

const OVERDUE = 'overdue'

function makeColumns(today: string): Column<SheetRental>[] {
  return [
    {
      header: 'Customer',
      cell: (r) => (<><span className="font-medium">{r.customerName}</span><div className="text-xs font-normal text-muted">{r.customerMobile ?? 'No mobile'} · {formatDate(r.rentalDate)}</div></>),
    },
    {
      header: 'Sheets',
      cell: (r) => (<>{r.quantity} × {variantLabel(r.lengthFt)}<div className="text-xs font-normal text-muted">{r.productName} · {stillOutQuantity(r)} still out</div></>),
    },
    {
      header: 'Return',
      cell: (r) => {
        const actual = actualReturnDate(r)
        return (
          <>
            {actual ? `Returned ${formatDate(actual)}` : r.expectedReturnDate ? `Due ${formatDate(r.expectedReturnDate)}` : 'No due date'}
            {r.damagedQuantity + r.missingQuantity > 0 && <div className="text-xs font-normal text-muted">{r.damagedQuantity} damaged · {r.missingQuantity} missing</div>}
            {isRentalOverdue(r, today) && <div className="mt-0.5"><StatusPill tone="danger">Overdue</StatusPill></div>}
          </>
        )
      },
    },
    { header: 'Net rent', align: 'right', cell: (r) => (<span className="font-medium">{formatINR(netRentPaise(r))}</span>) },
    { header: 'Paid', align: 'right', cell: (r) => formatINR(r.paidPaise) },
    {
      header: 'Outstanding', align: 'right',
      cell: (r) => { const o = rentalOutstandingPaise(r); return <span className={o > 0 && r.status !== 'cancelled' ? 'font-medium' : ''}>{formatINR(o)}</span> },
    },
    {
      header: 'Status',
      cell: (r) => <StatusPill tone={r.status === 'closed' ? 'good' : r.status === 'active' ? 'warn' : 'neutral'}>{RENTAL_STATUS_LABELS[r.status]}</StatusPill>,
    },
  ]
}

export function RentalsTab() {
  const c = useSheetListControls()
  const today = todayIST()
  const isOverdue = c.status === OVERDUE
  const status = (RENTAL_STATUSES as readonly string[]).includes(c.status) ? (c.status as RentalStatus) : undefined
  const variantId = c.variant !== 'all' ? c.variant : undefined
  const list = useRentals({ status, variantId, overdueBefore: isOverdue ? today : undefined, q: c.q }, c.page)
  const [dialog, setDialog] = useState<{ rental?: SheetRental } | null>(null)
  const [returnsFor, setReturnsFor] = useState<string | null>(null)
  const [paymentsFor, setPaymentsFor] = useState<string | null>(null)

  // Look the rental up in the freshly loaded list so figures update right after a save.
  const returnsRental = returnsFor ? list.data?.rows.find((r) => r.id === returnsFor) : undefined
  const paymentsRental = paymentsFor ? list.data?.rows.find((r) => r.id === paymentsFor) : undefined

  return (
    <>
      <RentalDialog key={dialog?.rental?.id ?? 'new'} open={dialog !== null} rental={dialog?.rental} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />
      <RentalReturnsDialog open={returnsFor !== null} rental={returnsRental} onClose={() => setReturnsFor(null)} />
      <RentalPaymentsDialog open={paymentsFor !== null} rental={paymentsRental} onClose={() => setPaymentsFor(null)} />
      <VariantFilter value={variantId ?? 'all'} onChange={c.setVariant} />
      <MasterList
        noun="rental" columns={makeColumns(today)} rowKey={(r) => r.id} rowLabel={(r) => `${r.customerName} rental`}
        data={list.data} isLoading={list.isLoading} isError={list.isError} onRetry={() => void list.refetch()}
        page={c.page} onPage={c.setPage} qText={c.qText} onSearch={c.setQText} searchLabel="Search by customer, mobile or notes"
        status={{
          value: isOverdue ? OVERDUE : (status ?? 'all'), onChange: c.setStatus,
          options: [{ value: OVERDUE, label: 'Overdue returns' }, ...RENTAL_STATUSES.map((s) => ({ value: s, label: RENTAL_STATUS_LABELS[s] }))],
        }}
        filtered={Boolean(status || isOverdue || variantId || c.q)} onClear={c.clear}
        onAdd={() => setDialog({})} onEdit={(rental) => setDialog({ rental })}
        rowActions={(r) => (
          <>
            <button type="button" className={buttonSecondary} aria-label={`Returns for ${r.customerName} rental`} onClick={() => setReturnsFor(r.id)}>Returns</button>
            <button type="button" className={buttonSecondary} aria-label={`Payments for ${r.customerName} rental`} onClick={() => setPaymentsFor(r.id)}>Payments</button>
          </>
        )}
        emptyHint="Add a rental with the customer, size, quantity and rent. Record returns (full or partial) and payments from each row."
      />
    </>
  )
}
