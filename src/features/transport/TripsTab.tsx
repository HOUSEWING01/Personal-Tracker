import { useState } from 'react'
import { formatDate } from '../../lib/dates'
import { formatINR } from '../../lib/money'
import { TRIP_STATUSES, type Trip, type TripStatus } from '../../types/transport'
import { Pill } from '../property/StatusBadge'
import { useTrips } from './hooks'
import { TRIP_STATUS_LABELS } from './labels'
import { MasterList, type Column } from './MasterList'
import { tripOperatingProfitPaise, tripRevenuePaise } from './transportEngine'
import { TripDialog } from './TripDialog'
import { useListControls } from './useListControls'
import { VehicleFilter } from './VehicleFilter'

const columns: Column<Trip>[] = [
  {
    header: 'Trip',
    cell: (t) => (<><span className="font-medium">{t.fromLocation} → {t.toLocation}</span><div className="text-xs font-normal text-muted">{formatDate(t.tripDate)} · {t.vehicleName} ({t.vehicleRegistration})</div></>),
  },
  { header: 'Customer', cell: (t) => (<>{t.customerName}<div className="text-xs text-muted">Driver: {t.driverName}</div></>) },
  { header: 'Distance', align: 'right', cell: (t) => `${t.distanceKm} km × ${formatINR(t.ratePerKmPaise)}` },
  { header: 'Revenue', align: 'right', cell: (t) => <span className="font-medium">{formatINR(tripRevenuePaise(t))}</span> },
  { header: 'Driver payment', align: 'right', cell: (t) => formatINR(t.driverPaymentPaise) },
  { header: 'Fuel', align: 'right', cell: (t) => formatINR(t.fuelPaise) },
  { header: 'Toll', align: 'right', cell: (t) => formatINR(t.tollPaise) },
  { header: 'Operating profit', align: 'right', cell: (t) => { const p = tripOperatingProfitPaise(t); return <span className={`font-medium ${p < 0 ? 'text-danger' : ''}`}>{p < 0 ? '−' : ''}{formatINR(Math.abs(p))}</span> } },
  { header: 'Status', cell: (t) => <Pill tone={t.status === 'completed' ? 'good' : 'neutral'}>{TRIP_STATUS_LABELS[t.status]}</Pill> },
]

export function TripsTab() {
  const c = useListControls()
  const status = (TRIP_STATUSES as readonly string[]).includes(c.status) ? (c.status as TripStatus) : undefined
  const vehicleId = c.vehicle !== 'all' ? c.vehicle : undefined
  const list = useTrips({ status, vehicleId, q: c.q }, c.page)
  const [dialog, setDialog] = useState<{ trip?: Trip } | null>(null)

  return (
    <>
      <TripDialog key={dialog?.trip?.id ?? 'new'} open={dialog !== null} trip={dialog?.trip} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />
      <VehicleFilter value={vehicleId ?? 'all'} onChange={c.setVehicle} />
      <MasterList
        noun="trip" columns={columns} rowKey={(t) => t.id} rowLabel={(t) => `${t.fromLocation} to ${t.toLocation}`}
        data={list.data} isLoading={list.isLoading} isError={list.isError} onRetry={() => void list.refetch()}
        page={c.page} onPage={c.setPage} qText={c.qText} onSearch={c.setQText} searchLabel="Search by place or notes"
        status={{ value: status ?? 'all', onChange: c.setStatus, options: TRIP_STATUSES.map((s) => ({ value: s, label: TRIP_STATUS_LABELS[s] })) }}
        filtered={Boolean(status || vehicleId || c.q)} onClear={c.clear}
        onAdd={() => setDialog({})} onEdit={(trip) => setDialog({ trip })}
        emptyHint="Add a trip with its vehicle, driver, customer, distance and rate. Completed trips post to Finance."
      />
    </>
  )
}
