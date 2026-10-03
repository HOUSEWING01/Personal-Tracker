import type { DriverStatus, LoanStatus, MaintenanceKind, TripStatus, VehicleStatus } from '../../types/transport'
export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = { active: 'Active', inactive: 'Inactive', sold: 'Sold' }
export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = { active: 'Active', inactive: 'Inactive' }
export const TRIP_STATUS_LABELS: Record<TripStatus, string> = { planned: 'Planned', completed: 'Completed', cancelled: 'Cancelled' }
export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = { active: 'Active', closed: 'Closed' }
export const MAINTENANCE_KIND_LABELS: Record<MaintenanceKind, string> = {
  service: 'Service', repair: 'Repair', tyres: 'Tyres', battery: 'Battery', insurance: 'Insurance', permit: 'Permit / FC', other: 'Other',
}
