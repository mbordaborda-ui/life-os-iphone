import {
  Apple,
  CalendarDays,
  ChartNoAxesCombined,
  Dumbbell,
  LogOut,
  Settings,
  Sun,
  UserRound,
  Wallet,
  WifiOff,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { cn, errorMessage } from '../lib/utils'
import { Logo } from './Logo'
import { ConfirmDialog, useToast } from './ui'

const NAV = [
  { to: '/today', label: 'Hoy', icon: Sun },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/food', label: 'Alimentación', shortLabel: 'Comida', icon: Apple },
  { to: '/training', label: 'Entrenamiento', shortLabel: 'Entreno', icon: Dumbbell },
  { to: '/finance', label: 'Finanzas', shortLabel: 'Dinero', icon: Wallet },
  { to: '/progress', label: 'Progreso', icon: ChartNoAxesCombined },
]

const SECTION_TITLES: Record<string, string> = {
  today: 'Hoy',
  agenda: 'Agenda',
  tasks: 'Tareas',
  notes: 'Notas',
  food: 'Alimentación',
  training: 'Entrenamiento',
  finance: 'Finanzas',
  progress: 'Progreso',
  settings: 'Ajustes',
}

function activeFor(pathname: string, to: string) {
  if (to === '/today') return pathname === '/today'
  if (to === '/agenda') return pathname.startsWith('/agenda')
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function AppShell() {
  const { profile, user, signOut } = useAuth()
  const { push } = useToast()
  const location = useLocation()
  const online = useNetworkStatus()
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const section = location.pathname.split('/').filter(Boolean)[0] || 'today'
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Perfil'
  const initial = displayName.slice(0, 1).toUpperCase()

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      setSignOutOpen(false)
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-dvh bg-ink-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-ink-700/60 bg-ink-950 px-4 md:flex">
        <div className="flex h-20 items-center px-2">
          <Logo />
        </div>
        <nav className="mt-3 space-y-1">
          {NAV.map((item) => {
            const active = activeFor(location.pathname, item.to)
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98]',
                  active ? 'bg-ink-800 text-white' : 'text-zinc-500 hover:bg-ink-900 hover:text-zinc-200',
                )}
              >
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110 group-active:scale-95',
                    active && 'scale-110 text-lime',
                  )}
                  strokeWidth={1.8}
                />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="mt-auto space-y-1 pb-6">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.98]',
                isActive ? 'bg-ink-800 text-white' : 'text-zinc-500 hover:bg-ink-900 hover:text-zinc-200',
              )
            }
          >
            <Settings
              className="h-[18px] w-[18px] transition-transform duration-200 group-hover:rotate-12 group-hover:scale-110"
              strokeWidth={1.8}
            />
            Ajustes
          </NavLink>
          <NavLink
            to="/settings"
            className="mt-3 flex items-center gap-3 rounded-xl border border-ink-700/70 bg-ink-850 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-600 hover:bg-ink-800 active:scale-[0.99]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lime/10 text-sm font-semibold text-lime">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-white">{displayName}</span>
              <span className="block truncate text-[11px] text-zinc-500">{user?.email}</span>
            </span>
            <UserRound className="ml-auto h-4 w-4 text-zinc-600" />
          </NavLink>
          {!online && (
            <div className="mt-3 flex items-center gap-2 px-3 text-[11px] text-amber-400">
              <WifiOff className="h-3.5 w-3.5" /> Sin conexión
            </div>
          )}
        </div>
      </aside>

      <div className="md:pl-[232px]">
        <header className="safe-top sticky top-0 z-20 border-b border-ink-700/60 bg-ink-950/95 backdrop-blur-md">
          <div className="flex h-14 items-center justify-between px-4 md:h-16 md:px-8">
            <div className="md:hidden">
              <Logo />
            </div>
            <div className="hidden md:block">
              <p className="muted-label">LIFE OS</p>
              <p className="mt-0.5 text-sm font-medium text-zinc-300">{SECTION_TITLES[section] ?? 'LIFE OS'}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <NavLink
                to="/settings"
                aria-label="Perfil"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-700 bg-ink-850 text-xs font-semibold text-lime transition-all duration-150 hover:scale-105 hover:border-ink-600 active:scale-95"
              >
                {initial}
              </NavLink>
              <NavLink
                to="/settings"
                aria-label="Configuración"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-all duration-150 hover:scale-105 hover:bg-ink-800 hover:text-white active:scale-90"
              >
                <Settings className="h-[18px] w-[18px]" />
              </NavLink>
              <button
                type="button"
                onClick={() => setSignOutOpen(true)}
                aria-label="Cerrar sesión"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-all duration-150 hover:scale-105 hover:bg-red-500/10 hover:text-red-300 active:scale-90"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
          {!online && (
            <div className="flex items-center justify-center gap-2 border-t border-amber-500/10 bg-amber-500/5 px-4 py-2 text-[11px] text-amber-300 md:hidden">
              <WifiOff className="h-3.5 w-3.5" /> Sin conexión · los cambios no se guardarán hasta volver a estar online
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-lime/25 to-transparent" />
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 md:px-8 md:pb-8 md:pt-8">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-700/70 bg-ink-950/95 backdrop-blur-md md:hidden">
        <div className="grid grid-cols-6 px-1 pb-[env(safe-area-inset-bottom,0px)]">
          {NAV.map((item) => {
            const active = activeFor(location.pathname, item.to)
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 pb-1 pt-2.5 text-[9px] font-medium tracking-wide transition-all duration-200 active:scale-90',
                  active ? 'text-lime' : 'text-zinc-600',
                )}
              >
                <Icon
                  className={cn(
                    'h-[21px] w-[21px] transition-transform duration-300',
                    active && 'scale-110 drop-shadow-[0_0_8px_rgba(184,243,107,0.35)]',
                  )}
                  strokeWidth={active ? 2.2 : 1.7}
                />
                <span className="max-w-full truncate px-0.5">{item.shortLabel || item.label}</span>
                <span
                  className={cn(
                    'h-0.5 w-4 rounded-full',
                    active ? 'bg-lime motion-safe:animate-pulse-soft' : 'bg-transparent',
                  )}
                />
              </NavLink>
            )
          })}
        </div>
      </nav>

      <ConfirmDialog
        open={signOutOpen}
        title="Cerrar sesión"
        description="Tendrás que volver a iniciar sesión para acceder a tus datos en este dispositivo."
        confirmLabel="Cerrar sesión"
        onCancel={() => setSignOutOpen(false)}
        onConfirm={handleSignOut}
        loading={signingOut}
      />
    </div>
  )
}
