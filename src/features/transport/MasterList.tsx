import { useEffect, type ReactNode } from 'react'
import { EmptyState } from '../../components/ui/EmptyState'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { AddButton } from '../../components/ui/AddButton'
import { ListToolbar, filterField, filterLabel } from '../../components/ui/ListToolbar'
import { Pagination } from '../../components/ui/Pagination'
import { TRANSPORT_PAGE_SIZE } from './hooks'
import { Select } from '../../components/forms/Select'

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
  /** Extra filter controls (label + Select) shown in the toolbar next to Status, and how many of them are active. */
  filters?: ReactNode
  filterCount?: number
  filtered: boolean
  onClear: () => void
  onAdd: () => void
  onEdit: (row: T) => void
  /** Optional extra button(s) shown next to Edit in each row (e.g. "Payments"). */
  rowActions?: (row: T) => ReactNode
  emptyHint: string
}

/**
 * Shared list for the Transport, Sheets and Gold screens: search and filters (behind a button on phones), a table on
 * desktop and cards on phones, paging, and a floating "+" on phones for the add action.
 */
export function MasterList<T>(p: Props<T>) {
  const rows = p.data?.rows ?? []
  const total = p.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / TRANSPORT_PAGE_SIZE))

  const { data, page, onPage } = p
  useEffect(() => {
    if (data && page > totalPages) onPage(totalPages)
  }, [data, page, totalPages, onPage])

  const [first, ...rest] = p.columns
  const statusActive = p.status && p.status.value !== 'all' ? 1 : 0
  const activeCount = statusActive + (p.filterCount ?? 0) + (p.qText ? 1 : 0)
  const hasFilters = Boolean(p.status || p.filters)

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <ListToolbar searchLabel={p.searchLabel} searchValue={p.qText} onSearch={p.onSearch} activeCount={activeCount} onClear={p.onClear}>
            {hasFilters ? (
              <>
                {p.status && (
                  <label className={`${filterLabel} col-span-2 md:col-span-1`}>Status
                    <Select value={p.status.value} onChange={(v) => p.status?.onChange(v)} className={filterField}>
                      <option value="all">All</option>
                      {p.status.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </label>
                )}
                {p.filters}
              </>
            ) : undefined}
          </ListToolbar>
        </div>
        <AddButton label={`Add ${p.noun}`} onClick={p.onAdd} />
      </div>

      <div className="mt-4">
        {p.isError ? (
          <div role="alert" className="rounded-lg border border-line bg-surface px-6 py-8 text-center">
            <p className="text-sm font-medium">Could not load {p.noun}s</p>
            <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
            <button type="button" className={`${buttonPrimary} mt-4`} onClick={p.onRetry}>Try again</button>
          </div>
        ) : p.isLoading ? (
          <ul className="flex flex-col gap-2" role="status" aria-label={`Loading ${p.noun}s`}>
            {[0, 1, 2].map((i) => <li key={i} className="h-24 animate-pulse rounded-lg border border-line bg-surface" />)}
          </ul>
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
            <div className="hidden overflow-x-auto rounded-lg border border-line bg-surface md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-canvas/60 text-left text-xs text-muted">
                  <tr>
                    {p.columns.map((c) => (
                      <th key={c.header} scope="col" className={`px-4 py-2.5 font-medium ${c.align === 'right' ? 'text-right' : ''}`}>{c.header}</th>
                    ))}
                    <th scope="col" className="px-4 py-2.5 text-right font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={p.rowKey(r)} className="border-b border-line last:border-0 hover:bg-canvas/50">
                      {p.columns.map((c) => (
                        <td key={c.header} className={`px-4 py-3 align-top ${c.align === 'right' ? 'whitespace-nowrap text-right tabular-nums' : ''}`}>{c.cell(r)}</td>
                      ))}
                      <td className="px-4 py-3 align-top text-right">
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

            <ul className="flex flex-col gap-2.5 md:hidden">
              {rows.map((r) => (
                <li key={p.rowKey(r)} className="rounded-lg border border-line bg-surface p-4">
                  <div className="min-w-0 break-words font-medium">{first?.cell(r)}</div>
                  {rest.length > 0 && (
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-line pt-3 text-xs">
                      {rest.map((c) => (
                        <div key={c.header} className="min-w-0">
                          <dt className="text-muted">{c.header}</dt>
                          <dd className="mt-0.5 break-words text-sm font-medium tabular-nums">{c.cell(r)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <div className="mt-3 grid auto-cols-fr grid-flow-col gap-2 border-t border-line pt-3">
                    {p.rowActions?.(r)}
                    <button type="button" className={buttonSecondary} aria-label={`Edit ${p.rowLabel(r)}`} onClick={() => p.onEdit(r)}>Edit</button>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination page={p.page} pageSize={TRANSPORT_PAGE_SIZE} total={total} onPage={p.onPage} noun={`${p.noun}s`} />
          </>
        )}
      </div>
    </>
  )
}
