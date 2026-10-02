import type { ChargeStatus } from './propertyEngine'

const LABEL: Record<ChargeStatus, string> = { paid: 'Paid', partial: 'Part paid', unpaid: 'Unpaid' }
const CLASS: Record<ChargeStatus, string> = { paid: 'bg-sage-soft text-primary', partial: 'bg-gold-soft text-primary', unpaid: 'bg-canvas text-muted' }

/** Status is always spelled out in text, never colour alone. */
export function ChargeStatusBadge({ status, overdue }: { status: ChargeStatus; overdue: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${CLASS[status]}`}>{LABEL[status]}</span>
      {overdue && <span className="inline-block rounded bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">Overdue</span>}
    </span>
  )
}

export function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tone === 'good' ? 'bg-sage-soft text-primary' : 'bg-canvas text-muted'}`}>{children}</span>
}
