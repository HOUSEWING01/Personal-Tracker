import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '../../lib/supabase'
import * as auth from '../../services/authService'
import { AuthContext, type AuthStatus, type AuthValue } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined = still loading the initial session
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'config-missing')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    auth.getSession()
      .then((s) => active && setSession(s))
      .catch((e: unknown) => {
        console.error('[auth] getSession failed', e)
        if (!active) return
        setErrorMessage(e instanceof Error ? e.message : 'Could not read your session.')
        setStatus('error')
      })
    const off = auth.onAuthChange((s) => active && setSession(s))
    return () => { active = false; off() }
  }, [attempt])

  // undefined (loading), null (signed out) and a token must all be distinct, or a signed-out start never leaves 'loading'.
  const sessionKey = session === undefined ? 'loading' : session === null ? 'signed-out' : session.access_token
  useEffect(() => {
    if (!isSupabaseConfigured || session === undefined) return
    if (session === null) { setStatus('signed-out'); return }
    let active = true
    setStatus('loading')
    auth.checkIsAdmin()
      .then((ok) => active && setStatus(ok ? 'admin' : 'forbidden'))
      .catch((e: unknown) => {
        console.error('[auth] is_admin check failed', e)
        if (!active) return
        setErrorMessage(e instanceof Error ? e.message : 'Could not verify admin access.')
        setStatus('error')
      })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, attempt])

  const retry = useCallback(() => { setErrorMessage(null); setStatus('loading'); setAttempt((n) => n + 1) }, [])
  const value = useMemo<AuthValue>(
    () => ({ status, email: session?.user.email ?? null, errorMessage, retry, signOut: auth.signOut }),
    [status, session, errorMessage, retry],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
