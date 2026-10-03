import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { currentMonthRangeIST, formatDate, todayIST } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { useUrlState } from '../../hooks/useUrlState'
import { useFinanceSummary } from '../finance/hooks'
import { dueLabel } from '../gold/goldEngine'
import { StatusPill } from '../sheets/StatusPill'
import { debtParts, receivablesPaise, summarizeGold } from './dashboardEngine'
import { useActiveGoldLoans, useDashboardCounts } from './hooks'

const DEFAULTS = { period: 'month' }

/** Title row of a dashboard card: heading on the left, link to the module on the right. */
function CardHead({ id, title, to, linkLabel }: { id: string; title: string; to: string; linkLabel: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-sm font-semibold">{title}</h2>
      <Link to={to} className="shrink-0 text-xs text-primary underline-offset-2 hover:underline">{linkLabel}</Link>
    </div>
  )
}

const retry = (onRetry: () => void) => (
  <div role="alert" className="mt-2 text-sm">Could not load this section. <button type="button" className="text-primary underline" onClick={onRetry}>Try again</button></div>
)

/** A small label + value for use inside a card's `<dl>`. Values wrap instead of clipping. */
function Stat({ label, value, hint, negative, big }: { label: string; value: ReactNode; hint?: string; negative?: boolean; big?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-0.5 break-words font-semibold tabular-nums ${big ? 'text-2xl' : 'text-sm'} ${negative ? 'text-danger' : 'text-ink'}`}>{value}</dd>
      {hint && <div className="text-[11px] leading-snug text-muted">{hint}</div>}
    </div>
  )
}

/** One module as one compact card: a header, then its figures in a 2 or 3 column grid. */
function Card({ title, to, linkLabel, loading, error, onRetry, cols = 2, children }: {
  title: string; to: string; linkLabel: string; loading: boolean; error: boolean; onRetry: () => void; cols?: 2 | 3; children: ReactNode
}) {
  const id = `dash-${to}`
  return (
    <section className="mt-3 rounded-lg border border-line bg-surface p-3" aria-labelledby={id} aria-busy={loading}>
      <CardHead id={id} title={title} to={to} linkLabel={linkLabel} />
      {error ? retry(onRetry) : <dl className={`mt-2.5 grid gap-x-3 gap-y-3 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>{children}</dl>}
    </section>
  )
}

const dash = '—'

export function DashboardPage() {
  const [p, update] = useUrlState(DEFAULTS)
  const period = p.period === 'all' ? 'all' : 'month'
  const today = todayIST()
  const month = currentMonthRangeIST()
  const range = period === 'month' ? { from: month.from, to: month.to } : {}
  const periodLabel = period === 'month' ? 'this month' : 'all time'

  const counts = useDashboardCounts(today, month.from, month.to)
  const all = useFinanceSummary(range, true)
  const transport = useFinanceSummary({ ...range, module: 'transport' }, true)
  // The overall strip under the title is always all-time, whichever period the tiles below show. On "All time" these are
  // the same queries as `all` / `transport`, so they are shared.
  const allTime = useFinanceSummary({}, true)
  const allTimeTransport = useFinanceSummary({ module: 'transport' }, true)
  const gold = useActiveGoldLoans()
  const g = gold.data ? summarizeGold(gold.data, today) : undefined
  const c = counts.data
  const f = all.data
  const t = transport.data
  const overall = allTime.data
  const debt = allTimeTransport.data && g ? debtParts(allTimeTransport.data.loanReceived, allTimeTransport.data.loanRepayments, g.estimatedBalancePaise) : undefined
  const receivables = c ? receivablesPaise(c.rentOutstandingPaise, c.sheetOutstandingPaise) : undefined
  const money = (v?: number) => (v === undefined ? dash : formatINR(v))
  const num = (v?: number) => (v === undefined ? dash : String(v))

  const attention: { key: string; text: string; to: string }[] = []
  if (c && c.overdueRentals > 0) attention.push({ key: 'sheets', text: `${c.overdueRentals} sheet ${c.overdueRentals === 1 ? 'rental is' : 'rentals are'} past the expected return date`, to: '/sheets' })
  if (c && c.rentOutstandingPaise > 0) attention.push({ key: 'rent', text: `${formatINR(c.rentOutstandingPaise)} rent is unpaid`, to: '/property' })
  if (c && c.sheetOutstandingPaise > 0) attention.push({ key: 'sheetpay', text: `${formatINR(c.sheetOutstandingPaise)} sheet rent is unpaid`, to: '/sheets' })
  if (g && g.overdueCount > 0) attention.push({ key: 'goldover', text: `${g.overdueCount} gold ${g.overdueCount === 1 ? 'loan is' : 'loans are'} past the due date`, to: '/gold-loans' })

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Money and operations across every module."
        actions={
          <div className="flex items-center">
            <div role="group" aria-label="Period for money figures" className="flex rounded-md border border-line bg-surface p-0.5 text-sm">
              {([['month', 'This month'], ['all', 'All time']] as const).map(([id, label]) => (
                <button
                  key={id} type="button" aria-pressed={period === id} onClick={() => update({ period: id })}
                  className={`rounded px-3 py-1.5 font-medium ${period === id ? 'bg-primary text-surface' : 'text-muted hover:text-ink'}`}
                >{label}</button>
              ))}
            </div>
          </div>
        }
      />

      <section className="mb-3 rounded-lg border border-line bg-surface p-3" aria-labelledby="dash-overall" aria-busy={allTime.isLoading || allTimeTransport.isLoading || gold.isLoading}>
        <h2 id="dash-overall" className="text-xs font-semibold uppercase tracking-wide text-muted">All modules · all time</h2>
        {allTime.isError ? retry(() => void allTime.refetch()) : (
          <dl className="mt-2 grid grid-cols-3 gap-x-3">
            <Stat label="Total revenue" value={money(overall?.revenue)} />
            <Stat label="Total profit" value={money(overall?.netProfit)} negative={(overall?.netProfit ?? 0) < 0} />
            <Stat label="Total debt" value={money(debt?.totalPaise)} hint="Estimate" />
            <div className="col-span-3 mt-3 grid grid-cols-2 gap-x-3 border-t border-line pt-3">
              <Stat label="Debt · vehicle loans" value={money(debt?.vehiclePaise)} hint="Received − repaid" />
              <Stat label="Debt · gold loans" value={money(debt?.goldPaise)} hint="Active, with interest" />
            </div>
          </dl>
        )}
      </section>

      {attention.length > 0 && (
        <section aria-labelledby="dash-attention" className="rounded-md bg-gold-soft px-3 py-2">
          <h2 id="dash-attention" className="text-xs font-semibold uppercase tracking-wide text-primary">Needs attention</h2>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm text-primary">
            {attention.map((a) => (<li key={a.key}><Link to={a.to} className="underline-offset-2 hover:underline">{a.text}</Link></li>))}
          </ul>
        </section>
      )}

      <section className="mt-3 rounded-lg border border-line bg-surface p-3" aria-labelledby="dash-finance" aria-busy={all.isLoading}>
        <CardHead id="dash-finance" title={`Financial · ${periodLabel}`} to="/finance" linkLabel="All transactions" />
        {all.isError ? retry(() => void all.refetch()) : (
          <dl className="mt-2.5">
            <Stat big label="Net profit" value={money(f?.netProfit)} negative={(f?.netProfit ?? 0) < 0} />
            <div className="mt-3 grid grid-cols-3 gap-x-3 border-t border-line pt-3">
              <Stat label="Revenue" value={money(f?.revenue)} />
              <Stat label="Expenses" value={money(f?.expenses)} />
              <Stat label="Receivables" value={money(receivables)} hint="Unpaid rent, all time" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 border-t border-line pt-3">
              <Stat label="Loans received" value={money(f?.loanReceived)} />
              <Stat label="Loan repayments" value={money(f?.loanRepayments)} hint="Includes interest" />
            </div>
          </dl>
        )}
      </section>

      <Card title="Godowns" to="/property" linkLabel="Open" cols={3} loading={counts.isLoading} error={counts.isError} onRetry={() => void counts.refetch()}>
        <Stat label="Godowns" value={num(c?.activeProperties)} />
        <Stat label="Occupied" value={num(c?.occupiedProperties)} />
        <Stat label="Rent unpaid" value={money(c?.rentOutstandingPaise)} negative={(c?.rentOutstandingPaise ?? 0) > 0} />
      </Card>

      <Card title={`Transport · ${periodLabel}`} to="/transport" linkLabel="Open" cols={3} loading={counts.isLoading || transport.isLoading} error={counts.isError || transport.isError} onRetry={() => { void counts.refetch(); void transport.refetch() }}>
        <Stat label="Vehicles" value={num(c?.activeVehicles)} hint="Active" />
        <Stat label="Trips" value={num(c?.tripsThisMonth)} hint="This month" />
        <Stat label="Profit" value={money(t?.netProfit)} hint="Before loan repayments" negative={(t?.netProfit ?? 0) < 0} />
        <Stat label="Revenue" value={money(t?.revenue)} />
        <Stat label="Expenses" value={money(t?.expenses)} />
      </Card>

      <Card title="Sheet rental" to="/sheets" linkLabel="Open" cols={3} loading={counts.isLoading} error={counts.isError} onRetry={() => void counts.refetch()}>
        <Stat label="Total sheets" value={num(c?.sheetsTotal)} />
        <Stat label="Rented out" value={num(c?.sheetsRented)} />
        <Stat label="Available" value={num(c?.sheetsAvailable)} hint={c && (c.sheetsDamaged > 0 || c.sheetsMissing > 0) ? `${c.sheetsDamaged} damaged, ${c.sheetsMissing} missing` : undefined} />
        <Stat label="Overdue returns" value={num(c?.overdueRentals)} negative={(c?.overdueRentals ?? 0) > 0} />
      </Card>

      <Card title="Gold loans" to="/gold-loans" linkLabel="Open" loading={gold.isLoading} error={gold.isError} onRetry={() => void gold.refetch()}>
        <Stat label="Active bank loans" value={num(g?.activeLoans)} />
        <Stat label="Amount borrowed" value={money(g?.borrowedPaise)} />
        <Stat label="Accrued interest" value={money(g?.accruedInterestPaise)} hint="Simple interest to today" />
        <Stat label="Estimated balance" value={money(g?.estimatedBalancePaise)} hint="Not the bank's figure" />
      </Card>

      {g && g.upcoming.length > 0 && (
        <section className="mt-3" aria-labelledby="dash-dues">
          <h3 id="dash-dues" className="mb-2 text-sm font-medium">Upcoming gold loan due dates</h3>
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {g.upcoming.slice(0, 5).map(({ loan, due }) => (
              <li key={loan.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span><span className="font-medium">{loan.personName}</span> <span className="text-muted">· {loan.bank} · due {formatDate(loan.dueDate ?? '')}</span></span>
                <StatusPill tone={due.kind === 'overdue' ? 'danger' : 'warn'}>{dueLabel(due)}</StatusPill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
