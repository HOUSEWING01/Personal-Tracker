import { createContext, useContext } from 'react'

export type AuthStatus = 'loading' | 'config-missing' | 'signed-out' | 'forbidden' | 'admin' | 'error'

export interface AuthValue {
  status: AuthStatus
  email: string | null
  errorMessage: string | null
  retry: () => void
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
