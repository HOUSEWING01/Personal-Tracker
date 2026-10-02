import { useTripOptions } from './hooks'
import { Select } from '../../components/forms/Select'

const field = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm'

/** "All vehicles" picker shown above the Trips, Fuel and Tolls lists. The choice lives in the URL (`vehicle`). */
export function VehicleFilter({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const options = useTripOptions()
  return (
    <div className="mb-3 max-w-xs">
      <label className="text-sm font-medium">Vehicle
        <Select value={value} onChange={(v) => onChange(v)} className={field}>
          <option value="all">All vehicles</option>
          {(options.data?.vehicles ?? []).map((v) => <option key={v.id} value={v.id}>{v.name} ({v.registrationNumber})</option>)}
        </Select>
      </label>
    </div>
  )
}
