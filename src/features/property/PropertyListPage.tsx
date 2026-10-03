import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { AddButton } from '../../components/ui/AddButton'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { Pagination } from '../../components/ui/Pagination'
import { useUrlState } from '../../hooks/useUrlState'
import { todayIST } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import type { PropertyOverview } from '../../types/property'
import { PROPERTY_PAGE_SIZE, useProperties, useRentSync } from './hooks'
import { isOccupied, propertyTotals } from './propertyEngine'
import { Pill } from './StatusBadge'
import { toast } from '../../lib/toast'
import { GodownDialog } from './GodownDialog'

const DEFAULTS = { q: '', due: 'all', page: '1' }

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

  const due = p.due === 'due' ? true : undefined
  const page = Math.max(1, Number.parseInt(p.page, 10) || 1)

  useEffect(() => {
    const id = setTimeout(() => { if (qText !== p.q) update({ q: qText }) }, 300)
    return () => clearTimeout(id)
  }, [qText, p.q, update])

  const sync = useRentSync()
  // "Due" is worked out here (rent outstanding > 0), so it loads the whole list and filters it on screen.
  const list = useProperties({ q: p.q }, due ? 1 : page, sync.isSuccess, due ? 500 : PROPERTY_PAGE_SIZE)
  const shown = due ? (list.data?.rows ?? []).filter((r) => propertyTotals(r).outstandingPaise > 0) : (list.data?.rows ?? [])
  const total = due ? shown.length : (list.data?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / PROPERTY_PAGE_SIZE))
  useEffect(() => {
    if (list.data && page > totalPages) update({ page: String(totalPages) })
  }, [list.data, page, totalPages, update])

  const filtered = Boolean(p.q || due)
  const rows = shown
  const failed = sync.isError || list.isError
  const retry = () => { if (sync.isError) void sync.refetch(); else void list.refetch() }

  return (
    <>
      <PageHeader
        title="Godowns"
        actions={<AddButton label="Add godown" onClick={() => setAdding(true)} />}
      />
      {adding && <GodownDialog open mode="add" onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); toast.success('Godown added'); navigate(`/property/${id}`, { state: { listSearch: search } }) }} />}

      <div role="search" className="rounded-lg border border-line bg-surface p-3 md:p-4">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search" value={qText} onChange={(e) => setQText(e.target.value)}
              aria-label="Search by tenant name" placeholder="Search by tenant name" autoComplete="off" enterKeyHint="search"
              className="w-full rounded-md border border-line bg-surface py-2.5 pl-9 pr-3 text-sm md:py-2"
            />
          </div>
          <button
            type="button" aria-pressed={due === true} onClick={() => update({ due: due ? 'all' : 'due', page: '1' })}
            className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-medium md:py-2 ${due ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-primary hover:bg-sage-soft'}`}
          >Due</button>
        </div>
      </div>

      <div className="mt-4">
        {failed ? (
          <div role="alert" className="rounded-lg border border-line bg-surface px-6 py-8 text-center">
            <p className="text-sm font-medium">Could not load godowns</p>
            <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
            <button type="button" className={`${buttonPrimary} mt-4`} onClick={retry}>Try again</button>
          </div>
        ) : sync.isLoading || list.isLoading ? (
          <ul className="flex flex-col gap-2" role="status" aria-label="Loading godowns">
            {[0, 1, 2].map((i) => <li key={i} className="h-24 animate-pulse rounded-lg border border-line bg-surface" />)}
          </ul>
        ) : total === 0 ? (
          <EmptyState
            title={filtered ? 'No godowns match these filters' : 'No godowns yet'}
            description={filtered ? 'Clear a filter or change the search.' : 'Add a godown with its tenant, rent and advance. Monthly rent is created for you.'}
            action={filtered
              ? <button type="button" className={buttonSecondary} onClick={() => { setQText(''); update({ q: '', due: 'all' }) }}>Clear filters</button>
              : <button type="button" className={buttonPrimary} onClick={() => setAdding(true)}>Add godown</button>}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-line bg-surface md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-canvas/60 text-left text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Tenant</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Monthly rent</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Rent due</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Advance held</th>
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
                          {r.address && <div className="text-xs text-muted">{r.address}</div>}
                        </td>
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
                    {r.address && <p className="mt-1 text-xs text-muted">{r.address}</p>}
                    <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
                      <div className="min-w-0"><dt className="text-muted">Rent</dt><dd className="mt-0.5 break-words text-sm font-medium tabular-nums">{formatINR(r.monthlyRentPaise)}</dd></div>
                      <div className="min-w-0"><dt className="text-muted">Rent due</dt><dd className="mt-0.5 break-words text-sm font-medium tabular-nums">{formatINR(t.outstandingPaise)}</dd></div>
                      <div className="min-w-0"><dt className="text-muted">Advance held</dt><dd className="mt-0.5 break-words text-sm font-medium tabular-nums">{formatINR(t.advanceRemainingPaise)}</dd></div>
                    </dl>
                  </li>
                )
              })}
            </ul>
            {!due && <Pagination page={page} pageSize={PROPERTY_PAGE_SIZE} total={total} onPage={(n) => update({ page: String(n) })} noun="godowns" />}
          </>
        )}
      </div>
    </>
  )
}
