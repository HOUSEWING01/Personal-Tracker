import { SignOut } from '@phosphor-icons/react'
import { useAuth } from '../../features/auth/AuthContext'

export function SignOutButton() {
  const { email, signOut } = useAuth()
  return (
    <div className="border-t border-line p-3">
      {email && <p className="truncate px-2 pb-1 text-xs text-muted" title={email}>{email}</p>}
      <button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-canvas">
        <SignOut size={18} aria-hidden /> Sign out
      </button>
    </div>
  )
}
