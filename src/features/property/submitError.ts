/** Maps database/service errors to messages the admin can act on. */
export function submitError(e: unknown, what: string): string {
  const msg = e instanceof Error ? e.message.toLowerCase() : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message).toLowerCase() : ''
  if (msg.includes('exceeds the outstanding')) return 'That is more than the rent outstanding for this month. Refresh and check the amount.'
  if (msg.includes('exceeds the remaining advance')) return 'That is more than the advance remaining. Refresh and check the amount.'
  if (msg.includes('no rent is due')) return 'No rent is due for that month yet.'
  if (msg.includes('properties_name_key') || msg.includes('duplicate key')) return 'A property with this name already exists.'
  if (msg.includes('row-level security') || msg.includes('permission') || msg.includes('not authorised')) return `You do not have permission to save the ${what}.`
  return `Could not save the ${what}. Check your connection and try again.`
}
