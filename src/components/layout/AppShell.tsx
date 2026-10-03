import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { ArrowsLeftRight, Buildings, CaretDoubleLeft, CaretDoubleRight, DotsThreeOutline, SquaresFour, Truck, X, type Icon } from '@phosphor-icons/react'
import { ALL_NAV_ITEMS, NAV } from '../../lib/navigation'
import { InstallAppBanner } from './InstallApp'
import { SignOutButton } from './SignOutButton'

const COLLAPSED_KEY = 'ba-sidebar-collapsed'

/** The four screens used most, always one tap away on phones. Everything else is under "More". */
const TABS: { to: string; label: string; icon: Icon }[] = [
  { to: '/', label: 'Home', icon: SquaresFour },
  { to: '/property', label: 'Godowns', icon: Buildings },
  { to: '/transport', label: 'Transport', icon: Truck },
  { to: '/finance', label: 'Money', icon: ArrowsLeftRight },
]

function NavList({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  return (
    <nav aria-label="Main" className={`flex flex-col gap-4 py-4 ${collapsed ? 'px-2' : 'px-3'}`}>
      {NAV.map((group, i) => (
        <div key={group.label ?? i}>
          {group.label && !collapsed && <p className="px-2 pb-1 text-xs font-medium text-muted">{group.label}</p>}
          {group.label && collapsed && <div className="mx-3 mb-2 border-t border-line" aria-hidden />}
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  onClick={onNavigate}
                  title={collapsed ? label : undefined}
                  aria-label={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-2.5 rounded-md px-2 py-2 text-sm lg:min-h-0 ${collapsed ? 'justify-center' : ''} ${
                      isActive ? 'bg-sage-soft font-medium text-primary' : 'text-ink hover:bg-canvas'
                    }`
                  }
                >
                  <Icon size={18} aria-hidden className="shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
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

function readCollapsed(): boolean {
  try { return window.localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const { pathname } = useLocation()
  const closeRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  const item = [...ALL_NAV_ITEMS].sort((a, b) => b.to.length - a.to.length).find((n) => (n.to === '/' ? pathname === '/' : pathname === n.to || pathname.startsWith(`${n.to}/`)))

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c
      try { window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0') } catch { /* private mode: still works for this visit */ }
      return next
    })
  }

  useEffect(() => setOpen(false), [pathname])

  // Page title per screen, and move focus to the content after navigating (not on first load) so keyboard and
  // screen-reader users start at the new page instead of the old menu link.
  useEffect(() => {
    document.title = item ? `${item.label} · Business Admin` : 'Business Admin'
    if (firstRender.current) { firstRender.current = false; return }
    mainRef.current?.focus({ preventScroll: true })
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname, item])

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

      {/* Desktop sidebar: full width, or an icon rail (remembered between visits). */}
      <aside className={`hidden shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex ${collapsed ? 'w-16' : 'w-60'}`}>
        <div className={`flex items-center pt-4 ${collapsed ? 'flex-col gap-2 px-2' : 'justify-between px-5'}`}>
          {collapsed
            ? <img src="/icons/favicon-32.png" alt="Business Admin" width={28} height={28} className="h-7 w-7 rounded" />
            : <span className="text-sm font-semibold">Business Admin</span>}
          <button
            type="button" onClick={toggleCollapsed} aria-pressed={collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-primary"
          >
            {collapsed ? <CaretDoubleRight size={16} aria-hidden /> : <CaretDoubleLeft size={16} aria-hidden />}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto"><NavList collapsed={collapsed} /></div>
        <SignOutButton collapsed={collapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone top bar: menu, then where you are. */}
        <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface pb-2 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden">
          <div className="min-w-0 py-1 pl-1 leading-tight">
            <p className="text-xs text-muted">Business Admin</p>
            <p className="truncate text-base font-semibold">{item?.label ?? 'Business Admin'}</p>
          </div>
        </header>
        <main id="main" ref={mainRef} tabIndex={-1}
          className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-5 outline-none sm:pt-6 sm:pb-[calc(6rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-6xl"><InstallAppBanner /><Outlet /></div>
        </main>
      </div>

      {/* Phone / tablet bottom bar: the app's main screens, like a native app. */}
      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:hidden">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs ${isActive ? 'font-semibold text-primary' : 'text-muted'}`}>
            {({ isActive }) => (<>
              <span className={`flex h-7 w-14 items-center justify-center rounded-full ${isActive ? 'bg-sage-soft' : ''}`}><Icon size={22} weight={isActive ? 'fill' : 'regular'} aria-hidden /></span>
              {label}
            </>)}
          </NavLink>
        ))}
        <button ref={menuButtonRef} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs text-muted">
          <span className="flex h-7 w-14 items-center justify-center rounded-full"><DotsThreeOutline size={22} aria-hidden /></span>
          More
        </button>
      </nav>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="backdrop-in absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div ref={drawerRef} className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-surface pt-[env(safe-area-inset-top)] shadow-lg">
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
