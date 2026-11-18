import { createClient } from '@supabase/supabase-js'
import { isNetworkError } from './utils'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project') && !supabaseAnonKey.includes('your-anon-key'),
)

const fetchWithRetry: typeof fetch = async (input, init) => {
  const method = (init?.method ?? 'GET').toUpperCase()
  try {
    return await fetch(input, init)
  } catch (error) {
    if (!isNetworkError(error) || (method !== 'GET' && method !== 'HEAD')) throw error
    await new Promise((resolve) => setTimeout(resolve, 400))
    return fetch(input, init)
  }
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        fetch: fetchWithRetry,
      },
    })
  : null

export function db() {
  if (!supabase) {
    throw new Error('Supabase no está configurado. Añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.')
  }
  return supabase
}
