import type { Session, User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Profile } from '../types'
import { db, isSupabaseConfigured } from '../lib/supabase'
import { errorMessage } from '../lib/utils'

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  configured: boolean
  authError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  updateProfile: (values: Pick<Profile, 'display_name' | 'timezone' | 'unit_system'>) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    let mounted = true
    db()
      .auth.getSession()
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) setAuthError(error.message)
        setSession(data.session)
      })
      .catch((error) => {
        if (mounted) setAuthError(errorMessage(error))
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    const { data: listener } = db().auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const loadProfile = useCallback(async (user: User) => {
    const client = db()
    const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (error) throw error
    if (data) {
      setProfile(data as Profile)
      return
    }
    const fallbackName =
      (user.user_metadata?.display_name as string | undefined) || user.email?.split('@')[0] || 'Mi perfil'
    const { data: created, error: createError } = await client
      .from('profiles')
      .upsert({ id: user.id, display_name: fallbackName })
      .select('*')
      .single()
    if (createError) throw createError
    setProfile(created as Profile)
  }, [])

  useEffect(() => {
    const user = session?.user
    if (!user) {
      setProfile(null)
      return
    }
    let active = true
    loadProfile(user).catch((error) => {
      if (active) setAuthError(errorMessage(error))
    })
    return () => {
      active = false
    }
  }, [session?.user, loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await db().auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await db().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() } },
    })
    if (error) throw error
    return { needsConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await db().auth.signOut()
    if (error) throw error
    setProfile(null)
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await db().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await db().auth.updateUser({ password })
    if (error) throw error
  }, [])

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const email = session?.user.email
      if (!email) throw new Error('No hay una sesión activa.')
      const { error: verifyError } = await db().auth.signInWithPassword({ email, password: currentPassword })
      if (verifyError) throw new Error('La contraseña actual no es correcta.')
      const { error } = await db().auth.updateUser({ password: newPassword })
      if (error) throw error
    },
    [session?.user.email],
  )

  const updateProfile = useCallback(
    async (values: Pick<Profile, 'display_name' | 'timezone' | 'unit_system'>) => {
      if (!session?.user) throw new Error('No hay una sesión activa.')
      const { data, error } = await db()
        .from('profiles')
        .update(values)
        .eq('id', session.user.id)
        .select('*')
        .single()
      if (error) throw error
      setProfile(data as Profile)
    },
    [session?.user],
  )

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user)
  }, [session?.user, loadProfile])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      configured: isSupabaseConfigured,
      authError,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      changePassword,
      updateProfile,
      refreshProfile,
    }),
    [
      session,
      profile,
      loading,
      authError,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      changePassword,
      updateProfile,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return value
}
