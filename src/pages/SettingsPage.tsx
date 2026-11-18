import {
  Check,
  Database,
  FolderKanban,
  KeyRound,
  LogOut,
  Mail,
  Pencil,
  Plus,
  Settings2,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Category, CategoryKind } from '../types'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { db, isSupabaseConfigured } from '../lib/supabase'
import { formatDateNumeric } from '../lib/dates'
import { errorMessage } from '../lib/utils'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  useToast,
} from '../components/ui'

const TIMEZONES = [
  'Europe/Madrid',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Atlantic/Canary',
  'UTC',
]

const CATEGORY_KINDS: Array<{ value: CategoryKind; label: string }> = [
  { value: 'task', label: 'Tareas y objetivos' },
  { value: 'activity', label: 'Agenda' },
  { value: 'recipe', label: 'Recetas' },
  { value: 'food', label: 'Alimentos' },
]

const CATEGORY_COLORS = ['#b8f36b', '#7dd3fc', '#fbbf24', '#f472b6', '#a78bfa', '#fb923c', '#34d399', '#f87171']

export default function SettingsPage() {
  const { user, profile, updateProfile, signOut, requestPasswordReset, changePassword, configured } = useAuth()
  const { push } = useToast()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [timezone, setTimezone] = useState(profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>(profile?.unit_system ?? 'metric')
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [resetSending, setResetSending] = useState(false)

  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.display_name)
    setTimezone(profile.timezone)
    setUnitSystem(profile.unit_system)
  }, [profile?.id, profile?.updated_at])

  const timezoneOptions = Array.from(new Set([timezone, ...TIMEZONES].filter(Boolean)))
  const projectHost = getProjectHost()
  const online = typeof navigator === 'undefined' || navigator.onLine

  async function saveProfile() {
    if (!displayName.trim()) {
      push('El nombre no puede estar vacío', 'error')
      return
    }
    setSaving(true)
    try {
      await updateProfile({
        display_name: displayName.trim(),
        timezone,
        unit_system: unitSystem,
      })
      push('Perfil actualizado')
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setSaving(false)
    }
  }

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

  function resetPasswordForm() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
  }

  function openPasswordModal() {
    resetPasswordForm()
    setPasswordOpen(true)
  }

  function closePasswordModal() {
    if (passwordSaving) return
    setPasswordOpen(false)
    resetPasswordForm()
  }

  async function savePassword() {
    setPasswordError('')
    if (newPassword.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas nuevas no coinciden.')
      return
    }
    if (currentPassword === newPassword) {
      setPasswordError('La nueva contraseña debe ser distinta de la actual.')
      return
    }
    setPasswordSaving(true)
    try {
      await changePassword(currentPassword, newPassword)
      push('Contraseña actualizada')
      setPasswordOpen(false)
      resetPasswordForm()
    } catch (reason) {
      setPasswordError(errorMessage(reason))
    } finally {
      setPasswordSaving(false)
    }
  }

  async function sendResetLink() {
    if (!user?.email) return
    setResetSending(true)
    try {
      await requestPasswordReset(user.email)
      push(`Enlace de recuperación enviado a ${user.email}`)
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setResetSending(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        eyebrow="Ajustes"
        title="Tu cuenta y configuración"
        description="Perfil, seguridad, preferencias regionales, categorías y estado de la conexión."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime/10 text-lime">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">Perfil</h2>
              <p className="truncate text-[11px] text-zinc-500">{user?.email}</p>
            </div>
            <Badge tone="accent" className="ml-auto">
              <ShieldCheck className="h-3 w-3" /> Privado
            </Badge>
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Nombre visible">
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Tu nombre"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Zona horaria" hint="Se usa para interpretar fechas locales.">
                <Select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                  {timezoneOptions.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Unidades">
                <Select
                  value={unitSystem}
                  onChange={(event) => setUnitSystem(event.target.value as 'metric' | 'imperial')}
                >
                  <option value="metric">Métrico (kg, km)</option>
                  <option value="imperial">Imperial (lb, mi)</option>
                </Select>
              </Field>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-ink-700/60 pt-4">
              <p className="text-[10px] leading-relaxed text-zinc-600">
                Las preferencias se guardan en tu perfil de Supabase.
              </p>
              <Button variant="primary" onClick={saveProfile} loading={saving} disabled={!profile}>
                <Check className="h-4 w-4" /> Guardar
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-zinc-500" />
              <h2 className="text-sm font-semibold text-white">Seguridad</h2>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-zinc-500">Cuenta</span>
                <span className="truncate text-zinc-300">{user?.email}</span>
              </div>
              <p className="rounded-xl border border-ink-700 bg-ink-900 p-3 text-[11px] leading-relaxed text-zinc-500">
                Cambia tu contraseña sin salir de la app o recibe un enlace de recuperación en tu correo.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="secondary" onClick={openPasswordModal} disabled={!user}>
                  <KeyRound className="h-4 w-4" /> Cambiar contraseña
                </Button>
                <Button
                  variant="secondary"
                  onClick={sendResetLink}
                  loading={resetSending}
                  disabled={!user?.email}
                >
                  <Mail className="h-4 w-4" /> Recuperar contraseña
                </Button>
              </div>
              <div className="border-t border-ink-700/60 pt-3">
                <Button
                  variant="danger"
                  className="w-full"
                  onClick={() => setSignOutOpen(true)}
                  loading={signingOut}
                >
                  <LogOut className="h-4 w-4" /> Cerrar sesión
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-zinc-500" />
              <h2 className="text-sm font-semibold text-white">Conexión</h2>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-zinc-500">Credenciales</span>
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <span className={configured ? 'h-1.5 w-1.5 rounded-full bg-lime' : 'h-1.5 w-1.5 rounded-full bg-red-400'} />
                  {configured ? 'Clave pública configurada' : 'Sin configurar'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-zinc-500">Proyecto</span>
                <span className="truncate font-mono text-[10px] text-zinc-400">{projectHost || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-zinc-500">Red</span>
                <span className={online ? 'text-zinc-300' : 'text-amber-300'}>{online ? 'En línea' : 'Sin conexión'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-zinc-500">Cuenta creada</span>
                <span className="text-zinc-400">
                  {user?.created_at ? formatDateNumeric(new Date(user.created_at)) : '—'}
                </span>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-ink-700 bg-ink-900 p-3">
              <p className="text-[10px] leading-relaxed text-zinc-500">
                Tus datos se guardan de forma privada en Supabase. El frontend solo usa la clave pública y cada
                tabla está protegida con RLS.
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-zinc-500" />
              <h2 className="text-sm font-semibold text-white">Instalar en iPhone</h2>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              Abre LIFE OS en Safari, pulsa Compartir y elige <span className="text-zinc-300">Añadir a pantalla de inicio</span>.
              Se abrirá a pantalla completa con safe areas y navegación inferior nativa.
            </p>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-600">
              <Settings2 className="h-3.5 w-3.5" /> El service worker solo cachea assets estáticos. Los datos necesitan conexión.
            </div>
          </Card>
        </div>
      </div>

      <CategoryManager />

      <Modal
        open={passwordOpen}
        onClose={closePasswordModal}
        title="Cambiar contraseña"
        description="Introduce tu contraseña actual y elige una nueva."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={closePasswordModal}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={savePassword}
              loading={passwordSaving}
              disabled={!currentPassword || !newPassword || !confirmPassword}
            >
              <KeyRound className="h-4 w-4" /> Actualizar contraseña
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {passwordError && (
            <div className="rounded-xl border border-red-950 bg-red-950/30 px-3.5 py-3 text-xs leading-relaxed text-red-300">
              {passwordError}
            </div>
          )}
          <Field label="Contraseña actual">
            <Input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Nueva contraseña" hint="Mínimo 8 caracteres.">
            <Input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>
          <Field label="Repetir nueva contraseña">
            <Input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </Field>
        </div>
      </Modal>

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

function CategoryManager() {
  const { user } = useAuth()
  const { push } = useToast()
  const query = useCategories()
  const [form, setForm] = useState<{ id: string | null; name: string; kind: CategoryKind; color: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)

  const grouped = CATEGORY_KINDS.map((kind) => ({
    ...kind,
    items: query.data.filter((category) => category.kind === kind.value),
  }))

  function nextColor(kind: CategoryKind) {
    const used = new Set(query.data.filter((category) => category.kind === kind).map((category) => category.color))
    return CATEGORY_COLORS.find((color) => !used.has(color)) ?? CATEGORY_COLORS[0]
  }

  function startCreate(kind: CategoryKind = 'task') {
    setForm({ id: null, name: '', kind, color: nextColor(kind) })
  }

  function startEdit(category: Category) {
    setForm({ id: category.id, name: category.name, kind: category.kind, color: category.color })
  }

  async function save() {
    if (!form || !user) return
    if (!form.name.trim()) {
      push('Escribe un nombre para la categoría', 'error')
      return
    }
    setSaving(true)
    try {
      if (form.id) {
        const { error } = await db()
          .from('categories')
          .update({ name: form.name.trim(), color: form.color })
          .eq('id', form.id)
        if (error) throw error
      } else {
        const { error } = await db().from('categories').insert({
          user_id: user.id,
          kind: form.kind,
          name: form.name.trim(),
          color: form.color,
        })
        if (error) throw error
      }
      push(form.id ? 'Categoría actualizada' : 'Categoría creada')
      setForm(null)
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('categories').delete().eq('id', deleteTarget.id)
      if (error) throw error
      push('Categoría eliminada')
      setDeleteTarget(null)
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-zinc-500" />
          <div>
            <h2 className="text-sm font-semibold text-white">Categorías</h2>
            <p className="text-[10px] text-zinc-500">Organiza tareas, agenda, recetas y alimentos.</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => startCreate()}>
          <Plus className="h-3.5 w-3.5" /> Nueva categoría
        </Button>
      </div>

      {form && (
        <div className="mt-4 rounded-xl border border-ink-700 bg-ink-900 p-3 animate-fade-in">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
            <Field label="Nombre">
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => (current ? { ...current, name: event.target.value } : current))}
                placeholder="Ej. Trabajo"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter') save()
                }}
              />
            </Field>
            <Field label="Tipo">
              <Select
                value={form.kind}
                onChange={(event) => {
                  const kind = event.target.value as CategoryKind
                  setForm((current) =>
                    current
                      ? { ...current, kind, color: current.id ? current.color : nextColor(kind) }
                      : current,
                  )
                }}
                disabled={Boolean(form.id)}
              >
                {CATEGORY_KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Color">
              <div className="flex h-11 items-center gap-1.5">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((current) => (current ? { ...current, color } : current))}
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 transition"
                    style={{
                      backgroundColor: color,
                      borderColor: form.color === color ? '#ffffff' : 'transparent',
                    }}
                    aria-label={`Color ${color}`}
                  >
                    {form.color === color && <Check className="h-3 w-3 text-black" />}
                  </button>
                ))}
              </div>
            </Field>
            <div className="flex items-end gap-2">
              <Button variant="primary" onClick={save} loading={saving} disabled={!form.name.trim()}>
                Guardar
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setForm(null)} aria-label="Cancelar">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {grouped.map((group) => (
          <div key={group.value}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{group.label}</h3>
              <button
                onClick={() => startCreate(group.value)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 hover:bg-ink-800 hover:text-lime"
                aria-label={`Nueva categoría de ${group.label}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {group.items.length ? (
              <div className="space-y-1">
                {group.items.map((category) => (
                  <div key={category.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-800/50">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                    <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">{category.name}</span>
                    <button
                      onClick={() => startEdit(category)}
                      className="flex h-6 w-6 items-center justify-center rounded text-zinc-700 opacity-0 transition hover:text-white group-hover:opacity-100 focus:opacity-100"
                      aria-label="Editar categoría"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(category)}
                      className="flex h-6 w-6 items-center justify-center rounded text-zinc-700 opacity-0 transition hover:text-red-300 group-hover:opacity-100 focus:opacity-100"
                      aria-label="Eliminar categoría"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-ink-700/60 px-2 py-3 text-[10px] text-zinc-600">
                Sin categorías todavía.
              </p>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar categoría"
        description="Los elementos que la usaban se conservarán sin categoría."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={deleting}
      />
    </Card>
  )
}

function getProjectHost() {
  if (!isSupabaseConfigured) return ''
  try {
    return new URL(import.meta.env.VITE_SUPABASE_URL as string).host
  } catch {
    return ''
  }
}
