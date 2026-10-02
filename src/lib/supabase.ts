import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// A harmless placeholder keeps imports safe when env vars are missing;
// AuthProvider shows a configuration screen instead of using it.
export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'missing-anon-key')
