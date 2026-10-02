import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { FullScreenMessage, buttonPrimary, buttonSecondary } from '../../components/ui/FullScreenMessage'
import { signInWithPassword } from '../../services/authService'
import { useAuth } from './AuthContext'

const inputClass = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm'

export function LoginPage() {
  const { status, email: signedInEmail, errorMessage, retry, signOut } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (status === 'admin') return <Navigate to={from} replace />
  if (status === 'config-missing') return <Navigate to="/" replace />
  // Signed in, but the admin check did not pass: say so instead of showing the form again with no explanation.
  if (status === 'forbidden') {
    return (
      <FullScreenMessage
        title="Not authorised"
        actions={<button type="button" className={buttonSecondary} onClick={() => void signOut()}>Sign out</button>}
      >
        {signedInEmail ?? 'This account'} signed in, but it is not in the admin list. Add it to <code>admin_users</code> in Supabase, or sign in with the admin account.
      </FullScreenMessage>
    )
  }
  if (status === 'error') {
    return (
      <FullScreenMessage
        title="Something went wrong"
        actions={<button type="button" className={buttonPrimary} onClick={retry}>Try again</button>}
      >
        {errorMessage ?? 'Could not verify your access. Check your connection and try again.'}
      </FullScreenMessage>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.')
    if (!password) return setError('Enter your password.')
    setBusy(true); setError(null)
    try {
      await signInWithPassword(email.trim(), password)
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      setError(msg.includes('invalid login') ? 'Email or password is incorrect.' : 'Could not sign in. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <FullScreenMessage title="Sign in">
      <form onSubmit={onSubmit} noValidate className="text-ink">
        <label className="block text-sm font-medium">
          Email
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Password
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </label>
        {error && <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <button type="submit" disabled={busy} className={`${buttonPrimary} mt-5 w-full`}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </FullScreenMessage>
  )
}
