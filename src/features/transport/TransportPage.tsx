import { PageHeader } from '../../components/ui/PageHeader'
import { TabBar } from '../../components/ui/TabBar'
import { useUrlState } from '../../hooks/useUrlState'
import { CustomersTab } from './CustomersTab'
import { DriversTab } from './DriversTab'
import { LoansTab } from './LoansTab'
import { MaintenanceTab } from './MaintenanceTab'
import { ProfitTab } from './ProfitTab'
import { TripsTab } from './TripsTab'
import { TRANSPORT_URL_DEFAULTS } from './useListControls'
import { VehiclesTab } from './VehiclesTab'

const TABS = [
  { id: 'trips', label: 'Trips' },
  { id: 'loans', label: 'Loans' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'profit', label: 'Profit' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'customers', label: 'Customers' },
] as const
type TabId = (typeof TABS)[number]['id']

export function TransportPage() {
  const [p, update] = useUrlState(TRANSPORT_URL_DEFAULTS)
  const tab: TabId = TABS.some((t) => t.id === p.tab) ? (p.tab as TabId) : 'trips'

  const selectTab = (id: string) => update({ tab: id, q: '', status: 'all', vehicle: 'all', from: '', to: '', page: '1' })

  return (
    <>
      <PageHeader title="Transport" />
      <TabBar tabs={TABS} current={tab} onSelect={selectTab} label="Transport sections" idPrefix="tr-tab-" panelId="tr-panel" />
      <div role="tabpanel" id="tr-panel" tabIndex={0} aria-labelledby={`tr-tab-${tab}`}>
        {tab === 'trips' && <TripsTab />}
        {tab === 'loans' && <LoansTab />}
        {tab === 'maintenance' && <MaintenanceTab />}
        {tab === 'profit' && <ProfitTab />}
        {tab === 'vehicles' && <VehiclesTab />}
        {tab === 'drivers' && <DriversTab />}
        {tab === 'customers' && <CustomersTab />}
      </div>
    </>
  )
}
