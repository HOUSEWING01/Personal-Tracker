import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { AddButton } from '../../components/ui/AddButton'
import { ListToolbar, filterField, filterLabel } from '../../components/ui/ListToolbar'
import { Pagination } from '../../components/ui/Pagination'
import { useUrlState } from '../../hooks/useUrlState'
import { currentMonthRangeIST, isValidISODate } from '../../lib/dates'
import { BUSINESS_MODULES, TRANSACTION_TYPES, type BusinessModule, type TransactionType } from '../../types/finance'
import type { TransactionSort } from '../../services/transactionService'
import { PAGE_SIZE, useFinanceSummary, useTransactions } from './hooks'
import { MODULE_LABELS, TYPE_LABELS } from './labels'
import { AddTransactionDialog } from './AddTransactionDialog'
import { SummaryStrip } from './SummaryStrip'
import { TransactionList } from './TransactionList'
import { Select } from '../../components/forms/Select'
import { DatePicker } from '../../components/forms/DatePicker'

const DEFAULTS = { type: 'all', module: 'all', from: '', to: '', q: '', sort: 'newest', page: '1' }

export function TransactionsPage() {
  const [p, update] = useUrlState(DEFAULTS)
  const [qText, setQText] = useState(p.q)
  const [adding, setAdding] = useState(false)

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
        actions={<AddButton label="Add transaction" onClick={() => setAdding(true)} />}
      />
      <AddTransactionDialog open={adding} onClose={() => setAdding(false)} onSaved={() => setAdding(false)} />

      <SummaryStrip summary={summary.data} loading={summary.isLoading} />
      {summary.isError && (
        <p role="alert" className="mt-2 text-sm text-danger">
          Could not load totals. <button type="button" className="underline" onClick={() => void summary.refetch()}>Try again</button>
        </p>
      )}
      <p className="mt-2 text-xs text-muted">Totals follow the date range and module. They ignore type and search.</p>

      <div className="mt-5">
        <ListToolbar
          searchLabel="Search description" searchValue={qText} onSearch={setQText}
          activeCount={[type, module, from, to, p.q].filter(Boolean).length}
          onClear={() => { setQText(''); update({ type: 'all', module: 'all', from: '', to: '', q: '' }) }}
        >
          <label className={filterLabel}>Type
            <Select value={type ?? 'all'} onChange={(v) => update({ type: v })} className={filterField}>
              <option value="all">All types</option>
              {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </Select>
          </label>
          <label className={filterLabel}>Module
            <Select value={module ?? 'all'} onChange={(v) => update({ module: v })} className={filterField}>
              <option value="all">All modules</option>
              {BUSINESS_MODULES.map((m) => <option key={m} value={m}>{MODULE_LABELS[m]}</option>)}
            </Select>
          </label>
          <label className={filterLabel}>From
            <DatePicker value={from ?? ''} onChange={(v) => update({ from: v })} className={filterField} />
          </label>
          <label className={filterLabel}>To
            <DatePicker value={to ?? ''} onChange={(v) => update({ to: v })} className={filterField} />
          </label>
          <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-4">
            <button type="button" className={buttonSecondary} onClick={() => update({ from: month.from, to: month.to })}>This month</button>
            <button type="button" className={buttonSecondary} onClick={() => update({ from: '', to: '' })}>All time</button>
            <label className="ml-auto flex items-center gap-2 text-sm">Sort
              <Select value={sort} onChange={(v) => update({ sort: v })} className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </Select>
            </label>
          </div>
        </ListToolbar>
      </div>

      <div className="mt-4">
        {rangeInvalid ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">The From date is after the To date. Change one of them.</p>
        ) : list.isLoading ? (
          <p className="py-10 text-center text-sm text-muted" role="status">Loading transactions…</p>
        ) : list.isError ? (
          <div role="alert" className="rounded-lg border border-line bg-surface px-6 py-8 text-center">
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
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={(n) => update({ page: String(n) })} noun="transactions" />
          </>
        )}
      </div>
    </>
  )
}
