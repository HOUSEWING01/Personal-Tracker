import type { DriverStatus, LoanStatus, TripStatus, VehicleStatus } from '../../types/transport'
export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = { active: 'Active', inactive: 'Inactive', sold: 'Sold' }
export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = { active: 'Active', inactive: 'Inactive' }
export const TRIP_STATUS_LABELS: Record<TripStatus, string> = { planned: 'Planned', completed: 'Completed', cancelled: 'Cancelled' }
export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = { active: 'Active', closed: 'Closed' }
