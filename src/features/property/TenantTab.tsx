import { EmptyState } from '../../components/ui/EmptyState'
import { buttonSecondary } from '../../components/ui/FullScreenMessage'
import { formatDate } from '../../lib/dates'
import type { Tenant } from '../../types/property'

export function TenantTab({ tenant, loading, failed, onRetry, onEdit }: {
  tenant: Tenant | null | undefined; loading: boolean; failed: boolean; onRetry: () => void; onEdit: () => void
}) {
  if (failed) {
    return (
      <div role="alert" className="rounded-md border border-line bg-surface px-6 py-6 text-center">
        <p className="text-sm font-medium">Could not load the tenant</p>
        <button type="button" className={`${buttonSecondary} mt-3`} onClick={onRetry}>Try again</button>
      </div>
    )
  }
  if (loading) return <p className="py-8 text-center text-sm text-muted" role="status">Loading tenant…</p>
  if (!tenant) {
    return <EmptyState title="No tenant yet" description="Each property has one tenant. Add them to start monthly rent from their rental start date."
      action={<button type="button" className={buttonSecondary} onClick={onEdit}>Add tenant</button>} />
  }
  const row = (label: string, value: string | null) => (
    <div><dt className="text-xs text-muted">{label}</dt><dd className="mt-0.5 text-sm">{value || '—'}</dd></div>
  )
  return (
    <div className="rounded-md border border-line bg-surface px-4 py-4">
      <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {row('Name', tenant.name)}
        {row('Mobile', tenant.mobile)}
        {row('Rental start', formatDate(tenant.rentalStartDate))}
        {row('Rental end', tenant.rentalEndDate ? formatDate(tenant.rentalEndDate) : 'Ongoing')}
        {row('Address', tenant.address)}
        {row('Notes', tenant.notes)}
      </dl>
      <button type="button" className={`${buttonSecondary} mt-4`} onClick={onEdit}>Edit tenant</button>
    </div>
  )
}
