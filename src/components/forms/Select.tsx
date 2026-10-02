import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ReactElement, type ReactNode, type Ref } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { Popover } from './Popover'

type Opt = { value: string; label: string; disabled: boolean }

const textOf = (n: ReactNode) => Children.toArray(n).filter((c) => typeof c === 'string' || typeof c === 'number').join('')

/** Reads `<option>` children (also inside fragments and arrays) so call sites keep the familiar markup. */
function collectOptions(children: ReactNode): Opt[] {
  const out: Opt[] = []
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return
    const el = c as ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>
    if (el.type === 'option') {
      const label = textOf(el.props.children)
      out.push({ value: String(el.props.value ?? label), label, disabled: Boolean(el.props.disabled) })
    } else if (el.props.children) out.push(...collectOptions(el.props.children))
  })
  return out
}

export type SelectProps = {
  id?: string
  name?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  children: ReactNode
  disabled?: boolean
  className?: string
  'aria-label'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-describedby'?: string
  'data-autofocus'?: boolean
  ref?: Ref<HTMLButtonElement>
}

const enabledFrom = (opts: Opt[], start: number, step: 1 | -1) => {
  for (let i = start; i >= 0 && i < opts.length; i += step) if (!opts[i].disabled) return i
  return -1
}

/**
 * Single-choice dropdown in the app theme. Replaces the browser `<select>` (whose open list cannot be styled).
 * Focus stays on the button while the list is open (combobox + aria-activedescendant); the list is a portal.
 */
export function Select({ id, name, value, onChange, onBlur, children, disabled, className = '', ref, 'data-autofocus': autoFocus, ...aria }: SelectProps) {
  const options = useMemo(() => collectOptions(children), [children])
  const selectedIdx = options.findIndex((o) => o.value === value)
  const selected = selectedIdx >= 0 ? options[selectedIdx] : undefined
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const btn = useRef<HTMLButtonElement | null>(null)
  const listId = useId()
  const typed = useRef({ text: '', at: 0 })

  const setRefs = (el: HTMLButtonElement | null) => {
    btn.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) (ref as { current: HTMLButtonElement | null }).current = el
  }

  const show = () => {
    if (disabled) return
    setActive(selectedIdx >= 0 && !options[selectedIdx].disabled ? selectedIdx : enabledFrom(options, 0, 1))
    setOpen(true)
  }
  const hide = () => setOpen(false)
  const commit = (i: number) => {
    const o = options[i]
    if (!o || o.disabled) return
    if (o.value !== value) onChange(o.value)
    hide()
  }

  // Escape must close the list only. The dialog listens for Escape on its panel, so stop it here, before it gets there.
  useEffect(() => {
    const el = btn.current
    if (!el) return
    const onEsc = (e: KeyboardEvent) => { if (open && e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    el.addEventListener('keydown', onEsc)
    return () => el.removeEventListener('keydown', onEsc)
  }, [open])

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [open, active, listId])

  const typeahead = (key: string) => {
    const now = Date.now()
    const t = typed.current
    t.text = now - t.at > 600 ? key : t.text + key
    t.at = now
    const needle = t.text.toLowerCase()
    const from = t.text.length === 1 ? active + 1 : Math.max(active, 0)
    for (let k = 0; k < options.length; k++) {
      const i = (from + k) % options.length
      if (!options[i].disabled && options[i].label.toLowerCase().startsWith(needle)) return i
    }
    return -1
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    const k = e.key
    if (!open) {
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') { e.preventDefault(); show() }
      else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const i = typeahead(k)
        if (i >= 0) { e.preventDefault(); setActive(i); setOpen(true) }
      }
      return
    }
    if (k === 'ArrowDown') { e.preventDefault(); const i = enabledFrom(options, active + 1, 1); if (i >= 0) setActive(i) }
    else if (k === 'ArrowUp') { e.preventDefault(); const i = enabledFrom(options, active - 1, -1); if (i >= 0) setActive(i) }
    else if (k === 'Home') { e.preventDefault(); setActive(enabledFrom(options, 0, 1)) }
    else if (k === 'End') { e.preventDefault(); setActive(enabledFrom(options, options.length - 1, -1)) }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); commit(active) }
    else if (k === 'Tab') hide()
    else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const i = typeahead(k)
      if (i >= 0) { e.preventDefault(); setActive(i) }
    }
  }

  return (
    <>
      <button
        ref={setRefs}
        type="button"
        id={id}
        name={name}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        {...aria}
        data-autofocus={autoFocus ? '' : undefined}
        disabled={disabled}
        onClick={() => (open ? hide() : show())}
        onKeyDown={onKeyDown}
        onBlur={() => { if (!open) onBlur?.() }}
        className={`${className} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className={`min-w-0 truncate ${value === '' ? 'text-muted' : ''}`}>{selected?.label ?? ''}</span>
        <CaretDown size={16} aria-hidden className={`shrink-0 text-primary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <Popover anchor={btn} onClose={hide} maxHeight={288} className="p-1">
          <ul role="listbox" id={listId} aria-label={aria['aria-label']} className="outline-none">
            {options.map((o, i) => (
              <li
                key={`${o.value}-${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === selectedIdx}
                aria-disabled={o.disabled || undefined}
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => { if (!o.disabled && active !== i) setActive(i) }}
                onClick={() => commit(i)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm ${
                  o.disabled ? 'cursor-not-allowed opacity-50' : i === active ? 'bg-sage-soft' : ''
                } ${i === selectedIdx ? 'font-medium text-primary' : ''} ${o.value === '' && i !== selectedIdx ? 'text-muted' : ''}`}
              >
                <span className="min-w-0 truncate">{o.label}</span>
                {i === selectedIdx && <Check size={16} weight="bold" aria-hidden className="shrink-0 text-primary" />}
              </li>
            ))}
          </ul>
        </Popover>
      )}
    </>
  )
}

/** `Select` wired to react-hook-form. `onValueChange` runs after the field updates (for dependent fields). */
export function FormSelect<T extends FieldValues>({ control, name, onValueChange, ...props }: Omit<SelectProps, 'value' | 'onChange' | 'onBlur' | 'name'> & {
  control: Control<T>; name: FieldPath<T>; onValueChange?: (value: string) => void
}) {
  const { field } = useController({ control, name })
  return (
    <Select
      {...props}
      name={field.name}
      value={(field.value as string | undefined) ?? ''}
      onChange={(v) => { field.onChange(v); onValueChange?.(v) }}
      onBlur={field.onBlur}
      ref={field.ref}
    />
  )
}
