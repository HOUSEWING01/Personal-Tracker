import { useState } from 'react'
import type { Driver, DriverStatus } from '../../types/transport'
import { Pill } from '../property/StatusBadge'
import { DriverDialog } from './DriverDialog'
import { useDrivers } from './hooks'
import { DRIVER_STATUS_LABELS } from './labels'
import { MasterList, type Column } from './MasterList'
import { useListControls } from './useListControls'

const columns: Column<Driver>[] = [
  { header: 'Driver', cell: (d) => <span className="font-medium">{d.name}</span> },
  { header: 'Mobile', cell: (d) => d.mobile ?? '—' },
  { header: 'Address', cell: (d) => d.address ?? '—' },
  { header: 'Status', cell: (d) => <Pill tone={d.status === 'active' ? 'good' : 'neutral'}>{DRIVER_STATUS_LABELS[d.status]}</Pill> },
]

export function DriversTab() {
  const c = useListControls()
  const status: DriverStatus | undefined = c.status === 'active' || c.status === 'inactive' ? c.status : undefined
  const list = useDrivers({ status, q: c.q }, c.page)
  const [dialog, setDialog] = useState<{ driver?: Driver } | null>(null)

  return (
    <>
      <DriverDialog key={dialog?.driver?.id ?? 'new'} open={dialog !== null} driver={dialog?.driver} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />
      <MasterList
        noun="driver" columns={columns} rowKey={(d) => d.id} rowLabel={(d) => d.name}
        data={list.data} isLoading={list.isLoading} isError={list.isError} onRetry={() => void list.refetch()}
        page={c.page} onPage={c.setPage} qText={c.qText} onSearch={c.setQText} searchLabel="Search by name or mobile"
        status={{ value: status ?? 'all', onChange: c.setStatus, options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] }}
        filtered={Boolean(status || c.q)} onClear={c.clear}
        onAdd={() => setDialog({})} onEdit={(driver) => setDialog({ driver })}
        emptyHint="Add the drivers who run your vehicles. Their pay is entered per trip later."
      />
    </>
  )
}
