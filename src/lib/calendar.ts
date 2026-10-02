/** Calendar maths for the date picker. Dates are 'YYYY-MM-DD' strings; everything runs in UTC so the browser timezone never shifts a day. */
export type YMD = { y: number; m: number; d: number } // m is 1-12

export const pad = (n: number, w = 2) => String(n).padStart(w, '0')
export const toISO = ({ y, m, d }: YMD) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`
export function parseISO(s: string): YMD {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
/** 0 = Sunday. */
export const weekday = (s: string) => { const { y, m, d } = parseISO(s); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() }

export function addDays(s: string, n: number): string {
  const { y, m, d } = parseISO(s)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Moves by whole months and keeps the day when the month is long enough, else clamps (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(s: string, n: number): string {
  const { y, m, d } = parseISO(s)
  const idx = y * 12 + (m - 1) + n
  const ny = Math.floor(idx / 12), nm = (idx % 12 + 12) % 12 + 1
  return toISO({ y: ny, m: nm, d: Math.min(d, daysInMonth(ny, nm)) })
}

/** 42 days (6 weeks, Sunday first) covering the month, including the tail of the previous and head of the next. */
export function monthGrid(y: number, m: number): string[] {
  const first = toISO({ y, m, d: 1 })
  const start = addDays(first, -weekday(first))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
