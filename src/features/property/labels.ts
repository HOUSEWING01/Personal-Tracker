import type { AdvanceKind, PropertyStatus, PropertyType } from '../../types/property'
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = { shop: 'Shop', godown: 'Godown', house: 'House', land: 'Land', other: 'Other' }
export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = { active: 'Active', inactive: 'Inactive' }
export const ADVANCE_KIND_LABELS: Record<AdvanceKind, string> = { received: 'Received', adjusted: 'Adjusted against rent', returned: 'Returned' }
