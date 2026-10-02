import { PageHeader } from '../../components/ui/PageHeader'
import { tabsKeyDown } from '../../components/ui/tabsKeys'
import { useUrlState } from '../../hooks/useUrlState'
import { CustomersTab } from './CustomersTab'
import { DriversTab } from './DriversTab'
import { FuelTab } from './FuelTab'
import { LoansTab } from './LoansTab'
import { ProfitTab } from './ProfitTab'
import { TollsTab } from './TollsTab'
import { TripsTab } from './TripsTab'
import { TRANSPORT_URL_DEFAULTS } from './useListControls'
import { VehiclesTab } from './VehiclesTab'

const TABS = [
  { id: 'trips', label: 'Trips' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'tolls', label: 'Tolls' },
  { id: 'loans', label: 'Loans' },
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
      <PageHeader title="Transport" description="Trips, fuel, tolls, vehicle loans, vehicles, drivers and customers. and profit." />
      <div role="tablist" aria-label="Transport sections" onKeyDown={tabsKeyDown(TABS.map((t) => t.id), tab, 'tr-tab-', selectTab)} className="mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line pb-px">
        {TABS.map((t) => {
          const selected = t.id === tab
          return (
            <button
              key={t.id} type="button" role="tab" id={`tr-tab-${t.id}`} aria-selected={selected} aria-controls="tr-panel" tabIndex={selected ? 0 : -1}
              className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${selected ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'}`}
              onClick={() => selectTab(t.id)}
            >{t.label}</button>
          )
        })}
      </div>
      <div role="tabpanel" id="tr-panel" tabIndex={0} aria-labelledby={`tr-tab-${tab}`}>
        {tab === 'trips' && <TripsTab />}
        {tab === 'fuel' && <FuelTab />}
        {tab === 'tolls' && <TollsTab />}
        {tab === 'loans' && <LoansTab />}
        {tab === 'profit' && <ProfitTab />}
        {tab === 'vehicles' && <VehiclesTab />}
        {tab === 'drivers' && <DriversTab />}
        {tab === 'customers' && <CustomersTab />}
      </div>
    </>
  )
}
