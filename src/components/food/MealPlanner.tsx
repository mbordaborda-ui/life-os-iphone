import {
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Plus,
  RotateCcw,
} from 'lucide-react'
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
import { MealPlanModal } from './MealPlanModal'
import { useQuery } from '../../hooks/useQuery'
import { db } from '../../lib/supabase'
import {
  addDays,
  endOfWeek,
  formatDateShort,
  formatWeekday,
  isToday,
  startOfWeek,
  toISODate,
  WEEKDAYS_SHORT,
} from '../../lib/dates'
import { MEAL_LABELS, MEAL_TYPES } from '../../lib/constants'
import { percentage, recipeCost, recipeNutrition } from '../../lib/calculations'
import { cn, errorMessage, formatMoney, formatNumber } from '../../lib/utils'
import type { Category, MealPlan, MealPlanWithRecipe, MealType, Recipe } from '../../types'

type PlannerData = { meals: MealPlanWithRecipe[]; recipes: Recipe[]; categories: Category[] }
const EMPTY: PlannerData = { meals: [], recipes: [], categories: [] }

export default function MealPlanner() {
  const { push } = useToast()
  const [anchor, setAnchor] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MealPlan | null>(null)
  const [defaultDate, setDefaultDate] = useState(toISODate(new Date()))
  const [defaultMealType, setDefaultMealType] = useState<MealType>('lunch')
  const [deleteTarget, setDeleteTarget] = useState<MealPlan | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [busyMeal, setBusyMeal] = useState<string | null>(null)

  const weekStart = startOfWeek(anchor)
  const weekEnd = endOfWeek(anchor)
  const startISO = toISODate(weekStart)
  const endISO = toISODate(weekEnd)
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

  const query = useQuery<PlannerData>(
    async () => {
      const client = db()
      const [meals, recipes, categories] = await Promise.all([
        client
          .from('meal_plans')
          .select('*, recipes(id, name, servings, recipe_ingredients(*, foods(*)))')
          .gte('plan_date', startISO)
          .lte('plan_date', endISO)
          .order('created_at'),
        client.from('recipes').select('*').order('name'),
        client.from('categories').select('*').eq('kind', 'recipe').order('name'),
      ])
      if (meals.error) throw meals.error
      if (recipes.error) throw recipes.error
      if (categories.error) throw categories.error
      return {
        meals: (meals.data ?? []) as MealPlanWithRecipe[],
        recipes: (recipes.data ?? []) as Recipe[],
        categories: (categories.data ?? []) as Category[],
      }
    },
    [startISO, endISO],
    EMPTY,
  )

  const consumed = query.data.meals.filter((meal) => meal.is_consumed).length
  const progress = percentage(consumed, query.data.meals.length)

  function openNew(date: string, mealType: MealType) {
    setEditing(null)
    setDefaultDate(date)
    setDefaultMealType(mealType)
    setModalOpen(true)
  }

  function openEdit(meal: MealPlan) {
    setEditing(meal)
    setModalOpen(true)
  }

  async function consume(meal: MealPlanWithRecipe) {
    setBusyMeal(meal.id)
    try {
      const { error } = await db().rpc('consume_meal_plan', { p_meal_plan_id: meal.id })
      if (error) throw error
      push('Registrado en el diario alimentario')
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setBusyMeal(null)
    }
  }

  async function unconsume(meal: MealPlanWithRecipe) {
    setBusyMeal(meal.id)
    try {
      const { error } = await db().rpc('unconsume_meal_plan', { p_meal_plan_id: meal.id })
      if (error) throw error
      push('Registro deshecho', 'info')
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setBusyMeal(null)
    }
  }

  async function deleteMeal() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('meal_plans').delete().eq('id', deleteTarget.id)
      if (error) throw error
      push('Comida eliminada del plan')
      setDeleteTarget(null)
      setModalOpen(false)
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const mealsByDay = useMemo(() => {
    const map = new Map<string, MealPlanWithRecipe[]>()
    days.forEach((day) => map.set(toISODate(day), []))
    query.data.meals.forEach((meal) => {
      map.set(meal.plan_date, [...(map.get(meal.plan_date) ?? []), meal])
    })
    return map
  }, [days, query.data.meals])

  if (query.loading) return <LoadingState label="Cargando planificador" />
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        eyebrow="Alimentación"
        title="Planificador semanal"
        description="Planifica con intención. Registra lo que realmente comiste."
        actions={
          <Button variant="primary" onClick={() => openNew(toISODate(new Date()), 'lunch')}>
            <Plus className="h-4 w-4" /> Planificar comida
          </Button>
        }
      />

      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" onClick={() => setAnchor(addDays(anchor, -7))} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1 text-center sm:min-w-[170px] sm:flex-none">
            <p className="text-sm font-semibold text-white">
              {formatDateShort(weekStart)} – {formatDateShort(weekEnd)}
            </p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">Semana planificada</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setAnchor(addDays(anchor, 7))} aria-label="Semana siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" className="shrink-0" onClick={() => setAnchor(new Date())}>
            Hoy
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-[110px]">
            <div className="mb-1.5 flex justify-between text-[10px] text-zinc-500">
              <span>Cumplimiento</span>
              <span className="text-lime">{Math.round(progress)}%</span>
            </div>
            <ProgressBar value={progress} />
          </div>
          <Badge tone="muted">
            {consumed}/{query.data.meals.length} consumidas
          </Badge>
        </div>
      </Card>

      <div className="grid gap-3 xl:grid-cols-7">
        {days.map((day) => {
          const dateISO = toISODate(day)
          const dayMeals = mealsByDay.get(dateISO) ?? []
          return (
            <Card
              key={dateISO}
              className={cn('overflow-hidden', isToday(day) && 'border-lime/25')}
            >
              <div className={cn('flex items-center justify-between border-b border-ink-700/60 px-3 py-2.5', isToday(day) && 'bg-lime/[0.03]')}>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                    {WEEKDAYS_SHORT[(day.getDay() + 6) % 7]}
                  </p>
                  <p className={cn('text-sm font-semibold', isToday(day) ? 'text-lime' : 'text-white')}>{day.getDate()}</p>
                </div>
                <button
                  onClick={() => openNew(dateISO, 'lunch')}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-ink-800 hover:text-white"
                  aria-label={`Añadir comida el ${formatWeekday(day)}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="divide-y divide-ink-700/40">
                {MEAL_TYPES.map((mealType) => {
                  const meals = dayMeals.filter((meal) => meal.meal_type === mealType)
                  return (
                    <div key={mealType} className="p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-600">
                          {MEAL_LABELS[mealType]}
                        </span>
                        {!meals.length && (
                          <button
                            onClick={() => openNew(dateISO, mealType)}
                            className="text-[9px] text-zinc-700 transition hover:text-lime"
                          >
                            Añadir
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {meals.map((meal) => (
                          <div
                            key={meal.id}
                            className={cn(
                              'group rounded-lg border px-2 py-2 transition',
                              meal.is_consumed ? 'border-lime/10 bg-lime/[0.035]' : 'border-ink-700/70 bg-ink-900/60',
                            )}
                          >
                            <button onClick={() => openEdit(meal)} className="w-full text-left">
                              <p className="text-[11px] font-medium leading-snug text-white">
                                {meal.recipes?.name || meal.title}
                              </p>
                              <p className="mt-0.5 text-[9px] text-zinc-500">
                                {meal.servings} ración{meal.servings === 1 ? '' : 'es'}
                                {meal.recipes?.recipe_ingredients?.length
                                  ? ` · ${formatNumber(
                                      recipeNutrition(meal.recipes.recipe_ingredients, meal.recipes.servings).perServing
                                        .calories * meal.servings,
                                      0,
                                    )} kcal · ${formatMoney(
                                      recipeCost(meal.recipes.recipe_ingredients, meal.recipes.servings).perServing *
                                        meal.servings,
                                    )}`
                                  : ''}
                                {meal.is_consumed ? ' · consumida' : ''}
                              </p>
                            </button>
                            <div className="mt-1.5 flex items-center gap-1">
                              {meal.is_consumed ? (
                                <button
                                  onClick={() => unconsume(meal)}
                                  disabled={busyMeal === meal.id}
                                  className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-amber-300 disabled:opacity-50"
                                >
                                  <RotateCcw className="h-3 w-3" /> Desmarcar
                                </button>
                              ) : (
                                <button
                                  onClick={() => consume(meal)}
                                  disabled={busyMeal === meal.id}
                                  className="flex items-center gap-1 text-[9px] text-lime hover:text-lime-soft disabled:opacity-50"
                                >
                                  {busyMeal === meal.id ? (
                                    <Circle className="h-2.5 w-2.5 animate-pulse" />
                                  ) : (
                                    <Check className="h-2.5 w-2.5" />
                                  )}
                                  Registrar
                                </button>
                              )}
                              <span className="ml-auto text-zinc-700">
                                {meal.is_consumed ? <Check className="h-3 w-3 text-lime" /> : null}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )
        })}
      </div>

      {!query.data.meals.length && (
        <Card>
          <EmptyState
            icon={<CalendarRange className="h-5 w-5" />}
            title="Semana sin planificar"
            description="Añade comidas a tus días para separar lo previsto de lo consumido y calcular el cumplimiento real."
            action={
              <Button onClick={() => openNew(toISODate(new Date()), 'lunch')}>
                <Plus className="h-4 w-4" /> Primera comida
              </Button>
            }
          />
        </Card>
      )}

      <div className="flex items-center justify-between text-[11px] text-zinc-600">
        <span>
          {query.data.recipes.length} recetas disponibles.{' '}
          {query.data.recipes.length === 0 && 'Crea una receta para reutilizarla en el plan.'}
        </span>
      </div>

      <MealPlanModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onSaved={query.reload}
        meal={editing}
        recipes={query.data.recipes}
        categories={query.data.categories}
        defaultDate={defaultDate}
        defaultMealType={defaultMealType}
        onDelete={(meal) => setDeleteTarget(meal)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar del plan"
        description="La comida planificada se eliminará. Los registros alimentarios ya guardados no se borrarán."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteMeal}
        loading={deleting}
      />
    </div>
  )
}
