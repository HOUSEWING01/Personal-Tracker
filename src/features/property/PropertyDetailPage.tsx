import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, PencilSimple, Plus } from '@phosphor-icons/react'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { useUrlState } from '../../hooks/useUrlState'
import { todayIST } from '../../lib/dates'
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
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(t)
  }, [notice])

  const property = useProperty(id, Boolean(id))
  const tenant = useTenant(id)
  const back = <Link to={`/property${listSearch}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"><ArrowLeft size={16} aria-hidden /> All properties</Link>

  if (property.isLoading) return <>{back}<p className="py-10 text-center text-sm text-muted" role="status">Loading property…</p></>
  if (property.isError) {
    return (
      <>{back}
        <div role="alert" className="rounded-md border border-line bg-surface px-6 py-8 text-center">
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
  const stat = (label: string, value: string) => (
    <div className="rounded-md border border-line bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt><dd className="mt-1 text-base font-semibold tabular-nums">{value}</dd>
    </div>
  )

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
      <div aria-live="polite">{notice && <p role="status" className="mb-4 rounded-md bg-sage-soft px-3 py-2 text-sm text-primary">{notice}</p>}</div>

      <PropertyDialog open={editing} property={prop} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setNotice('Property saved.') }} />
      <TenantDialog open={tenantOpen} propertyId={prop.id} tenant={tenant.data ?? null} onClose={() => setTenantOpen(false)} onSaved={() => { setTenantOpen(false); setNotice('Tenant saved.') }} />
      <AdvanceDialog open={advanceOpen} propertyId={prop.id} remainingPaise={totals.advanceRemainingPaise} onClose={() => setAdvanceOpen(false)} onSaved={() => { setAdvanceOpen(false); setNotice('Advance entry saved.') }} />

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat('Monthly rent', formatINR(prop.monthlyRentPaise))}
        {stat('Rent outstanding', formatINR(totals.outstandingPaise))}
        {stat('Advance remaining', formatINR(totals.advanceRemainingPaise))}
        {stat('Tenant', prop.tenantName ?? 'None')}
      </dl>

      <div className="mt-6 flex items-end justify-between gap-3 border-b border-line">
        <div role="tablist" aria-label="Property sections" className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls="tab-panel"
              onClick={() => update({ tab: t.id })}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'}`}
            >{t.label}</button>
          ))}
        </div>
        {tab === 'advance' && <button type="button" className={`${buttonSecondary} mb-1.5 gap-1.5`} onClick={() => setAdvanceOpen(true)}><Plus size={16} aria-hidden /> Add advance entry</button>}
      </div>

      <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-4">
        {tab === 'rent' && <RentTab propertyId={prop.id} hasTenant={Boolean(prop.tenantName)} onNotice={setNotice} />}
        {tab === 'advance' && <AdvanceTab property={prop} />}
        {tab === 'tenant' && (
          <TenantTab tenant={tenant.data} loading={tenant.isLoading} failed={tenant.isError} onRetry={() => void tenant.refetch()} onEdit={() => setTenantOpen(true)} />
        )}
      </div>
    </>
  )
}
