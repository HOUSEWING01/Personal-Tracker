import { supabase } from '../lib/supabase'
import { toPaise, type Paise } from '../lib/money'

/** Raw counts and sums from `dashboard_counts()` (migration 0012). Formulas live in the engines, not here. */
export interface DashboardCounts {
  activeProperties: number
  occupiedProperties: number
  rentOutstandingPaise: Paise
  activeVehicles: number
  tripsThisMonth: number
  sheetsTotal: number
  sheetsRented: number
  sheetsDamaged: number
  sheetsMissing: number
  sheetsAvailable: number
  overdueRentals: number
  sheetOutstandingPaise: Paise
}

type Num = number | string
interface Row {
  active_properties: Num; occupied_properties: Num; rent_outstanding: Num; active_vehicles: Num; trips_this_month: Num
  sheets_total: Num; sheets_rented: Num; sheets_damaged: Num; sheets_missing: Num; sheets_available: Num
  overdue_rentals: Num; sheet_outstanding: Num
}

export async function getDashboardCounts(today: string, monthFrom: string, monthTo: string): Promise<DashboardCounts> {
  const { data, error } = await supabase.rpc('dashboard_counts', { p_today: today, p_month_from: monthFrom, p_month_to: monthTo })
  if (error) throw error
  const r = (Array.isArray(data) ? data[0] : data) as Row | undefined
  if (!r) throw new Error('dashboard_counts returned no row')
  const n = (v: Num) => Number(v)
  return {
    activeProperties: n(r.active_properties), occupiedProperties: n(r.occupied_properties), rentOutstandingPaise: toPaise(r.rent_outstanding),
    activeVehicles: n(r.active_vehicles), tripsThisMonth: n(r.trips_this_month),
    sheetsTotal: n(r.sheets_total), sheetsRented: n(r.sheets_rented), sheetsDamaged: n(r.sheets_damaged),
    sheetsMissing: n(r.sheets_missing), sheetsAvailable: n(r.sheets_available),
    overdueRentals: n(r.overdue_rentals), sheetOutstandingPaise: toPaise(r.sheet_outstanding),
  }
}
