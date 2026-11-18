import { Check, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  ProgressBar,
  useToast,
} from '../ui'
import { PriorityFoodModal } from './PriorityFoodModal'
import { useAuth } from '../../hooks/useAuth'
import { useQuery } from '../../hooks/useQuery'
import { db } from '../../lib/supabase'
import { startOfMonth, startOfWeek, toISODate } from '../../lib/dates'
import { percentage } from '../../lib/calculations'
import { errorMessage } from '../../lib/utils'
import type { PriorityFood, PriorityFoodLog } from '../../types'

export default function PriorityFoodsPage() {
  const { user } = useAuth()
  const { push } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PriorityFood | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PriorityFood | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const todayISO = toISODate(new Date())
  const weekStart = startOfWeek(new Date())
  const monthStart = startOfMonth(new Date())

  const query = useQuery<{ foods: PriorityFood[]; logs: PriorityFoodLog[] }>(
    async () => {
      const client = db()
      const [foods, logs] = await Promise.all([
        client.from('priority_foods').select('*').order('name'),
        client.from('priority_food_logs').select('*').order('logged_on', { ascending: false }),
      ])
      if (foods.error) throw foods.error
      if (logs.error) throw logs.error
      return {
        foods: (foods.data ?? []) as PriorityFood[],
        logs: (logs.data ?? []) as PriorityFoodLog[],
      }
    },
    [],
    { foods: [], logs: [] },
  )

  const stats = useMemo(() => {
    const active = query.data.foods.filter((food) => food.is_active)
    const weekly = active.filter((food) => food.period === 'weekly')
    const met = weekly.filter((food) => {
      const count = query.data.logs.filter(
        (log) => log.priority_food_id === food.id && new Date(`${log.logged_on}T12:00:00`) >= weekStart,
      ).length
      return count >= food.target_count
    })
    return { active: active.length, met: met.length, rate: percentage(met.length, weekly.length) }
  }, [query.data, weekStart])

  async function toggleToday(food: PriorityFood) {
    if (!user) return
    const existing = query.data.logs.find(
      (log) => log.priority_food_id === food.id && log.logged_on === todayISO,
    )
    setBusy(food.id)
    try {
      if (existing) {
        const { error } = await db().from('priority_food_logs').delete().eq('id', existing.id)
        if (error) throw error
        push('Consumo de hoy eliminado', 'info')
      } else {
        const { error } = await db()
          .from('priority_food_logs')
          .insert({ user_id: user.id, priority_food_id: food.id, logged_on: todayISO, quantity: 1 })
        if (error) throw error
        push('Consumo registrado')
      }
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function deleteFood() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('priority_foods').delete().eq('id', deleteTarget.id)
      if (error) throw error
      push('Alimento prioritario eliminado')
      setDeleteTarget(null)
      setModalOpen(false)
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (query.loading) return <LoadingState label="Cargando prioridades" />
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        eyebrow="Alimentación"
        title="Alimentos prioritarios"
        description="Lo que quieres comer con frecuencia, medido con datos reales."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4" /> Añadir alimento
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="muted-label">Prioridades activas</p>
          <p className="mt-2 text-2xl font-semibold text-white">{stats.active}</p>
        </Card>
        <Card className="p-4">
          <p className="muted-label">Objetivos semanales cumplidos</p>
          <p className="mt-2 text-2xl font-semibold text-white">{stats.met}</p>
        </Card>
        <Card className="p-4">
          <div className="flex justify-between">
            <p className="muted-label">Cumplimiento semanal</p>
            <span className="text-xs font-semibold text-lime">{Math.round(stats.rate)}%</span>
          </div>
          <ProgressBar value={stats.rate} className="mt-4" />
        </Card>
      </div>

      {query.data.foods.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {query.data.foods.map((food) => {
            const weekCount = query.data.logs.filter(
              (log) => log.priority_food_id === food.id && new Date(`${log.logged_on}T12:00:00`) >= weekStart,
            ).length
            const monthCount = query.data.logs.filter(
              (log) => log.priority_food_id === food.id && new Date(`${log.logged_on}T12:00:00`) >= monthStart,
            ).length
            const periodCount = food.period === 'weekly' ? weekCount : monthCount
            const rate = percentage(periodCount, food.target_count)
            const consumedToday = query.data.logs.some(
              (log) => log.priority_food_id === food.id && log.logged_on === todayISO,
            )
            return (
              <Card key={food.id} className={food.is_active ? '' : 'opacity-60'}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{food.name}</h3>
                        {!food.is_active && <Badge tone="muted">Inactivo</Badge>}
                      </div>
                      <p className="mt-0.5 text-[10px] text-zinc-500">
                        {food.category || 'Sin categoría'} · objetivo {food.period === 'weekly' ? 'semanal' : 'mensual'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditing(food)
                        setModalOpen(true)
                      }}
                      className="text-[10px] text-zinc-600 hover:text-white"
                    >
                      Editar
                    </button>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-xl font-semibold text-white">
                        {periodCount}
                        <span className="text-sm font-normal text-zinc-600"> / {food.target_count}</span>
                      </p>
                      <p className="text-[10px] text-zinc-600">
                        {food.period === 'weekly' ? 'esta semana' : 'este mes'}
                      </p>
                    </div>
                    <div className="text-right text-[10px] text-zinc-600">
                      <p>Semana: {weekCount}</p>
                      <p>Mes: {monthCount}</p>
                    </div>
                  </div>
                  <ProgressBar value={rate} className="mt-3" />
                </div>
                <div className="flex items-center justify-between border-t border-ink-700/60 bg-ink-900/50 px-3 py-2">
                  <button
                    onClick={() => toggleToday(food)}
                    disabled={busy === food.id || !food.is_active}
                    className={`inline-flex items-center gap-1.5 text-[10px] font-medium disabled:opacity-40 ${
                      consumedToday ? 'text-lime' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    {consumedToday ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    {consumedToday ? 'Consumido hoy' : 'Registrar hoy'}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(food)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-700 hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="Sin alimentos prioritarios"
            description="Añade alimentos o grupos que quieras incorporar con frecuencia, como verduras, legumbres o pescado."
            action={
              <Button
                onClick={() => {
                  setEditing(null)
                  setModalOpen(true)
                }}
              >
                <Plus className="h-4 w-4" /> Crear prioridad
              </Button>
            }
          />
        </Card>
      )}

      <p className="text-[11px] leading-relaxed text-zinc-600">
        El registro es diario e idempotente: no puedes contar dos veces el mismo alimento el mismo día. La frecuencia se calcula con esos registros reales.
      </p>

      <PriorityFoodModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onSaved={query.reload}
        food={editing}
        onDelete={(food) => setDeleteTarget(food)}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar alimento prioritario"
        description="También se eliminará su historial de consumo. Esta acción no se puede deshacer."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteFood}
        loading={deleting}
      />
    </div>
  )
}
