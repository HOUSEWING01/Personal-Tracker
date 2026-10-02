/**
 * Toast store. A plain module (not React state) so non-React code, such as the query client, can raise a toast.
 * Components read it through `useToasts()` in `components/ui/Toaster.tsx`.
 */
export type ToastKind = 'success' | 'error' | 'info'
export interface ToastAction { label: string; onClick: () => void }
export interface Toast { id: number; kind: ToastKind; message: string; /** 0 keeps it until dismissed. */ duration: number; action?: ToastAction }
export type ToastOptions = { duration?: number; action?: ToastAction }

/** Time on screen in ms. Errors stay longer because they need more reading and often a decision. */
export const TOAST_DURATION: Record<ToastKind, number> = { success: 4000, info: 5000, error: 8000 }
export const MAX_TOASTS = 3

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function push(kind: ToastKind, message: string, opts: number | ToastOptions = {}): number {
  const { duration, action } = typeof opts === 'number' ? { duration: opts, action: undefined } : opts
  // The same message shown again replaces the old one (and restarts its timer) instead of stacking.
  const rest = toasts.filter((t) => !(t.kind === kind && t.message === message))
  const t: Toast = { id: nextId++, kind, message, duration: duration ?? TOAST_DURATION[kind], action }
  toasts = [...rest, t].slice(-MAX_TOASTS)
  emit()
  return t.id
}

export const toast = {
  success: (message: string, opts?: number | ToastOptions) => push('success', message, opts),
  error: (message: string, opts?: number | ToastOptions) => push('error', message, opts),
  info: (message: string, opts?: number | ToastOptions) => push('info', message, opts),
  dismiss(id: number) {
    if (!toasts.some((t) => t.id === id)) return
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  },
  clear() { toasts = []; emit() },
}

export const subscribeToasts = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export const getToasts = () => toasts
