import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { AddButton } from '../../components/ui/AddButton'
import { ListToolbar, filterField, filterLabel } from '../../components/ui/ListToolbar'
import { Pagination } from '../../components/ui/Pagination'
import { useUrlState } from '../../hooks/useUrlState'
import { todayIST } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import type { PropertyOverview, PropertyStatus } from '../../types/property'
import { PROPERTY_PAGE_SIZE, useProperties, useRentSync } from './hooks'
import { PROPERTY_TYPE_LABELS } from './labels'
import { isOccupied, propertyTotals } from './propertyEngine'
import { Pill } from './StatusBadge'
import { toast } from '../../lib/toast'
import { PropertyDialog } from './PropertyDialog'
import { Select } from '../../components/forms/Select'

const DEFAULTS = { q: '', status: 'all', page: '1' }

function Occupancy({ p, today }: { p: PropertyOverview; today: string }) {
  if (p.status === 'inactive') return <Pill>Inactive</Pill>
  return isOccupied(p, today) ? <Pill tone="good">Occupied</Pill> : <Pill>Vacant</Pill>
}

export function PropertyListPage() {
  const [p, update] = useUrlState(DEFAULTS)
  const [qText, setQText] = useState(p.q)
  const [adding, setAdding] = useState(false)
  const navigate = useNavigate()
  const { search } = useLocation()
  const today = todayIST()

  const status: PropertyStatus | undefined = p.status === 'active' || p.status === 'inactive' ? p.status : undefined
  const page = Math.max(1, Number.parseInt(p.page, 10) || 1)

  useEffect(() => {
    const id = setTimeout(() => { if (qText !== p.q) update({ q: qText }) }, 300)
    return () => clearTimeout(id)
  }, [qText, p.q, update])

  const sync = useRentSync()
  const list = useProperties({ status, q: p.q }, page, sync.isSuccess)
  const total = list.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PROPERTY_PAGE_SIZE))
  useEffect(() => {
    if (list.data && page > totalPages) update({ page: String(totalPages) })
  }, [list.data, page, totalPages, update])

  const filtered = Boolean(status || p.q)
  const rows = list.data?.rows ?? []
  const failed = sync.isError || list.isError
  const retry = () => { if (sync.isError) void sync.refetch(); else void list.refetch() }

  return (
    <>
      <PageHeader
        title="Property rental"
        description="Properties, their tenants, monthly rent and advance."
        actions={<AddButton label="Add property" onClick={() => setAdding(true)} />}
      />
      <PropertyDialog open={adding} onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); toast.success('Property added'); navigate(`/property/${id}`, { state: { listSearch: search } }) }} />

      <ListToolbar
        searchLabel="Search by name" searchValue={qText} onSearch={setQText}
        activeCount={(status ? 1 : 0) + (p.q ? 1 : 0)} onClear={() => { setQText(''); update({ q: '', status: 'all' }) }}
      >
        <label className={`${filterLabel} col-span-2 md:col-span-1`}>Status
          <Select value={status ?? 'all'} onChange={(v) => update({ status: v })} className={filterField}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </label>
      </ListToolbar>

      <div className="mt-4">
        {failed ? (
          <div role="alert" className="rounded-lg border border-line bg-surface px-6 py-8 text-center">
            <p className="text-sm font-medium">Could not load properties</p>
            <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
            <button type="button" className={`${buttonPrimary} mt-4`} onClick={retry}>Try again</button>
          </div>
        ) : sync.isLoading || list.isLoading ? (
          <ul className="flex flex-col gap-2" role="status" aria-label="Loading properties">
            {[0, 1, 2].map((i) => <li key={i} className="h-24 animate-pulse rounded-lg border border-line bg-surface" />)}
          </ul>
        ) : total === 0 ? (
          <EmptyState
            title={filtered ? 'No properties match these filters' : 'No properties yet'}
            description={filtered ? 'Clear a filter or change the search.' : 'Add a property, then add its tenant to start tracking monthly rent.'}
            action={filtered
              ? <button type="button" className={buttonSecondary} onClick={() => { setQText(''); update({ q: '', status: 'all' }) }}>Clear filters</button>
              : <button type="button" className={buttonPrimary} onClick={() => setAdding(true)}>Add property</button>}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-line bg-surface md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-canvas/60 text-left text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Property</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Tenant</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Monthly rent</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Outstanding</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Advance left</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const t = propertyTotals(r)
                    return (
                      <tr key={r.id} className="border-b border-line last:border-0 hover:bg-canvas/50">
                        <td className="px-4 py-3">
                          <Link to={`/property/${r.id}`} state={{ listSearch: search }} className="font-medium text-primary underline-offset-2 hover:underline">{r.name}</Link>
                          <div className="text-xs text-muted">{PROPERTY_TYPE_LABELS[r.type]}</div>
                        </td>
                        <td className="px-4 py-3">{r.tenantName ?? '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatINR(r.monthlyRentPaise)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{formatINR(t.outstandingPaise)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatINR(t.advanceRemainingPaise)}</td>
                        <td className="px-4 py-3"><Occupancy p={r} today={today} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-2.5 md:hidden">
              {rows.map((r) => {
                const t = propertyTotals(r)
                return (
                  <li key={r.id} className="relative rounded-lg border border-line bg-surface p-4 active:bg-canvas">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/property/${r.id}`} state={{ listSearch: search }} className="min-w-0 break-words font-medium text-primary after:absolute after:inset-0">{r.name}</Link>
                      <Occupancy p={r} today={today} />
                    </div>
                    <p className="mt-1 text-xs text-muted">{PROPERTY_TYPE_LABELS[r.type]} · {r.tenantName ?? 'No tenant'}</p>
                    <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
                      <div className="min-w-0"><dt className="text-muted">Rent</dt><dd className="mt-0.5 break-words text-sm font-medium tabular-nums">{formatINR(r.monthlyRentPaise)}</dd></div>
                      <div className="min-w-0"><dt className="text-muted">Outstanding</dt><dd className="mt-0.5 break-words text-sm font-medium tabular-nums">{formatINR(t.outstandingPaise)}</dd></div>
                      <div className="min-w-0"><dt className="text-muted">Advance left</dt><dd className="mt-0.5 break-words text-sm font-medium tabular-nums">{formatINR(t.advanceRemainingPaise)}</dd></div>
                    </dl>
                  </li>
                )
              })}
            </ul>
            <Pagination page={page} pageSize={PROPERTY_PAGE_SIZE} total={total} onPage={(n) => update({ page: String(n) })} noun="properties" />
          </>
        )}
      </div>
    </>
  )
}
