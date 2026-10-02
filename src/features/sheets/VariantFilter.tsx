import { useVariantChoices } from './hooks'
import { variantLabel } from './sheetEngine'
import { Select } from '../../components/forms/Select'

const field = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm'

/** "All sizes" picker shown above the Rentals list. The choice lives in the URL (`variant`). */
export function VariantFilter({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const options = useVariantChoices()
  return (
    <label className="col-span-2 text-sm font-medium md:col-span-1">Product and size
        <Select value={value} onChange={(v) => onChange(v)} className={field}>
          <option value="all">All sizes</option>
          {(options.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.productName} · {variantLabel(v.lengthFt)}</option>)}
        </Select>
    </label>
  )
}
