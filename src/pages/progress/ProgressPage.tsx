import { ChevronLeft, ChevronRight, Dumbbell, Salad, Target, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import type {
  Activity,
  Category,
  FoodLog,
  MealPlan,
  PantryTransaction,
  PriorityFood,
  PriorityFoodLog,
  Task,
  WorkoutRoutine,
  WorkoutSessionWithLogs,
} from '../../types'
import { useQuery } from '../../hooks/useQuery'
import { db } from '../../lib/supabase'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  formatDateShort,
  formatMonthYear,
  rangeDays,
  startOfMonth,
  startOfWeek,
  toISODate,
} from '../../lib/dates'
import { expandActivities } from '../../lib/dates'
import { Button, ErrorState, LoadingState, PageHeader, Segmented } from '../../components/ui'
import { ProductivitySection } from '../../components/progress/ProductivitySection'
import { FoodStatsSection } from '../../components/progress/FoodStatsSection'
import { TrainingStatsSection } from '../../components/progress/TrainingStatsSection'
import { GoalsPanel } from '../../components/progress/GoalsPanel'

type Tab = 'productivity' | 'food' | 'training' | 'goals'
type PeriodType = 'week' | 'month'
type WasteTransaction = PantryTransaction & { pantry_items: { name: string; unit: string } | null }

type ProgressData = {
  tasks: Task[]
  activities: Activity[]
  meals: MealPlan[]
  foodLogs: FoodLog[]
  priorityFoods: PriorityFood[]
  priorityLogs: PriorityFoodLog[]
  waste: WasteTransaction[]
  sessions: WorkoutSessionWithLogs[]
  routines: WorkoutRoutine[]
  categories: Category[]
}

const EMPTY: ProgressData = {
  tasks: [],
  activities: [],
  meals: [],
  foodLogs: [],
  priorityFoods: [],
  priorityLogs: [],
  waste: [],
  sessions: [],
  routines: [],
  categories: [],
}

export default function ProgressPage() {
  const [tab, setTab] = useState<Tab>('productivity')
  const [periodType, setPeriodType] = useState<PeriodType>('week')
  const [anchor, setAnchor] = useState(new Date())

  const start = periodType === 'week' ? startOfWeek(anchor) : startOfMonth(anchor)
  const end = periodType === 'week' ? endOfWeek(anchor) : endOfMonth(anchor)
  const days = useMemo(() => rangeDays(start, end), [start.getTime(), end.getTime()])
  const startISO = toISODate(start)
  const endISO = toISODate(end)

  const query = useQuery<ProgressData>(
    async () => {
      const client = db()
      const [tasks, activities, meals, foodLogs, priorityFoods, priorityLogs, waste, sessions, routines, categories] =
        await Promise.all([
          client.from('tasks').select('*').order('created_at', { ascending: false }),
          client.from('activities').select('*').order('start_at'),
          client
            .from('meal_plans')
            .select('*')
            .gte('plan_date', startISO)
            .lte('plan_date', endISO)
            .order('plan_date'),
          client
            .from('food_logs')
            .select('*')
            .gte('log_date', startISO)
            .lte('log_date', endISO)
            .order('log_date'),
          client.from('priority_foods').select('*').eq('is_active', true).order('name'),
          client
            .from('priority_food_logs')
            .select('*')
            .gte('logged_on', startISO)
            .lte('logged_on', endISO)
            .order('logged_on'),
          client
            .from('pantry_transactions')
            .select('*, pantry_items(name, unit)')
            .eq('reason', 'waste')
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
            .order('created_at', { ascending: false }),
          client
            .from('workout_sessions')
            .select('*, exercise_logs(*)')
            .gte('session_date', startISO)
            .lte('session_date', endISO)
            .order('session_date'),
          client.from('workout_routines').select('*').order('weekday'),
          client.from('categories').select('*').order('name'),
        ])

      for (const result of [
        tasks,
        activities,
        meals,
        foodLogs,
        priorityFoods,
        priorityLogs,
        waste,
        sessions,
        routines,
        categories,
      ]) {
        if (result.error) throw result.error
      }

      return {
        tasks: (tasks.data ?? []) as Task[],
        activities: (activities.data ?? []) as Activity[],
        meals: (meals.data ?? []) as MealPlan[],
        foodLogs: (foodLogs.data ?? []) as FoodLog[],
        priorityFoods: (priorityFoods.data ?? []) as PriorityFood[],
        priorityLogs: (priorityLogs.data ?? []) as PriorityFoodLog[],
        waste: (waste.data ?? []) as WasteTransaction[],
        sessions: (sessions.data ?? []) as WorkoutSessionWithLogs[],
        routines: (routines.data ?? []) as WorkoutRoutine[],
        categories: (categories.data ?? []) as Category[],
      }
    },
    [startISO, endISO],
    EMPTY,
  )

  const occurrences = useMemo(
    () => expandActivities(query.data.activities, start, end),
    [query.data.activities, start.getTime(), end.getTime()],
  )

  function move(direction: -1 | 1) {
    setAnchor((current) => (periodType === 'week' ? addDays(current, direction * 7) : addMonths(current, direction)))
  }

  const rangeLabel =
    periodType === 'week' ? `${formatDateShort(start)} – ${formatDateShort(end)}` : formatMonthYear(anchor)

  if (query.loading) return <LoadingState label="Calculando progreso" />
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        eyebrow="Progreso"
        title="Datos que importan"
        description="Analiza tu constancia, tus hábitos y tu entrenamiento con registros reales. Sin estimaciones inventadas."
      />

      <div className="rounded-2xl border border-ink-700/70 bg-ink-850 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="overflow-x-auto">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'productivity', label: 'Productividad', icon: <TrendingUp className="h-3.5 w-3.5" /> },
                { value: 'food', label: 'Alimentación', icon: <Salad className="h-3.5 w-3.5" /> },
                { value: 'training', label: 'Entreno', icon: <Dumbbell className="h-3.5 w-3.5" /> },
                { value: 'goals', label: 'Objetivos', icon: <Target className="h-3.5 w-3.5" /> },
              ]}
            />
          </div>
          {tab !== 'goals' && (
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                value={periodType}
                onChange={(value) => {
                  setPeriodType(value)
                  setAnchor(new Date())
                }}
                options={[
                  { value: 'week', label: 'Semana' },
                  { value: 'month', label: 'Mes' },
                ]}
              />
              <div className="flex items-center gap-1 rounded-xl border border-ink-700 bg-ink-900 p-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(-1)} aria-label="Periodo anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-28 px-1 text-center text-[11px] font-medium text-zinc-300">{rangeLabel}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(1)} aria-label="Periodo siguiente">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAnchor(new Date())}
                disabled={
                  startISO === toISODate(periodType === 'week' ? startOfWeek(new Date()) : startOfMonth(new Date()))
                }
              >
                Actual
              </Button>
            </div>
          )}
        </div>
      </div>

      {tab === 'productivity' && (
        <ProductivitySection
          tasks={query.data.tasks}
          occurrences={occurrences}
          categories={query.data.categories}
          days={days}
          start={start}
          end={end}
        />
      )}

      {tab === 'food' && (
        <FoodStatsSection
          meals={query.data.meals}
          foodLogs={query.data.foodLogs}
          priorityFoods={query.data.priorityFoods}
          priorityLogs={query.data.priorityLogs}
          waste={query.data.waste}
          days={days}
          start={start}
          end={end}
          periodType={periodType}
        />
      )}

      {tab === 'training' && (
        <TrainingStatsSection sessions={query.data.sessions} routines={query.data.routines} days={days} start={start} end={end} />
      )}

      {tab === 'goals' && (
        <GoalsPanel tasks={query.data.tasks} categories={query.data.categories} onCategoriesChanged={query.reload} />
      )}
    </div>
  )
}
