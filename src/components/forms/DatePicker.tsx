import { useEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { addDays, addMonths, daysInMonth, monthGrid, MONTHS_LONG, MONTHS_SHORT, parseISO, toISO, WEEKDAYS, weekday } from '../../lib/calendar'
import { formatDate, isValidISODate, todayIST } from '../../lib/dates'
import { Popover } from './Popover'

export type DatePickerProps = {
  id?: string
  name?: string
  /** 'YYYY-MM-DD', or '' for no date. */
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  className?: string
  placeholder?: string
  'aria-label'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-describedby'?: string
  'data-autofocus'?: boolean
  ref?: Ref<HTMLButtonElement>
}

type View = 'days' | 'months' | 'years'
const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"])'
const longDate = (iso: string) => { const { y, m, d } = parseISO(iso); return `${d} ${MONTHS_LONG[m - 1]} ${y}` }
/** Same day-of-month in another year/month, clamped to that month's length. */
const withYM = (iso: string, y: number, m: number) => toISO({ y, m, d: Math.min(parseISO(iso).d, daysInMonth(y, m)) })

const navBtn = 'inline-flex h-8 w-8 items-center justify-center rounded-md text-primary hover:bg-sage-soft'
const cell = 'rounded-md text-sm hover:bg-sage-soft'

/**
 * Calendar date picker in the app theme. Replaces the browser `<input type="date">` (whose popup cannot be styled).
 * Arrow keys move by day and week, PageUp/PageDown by month (Shift: year), Home/End within the week, Esc closes.
 */
export function DatePicker({ id, name, value, onChange, onBlur, disabled, className = '', placeholder = 'Select date', ref, 'data-autofocus': autoFocus, ...aria }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('days')
  const [cursor, setCursor] = useState(todayIST())
  const btn = useRef<HTMLButtonElement | null>(null)
  const pop = useRef<HTMLDivElement | null>(null)
  const wantFocus = useRef(false)
  const today = todayIST()
  const hasValue = isValidISODate(value)

  const setRefs = (el: HTMLButtonElement | null) => {
    btn.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) (ref as { current: HTMLButtonElement | null }).current = el
  }

  const show = () => {
    if (disabled) return
    setCursor(hasValue ? value : today)
    setView('days')
    wantFocus.current = true
    setOpen(true)
  }
  const hide = (refocus = true) => {
    setOpen(false)
    if (refocus) btn.current?.focus()
  }
  const pick = (iso: string) => { onChange(iso); hide() }
  const move = (iso: string) => { setCursor(iso); wantFocus.current = true }

  // Keep keyboard focus on the day that is "current" after opening or moving.
  useEffect(() => {
    if (!open || !wantFocus.current) return
    wantFocus.current = false
    pop.current?.querySelector<HTMLElement>(`[data-date="${cursor}"]`)?.focus()
  })

  const { y, m } = parseISO(cursor)

  const onGridKey = (e: KeyboardEvent) => {
    const wd = weekday(cursor)
    const k = e.key
    let next: string | null = null
    if (k === 'ArrowLeft') next = addDays(cursor, -1)
    else if (k === 'ArrowRight') next = addDays(cursor, 1)
    else if (k === 'ArrowUp') next = addDays(cursor, -7)
    else if (k === 'ArrowDown') next = addDays(cursor, 7)
    else if (k === 'Home') next = addDays(cursor, -wd)
    else if (k === 'End') next = addDays(cursor, 6 - wd)
    else if (k === 'PageUp') next = addMonths(cursor, e.shiftKey ? -12 : -1)
    else if (k === 'PageDown') next = addMonths(cursor, e.shiftKey ? 12 : 1)
    if (next) { e.preventDefault(); move(next) }
  }

  const onPopKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hide() }
    else if (e.key === 'Tab') {
      const list = Array.from(pop.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
      if (list.length === 0) return
      const first = list[0], last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }

  const step = view === 'days' ? 1 : view === 'months' ? 12 : 144 // months to move per prev/next press
  const yearStart = Math.floor(y / 12) * 12
  const caption = view === 'days' ? `${MONTHS_LONG[m - 1]} ${y}` : view === 'months' ? String(y) : `${yearStart}–${yearStart + 11}`
  const captionLabel = view === 'days' ? 'Choose month and year' : view === 'months' ? 'Choose year' : 'Years'

  return (
    <>
      <button
        ref={setRefs}
        type="button"
        id={id}
        name={name}
        aria-haspopup="dialog"
        aria-expanded={open}
        {...aria}
        data-autofocus={autoFocus ? '' : undefined}
        disabled={disabled}
        onClick={() => (open ? hide(false) : show())}
        onBlur={() => { if (!open) onBlur?.() }}
        className={`${className} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className={`min-w-0 truncate tabular-nums ${hasValue ? '' : 'text-muted'}`}>{hasValue ? formatDate(value) : placeholder}</span>
        <CalendarBlank size={16} aria-hidden className="shrink-0 text-primary" />
      </button>
      {open && (
        <Popover anchor={btn} onClose={() => hide(false)} matchWidth={false} minWidth={288} maxHeight={560} popRef={pop} className="w-72 p-3">
          <div role="dialog" aria-label="Choose date" onKeyDown={onPopKey}>
            <div className="mb-2 flex items-center justify-between gap-1">
              <button type="button" aria-label={view === 'days' ? 'Previous month' : view === 'months' ? 'Previous year' : 'Previous years'} className={navBtn} onClick={() => setCursor(addMonths(cursor, -step))}>
                <CaretLeft size={16} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={captionLabel}
                aria-live="polite"
                disabled={view === 'years'}
                className="rounded-md px-2 py-1 text-sm font-semibold hover:bg-sage-soft disabled:hover:bg-transparent"
                onClick={() => setView(view === 'days' ? 'months' : 'years')}
              >
                {caption}
              </button>
              <button type="button" aria-label={view === 'days' ? 'Next month' : view === 'months' ? 'Next year' : 'Next years'} className={navBtn} onClick={() => setCursor(addMonths(cursor, step))}>
                <CaretRight size={16} aria-hidden />
              </button>
            </div>

            {view === 'days' && (
              <div role="group" aria-label={`${MONTHS_LONG[m - 1]} ${y}`} onKeyDown={onGridKey}>
                <div className="mb-1 grid grid-cols-7 text-center text-xs text-muted" aria-hidden>
                  {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-y-0.5">
                  {monthGrid(y, m).map((iso) => {
                    const inMonth = parseISO(iso).m === m
                    const selected = hasValue && iso === value
                    return (
                      <button
                        key={iso}
                        type="button"
                        data-date={iso}
                        tabIndex={iso === cursor ? 0 : -1}
                        aria-label={longDate(iso)}
                        aria-pressed={selected}
                        aria-current={iso === today ? 'date' : undefined}
                        onClick={() => pick(iso)}
                        className={`${cell} h-9 w-full tabular-nums ${
                          selected ? 'bg-primary font-medium text-white hover:bg-primary-hover'
                            : iso === today ? 'font-semibold ring-1 ring-inset ring-sage'
                            : !inMonth ? 'text-muted/70' : ''
                        }`}
                      >
                        {parseISO(iso).d}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {view === 'months' && (
              <div className="grid grid-cols-3 gap-1">
                {MONTHS_SHORT.map((label, i) => {
                  const isSel = hasValue && parseISO(value).y === y && parseISO(value).m === i + 1
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-label={`${MONTHS_LONG[i]} ${y}`}
                      aria-pressed={isSel}
                      onClick={() => { move(withYM(cursor, y, i + 1)); setView('days') }}
                      className={`${cell} h-11 ${isSel ? 'bg-sage-soft font-medium text-primary' : parseISO(today).y === y && parseISO(today).m === i + 1 ? 'ring-1 ring-inset ring-sage' : ''}`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}

            {view === 'years' && (
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 12 }, (_, i) => yearStart + i).map((yr) => {
                  const isSel = hasValue && parseISO(value).y === yr
                  return (
                    <button
                      key={yr}
                      type="button"
                      aria-pressed={isSel}
                      onClick={() => { setCursor(withYM(cursor, yr, m)); setView('months') }}
                      className={`${cell} h-11 tabular-nums ${isSel ? 'bg-sage-soft font-medium text-primary' : parseISO(today).y === yr ? 'ring-1 ring-inset ring-sage' : ''}`}
                    >
                      {yr}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
              <button type="button" className="rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-sage-soft" onClick={() => pick(today)}>Today</button>
              {hasValue && <button type="button" className="rounded-md px-2 py-1 text-sm text-muted hover:bg-sage-soft" onClick={() => pick('')}>Clear</button>}
            </div>
          </div>
        </Popover>
      )}
    </>
  )
}

/** `DatePicker` wired to react-hook-form. */
export function FormDatePicker<T extends FieldValues>({ control, name, ...props }: Omit<DatePickerProps, 'value' | 'onChange' | 'onBlur' | 'name'> & {
  control: Control<T>; name: FieldPath<T>
}) {
  const { field } = useController({ control, name })
  return (
    <DatePicker
      {...props}
      name={field.name}
      value={(field.value as string | undefined) ?? ''}
      onChange={field.onChange}
      onBlur={field.onBlur}
      ref={field.ref}
    />
  )
}
