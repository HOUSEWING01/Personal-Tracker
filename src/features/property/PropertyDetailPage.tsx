import { TabBar } from '../../components/ui/TabBar'
import { StatTile, statGrid } from '../../components/ui/StatTile'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, PencilSimple, Plus } from '@phosphor-icons/react'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { useUrlState } from '../../hooks/useUrlState'
import { todayIST } from '../../lib/dates'
import { toast } from '../../lib/toast'
import { formatINR } from '../../lib/money'
import { useProperty, useTenant } from './hooks'
import { PROPERTY_TYPE_LABELS } from './labels'
import { isOccupied, propertyTotals } from './propertyEngine'
import { AdvanceDialog } from './AdvanceDialog'
import { AdvanceTab } from './AdvanceTab'
import { PropertyDialog } from './PropertyDialog'
import { RentTab } from './RentTab'
import { Pill } from './StatusBadge'
import { TenantDialog } from './TenantDialog'
import { TenantTab } from './TenantTab'

const TABS = [{ id: 'rent', label: 'Rent' }, { id: 'advance', label: 'Advance' }, { id: 'tenant', label: 'Tenant' }] as const
type TabId = (typeof TABS)[number]['id']

export function PropertyDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const listSearch = (location.state as { listSearch?: string } | null)?.listSearch ?? ''
  const [p, update] = useUrlState({ tab: 'rent' })
  const tab: TabId = TABS.some((t) => t.id === p.tab) ? (p.tab as TabId) : 'rent'
  const [editing, setEditing] = useState(false)
  const [tenantOpen, setTenantOpen] = useState(false)
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const setNotice = (message: string) => { toast.success(message) }

  const property = useProperty(id, Boolean(id))
  const tenant = useTenant(id)
  const back = <Link to={`/property${listSearch}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"><ArrowLeft size={16} aria-hidden /> All properties</Link>

  if (property.isLoading) return <>{back}<p className="py-10 text-center text-sm text-muted" role="status">Loading property…</p></>
  if (property.isError) {
    return (
      <>{back}
        <div role="alert" className="rounded-lg border border-line bg-surface px-6 py-8 text-center">
          <p className="text-sm font-medium">Could not load this property</p>
          <button type="button" className={`${buttonPrimary} mt-4`} onClick={() => void property.refetch()}>Try again</button>
        </div>
      </>
    )
  }
  const prop = property.data
  if (!prop) return <>{back}<EmptyState title="Property not found" description="It may have been removed, or the link is wrong." /></>

  const totals = propertyTotals(prop)
  const occupied = isOccupied(prop, todayIST())
  return (
    <>
      {back}
      <PageHeader
        title={prop.name}
        description={[PROPERTY_TYPE_LABELS[prop.type], prop.address].filter(Boolean).join(' · ')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {prop.status === 'inactive' ? <Pill>Inactive</Pill> : occupied ? <Pill tone="good">Occupied</Pill> : <Pill>Vacant</Pill>}
            <button type="button" className={`${buttonSecondary} gap-1.5`} onClick={() => setEditing(true)}><PencilSimple size={16} aria-hidden /> Edit property</button>
          </div>
        }
      />
      <PropertyDialog open={editing} property={prop} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setNotice('Property saved.') }} />
      <TenantDialog open={tenantOpen} propertyId={prop.id} tenant={tenant.data ?? null} onClose={() => setTenantOpen(false)} onSaved={() => { setTenantOpen(false); setNotice('Tenant saved.') }} />
      <AdvanceDialog open={advanceOpen} propertyId={prop.id} remainingPaise={totals.advanceRemainingPaise} onClose={() => setAdvanceOpen(false)} onSaved={() => { setAdvanceOpen(false); setNotice('Advance entry saved.') }} />

      <dl className={statGrid}>
        <StatTile label="Monthly rent" value={formatINR(prop.monthlyRentPaise)} />
        <StatTile label="Rent outstanding" value={formatINR(totals.outstandingPaise)} />
        <StatTile label="Advance remaining" value={formatINR(totals.advanceRemainingPaise)} />
        <StatTile label="Tenant" value={prop.tenantName ?? 'None'} />
      </dl>

      <div className="mt-6">
        <TabBar tabs={TABS} current={tab} onSelect={(id) => update({ tab: id })} label="Property sections" idPrefix="tab-" panelId="tab-panel" />
      </div>
      {tab === 'advance' && (
        <div className="-mt-1 mb-4 flex">
          <button type="button" className={`${buttonSecondary} w-full gap-1.5 sm:w-auto`} onClick={() => setAdvanceOpen(true)}><Plus size={16} aria-hidden /> Add advance entry</button>
        </div>
      )}

      <div id="tab-panel" tabIndex={0} role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-0">
        {tab === 'rent' && <RentTab propertyId={prop.id} hasTenant={Boolean(prop.tenantName)} onNotice={setNotice} />}
        {tab === 'advance' && <AdvanceTab property={prop} />}
        {tab === 'tenant' && (
          <TenantTab tenant={tenant.data} loading={tenant.isLoading} failed={tenant.isError} onRetry={() => void tenant.refetch()} onEdit={() => setTenantOpen(true)} />
        )}
      </div>
    </>
  )
}
