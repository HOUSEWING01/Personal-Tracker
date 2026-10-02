import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatTile as Tile, statGrid } from '../../components/ui/StatTile'
import { currentMonthRangeIST, formatDate, todayIST } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { useUrlState } from '../../hooks/useUrlState'
import { useFinanceSummary } from '../finance/hooks'
import { dueLabel } from '../gold/goldEngine'
import { StatusPill } from '../sheets/StatusPill'
import { receivablesPaise, summarizeGold } from './dashboardEngine'
import { useActiveGoldLoans, useDashboardCounts } from './hooks'

const DEFAULTS = { period: 'month' }

function Section({ title, to, linkLabel, loading, error, onRetry, children }: {
  title: string; to: string; linkLabel: string; loading: boolean; error: boolean; onRetry: () => void; children: ReactNode
}) {
  return (
    <section className="mt-8" aria-labelledby={`dash-${to}`} aria-busy={loading}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id={`dash-${to}`} className="text-sm font-semibold">{title}</h2>
        <Link to={to} className="text-sm text-primary underline-offset-2 hover:underline">{linkLabel}</Link>
      </div>
      {error ? (
        <div role="alert" className="rounded-md border border-line bg-surface px-4 py-4 text-sm">
          Could not load this section. <button type="button" className="text-primary underline" onClick={onRetry}>Try again</button>
        </div>
      ) : (
        <dl className={statGrid}>{children}</dl>
      )}
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
  const gold = useActiveGoldLoans()
  const g = gold.data ? summarizeGold(gold.data, today) : undefined
  const c = counts.data
  const f = all.data
  const t = transport.data
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
          <div role="group" aria-label="Period for money figures" className="flex rounded-md border border-line bg-surface p-0.5 text-sm">
            {([['month', 'This month'], ['all', 'All time']] as const).map(([id, label]) => (
              <button
                key={id} type="button" aria-pressed={period === id} onClick={() => update({ period: id })}
                className={`rounded px-3 py-1.5 font-medium ${period === id ? 'bg-primary text-surface' : 'text-muted hover:text-ink'}`}
              >{label}</button>
            ))}
          </div>
        }
      />

      {attention.length > 0 && (
        <section aria-labelledby="dash-attention" className="rounded-md bg-gold-soft px-4 py-3">
          <h2 id="dash-attention" className="text-sm font-semibold text-primary">Needs attention</h2>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm text-primary">
            {attention.map((a) => (<li key={a.key}><Link to={a.to} className="underline-offset-2 hover:underline">{a.text}</Link></li>))}
          </ul>
        </section>
      )}

      <Section title={`Financial · ${periodLabel}`} to="/finance" linkLabel="All transactions" loading={all.isLoading} error={all.isError} onRetry={() => void all.refetch()}>
        <Tile label="Revenue" value={money(f?.revenue)} />
        <Tile label="Expenses" value={money(f?.expenses)} />
        <Tile label="Net profit" value={money(f?.netProfit)} negative={(f?.netProfit ?? 0) < 0} />
        <Tile label="Outstanding receivables" value={money(receivables)} hint="Unpaid rent and sheet rent, all time" />
        <Tile label="Loans received" value={money(f?.loanReceived)} hint={periodLabel} />
        <Tile label="Loan repayments" value={money(f?.loanRepayments)} hint="Includes interest" />
      </Section>

      <Section title="Godowns" to="/property" linkLabel="Open godowns" loading={counts.isLoading} error={counts.isError} onRetry={() => void counts.refetch()}>
        <Tile label="Godowns" value={num(c?.activeProperties)} />
        <Tile label="Occupied" value={num(c?.occupiedProperties)} />
        <Tile label="Rent outstanding" value={money(c?.rentOutstandingPaise)} />
      </Section>

      <Section title="Transport" to="/transport" linkLabel="Open transport" loading={counts.isLoading || transport.isLoading} error={counts.isError || transport.isError} onRetry={() => { void counts.refetch(); void transport.refetch() }}>
        <Tile label="Active vehicles" value={num(c?.activeVehicles)} />
        <Tile label="Trips this month" value={num(c?.tripsThisMonth)} hint="Not counting cancelled" />
        <Tile label="Revenue" value={money(t?.revenue)} hint={periodLabel} />
        <Tile label="Expenses" value={money(t?.expenses)} hint={periodLabel} />
        <Tile label="Profit" value={money(t?.netProfit)} hint={`${periodLabel}, before loan repayments`} negative={(t?.netProfit ?? 0) < 0} />
      </Section>

      <Section title="Sheet rental" to="/sheets" linkLabel="Open sheet rental" loading={counts.isLoading} error={counts.isError} onRetry={() => void counts.refetch()}>
        <Tile label="Total sheets" value={num(c?.sheetsTotal)} hint="Active sizes" />
        <Tile label="Rented out" value={num(c?.sheetsRented)} />
        <Tile label="Available" value={num(c?.sheetsAvailable)} hint={c && (c.sheetsDamaged > 0 || c.sheetsMissing > 0) ? `${c.sheetsDamaged} damaged, ${c.sheetsMissing} missing` : undefined} />
        <Tile label="Overdue returns" value={num(c?.overdueRentals)} negative={(c?.overdueRentals ?? 0) > 0} />
      </Section>

      <Section title="Gold loans" to="/gold-loans" linkLabel="Open gold loans" loading={gold.isLoading} error={gold.isError} onRetry={() => void gold.refetch()}>
        <Tile label="Active bank loans" value={num(g?.activeLoans)} />
        <Tile label="Amount borrowed" value={money(g?.borrowedPaise)} hint="Active loans" />
        <Tile label="Accrued interest" value={money(g?.accruedInterestPaise)} hint="Simple interest to today" />
        <Tile label="Estimated balance" value={money(g?.estimatedBalancePaise)} hint="Estimate, not the bank's figure" />
      </Section>

      {g && g.upcoming.length > 0 && (
        <section className="mt-4" aria-labelledby="dash-dues">
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
