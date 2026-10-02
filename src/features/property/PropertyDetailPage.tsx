import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, PencilSimple, Plus } from '@phosphor-icons/react'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatTile, statGrid } from '../../components/ui/StatTile'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { todayIST, formatDate } from '../../lib/dates'
import { toast } from '../../lib/toast'
import { formatINR } from '../../lib/money'
import { useProperty, useTenant } from './hooks'
import { isOccupied, propertyTotals } from './propertyEngine'
import { AdvanceDialog } from './AdvanceDialog'
import { AdvanceTab } from './AdvanceTab'
import { GodownDialog, type GodownMode } from './GodownDialog'
import { LeavingDialog } from './LeavingDialog'
import { RentTab } from './RentTab'
import { Pill } from './StatusBadge'

/** One godown on one screen: who rents it, what is due, the advance held, then the rent months and the advance history. */
export function PropertyDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const listSearch = (location.state as { listSearch?: string } | null)?.listSearch ?? ''
  const [godownMode, setGodownMode] = useState<GodownMode | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [advanceOpen, setAdvanceOpen] = useState(false)

  const property = useProperty(id, Boolean(id))
  const tenant = useTenant(id)
  const back = <Link to={`/property${listSearch}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"><ArrowLeft size={16} aria-hidden /> All godowns</Link>

  if (property.isLoading) return <>{back}<p className="py-10 text-center text-sm text-muted" role="status">Loading godown…</p></>
  if (property.isError) {
    return (
      <>{back}
        <div role="alert" className="rounded-lg border border-line bg-surface px-6 py-8 text-center">
          <p className="text-sm font-medium">Could not load this godown</p>
          <button type="button" className={`${buttonPrimary} mt-4`} onClick={() => void property.refetch()}>Try again</button>
        </div>
      </>
    )
  }
  const prop = property.data
  if (!prop) return <>{back}<EmptyState title="Godown not found" description="It may have been removed, or the link is wrong." /></>

  const totals = propertyTotals(prop)
  const occupied = isOccupied(prop, todayIST())
  const t = tenant.data
  return (
    <>
      {back}
      <PageHeader
        title={prop.name}
        description={[t?.mobile, prop.address].filter(Boolean).join(' · ') || undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {prop.status === 'inactive' ? <Pill>Inactive</Pill> : occupied ? <Pill tone="good">Occupied</Pill> : <Pill>Vacant</Pill>}
            <button type="button" className={`${buttonSecondary} gap-1.5`} onClick={() => setGodownMode('edit')}><PencilSimple size={16} aria-hidden /> Edit</button>
            {occupied && t
              ? <button type="button" className={buttonSecondary} onClick={() => setLeaving(true)}>Tenant leaving</button>
              : <button type="button" className={buttonPrimary} onClick={() => setGodownMode('relet')}>New tenant</button>}
          </div>
        }
      />
      {godownMode && (
        <GodownDialog
          open mode={godownMode} property={prop} tenant={t}
          onClose={() => setGodownMode(null)}
          onSaved={() => { setGodownMode(null); toast.success(godownMode === 'relet' ? 'New tenant saved' : 'Godown saved') }}
        />
      )}
      {t && (
        <LeavingDialog
          open={leaving} propertyId={prop.id} tenant={t} advancePaise={totals.advanceRemainingPaise} outstandingPaise={totals.outstandingPaise}
          onClose={() => setLeaving(false)} onSaved={() => { setLeaving(false); toast.success('Tenancy ended') }}
        />
      )}
      <AdvanceDialog open={advanceOpen} propertyId={prop.id} remainingPaise={totals.advanceRemainingPaise} onClose={() => setAdvanceOpen(false)} onSaved={() => { setAdvanceOpen(false); toast.success('Advance entry saved') }} />

      <dl className={statGrid}>
        <StatTile label="Monthly rent" value={formatINR(prop.monthlyRentPaise)} />
        <StatTile label="Rent due" value={formatINR(totals.outstandingPaise)} negative={totals.outstandingPaise > 0} />
        <StatTile label="Advance held" value={formatINR(totals.advanceRemainingPaise)} />
        <StatTile label="Rented since" value={t ? formatDate(t.rentalStartDate) : '—'} hint={t?.rentalEndDate ? `Left ${formatDate(t.rentalEndDate)}` : undefined} />
      </dl>

      <section className="mt-8" aria-labelledby="rent-h">
        <h2 id="rent-h" className="mb-3 text-base font-semibold">Rent</h2>
        <RentTab propertyId={prop.id} hasTenant={Boolean(prop.tenantName)} onNotice={(m) => toast.success(m)} />
      </section>

      <section className="mt-8" aria-labelledby="adv-h">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="adv-h" className="text-base font-semibold">Advance</h2>
          <button type="button" className={`${buttonSecondary} gap-1.5`} onClick={() => setAdvanceOpen(true)}><Plus size={16} aria-hidden /> Add advance</button>
        </div>
        <AdvanceTab property={prop} />
      </section>
    </>
  )
}
