import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react'
import { getToasts, subscribeToasts, toast, type Toast, type ToastKind } from '../../lib/toast'

const STYLE: Record<ToastKind, { box: string; icon: string; Icon: typeof Info }> = {
  success: { box: 'border-sage', icon: 'text-primary', Icon: CheckCircle },
  info: { box: 'border-line', icon: 'text-primary', Icon: Info },
  error: { box: 'border-danger', icon: 'text-danger', Icon: WarningCircle },
}

function ToastItem({ t }: { t: Toast }) {
  const left = useRef(t.duration)
  const startedAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { box, icon, Icon } = STYLE[t.kind]

  const start = useCallback(() => {
    if (t.duration <= 0) return // sticky: stays until dismissed
    startedAt.current = Date.now()
    timer.current = setTimeout(() => toast.dismiss(t.id), left.current)
  }, [t.id])
  // Pause while the pointer is over the toast or focus is inside it, so it never vanishes mid-read.
  const pause = () => {
    if (timer.current === undefined) return
    clearTimeout(timer.current)
    timer.current = undefined
    left.current = Math.max(1500, left.current - (Date.now() - startedAt.current))
  }
  const resume = () => { if (timer.current === undefined) start() }

  useEffect(() => {
    start()
    return () => clearTimeout(timer.current)
  }, [start])

  return (
    <div
      role={t.kind === 'error' ? 'alert' : 'status'}
      onMouseEnter={pause} onMouseLeave={resume} onFocus={pause} onBlur={resume}
      onKeyDown={(e) => { if (e.key === 'Escape') toast.dismiss(t.id) }}
      className={`toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-surface py-3 pl-4 pr-2 shadow-lg ${box}`}
    >
      <Icon size={20} weight="fill" aria-hidden className={`mt-0.5 shrink-0 ${icon}`} />
      <p className="min-w-0 flex-1 break-words text-sm font-medium text-ink">{t.message}</p>
      {t.action && (
        <button type="button" onClick={() => { t.action?.onClick(); toast.dismiss(t.id) }} className="shrink-0 rounded-md px-2.5 py-1.5 text-sm font-semibold text-primary hover:bg-sage-soft">
          {t.action.label}
        </button>
      )}
      <button type="button" aria-label="Dismiss notification" onClick={() => toast.dismiss(t.id)} className="-my-1 shrink-0 rounded-md p-2.5 text-muted hover:bg-canvas hover:text-ink">
        <X size={16} aria-hidden />
      </button>
    </div>
  )
}

/** Renders the toast stack. Mount once, outside the router, so toasts survive navigation. Bottom-centre on phones, bottom-right on desktop. */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts)
  return (
    <div
      role="region" aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:items-end md:px-6 md:pb-6"
    >
      {toasts.map((t) => <ToastItem key={t.id} t={t} />)}
    </div>
  )
}
