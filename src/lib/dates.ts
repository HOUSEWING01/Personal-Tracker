/** Business timezone is Asia/Kolkata (DECISIONS D-004). Business dates are 'YYYY-MM-DD' strings. */
const IST = 'Asia/Kolkata'
const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' })

export function todayIST(now: Date = new Date()): string {
  return ymd.format(now)
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function currentMonthRangeIST(now: Date = new Date()): { from: string; to: string } {
  const today = todayIST(now)
  const [y, m] = today.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const prefix = today.slice(0, 7)
  return { from: `${prefix}-01`, to: `${prefix}-${String(lastDay).padStart(2, '0')}` }
}

const display = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
export function formatDate(s: string): string {
  return isValidISODate(s) ? display.format(new Date(`${s}T00:00:00Z`)) : s
}
