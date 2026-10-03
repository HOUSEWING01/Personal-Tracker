/** Maps database/service errors to messages the admin can act on. */
export function transportSubmitError(e: unknown, what: string): string {
  const msg = e instanceof Error ? e.message.toLowerCase()
    : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message).toLowerCase() : ''
  if (msg.includes('vehicles_registration_key')) return 'A vehicle with this registration number already exists.'
  if (msg.includes('drivers_mobile_key')) return 'A driver with this mobile number already exists.'
  if (msg.includes('customers_mobile_key')) return 'A customer with this mobile number already exists. Search for them instead of adding again.'
  if (msg.includes('vehicle is not active')) return 'This vehicle is not active. Choose an active vehicle, or make it active first.'
  if (msg.includes('already has a trip in progress')) return 'This vehicle already has a trip in progress. Complete or cancel that trip first.'
  if (msg.includes('ending odometer is required')) return 'Enter the ending odometer to complete the trip.'
  if (msg.includes('ending odometer must be more')) return 'The ending odometer must be more than the starting odometer.'
  if (msg.includes('driver is not active')) return 'This driver is not active. Choose an active driver, or make them active first.'
  if (msg.includes('trip belongs to a different vehicle')) return 'The chosen trip belongs to a different vehicle. Choose a trip for this vehicle, or leave the trip blank.'
  if (msg.includes('trip has fuel or toll entries')) return 'This trip has fuel or toll entries, so its vehicle cannot be changed.'
  if (msg.includes('next due date is before')) return 'The next due date cannot be before the date of this entry.'
  if (msg.includes('loan is closed')) return 'This loan is closed. Set it back to Active to record a new payment.'
  if (msg.includes('payment is before the loan start date')) return 'The payment date is before the loan start date.'
  if (msg.includes('loan has payments before the start date')) return 'This loan already has payments dated before that start date. Choose an earlier start date.'
  if (msg.includes('payment belongs to a different loan')) return 'This payment belongs to a different loan.'
  if (msg.includes('row-level security') || msg.includes('permission') || msg.includes('not authorised')) return `You do not have permission to save the ${what}.`
  return `Could not save the ${what}. Check your connection and try again.`
}
