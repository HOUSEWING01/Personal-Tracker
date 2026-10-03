import { useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { buttonSecondary } from '../../components/ui/FullScreenMessage'
import { formatDate, todayIST } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { accruedInterestPaise, daysBetween, interestDays, interestToDueDatePaise } from '../../services/goldInterest'
import { GOLD_LOAN_STATUSES, type GoldLoan, type GoldLoanStatus } from '../../types/gold'
import { MasterList, type Column } from '../transport/MasterList'
import { useListControls } from '../transport/useListControls'
import { StatusPill } from '../sheets/StatusPill'
import { dueLabel, dueState, estimatedBalancePaise, formatGrams } from './goldEngine'
import { GoldLoanDialog } from './GoldLoanDialog'
import { GoldPaymentsDialog } from './GoldPaymentsDialog'
import { useGoldLoans } from './hooks'
import { GOLD_STATUS_LABELS } from './labels'

function buildColumns(today: string): Column<GoldLoan>[] {
  return [
    {
      header: 'Loan',
      cell: (l) => (
        <>
          <span className="font-medium">{l.personName}</span>
          <div className="text-xs font-normal text-muted">{l.bank}{l.mobile ? ` · ${l.mobile}` : ''}</div>
        </>
      ),
    },
    {
      header: 'Gold',
      cell: (l) => (<>{l.goldDescription}{l.goldWeightGrams !== null && <div className="text-xs font-normal text-muted">{formatGrams(l.goldWeightGrams)}</div>}</>),
    },
    { header: 'Received', align: 'right', cell: (l) => <span className="font-medium">{formatINR(l.principalPaise)}</span> },
    {
      header: 'Interest so far', align: 'right',
      cell: (l) => {
        const days = interestDays(l, today)
        const full = interestToDueDatePaise(l)
        return (
          <>
            {formatINR(accruedInterestPaise(l, today))}
            <div className="text-xs font-normal text-muted">{l.annualRate}% a year · {days} {days === 1 ? 'day' : 'days'}</div>
            {full !== null && l.dueDate && <div className="text-xs font-normal text-muted">Till due date {formatINR(full)} ({daysBetween(l.pledgeDate, l.dueDate)} days)</div>}
          </>
        )
      },
    },
    {
      header: 'Repaid so far', align: 'right',
      cell: (l) => (
        <>
          {formatINR(l.paidPaise)}
          <div className="text-xs font-normal text-muted">
            {l.status === 'active' ? `Est. balance ${formatINR(estimatedBalancePaise(l, l.paidPaise, today))}` : `${l.paymentCount} ${l.paymentCount === 1 ? 'payment' : 'payments'}`}
          </div>
        </>
      ),
    },
    {
      header: 'Dates',
      cell: (l) => {
        const due = dueState(l, today)
        return (
          <>
            Pledged {formatDate(l.pledgeDate)}
            <div className="text-xs font-normal text-muted">
              {l.status !== 'active' && l.closedDate ? `Closed ${formatDate(l.closedDate)}` : l.dueDate ? `Due ${formatDate(l.dueDate)}` : 'No due date'}
            </div>
            {due && <div className="mt-1"><StatusPill tone={due.kind === 'overdue' ? 'danger' : 'warn'}>{dueLabel(due)}</StatusPill></div>}
          </>
        )
      },
    },
    { header: 'Status', cell: (l) => <StatusPill tone={l.status === 'active' ? 'good' : 'neutral'}>{GOLD_STATUS_LABELS[l.status]}</StatusPill> },
  ]
}

/** Shown on a collapsed phone card: amount, balance or payments, status and any due warning. */
function buildSummary(today: string) {
  return (l: GoldLoan) => {
    const due = dueState(l, today)
    return (
      <>
        <span className="tabular-nums">{formatINR(l.principalPaise)}</span>
        {l.status === 'active' && <span className="tabular-nums text-muted">Balance {formatINR(estimatedBalancePaise(l, l.paidPaise, today))}</span>}
        <StatusPill tone={l.status === 'active' ? 'good' : 'neutral'}>{GOLD_STATUS_LABELS[l.status]}</StatusPill>
        {due && <StatusPill tone={due.kind === 'overdue' ? 'danger' : 'warn'}>{dueLabel(due)}</StatusPill>}
      </>
    )
  }
}

export function GoldLoansPage() {
  const c = useListControls()
  const status = (GOLD_LOAN_STATUSES as readonly string[]).includes(c.status) ? (c.status as GoldLoanStatus) : undefined
  const list = useGoldLoans({ status, q: c.q }, c.page)
  const [dialog, setDialog] = useState<{ loan?: GoldLoan } | null>(null)
  const [paymentsFor, setPaymentsFor] = useState<string | null>(null)
  const today = todayIST()
  const columns = buildColumns(today)

  // Look the loan up in the freshly loaded list so totals update right after a payment is saved.
  const paymentsLoan = paymentsFor ? list.data?.rows.find((l) => l.id === paymentsFor) : undefined

  return (
    <>
      <PageHeader title="Gold loans" description="Gold pledged to a bank: the loan received, interest accruing at the annual rate, repayments, and the gold released when the loan is closed." />
      <GoldLoanDialog key={dialog?.loan?.id ?? 'new'} open={dialog !== null} loan={dialog?.loan} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />
      <GoldPaymentsDialog open={paymentsFor !== null} loan={paymentsLoan} onClose={() => setPaymentsFor(null)} />
      <MasterList
        noun="gold loan" columns={columns} rowKey={(l) => l.id} rowLabel={(l) => `${l.personName} gold loan`}
        data={list.data} isLoading={list.isLoading} isError={list.isError} onRetry={() => void list.refetch()}
        page={c.page} onPage={c.setPage} qText={c.qText} onSearch={c.setQText} searchLabel="Search by person, bank or gold"
        status={{ value: status ?? 'all', onChange: c.setStatus, options: GOLD_LOAN_STATUSES.map((s) => ({ value: s, label: GOLD_STATUS_LABELS[s] })) }}
        filtered={Boolean(status || c.q)} onClear={c.clear}
        onAdd={() => setDialog({})} onEdit={(loan) => setDialog({ loan })} collapsedSummary={buildSummary(today)}
        rowActions={(l) => (
          <button type="button" className={buttonSecondary} aria-label={`Payments for ${l.personName} gold loan`} onClick={() => setPaymentsFor(l.id)}>Payments</button>
        )}
        emptyHint="Add a gold loan with the bank, the gold pledged, the amount received and the yearly interest rate. Then record each repayment under Payments."
      />
    </>
  )
}
