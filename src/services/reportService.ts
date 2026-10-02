import { supabase } from '../lib/supabase'
import { toPaise, type Paise } from '../lib/money'
import type { BusinessModule, TransactionType } from '../types/finance'
import type { BreakdownRow } from '../features/reports/reportEngine'

/** Report filters. The date range is inclusive business dates (IST). */
export interface ReportFilters {
  from?: string
  to?: string
  module?: BusinessModule
  vehicleId?: string
  propertyId?: string
  customerId?: string
}
export type ReportGroup = 'total' | 'month' | 'module'

const args = (f: ReportFilters) => ({
  p_from: f.from ?? null, p_to: f.to ?? null, p_module: f.module ?? null,
  p_vehicle: f.vehicleId ?? null, p_property: f.propertyId ?? null, p_customer: f.customerId ?? null,
})

/** Per-type totals per bucket from `report_breakdown()` (migration 0013). Formulas are applied by reportEngine. */
export async function getReportBreakdown(group: ReportGroup, f: ReportFilters): Promise<BreakdownRow[]> {
  const { data, error } = await supabase.rpc('report_breakdown', { p_group: group, ...args(f) })
  if (error) throw error
  return ((data ?? []) as { bucket: string; type: TransactionType; total: number | string }[])
    .map((r) => ({ bucket: r.bucket, type: r.type, totalPaise: toPaise(r.total) }))
}

export interface ReportOutstanding { rentPaise: Paise; sheetPaise: Paise }

export async function getReportOutstanding(f: ReportFilters): Promise<ReportOutstanding> {
  const { data, error } = await supabase.rpc('report_outstanding', args(f))
  if (error) throw error
  const r = (Array.isArray(data) ? data[0] : data) as { rent_outstanding: number | string; sheet_outstanding: number | string } | undefined
  if (!r) throw new Error('report_outstanding returned no row')
  return { rentPaise: toPaise(r.rent_outstanding), sheetPaise: toPaise(r.sheet_outstanding) }
}

export interface PropertyChoice { id: string; name: string }
export async function listPropertyChoices(): Promise<PropertyChoice[]> {
  const { data, error } = await supabase.from('properties').select('id, name').order('name').limit(1000)
  if (error) throw error
  return data as PropertyChoice[]
}
