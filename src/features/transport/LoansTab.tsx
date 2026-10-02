import { useState } from 'react'
import { formatDate } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { buttonSecondary } from '../../components/ui/FullScreenMessage'
import { LOAN_STATUSES, type LoanStatus, type VehicleLoan } from '../../types/transport'
import { Pill } from '../property/StatusBadge'
import { useLoans } from './hooks'
import { LOAN_STATUS_LABELS } from './labels'
import { LoanDialog } from './LoanDialog'
import { LoanPaymentsDialog } from './LoanPaymentsDialog'
import { MasterList, type Column } from './MasterList'
import { loanEndDate } from './transportEngine'
import { useListControls } from './useListControls'
import { VehicleFilter } from './VehicleFilter'

const columns: Column<VehicleLoan>[] = [
  {
    header: 'Loan',
    cell: (l) => (
      <>
        <span className="font-medium">{l.lender}</span>
        <div className="text-xs font-normal text-muted">{l.vehicleName ? `${l.vehicleName} (${l.vehicleRegistration})` : 'No vehicle linked'}</div>
      </>
    ),
  },
  { header: 'Received', align: 'right', cell: (l) => <span className="font-medium">{formatINR(l.principalPaise)}</span> },
  { header: 'EMI', align: 'right', cell: (l) => formatINR(l.emiPaise) },
  { header: 'Interest', align: 'right', cell: (l) => `${l.interestRate}% a year` },
  {
    header: 'Repaid so far', align: 'right',
    cell: (l) => (<>{formatINR(l.paidPaise)}<div className="text-xs font-normal text-muted">{l.paymentCount} {l.paymentCount === 1 ? 'payment' : 'payments'}</div></>),
  },
  {
    header: 'Term',
    cell: (l) => {
      const end = loanEndDate(l.startDate, l.tenureMonths)
      return (<>From {formatDate(l.startDate)}<div className="text-xs font-normal text-muted">{end ? `Ends ${formatDate(end)} (${l.tenureMonths} months)` : 'No tenure set'}</div></>)
    },
  },
  { header: 'Status', cell: (l) => <Pill tone={l.status === 'active' ? 'good' : 'neutral'}>{LOAN_STATUS_LABELS[l.status]}</Pill> },
]

export function LoansTab() {
  const c = useListControls()
  const status = (LOAN_STATUSES as readonly string[]).includes(c.status) ? (c.status as LoanStatus) : undefined
  const vehicleId = c.vehicle !== 'all' ? c.vehicle : undefined
  const list = useLoans({ status, vehicleId, q: c.q }, c.page)
  const [dialog, setDialog] = useState<{ loan?: VehicleLoan } | null>(null)
  const [paymentsFor, setPaymentsFor] = useState<string | null>(null)

  // Look the loan up in the freshly loaded list so the totals update right after a payment is saved.
  const paymentsLoan = paymentsFor ? list.data?.rows.find((l) => l.id === paymentsFor) : undefined

  return (
    <>
      <LoanDialog key={dialog?.loan?.id ?? 'new'} open={dialog !== null} loan={dialog?.loan} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />
      <LoanPaymentsDialog open={paymentsFor !== null} loan={paymentsLoan} onClose={() => setPaymentsFor(null)} />
      <VehicleFilter value={vehicleId ?? 'all'} onChange={c.setVehicle} />
      <MasterList
        noun="loan" columns={columns} rowKey={(l) => l.id} rowLabel={(l) => `${l.lender} loan`}
        data={list.data} isLoading={list.isLoading} isError={list.isError} onRetry={() => void list.refetch()}
        page={c.page} onPage={c.setPage} qText={c.qText} onSearch={c.setQText} searchLabel="Search by lender or notes"
        status={{ value: status ?? 'all', onChange: c.setStatus, options: LOAN_STATUSES.map((s) => ({ value: s, label: LOAN_STATUS_LABELS[s] })) }}
        filtered={Boolean(status || vehicleId || c.q)} onClear={c.clear}
        onAdd={() => setDialog({})} onEdit={(loan) => setDialog({ loan })}
        rowActions={(l) => (
          <button type="button" className={buttonSecondary} aria-label={`Payments for ${l.lender} loan`} onClick={() => setPaymentsFor(l.id)}>Payments</button>
        )}
        emptyHint="Add a vehicle loan with the lender, amount received, rate and EMI. Then record each repayment under Payments."
      />
    </>
  )
}
