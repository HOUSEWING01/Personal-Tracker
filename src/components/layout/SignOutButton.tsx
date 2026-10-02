import { SignOut } from '@phosphor-icons/react'
import { useAuth } from '../../features/auth/AuthContext'
import { InstallAppButton } from './InstallApp'

export function SignOutButton({ collapsed = false }: { collapsed?: boolean }) {
  const { email, signOut } = useAuth()
  return (
    <div className="border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {email && !collapsed && <p className="truncate px-2 pb-1 text-xs text-muted" title={email}>{email}</p>}
      <InstallAppButton collapsed={collapsed} />
      <button
        type="button" onClick={() => void signOut()} title={collapsed ? 'Sign out' : undefined} aria-label={collapsed ? 'Sign out' : undefined}
        className={`flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-canvas lg:min-h-0 ${collapsed ? 'justify-center' : ''}`}
      >
        <SignOut size={18} aria-hidden className="shrink-0" /> {!collapsed && 'Sign out'}
      </button>
    </div>
  )
}
