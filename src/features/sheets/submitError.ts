/** Maps database/service errors to messages the admin can act on. */
export function sheetSubmitError(e: unknown, what: string): string {
  const msg = e instanceof Error ? e.message.toLowerCase()
    : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message).toLowerCase() : ''
  if (msg.includes('sheet_products_name_key')) return 'A product with this name already exists.'
  if (msg.includes('sheet_variants_product_length_key')) return 'This product already has a variant of that size.'
  if (msg.includes('customers_mobile_key')) return 'A customer with this mobile number already exists. Choose them from the list instead.'
  if (msg.includes('not enough sheets available')) return 'Not enough sheets are available for that quantity. Check the Stock tab.'
  if (msg.includes('variant is not active')) return 'This variant is not active. Choose an active variant, or make it active first.'
  if (msg.includes('product is not active')) return 'This product is not active. Choose an active product, or make it active first.'
  if (msg.includes('total quantity is below')) return 'The total cannot be lower than the sheets already rented, damaged or missing.'
  if (msg.includes('variant has rentals')) return 'This variant already has rentals, so its product and size cannot change.'
  if (msg.includes('quantity is below the sheets already returned')) return 'The quantity cannot be lower than the sheets already returned, damaged or missing.'
  if (msg.includes('net rent is below the amount already paid')) return 'The net rent (rent minus discount) cannot be lower than what has already been paid.'
  if (msg.includes('advance is more than the net rent')) return 'The advance cannot be more than the net rent (rent minus discount).'
  if (msg.includes('discount is more than the rent')) return 'The discount cannot be more than the rent.'
  if (msg.includes('expected return is before the rental date')) return 'The expected return date is before the rental date.'
  if (msg.includes('before that date')) return 'This rental has returns or payments dated before that rental date. Choose an earlier date.'
  if (msg.includes('rental is cancelled')) return 'This rental is cancelled and cannot be changed.'
  if (msg.includes('rental has returns or payments')) return 'A rental with returns or payments cannot be cancelled.'
  if (msg.includes('payment is more than the outstanding rent')) return 'The payment is more than the outstanding rent. Raise the rent first if more is owed.'
  if (msg.includes('payment is before the rental date')) return 'The payment date is before the rental date.'
  if (msg.includes('more sheets than are still out')) return 'That is more sheets than are still out on this rental.'
  if (msg.includes('return is before the rental date')) return 'The return date is before the rental date.'
  if (msg.includes('return date is in the future')) return 'The return date cannot be in the future.'
  if (msg.includes('already rented out again')) return 'Those sheets have been rented out again, so this return cannot be undone.'
  if (msg.includes('row-level security') || msg.includes('permission') || msg.includes('not authorised')) return `You do not have permission to save the ${what}.`
  return `Could not save the ${what}. Check your connection and try again.`
}
