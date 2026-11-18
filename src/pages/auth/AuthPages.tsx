import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Mail } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { errorMessage } from '../../lib/utils'
import { Logo } from '../../components/Logo'
import { Button, Field, Input } from '../../components/ui'

function AuthLayout({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-ink-950">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[460px] w-[460px] -translate-x-1/2 rounded-full border border-ink-700/30" />
      <div className="pointer-events-none absolute left-1/2 top-[-140px] h-[300px] w-[300px] -translate-x-1/2 rounded-full border border-lime/10" />
      <div className="relative flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-[390px]">
          <Logo className="mb-14 justify-center" />
          <div className="mb-8 text-center">
            <h1 className="text-[28px] font-semibold tracking-[-0.035em] text-white">{title}</h1>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
      <p className="relative pb-7 text-center text-[10px] uppercase tracking-[0.2em] text-zinc-700">
        Tu sistema personal
      </p>
    </div>
  )
}

function AuthError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-950 bg-red-950/30 px-3.5 py-3 text-xs leading-relaxed text-red-300">
      {message}
    </div>
  )
}

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const from = (location.state as { from?: string } | null)?.from || '/today'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Bienvenido de nuevo" subtitle="Entra para retomar tu día, tus planes y tu progreso.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthError message={error} />}
        <Field label="Correo electrónico">
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
          />
        </Field>
        <Field label="Contraseña">
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs text-zinc-500 transition hover:text-lime">
            ¿Olvidaste la contraseña?
          </Link>
        </div>
        <Button type="submit" variant="primary" className="w-full" loading={loading}>
          Entrar <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
      <p className="mt-7 text-center text-xs text-zinc-500">
        ¿Aún no tienes cuenta?{' '}
        <Link to="/register" className="font-medium text-lime hover:text-lime-soft">
          Crear cuenta
        </Link>
      </p>
    </AuthLayout>
  )
}

export function RegisterPage() {
  const { signUp } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      const result = await signUp(email, password, displayName)
      if (result.needsConfirmation) setSent(true)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Revisa tu correo" subtitle="Te hemos enviado un enlace para confirmar tu cuenta.">
        <div className="rounded-2xl border border-lime/20 bg-lime/5 p-5 text-center">
          <CheckCircle2 className="mx-auto h-7 w-7 text-lime" />
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Confirma tu correo y después inicia sesión con <span className="text-white">{email}</span>.
          </p>
        </div>
        <Link to="/login" className="mt-6 block">
          <Button className="w-full">
            <ArrowLeft className="h-4 w-4" /> Volver al acceso
          </Button>
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Crear tu LIFE OS" subtitle="Un único lugar privado para organizar lo que importa.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthError message={error} />}
        <Field label="Nombre">
          <Input
            autoComplete="name"
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Tu nombre"
          />
        </Field>
        <Field label="Correo electrónico">
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
          />
        </Field>
        <Field label="Contraseña" hint="Mínimo 8 caracteres.">
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <Field label="Repetir contraseña">
          <Input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <Button type="submit" variant="primary" className="w-full" loading={loading}>
          Crear cuenta <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
      <p className="mt-7 text-center text-xs text-zinc-500">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-medium text-lime hover:text-lime-soft">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  )
}

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Recuperar acceso" subtitle="Te enviaremos un enlace seguro para crear una nueva contraseña.">
      {sent ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-lime/20 bg-lime/5 p-5 text-center">
            <Mail className="mx-auto h-7 w-7 text-lime" />
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Si existe una cuenta con <span className="text-white">{email}</span>, recibirás el enlace en unos minutos.
            </p>
          </div>
          <Link to="/login" className="block">
            <Button className="w-full">
              <ArrowLeft className="h-4 w-4" /> Volver al acceso
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <AuthError message={error} />}
          <Field label="Correo electrónico">
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@correo.com"
            />
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={loading}>
            Enviar enlace <ArrowRight className="h-4 w-4" />
          </Button>
          <Link to="/login" className="block pt-2 text-center text-xs text-zinc-500 transition hover:text-white">
            Volver al acceso
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}

export function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      await updatePassword(password)
      navigate('/today', { replace: true })
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Nueva contraseña" subtitle="Elige una contraseña distinta y segura para tu cuenta.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthError message={error} />}
        <Field label="Contraseña">
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <Field label="Repetir contraseña">
          <Input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <Button type="submit" variant="primary" className="w-full" loading={loading}>
          <KeyRound className="h-4 w-4" /> Guardar contraseña
        </Button>
      </form>
    </AuthLayout>
  )
}
