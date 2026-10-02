import { useEffect, type ReactNode } from 'react'
import { Plus } from '@phosphor-icons/react'
import { EmptyState } from '../../components/ui/EmptyState'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { TRANSPORT_PAGE_SIZE } from './hooks'

export interface Column<T> {
  header: string
  cell: (row: T) => ReactNode
  align?: 'right'
}

interface Props<T> {
  /** Singular and plural nouns for messages, e.g. "vehicle". */
  noun: string
  columns: Column<T>[]
  rowKey: (row: T) => string
  rowLabel: (row: T) => string
  data?: { rows: T[]; total: number }
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  page: number
  onPage: (n: number) => void
  qText: string
  onSearch: (s: string) => void
  searchLabel: string
  status?: { value: string; options: { value: string; label: string }[]; onChange: (s: string) => void }
  filtered: boolean
  onClear: () => void
  onAdd: () => void
  onEdit: (row: T) => void
  /** Optional extra button(s) shown next to Edit in each row (e.g. "Payments"). */
  rowActions?: (row: T) => ReactNode
  emptyHint: string
}

const field = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm'

/** Shared list for the Transport master tabs: search, optional status filter, table (desktop) / cards (mobile), paging. */
export function MasterList<T>(p: Props<T>) {
  const rows = p.data?.rows ?? []
  const total = p.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / TRANSPORT_PAGE_SIZE))

  const { data, page, onPage } = p
  useEffect(() => {
    if (data && page > totalPages) onPage(totalPages)
  }, [data, page, totalPages, onPage])

  const [first, ...rest] = p.columns

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <form className="grid min-w-0 flex-1 grid-cols-2 gap-3 md:max-w-xl" onSubmit={(e) => e.preventDefault()} role="search">
          <label className="col-span-2 text-sm font-medium md:col-span-1">{p.searchLabel}
            <input type="search" value={p.qText} onChange={(e) => p.onSearch(e.target.value)} className={field} />
          </label>
          {p.status && (
            <label className="col-span-2 text-sm font-medium md:col-span-1">Status
              <select value={p.status.value} onChange={(e) => p.status?.onChange(e.target.value)} className={field}>
                <option value="all">All</option>
                {p.status.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          )}
        </form>
        <button type="button" className={`${buttonPrimary} gap-1.5`} onClick={p.onAdd}>
          <Plus size={16} aria-hidden /> Add {p.noun}
        </button>
      </div>

      <div className="mt-4">
        {p.isError ? (
          <div role="alert" className="rounded-md border border-line bg-surface px-6 py-8 text-center">
            <p className="text-sm font-medium">Could not load {p.noun}s</p>
            <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
            <button type="button" className={`${buttonPrimary} mt-4`} onClick={p.onRetry}>Try again</button>
          </div>
        ) : p.isLoading ? (
          <p className="py-10 text-center text-sm text-muted" role="status">Loading {p.noun}s…</p>
        ) : total === 0 ? (
          <EmptyState
            title={p.filtered ? `No ${p.noun}s match these filters` : `No ${p.noun}s yet`}
            description={p.filtered ? 'Clear a filter or change the search.' : p.emptyHint}
            action={p.filtered
              ? <button type="button" className={buttonSecondary} onClick={p.onClear}>Clear filters</button>
              : <button type="button" className={buttonPrimary} onClick={p.onAdd}>Add {p.noun}</button>}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-md border border-line bg-surface md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs text-muted">
                  <tr>
                    {p.columns.map((c) => (
                      <th key={c.header} scope="col" className={`px-4 py-2 font-medium ${c.align === 'right' ? 'text-right' : ''}`}>{c.header}</th>
                    ))}
                    <th scope="col" className="px-4 py-2 text-right font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={p.rowKey(r)} className="border-b border-line last:border-0">
                      {p.columns.map((c) => (
                        <td key={c.header} className={`px-4 py-2.5 ${c.align === 'right' ? 'whitespace-nowrap text-right tabular-nums' : ''}`}>{c.cell(r)}</td>
                      ))}
                      <td className="px-4 py-2.5 text-right">
                        <span className="inline-flex gap-2">
                          {p.rowActions?.(r)}
                          <button type="button" className={buttonSecondary} aria-label={`Edit ${p.rowLabel(r)}`} onClick={() => p.onEdit(r)}>Edit</button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="flex flex-col gap-2 md:hidden">
              {rows.map((r) => (
                <li key={p.rowKey(r)} className="rounded-md border border-line bg-surface px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 font-medium">{first?.cell(r)}</div>
                    <span className="flex shrink-0 gap-2">
                      {p.rowActions?.(r)}
                      <button type="button" className={buttonSecondary} aria-label={`Edit ${p.rowLabel(r)}`} onClick={() => p.onEdit(r)}>Edit</button>
                    </span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    {rest.map((c) => (
                      <div key={c.header}><dt className="text-muted">{c.header}</dt><dd className="font-medium tabular-nums">{c.cell(r)}</dd></div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted">{(p.page - 1) * TRANSPORT_PAGE_SIZE + 1}–{Math.min(p.page * TRANSPORT_PAGE_SIZE, total)} of {total}</span>
              <span className="flex gap-2">
                <button type="button" className={buttonSecondary} disabled={p.page <= 1} onClick={() => p.onPage(p.page - 1)}>Previous</button>
                <button type="button" className={buttonSecondary} disabled={p.page >= totalPages} onClick={() => p.onPage(p.page + 1)}>Next</button>
              </span>
            </div>
          </>
        )}
      </div>
    </>
  )
}
