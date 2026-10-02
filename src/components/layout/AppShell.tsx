import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { List, X } from '@phosphor-icons/react'
import { ALL_NAV_ITEMS, NAV } from '../../lib/navigation'
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

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function AppShell() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const closeRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  useEffect(() => setOpen(false), [pathname])

  // Page title per screen, and move focus to the content after navigating (not on first load) so keyboard and
  // screen-reader users start at the new page instead of the old menu link.
  useEffect(() => {
    const item = [...ALL_NAV_ITEMS].sort((a, b) => b.to.length - a.to.length).find((n) => (n.to === '/' ? pathname === '/' : pathname === n.to || pathname.startsWith(`${n.to}/`)))
    document.title = item ? `${item.label} · Business Admin` : 'Business Admin'
    if (firstRender.current) { firstRender.current = false; return }
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  // Mobile menu: focus moves in, Tab stays inside, Esc closes, focus returns to the menu button.
  useEffect(() => {
    if (!open) return
    const drawer = drawerRef.current
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return }
      if (e.key !== 'Tab' || !drawer) return
      const list = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (list.length === 0) return
      const first = list[0], last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const button = menuButtonRef.current
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      button?.focus()
    }
  }, [open])

  return (
    <div className="flex h-full">
      <a href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus() }}
        className="sr-only z-[60] rounded-md bg-primary px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 pt-5 text-sm font-semibold">Business Admin</div>
        <div className="flex-1 overflow-y-auto"><NavList /></div>
        <SignOutButton />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
          <button ref={menuButtonRef} type="button" aria-label="Open menu" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} className="-m-1 rounded-md p-2.5 hover:bg-canvas">
            <List size={22} aria-hidden />
          </button>
          <span className="text-sm font-semibold">Business Admin</span>
        </header>
        <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 overflow-y-auto px-4 py-6 outline-none lg:px-8">
          <div className="mx-auto max-w-6xl"><Outlet /></div>
        </main>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div ref={drawerRef} className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-surface shadow-lg">
            <div className="flex items-center justify-between px-5 pt-4">
              <span className="text-sm font-semibold">Business Admin</span>
              <button ref={closeRef} type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-md p-2.5 hover:bg-canvas">
                <X size={20} aria-hidden />
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
