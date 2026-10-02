/**
 * Money strategy (see DECISIONS.md D-003):
 * - Database: numeric(14,2) in INR.
 * - App logic: integer paise (1 INR = 100 paise). Never do arithmetic on float rupees.
 */
export type Paise = number

/** Parse "1234.5", "₹1,234.50" or a number into integer paise. Throws on invalid input. */
export function toPaise(input: string | number): Paise {
  const raw = typeof input === 'number' ? input.toString() : input.replace(/[₹,\s]/g, '')
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) throw new Error(`Invalid amount: ${String(input)}`)
  const negative = raw.startsWith('-')
  const [whole, frac = ''] = raw.replace('-', '').split('.')
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  if (!Number.isSafeInteger(paise)) throw new Error('Amount too large')
  return negative ? -paise : paise
}

export function fromPaise(paise: Paise): number {
  return paise / 100
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })
export function formatINR(paise: Paise): string {
  return inr.format(fromPaise(paise))
}

/** "+₹1,000.00" / "−₹1,000.00" (sign is text, so meaning never depends on colour alone). */
export function formatSignedINR(paise: Paise): string {
  const sign = paise > 0 ? '+' : paise < 0 ? '−' : ''
  return `${sign}${formatINR(Math.abs(paise))}`
}
