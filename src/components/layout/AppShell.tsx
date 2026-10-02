import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { List, X } from '@phosphor-icons/react'
import { NAV } from '../../lib/navigation'
import { SignOutButton } from './SignOutButton'

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-4 px-3 py-4">
      {NAV.map((group, i) => (
        <div key={group.label ?? i}>
          {group.label && <p className="px-2 pb-1 text-xs font-medium text-muted">{group.label}</p>}
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-md px-2 py-2 text-sm ${
                      isActive ? 'bg-sage-soft font-medium text-primary' : 'text-ink hover:bg-canvas'
                    }`
                  }
                >
                  <Icon size={18} aria-hidden />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 pt-5 text-sm font-semibold">Business Admin</div>
        <div className="flex-1 overflow-y-auto"><NavList /></div>
        <SignOutButton />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
          <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-md p-1.5 hover:bg-canvas">
            <List size={22} />
          </button>
          <span className="text-sm font-semibold">Business Admin</span>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-6xl"><Outlet /></div>
        </main>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-surface shadow-lg">
            <div className="flex items-center justify-between px-5 pt-4">
              <span className="text-sm font-semibold">Business Admin</span>
              <button ref={closeRef} type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-md p-1.5 hover:bg-canvas">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto"><NavList onNavigate={() => setOpen(false)} /></div>
            <SignOutButton />
          </div>
        </div>
      )}
      <ScrollRestoration />
    </div>
  )
}
