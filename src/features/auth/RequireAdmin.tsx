import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullScreenMessage, buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { useAuth } from './AuthContext'

export function RequireAdmin() {
  const { status, errorMessage, retry, signOut } = useAuth()
  const location = useLocation()

  switch (status) {
    case 'loading':
      return <FullScreenMessage title="Loading…" />
    case 'config-missing':
      return (
        <FullScreenMessage title="Supabase is not configured">
          Copy <code>.env.example</code> to <code>.env</code> and set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>, then restart the dev server. See docs/SUPABASE_SETUP.md.
        </FullScreenMessage>
      )
    case 'signed-out':
      return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
    case 'forbidden':
      return (
        <FullScreenMessage
          title="Not authorised"
          actions={<button type="button" className={buttonSecondary} onClick={() => void signOut()}>Sign out</button>}
        >
          This account is not an administrator of this app. Sign in with the admin account.
        </FullScreenMessage>
      )
    case 'error':
      return (
        <FullScreenMessage
          title="Something went wrong"
          actions={<button type="button" className={buttonPrimary} onClick={retry}>Try again</button>}
        >
          {errorMessage ?? 'Could not verify your access. Check your connection and try again.'}
        </FullScreenMessage>
      )
    case 'admin':
      return <Outlet />
  }
}
