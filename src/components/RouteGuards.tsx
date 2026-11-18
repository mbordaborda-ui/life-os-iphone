import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Logo } from './Logo'
import { LoadingState } from './ui'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, configured } = useAuth()
  const location = useLocation()

  if (!configured) return <ConfigurationScreen />
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-950">
        <div className="space-y-4 text-center">
          <Logo className="justify-center" />
          <LoadingState label="Abriendo LIFE OS" />
        </div>
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, configured } = useAuth()
  if (!configured) return <ConfigurationScreen />
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-950">
        <LoadingState label="Comprobando sesión" />
      </div>
    )
  }
  if (session) return <Navigate to="/today" replace />
  return <>{children}</>
}

export function ConfigurationScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-950 px-5">
      <div className="w-full max-w-lg rounded-3xl border border-ink-700 bg-ink-850 p-7">
        <Logo />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight text-white">Configura Supabase</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          LIFE OS necesita las credenciales públicas de tu proyecto para autenticar y guardar tus datos reales.
        </p>
        <div className="mt-5 rounded-xl border border-ink-700 bg-ink-900 p-4 font-mono text-xs leading-relaxed text-zinc-400">
          VITE_SUPABASE_URL=...<br />
          VITE_SUPABASE_ANON_KEY=...
        </div>
        <p className="mt-4 text-xs leading-relaxed text-zinc-500">
          Crea un archivo <span className="text-zinc-300">.env</span> en la raíz, añade los valores y reinicia el servidor.
          Después aplica las migraciones de <span className="text-zinc-300">supabase/migrations</span>.
        </p>
      </div>
    </div>
  )
}
