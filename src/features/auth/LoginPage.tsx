import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { FullScreenMessage, buttonPrimary } from '../../components/ui/FullScreenMessage'
import { signInWithPassword } from '../../services/authService'
import { useAuth } from './AuthContext'

const inputClass = 'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm'

export function LoginPage() {
  const { status } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (status === 'admin') return <Navigate to={from} replace />
  if (status === 'config-missing') return <Navigate to="/" replace />

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
