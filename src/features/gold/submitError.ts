/** Maps database/service errors to messages the admin can act on. */
export function goldSubmitError(e: unknown, what: string): string {
  const msg = e instanceof Error ? e.message.toLowerCase()
    : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message).toLowerCase() : ''
  if (msg.includes('loan is closed')) return 'This loan is closed. Set it back to Active to record a new payment.'
  if (msg.includes('payment is before the pledge date')) return 'The payment date is before the pledge date.'
  if (msg.includes('payment is after the closing date')) return 'The payment date is after the date this loan was closed.'
  if (msg.includes('loan has payments before the pledge date')) return 'This loan already has payments dated before that pledge date. Choose an earlier date.'
  if (msg.includes('loan has payments after the closing date')) return 'This loan has payments after that closing date. Choose a later closing date.'
  if (msg.includes('payment belongs to a different loan')) return 'This payment belongs to a different loan.'
  if (msg.includes('due date is before')) return 'The due date cannot be before the pledge date.'
  if (msg.includes('closing date')) return 'Enter a closing date that is not before the pledge date.'
  if (msg.includes('row-level security') || msg.includes('permission') || msg.includes('not authorised')) return `You do not have permission to save the ${what}.`
  return `Could not save the ${what}. Check your connection and try again.`
}
