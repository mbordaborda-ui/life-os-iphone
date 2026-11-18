import { ChevronLeft, ChevronRight, Flame, Plus, Trash2, UtensilsCrossed } from 'lucide-react'
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
  useToast,
} from '../ui'
import { FoodLogModal } from './FoodLogModal'
import { useQuery } from '../../hooks/useQuery'
import { db } from '../../lib/supabase'
import { addDays, formatDateLong, isToday, toISODate } from '../../lib/dates'
import { MEAL_LABELS, MEAL_TYPES } from '../../lib/constants'
import { nutritionTotals } from '../../lib/calculations'
import { errorMessage, formatNumber } from '../../lib/utils'
import type { FoodLog } from '../../types'

export default function MealLog() {
  const { push } = useToast()
  const [date, setDate] = useState(toISODate(new Date()))
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FoodLog | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FoodLog | null>(null)
  const [deleting, setDeleting] = useState(false)

  const query = useQuery<FoodLog[]>(
    async () => {
      const { data, error } = await db()
        .from('food_logs')
        .select('*')
        .eq('log_date', date)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as FoodLog[]
    },
    [date],
    [],
  )

  const totals = useMemo(() => nutritionTotals(query.data), [query.data])
  const dateObject = useMemo(() => new Date(`${date}T12:00:00`), [date])

  async function deleteLog() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('food_logs').delete().eq('id', deleteTarget.id)
      if (error) throw error
      push('Registro eliminado')
      setDeleteTarget(null)
      setModalOpen(false)
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (query.loading) return <LoadingState label="Cargando diario" />
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        eyebrow="Alimentación"
        title="Registro alimentario"
        description="Lo que realmente comiste, con macros calculados desde tu catálogo de alimentos."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4" /> Registrar alimento
          </Button>
        }
      />

      <Card className="flex items-center justify-between p-3">
        <Button variant="ghost" size="icon" onClick={() => setDate(toISODate(addDays(dateObject, -1)))} aria-label="Día anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold text-white">{formatDateLong(dateObject)}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-600">
            {query.data.length} registros
          </p>
        </div>
        <div className="flex items-center gap-1">
          {!isToday(dateObject) && (
            <Button variant="secondary" size="sm" onClick={() => setDate(toISODate(new Date()))}>
              Hoy
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setDate(toISODate(addDays(dateObject, 1)))} aria-label="Día siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Calorías</p>
            <Flame className="h-4 w-4 text-zinc-600" />
          </div>
          <p className="mt-2 text-xl font-semibold text-white">{formatNumber(totals.calories, 0)}</p>
          <p className="text-[10px] text-zinc-600">kcal registradas</p>
        </Card>
        <Card className="p-4">
          <p className="muted-label">Proteína</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatNumber(totals.protein)} g</p>
          <p className="text-[10px] text-zinc-600">del total registrado</p>
        </Card>
        <Card className="p-4">
          <p className="muted-label">Carbohidratos</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatNumber(totals.carbs)} g</p>
          <p className="text-[10px] text-zinc-600">del total registrado</p>
        </Card>
        <Card className="p-4">
          <p className="muted-label">Grasas</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatNumber(totals.fat)} g</p>
          <p className="text-[10px] text-zinc-600">del total registrado</p>
        </Card>
        <Card className="p-4">
          <p className="muted-label">Fibra</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatNumber(totals.fiber)} g</p>
          <p className="text-[10px] text-zinc-600">del total registrado</p>
        </Card>
      </div>

      {query.data.length > 0 && totals.withNutrition < query.data.length && (
        <div className="rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-[11px] leading-relaxed text-zinc-500">
          {totals.withNutrition} de {query.data.length} registros tienen datos nutricionales. Los totales no están completos.
        </div>
      )}

      {query.data.length > 0 && (
        <div className="space-y-4">
          {MEAL_TYPES.map((mealType) => {
            const logs = query.data.filter((log) => log.meal_type === mealType)
            if (!logs.length) return null
            return (
              <section key={mealType}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    {MEAL_LABELS[mealType]}
                  </h2>
                  <span className="text-[10px] text-zinc-700">{logs.length} registros</span>
                </div>
                <Card className="divide-y divide-ink-700/60">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-800 text-zinc-500">
                        <UtensilsCrossed className="h-4 w-4" />
                      </div>
                      <button
                        onClick={() => {
                          setEditing(log)
                          setModalOpen(true)
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">{log.food_name}</p>
                          {log.meal_plan_id && <Badge tone="accent">Del plan</Badge>}
                        </div>
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          {formatNumber(log.quantity)} {log.unit}
                          {log.calories !== null && ` · ${formatNumber(log.calories, 0)} kcal`}
                          {log.protein_g !== null && ` · P ${formatNumber(log.protein_g, 0)} g`}
                          {log.carbs_g !== null && ` · C ${formatNumber(log.carbs_g, 0)} g`}
                          {log.fat_g !== null && ` · G ${formatNumber(log.fat_g, 0)} g`}
                          {log.fiber_g !== null && ` · Fibra ${formatNumber(log.fiber_g, 0)} g`}
                        </p>
                        {log.notes && <p className="mt-0.5 truncate text-[10px] text-zinc-600">{log.notes}</p>}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(log)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-red-500/10 hover:text-red-400"
                        aria-label="Eliminar registro"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </Card>
              </section>
            )
          })}
        </div>
      )}

      {!query.data.length && (
        <Card>
          <EmptyState
            icon={<UtensilsCrossed className="h-5 w-5" />}
            title="Sin registros este día"
            description="Registra lo que has comido eligiendo un alimento de tu catálogo. Los macros se calculan automáticamente."
            action={
              <Button
                onClick={() => {
                  setEditing(null)
                  setModalOpen(true)
                }}
              >
                <Plus className="h-4 w-4" /> Registrar alimento
              </Button>
            }
          />
        </Card>
      )}

      <FoodLogModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onSaved={query.reload}
        log={editing}
        defaultDate={date}
        onDelete={(log) => setDeleteTarget(log)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar registro alimentario"
        description="El registro se eliminará del diario. Si vino del planificador, la comida planificada seguirá marcada como consumida hasta que la deshagas allí."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteLog}
        loading={deleting}
      />
    </div>
  )
}
