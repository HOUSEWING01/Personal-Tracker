import { useState } from 'react'
import { formatDate, todayIST } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { MAINTENANCE_KINDS, type MaintenanceKind, type MaintenanceLog } from '../../types/transport'
import { Pill } from '../property/StatusBadge'
import { useMaintenance, useMaintenanceDue } from './hooks'
import { MAINTENANCE_KIND_LABELS } from './labels'
import { MaintenanceDialog } from './MaintenanceDialog'
import { MasterList, type Column } from './MasterList'
import { maintenanceDueLabel, maintenanceDueState } from './transportEngine'
import { useListControls } from './useListControls'
import { VehicleFilter } from './VehicleFilter'

const columns: Column<MaintenanceLog>[] = [
  {
    header: 'Maintenance',
    cell: (m) => (<><span className="font-medium">{MAINTENANCE_KIND_LABELS[m.kind]} · {formatDate(m.serviceDate)}</span><div className="text-xs font-normal text-muted">{m.vehicleName} ({m.vehicleRegistration})</div></>),
  },
  { header: 'Amount', align: 'right', cell: (m) => <span className="font-medium">{formatINR(m.amountPaise)}</span> },
  { header: 'Garage / vendor', cell: (m) => m.vendor ?? '—' },
  { header: 'Odometer', align: 'right', cell: (m) => (m.odometerKm === null ? '—' : `${m.odometerKm.toLocaleString('en-IN')} km`) },
  { header: 'Next due', cell: (m) => (m.nextDueDate ? formatDate(m.nextDueDate) : '—') },
]

/** Overdue and due-soon items (the latest entry of each kind per vehicle). Nothing is shown when nothing needs attention. */
function DueList() {
  const due = useMaintenanceDue()
  const today = todayIST()
  const flagged = (due.data ?? [])
    .map((d) => ({ d, state: maintenanceDueState(d.nextDueDate, today) }))
    .filter((x): x is { d: (typeof x)['d']; state: NonNullable<(typeof x)['state']> } => x.state !== null)
  if (flagged.length === 0) return null
  return (
    <section aria-label="Maintenance due" className="mb-4 rounded-lg border border-line bg-gold-soft p-4">
      <h2 className="text-sm font-semibold">Needs attention</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {flagged.map(({ d, state }) => (
          <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span><span className="font-medium">{MAINTENANCE_KIND_LABELS[d.kind]}</span> · {d.vehicleName} ({d.vehicleRegistration})</span>
            <span className={`tabular-nums ${state.kind === 'overdue' ? 'font-medium text-danger' : ''}`}>{maintenanceDueLabel(state)} · {formatDate(d.nextDueDate)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Shown on a collapsed phone card. */
function summary(m: MaintenanceLog) {
  const state = maintenanceDueState(m.nextDueDate, todayIST())
  return (
    <>
      <span className="tabular-nums">{formatINR(m.amountPaise)}</span>
      {m.nextDueDate && <Pill tone={state?.kind === 'overdue' ? 'neutral' : 'good'}>{state ? maintenanceDueLabel(state) : `Next ${formatDate(m.nextDueDate)}`}</Pill>}
    </>
  )
}

export function MaintenanceTab() {
  const c = useListControls()
  const kind = (MAINTENANCE_KINDS as readonly string[]).includes(c.status) ? (c.status as MaintenanceKind) : undefined
  const vehicleId = c.vehicle !== 'all' ? c.vehicle : undefined
  const list = useMaintenance({ vehicleId, kind, q: c.q }, c.page)
  const [dialog, setDialog] = useState<{ entry?: MaintenanceLog } | null>(null)

  return (
    <>
      <MaintenanceDialog key={dialog?.entry?.id ?? 'new'} open={dialog !== null} entry={dialog?.entry} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />
      <DueList />
      <MasterList
        filters={<VehicleFilter value={vehicleId ?? 'all'} onChange={c.setVehicle} />} filterCount={vehicleId ? 1 : 0}
        noun="maintenance entry" columns={columns} rowKey={(m) => m.id} rowLabel={(m) => `${MAINTENANCE_KIND_LABELS[m.kind]} for ${m.vehicleName} on ${formatDate(m.serviceDate)}`}
        data={list.data} isLoading={list.isLoading} isError={list.isError} onRetry={() => void list.refetch()}
        page={c.page} onPage={c.setPage} qText={c.qText} onSearch={c.setQText} searchLabel="Search by garage or notes"
        status={{ label: 'Type', value: kind ?? 'all', onChange: c.setStatus, options: MAINTENANCE_KINDS.map((k) => ({ value: k, label: MAINTENANCE_KIND_LABELS[k] })) }}
        filtered={Boolean(kind || vehicleId || c.q)} onClear={c.clear}
        onAdd={() => setDialog({})} onEdit={(entry) => setDialog({ entry })} collapsedSummary={summary}
        emptyHint="Record services, repairs, tyres, insurance and permits. Each posts to Finance as an expense and counts against the vehicle's profit."
      />
    </>
  )
}
