import type { RentalStatus } from '../../types/sheets'
export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = { active: 'Out on rent', closed: 'Returned', cancelled: 'Cancelled' }
export const ACTIVE_STATUS_LABELS = { active: 'Active', inactive: 'Inactive' } as const
