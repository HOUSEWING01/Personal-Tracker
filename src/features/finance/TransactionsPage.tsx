import { useEffect, useState } from 'react'
import { Plus } from '@phosphor-icons/react'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { useUrlState } from '../../hooks/useUrlState'
import { currentMonthRangeIST, isValidISODate } from '../../lib/dates'
import { BUSINESS_MODULES, TRANSACTION_TYPES, type BusinessModule, type TransactionType } from '../../types/finance'
import type { TransactionSort } from '../../services/transactionService'
import { PAGE_SIZE, useFinanceSummary, useTransactions } from './hooks'
import { MODULE_LABELS, TYPE_LABELS } from './labels'
import { AddTransactionDialog } from './AddTransactionDialog'
import { SummaryStrip } from './SummaryStrip'
import { TransactionList } from './TransactionList'

const DEFAULTS = { type: 'all', module: 'all', from: '', to: '', q: '', sort: 'newest', page: '1' }
const field = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm'

export function TransactionsPage() {
  const [p, update] = useUrlState(DEFAULTS)
  const [qText, setQText] = useState(p.q)
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState(false)

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(false), 5000)
    return () => clearTimeout(id)
  }, [notice])

  const type = (TRANSACTION_TYPES as readonly string[]).includes(p.type) ? (p.type as TransactionType) : undefined
  const module = (BUSINESS_MODULES as readonly string[]).includes(p.module) ? (p.module as BusinessModule) : undefined
  const from = isValidISODate(p.from) ? p.from : undefined
  const to = isValidISODate(p.to) ? p.to : undefined
  const sort: TransactionSort = p.sort === 'oldest' ? 'oldest' : 'newest'
  const page = Math.max(1, Number.parseInt(p.page, 10) || 1)
  const rangeInvalid = Boolean(from && to && from > to)

  useEffect(() => {
    const id = setTimeout(() => { if (qText !== p.q) update({ q: qText }) }, 300)
    return () => clearTimeout(id)
  }, [qText, p.q, update])

  const list = useTransactions({ type, module, from, to, q: p.q }, page, sort, !rangeInvalid)
  const summary = useFinanceSummary({ module, from, to }, !rangeInvalid)

  const total = list.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  useEffect(() => {
    if (list.data && page > totalPages) update({ page: String(totalPages) })
  }, [list.data, page, totalPages, update])

  const filtered = Boolean(type || module || from || to || p.q)
  const month = currentMonthRangeIST()

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every income, expense, loan and payment across all four businesses."
        actions={<button type="button" className={`${buttonPrimary} gap-1.5`} onClick={() => setAdding(true)}><Plus size={16} aria-hidden /> Add transaction</button>}
      />
      <div aria-live="polite">
        {notice && <p role="status" className="mb-4 rounded-md bg-sage-soft px-3 py-2 text-sm text-primary">Transaction added.</p>}
      </div>
      <AddTransactionDialog open={adding} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); setNotice(true) }} />


      <SummaryStrip summary={summary.data} loading={summary.isLoading} />
      {summary.isError && (
        <p role="alert" className="mt-2 text-sm text-danger">
          Could not load totals. <button type="button" className="underline" onClick={() => void summary.refetch()}>Try again</button>
        </p>
      )}
      <p className="mt-2 text-xs text-muted">Totals follow the date range and module. They ignore type and search.</p>

      <form className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6" onSubmit={(e) => e.preventDefault()} role="search">
        <label className="col-span-2 text-sm font-medium md:col-span-2">Search description
          <input type="search" value={qText} onChange={(e) => setQText(e.target.value)} className={field} />
        </label>
        <label className="text-sm font-medium">Type
          <select value={type ?? 'all'} onChange={(e) => update({ type: e.target.value })} className={field}>
            <option value="all">All types</option>
            {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Module
          <select value={module ?? 'all'} onChange={(e) => update({ module: e.target.value })} className={field}>
            <option value="all">All modules</option>
            {BUSINESS_MODULES.map((m) => <option key={m} value={m}>{MODULE_LABELS[m]}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">From
          <input type="date" value={from ?? ''} onChange={(e) => update({ from: e.target.value })} className={field} />
        </label>
        <label className="text-sm font-medium">To
          <input type="date" value={to ?? ''} onChange={(e) => update({ to: e.target.value })} className={field} />
        </label>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={buttonSecondary} onClick={() => update({ from: month.from, to: month.to })}>This month</button>
        <button type="button" className={buttonSecondary} onClick={() => update({ from: '', to: '' })}>All time</button>
        <label className="ml-auto flex items-center gap-2 text-sm">Sort
          <select value={sort} onChange={(e) => update({ sort: e.target.value })} className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      <div className="mt-4">
        {rangeInvalid ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">The From date is after the To date. Change one of them.</p>
        ) : list.isLoading ? (
          <p className="py-10 text-center text-sm text-muted" role="status">Loading transactions…</p>
        ) : list.isError ? (
          <div role="alert" className="rounded-md border border-line bg-surface px-6 py-8 text-center">
            <p className="text-sm font-medium">Could not load transactions</p>
            <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
            <button type="button" className={`${buttonPrimary} mt-4`} onClick={() => void list.refetch()}>Try again</button>
          </div>
        ) : total === 0 ? (
          <EmptyState
            title={filtered ? 'No transactions match these filters' : 'No transactions yet'}
            description={filtered ? 'Widen the date range or clear a filter.' : 'Transactions appear here as you record rent, trips, rentals and loans in each business module.'}
            action={filtered ? <button type="button" className={buttonSecondary} onClick={() => { setQText(''); update({ type: 'all', module: 'all', from: '', to: '', q: '' }) }}>Clear filters</button> : undefined}
          />
        ) : (
          <>
            <TransactionList rows={list.data?.rows ?? []} />
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <span className="flex gap-2">
                <button type="button" className={buttonSecondary} disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>Previous</button>
                <button type="button" className={buttonSecondary} disabled={page >= totalPages} onClick={() => update({ page: String(page + 1) })}>Next</button>
              </span>
            </div>
          </>
        )}
      </div>
    </>
  )
}
