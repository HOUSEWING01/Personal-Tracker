import { useState } from 'react'
import type { Customer } from '../../types/transport'
import { CustomerDialog } from './CustomerDialog'
import { useCustomers } from './hooks'
import { MasterList, type Column } from './MasterList'
import { useListControls } from './useListControls'

const columns: Column<Customer>[] = [
  { header: 'Customer', cell: (c) => <span className="font-medium">{c.name}</span> },
  { header: 'Mobile', cell: (c) => c.mobile ?? '—' },
  { header: 'Address', cell: (c) => c.address ?? '—' },
]

export function CustomersTab() {
  const c = useListControls()
  const list = useCustomers({ q: c.q }, c.page)
  const [dialog, setDialog] = useState<{ customer?: Customer } | null>(null)

  return (
    <>
      <CustomerDialog key={dialog?.customer?.id ?? 'new'} open={dialog !== null} customer={dialog?.customer} onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />
      <MasterList
        noun="customer" columns={columns} rowKey={(x) => x.id} rowLabel={(x) => x.name}
        data={list.data} isLoading={list.isLoading} isError={list.isError} onRetry={() => void list.refetch()}
        page={c.page} onPage={c.setPage} qText={c.qText} onSearch={c.setQText} searchLabel="Search by name or mobile"
        filtered={Boolean(c.q)} onClear={c.clear}
        onAdd={() => setDialog({})} onEdit={(customer) => setDialog({ customer })}
        emptyHint="Customers are shared across the app, so each person is added once and reused for trips and other modules."
      />
    </>
  )
}
