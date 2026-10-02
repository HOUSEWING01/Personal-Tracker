import type { ReactNode } from 'react'

export function FullScreenMessage({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6">
        <h1 className="text-lg font-semibold">{title}</h1>
        {children && <div className="mt-2 text-sm text-muted">{children}</div>}
        {actions && <div className="mt-5 flex gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export const buttonPrimary =
  'inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60'
export const buttonSecondary =
  'inline-flex items-center justify-center rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-primary hover:bg-sage-soft'
