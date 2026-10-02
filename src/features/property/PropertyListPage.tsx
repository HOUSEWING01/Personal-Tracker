import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { useUrlState } from '../../hooks/useUrlState'
import { todayIST } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import type { PropertyOverview, PropertyStatus } from '../../types/property'
import { PROPERTY_PAGE_SIZE, useProperties, useRentSync } from './hooks'
import { PROPERTY_TYPE_LABELS } from './labels'
import { isOccupied, propertyTotals } from './propertyEngine'
import { Pill } from './StatusBadge'
import { PropertyDialog } from './PropertyDialog'
import { Select } from '../../components/forms/Select'

const DEFAULTS = { q: '', status: 'all', page: '1' }
const field = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm'

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
        actions={<button type="button" className={`${buttonPrimary} gap-1.5`} onClick={() => setAdding(true)}><Plus size={16} aria-hidden /> Add property</button>}
      />
      <PropertyDialog open={adding} onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); navigate(`/property/${id}`, { state: { listSearch: search } }) }} />

      <form className="grid grid-cols-2 gap-3 md:grid-cols-4" onSubmit={(e) => e.preventDefault()} role="search">
        <label className="col-span-2 text-sm font-medium">Search by name
          <input type="search" value={qText} onChange={(e) => setQText(e.target.value)} className={field} />
        </label>
        <label className="col-span-2 text-sm font-medium md:col-span-1">Status
          <Select value={status ?? 'all'} onChange={(v) => update({ status: v })} className={field}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </label>
      </form>

      <div className="mt-4">
        {failed ? (
          <div role="alert" className="rounded-md border border-line bg-surface px-6 py-8 text-center">
            <p className="text-sm font-medium">Could not load properties</p>
            <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
            <button type="button" className={`${buttonPrimary} mt-4`} onClick={retry}>Try again</button>
          </div>
        ) : sync.isLoading || list.isLoading ? (
          <p className="py-10 text-center text-sm text-muted" role="status">Loading properties…</p>
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
            <div className="hidden overflow-x-auto rounded-md border border-line bg-surface md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Property</th>
                    <th scope="col" className="px-4 py-2 font-medium">Tenant</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Monthly rent</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Outstanding</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Advance left</th>
                    <th scope="col" className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const t = propertyTotals(r)
                    return (
                      <tr key={r.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-2.5">
                          <Link to={`/property/${r.id}`} state={{ listSearch: search }} className="font-medium text-primary underline-offset-2 hover:underline">{r.name}</Link>
                          <div className="text-xs text-muted">{PROPERTY_TYPE_LABELS[r.type]}</div>
                        </td>
                        <td className="px-4 py-2.5">{r.tenantName ?? '—'}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatINR(r.monthlyRentPaise)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums">{formatINR(t.outstandingPaise)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatINR(t.advanceRemainingPaise)}</td>
                        <td className="px-4 py-2.5"><Occupancy p={r} today={today} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-2 md:hidden">
              {rows.map((r) => {
                const t = propertyTotals(r)
                return (
                  <li key={r.id} className="rounded-md border border-line bg-surface px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/property/${r.id}`} state={{ listSearch: search }} className="font-medium text-primary">{r.name}</Link>
                      <Occupancy p={r} today={today} />
                    </div>
                    <p className="mt-1 text-xs text-muted">{PROPERTY_TYPE_LABELS[r.type]} · {r.tenantName ?? 'No tenant'}</p>
                    <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div><dt className="text-muted">Rent</dt><dd className="font-medium tabular-nums">{formatINR(r.monthlyRentPaise)}</dd></div>
                      <div><dt className="text-muted">Outstanding</dt><dd className="font-medium tabular-nums">{formatINR(t.outstandingPaise)}</dd></div>
                      <div><dt className="text-muted">Advance left</dt><dd className="font-medium tabular-nums">{formatINR(t.advanceRemainingPaise)}</dd></div>
                    </dl>
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted">{(page - 1) * PROPERTY_PAGE_SIZE + 1}–{Math.min(page * PROPERTY_PAGE_SIZE, total)} of {total}</span>
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
