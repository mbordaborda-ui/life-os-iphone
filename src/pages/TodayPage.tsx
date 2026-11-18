import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Dumbbell,
  Flame,
  ListTodo,
  NotebookPen,
  Plus,
  RotateCcw,
  Target,
  Trash2,
  Utensils,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { QuickAdd } from '../components/QuickAdd'
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
  SectionHeader,
  useToast,
} from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { useQuery } from '../hooks/useQuery'
import {
  addDays,
  expandActivities,
  formatDateLong,
  formatTimeRange,
  isToday,
  parseLocalDate,
  startOfMonth,
  startOfWeek,
  toISODate,
} from '../lib/dates'
import {
  goalProgressTotal,
  isTaskOverdue,
  percentage,
  sum,
  taskCompletionRate,
} from '../lib/calculations'
import { MEAL_LABELS, PRIORITY_LABELS } from '../lib/constants'
import { db } from '../lib/supabase'
import { cn, errorMessage, formatNumber } from '../lib/utils'
import type {
  Activity,
  FoodLog,
  Goal,
  GoalProgress,
  MealPlanWithRecipe,
  Task,
  WorkoutRoutineWithItems,
  WorkoutSession,
} from '../types'

type TodayData = {
  activities: Activity[]
  tasks: Task[]
  meals: MealPlanWithRecipe[]
  foodLogs: FoodLog[]
  routine: WorkoutRoutineWithItems | null
  sessions: WorkoutSession[]
  goals: Goal[]
  goalProgress: GoalProgress[]
}

const EMPTY: TodayData = {
  activities: [],
  tasks: [],
  meals: [],
  foodLogs: [],
  routine: null,
  sessions: [],
  goals: [],
  goalProgress: [],
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 6) return 'Buenas noches'
  if (hour < 13) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function TodayPage() {
  const { profile } = useAuth()
  const online = useNetworkStatus()
  const { push } = useToast()
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickTab, setQuickTab] = useState<'task' | 'activity' | 'note' | 'food'>('task')
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState(false)
  const today = useMemo(() => new Date(), [])
  const todayISO = toISODate(today)
  const weekday = today.getDay()

  const query = useQuery<TodayData>(
    async () => {
      const client = db()
      const [activities, tasks, meals, foodLogs, routine, sessions, goals, progress] = await Promise.all([
        client.from('activities').select('*').order('start_at'),
        client.from('tasks').select('*').order('created_at', { ascending: false }),
        client
          .from('meal_plans')
          .select('*, recipes(id, name, servings)')
          .eq('plan_date', todayISO)
          .order('created_at'),
        client.from('food_logs').select('*').eq('log_date', todayISO).order('created_at'),
        client
          .from('workout_routines')
          .select('*, routine_items(*, exercises(id, name, muscle_group, exercise_type))')
          .eq('weekday', weekday)
          .maybeSingle(),
        client.from('workout_sessions').select('*').eq('session_date', todayISO),
        client.from('goals').select('*').eq('status', 'active').order('created_at'),
        client.from('goal_progress').select('*').order('recorded_on', { ascending: false }),
      ])
      for (const result of [activities, tasks, meals, foodLogs, routine, sessions, goals, progress]) {
        if (result.error) throw result.error
      }
      return {
        activities: (activities.data ?? []) as Activity[],
        tasks: (tasks.data ?? []) as Task[],
        meals: (meals.data ?? []) as MealPlanWithRecipe[],
        foodLogs: (foodLogs.data ?? []) as FoodLog[],
        routine: (routine.data ?? null) as WorkoutRoutineWithItems | null,
        sessions: (sessions.data ?? []) as WorkoutSession[],
        goals: (goals.data ?? []) as Goal[],
        goalProgress: (progress.data ?? []) as GoalProgress[],
      }
    },
    [todayISO, weekday],
    EMPTY,
  )

  const data = query.data
  const events = useMemo(
    () => expandActivities(data.activities, today, today).filter((event) => !event.all_day || true),
    [data.activities, today],
  )
  const upcoming = useMemo(() => {
    const now = new Date()
    return expandActivities(data.activities, today, addDays(today, 14))
      .filter((event) => new Date(event.occurrence_start) >= now && !event.completed)
      .slice(0, 3)
  }, [data.activities, today])

  const pendingTasks = useMemo(
    () =>
      data.tasks
        .filter((task) => task.status === 'pending')
        .sort((a, b) => {
          const priorityScore = { high: 0, medium: 1, low: 2 }
          const aOverdue = isTaskOverdue(a, todayISO) ? 0 : 1
          const bOverdue = isTaskOverdue(b, todayISO) ? 0 : 1
          return (
            aOverdue - bOverdue ||
            priorityScore[a.priority] - priorityScore[b.priority] ||
            (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
          )
        }),
    [data.tasks, todayISO],
  )
  const todayTasks = pendingTasks.filter((task) => task.due_date === todayISO)
  const overdueTasks = pendingTasks.filter((task) => isTaskOverdue(task, todayISO))
  const completedFocusTasks = data.tasks
    .filter(
      (task) =>
        task.status === 'completed' &&
        task.completed_at !== null &&
        isToday(new Date(task.completed_at)),
    )
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
  const focusTasks = [...overdueTasks, ...todayTasks].slice(0, 5).concat(completedFocusTasks.slice(0, 2))

  const completedEvents = events.filter((event) => event.completed).length
  const dayEventsProgress = percentage(completedEvents, events.length)
  const todayTaskAll = data.tasks.filter((task) => task.due_date === todayISO)
  const taskProgress = taskCompletionRate(todayTaskAll)
  const mealProgress = percentage(data.meals.filter((meal) => meal.is_consumed).length, data.meals.length)
  const overall = Math.round(
    ([events.length ? dayEventsProgress : null, todayTaskAll.length ? taskProgress : null, data.meals.length ? mealProgress : null].filter(
      (value): value is number => value !== null,
    ).reduce((total, value, _index, array) => total + value / array.length, 0)),
  )

  const nextEvent = upcoming[0] ?? null

  const weekStart = startOfWeek(today)
  const monthStart = startOfMonth(today)

  async function toggleTask(task: Task) {
    try {
      const completed = task.status !== 'completed'
      const { error } = await db()
        .from('tasks')
        .update({
          status: completed ? 'completed' : 'pending',
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', task.id)
      if (error) throw error
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    }
  }

  async function deleteTask() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('tasks').delete().eq('id', deleteTarget.id)
      if (error) throw error
      push('Tarea eliminada', 'info')
      setDeleteTarget(null)
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setDeleting(false)
    }
  }

  async function toggleActivity(activity: Activity) {
    try {
      const completed = !activity.completed
      const { error } = await db()
        .from('activities')
        .update({ completed, completed_at: completed ? new Date().toISOString() : null })
        .eq('id', activity.id)
      if (error) throw error
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    }
  }

  async function consumeMeal(meal: MealPlanWithRecipe) {
    try {
      const { error } = await db().rpc('consume_meal_plan', { p_meal_plan_id: meal.id })
      if (error) throw error
      push('Comida registrada en tu diario')
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    }
  }

  async function unconsumeMeal(meal: MealPlanWithRecipe) {
    try {
      const { error } = await db().rpc('unconsume_meal_plan', { p_meal_plan_id: meal.id })
      if (error) throw error
      push('Comida desmarcada y registro eliminado', 'info')
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    }
  }

  function openQuick(tab: typeof quickTab) {
    setQuickTab(tab)
    setQuickOpen(true)
  }

  if (query.loading) return <LoadingState label="Preparando tu día" />
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow={formatDateLong(today)}
        title={`${greeting()}${profile?.display_name ? `, ${profile.display_name.split(' ')[0]}` : ''}.`}
        description="Una vista honesta de lo que tienes hoy. Sin ruido."
        actions={
          <Button variant="primary" onClick={() => openQuick('task')}>
            <Plus className="h-4 w-4" /> Añadir rápido
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="relative overflow-hidden p-5 hover:shadow-[0_0_45px_rgba(184,243,107,0.035)] sm:p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-lime/[0.035] blur-3xl" />
          <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-lime/35 to-transparent motion-safe:animate-pulse-soft" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-5">
              <div className="relative flex h-24 w-24 items-center justify-center">
                <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#242424" strokeWidth="7" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="#b8f36b"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={`${overall * 2.64} 264`}
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-2xl font-semibold tracking-tight text-white">{overall}%</span>
                  <span className="block text-[9px] uppercase tracking-[0.14em] text-zinc-600">del día</span>
                </div>
              </div>
              <div>
                <p className="muted-label">Resumen de hoy</p>
                <p className="mt-1.5 max-w-[13rem] text-sm leading-relaxed text-zinc-400">
                  {overall === 0 && !events.length && !todayTaskAll.length && !data.meals.length
                    ? 'Aún no hay nada planificado. Crea el primer bloque de tu día.'
                    : `${completedEvents}/${events.length} actividades · ${todayTaskAll.filter((task) => task.status === 'completed').length}/${todayTaskAll.length} tareas · ${data.meals.filter((meal) => meal.is_consumed).length}/${data.meals.length} comidas`}
                </p>
              </div>
            </div>
            <div className="grid flex-1 grid-cols-3 divide-x divide-ink-700/70 border-t border-ink-700/70 pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
              <div className="pr-3">
                <p className="text-xl font-semibold text-white">{data.tasks.filter((task) => task.status === 'pending').length}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-600">Pendientes</p>
              </div>
              <div className="px-3">
                <p className="text-xl font-semibold text-amber-300">{overdueTasks.length}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-600">Atrasadas</p>
              </div>
              <div className="pl-3">
                <p className="text-xl font-semibold text-white">{events.length}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-600">Eventos</p>
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-700/60 pt-4">
            {(
              [
                ['task', 'Tarea', ListTodo],
                ['activity', 'Evento', CalendarDays],
                ['note', 'Nota', NotebookPen],
                ['food', 'Comida', Utensils],
              ] as const
            ).map(([tab, label, Icon]) => (
              <button
                key={tab}
                onClick={() => openQuick(tab)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-[11px] text-zinc-400 transition hover:border-ink-600 hover:text-white"
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Próximo evento" subtitle="Lo siguiente en tu agenda" />
          {nextEvent ? (
            <div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime/10 text-lime">
                  <Clock3 className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{nextEvent.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {isToday(new Date(nextEvent.occurrence_start))
                      ? 'Hoy'
                      : formatDateLong(parseLocalDate(nextEvent.occurrence_date))}
                    {' · '}
                    {formatTimeRange(new Date(nextEvent.occurrence_start), new Date(nextEvent.occurrence_end), nextEvent.all_day)}
                  </p>
                  {nextEvent.location && <p className="mt-1 truncate text-[11px] text-zinc-600">{nextEvent.location}</p>}
                </div>
              </div>
              <Link
                to="/agenda"
                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-lime transition hover:text-lime-soft"
              >
                Ver agenda <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="flex min-h-28 flex-col items-center justify-center text-center">
              <p className="text-xs text-zinc-500">No hay eventos próximos.</p>
              <button onClick={() => openQuick('activity')} className="mt-2 text-xs font-medium text-lime">
                Añadir uno
              </button>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <SectionHeader
            title="Agenda de hoy"
            subtitle={`${events.length} bloque${events.length === 1 ? '' : 's'}`}
            action={
              <Link to="/agenda" className="text-[11px] text-zinc-500 hover:text-white">
                Ver todo
              </Link>
            }
          />
          <Card>
            {events.length ? (
              <div className="divide-y divide-ink-700/60">
                {events.map((event) => (
                  <div key={`${event.id}-${event.occurrence_date}`} className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => toggleActivity(event)}
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition',
                        event.completed ? 'border-lime bg-lime text-ink-950' : 'border-ink-600 text-transparent hover:border-lime/60',
                      )}
                      aria-label={event.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-sm text-white', event.completed && 'text-zinc-500 line-through')}>{event.title}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {formatTimeRange(new Date(event.occurrence_start), new Date(event.occurrence_end), event.all_day)}
                        {event.is_recurring_instance && ' · serie'}
                      </p>
                    </div>
                    {event.completed && <CheckCircle2 className="h-4 w-4 shrink-0 text-lime" />}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<CalendarDays className="h-5 w-5" />}
                title="Tu día está libre"
                description="No hay actividades programadas para hoy."
                action={
                  <Button size="sm" onClick={() => openQuick('activity')}>
                    <Plus className="h-3.5 w-3.5" /> Nueva actividad
                  </Button>
                }
              />
            )}
          </Card>
        </section>

        <section>
          <SectionHeader
            title="Tareas en foco"
            subtitle={`${overdueTasks.length} atrasadas · ${todayTasks.length} para hoy${
              completedFocusTasks.length ? ` · ${completedFocusTasks.length} completadas` : ''
            }`}
            action={
              <Link to="/agenda/tasks" className="text-[11px] text-zinc-500 hover:text-white">
                Ver todas
              </Link>
            }
          />
          <Card>
            {focusTasks.length ? (
              <div className="divide-y divide-ink-700/60">
                {focusTasks.map((task, index) => {
                  const completed = task.status === 'completed'
                  return (
                    <div
                      key={task.id}
                      className="group flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-ink-800/35 active:bg-ink-800/55 motion-safe:animate-row-in"
                      style={{ animationDelay: `${index * 35}ms` }}
                    >
                      <button
                        onClick={() => toggleTask(task)}
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition duration-200 active:scale-90',
                          completed
                            ? 'border-lime bg-lime text-ink-950 shadow-[0_0_16px_rgba(184,243,107,0.28)]'
                            : 'border-ink-600 text-transparent hover:border-lime/60 hover:bg-lime/5 hover:text-lime/60',
                        )}
                        aria-label={completed ? 'Marcar como pendiente' : 'Completar tarea'}
                        aria-pressed={completed}
                      >
                        <Check className={cn('h-3.5 w-3.5', completed && 'motion-safe:animate-check-pop')} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-sm transition-colors duration-200',
                            completed ? 'text-zinc-500 line-through' : 'text-white',
                          )}
                        >
                          {task.title}
                        </p>
                        <p
                          className={cn(
                            'mt-0.5 text-[11px]',
                            completed
                              ? 'text-lime/70'
                              : isTaskOverdue(task, todayISO)
                                ? 'text-red-400'
                                : 'text-zinc-500',
                          )}
                        >
                          {completed
                            ? 'Completada'
                            : isTaskOverdue(task, todayISO)
                              ? `Atrasada · ${task.due_date}`
                              : 'Para hoy'}
                        </p>
                      </div>
                      <Badge
                        tone={
                          completed
                            ? 'muted'
                            : task.priority === 'high'
                              ? 'danger'
                              : task.priority === 'medium'
                                ? 'warning'
                                : 'muted'
                        }
                      >
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>
                      <button
                        onClick={() => setDeleteTarget(task)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-600 opacity-100 transition hover:bg-red-500/10 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label={`Eliminar ${task.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={<ListTodo className="h-5 w-5" />}
                title="Sin tareas urgentes"
                description="No hay tareas atrasadas ni con vencimiento hoy."
                action={
                  <Button size="sm" onClick={() => openQuick('task')}>
                    <Plus className="h-3.5 w-3.5" /> Añadir tarea
                  </Button>
                }
              />
            )}
          </Card>
        </section>

        <section>
          <SectionHeader
            title="Comidas de hoy"
            subtitle={`${data.meals.filter((meal) => meal.is_consumed).length} de ${data.meals.length} registradas`}
            action={
              <Link to="/food/planner" className="text-[11px] text-zinc-500 hover:text-white">
                Planificador
              </Link>
            }
          />
          <Card>
            {data.meals.length ? (
              <div className="divide-y divide-ink-700/60">
                {data.meals.map((meal) => (
                  <div key={meal.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-zinc-400">
                      <Utensils className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">{MEAL_LABELS[meal.meal_type]}</p>
                      <p className="mt-0.5 truncate text-sm text-white">{meal.recipes?.name || meal.title}</p>
                    </div>
                    {meal.is_consumed ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone="accent">
                          <Check className="h-3 w-3" /> Consumida
                        </Badge>
                        <button
                          onClick={() => unconsumeMeal(meal)}
                          className="inline-flex items-center gap-1 text-[10px] text-zinc-500 transition hover:text-amber-300"
                          aria-label="Desmarcar comida consumida"
                        >
                          <RotateCcw className="h-3 w-3" /> Desmarcar
                        </button>
                      </div>
                    ) : (
                      <Button size="sm" variant="subtle" onClick={() => consumeMeal(meal)}>
                        Registrar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Utensils className="h-5 w-5" />}
                title="Sin comidas planificadas"
                description="Planifica tus comidas para que el día tenga una estructura clara."
                action={
                  <Link to="/food/planner">
                    <Button size="sm">Abrir planificador</Button>
                  </Link>
                }
              />
            )}
          </Card>
        </section>

        <section>
          <SectionHeader
            title="Entrenamiento"
            subtitle="Programado para hoy"
            action={
              <Link to="/training" className="text-[11px] text-zinc-500 hover:text-white">
                Entrenar
              </Link>
            }
          />
          <Card className="p-5">
            {data.routine ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl',
                        data.routine.is_rest ? 'bg-ink-800 text-zinc-500' : 'bg-lime/10 text-lime',
                      )}
                    >
                      <Dumbbell className="h-[18px] w-[18px]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{data.routine.title}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {data.routine.is_rest
                          ? 'Día de descanso'
                          : `${data.routine.muscle_groups.join(' · ') || 'Sesión libre'}`}
                      </p>
                    </div>
                  </div>
                  <Badge tone={data.routine.is_rest ? 'muted' : 'accent'}>
                    {data.routine.is_rest ? 'Descanso' : data.routine.workout_type === 'strength' ? 'Fuerza' : data.routine.workout_type === 'cardio' ? 'Cardio' : 'Activo'}
                  </Badge>
                </div>
                {!data.routine.is_rest && data.routine.routine_items?.length > 0 && (
                  <div className="mt-4 space-y-1.5 border-t border-ink-700/60 pt-3">
                    {data.routine.routine_items.slice(0, 4).map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">{item.exercises?.name ?? 'Ejercicio'}</span>
                        <span className="text-zinc-600">
                          {item.sets ? `${item.sets} × ${item.reps ?? '—'}` : item.duration_min ? `${item.duration_min} min` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <Link to="/training" className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-ink-700 py-2.5 text-xs font-medium text-zinc-300 transition hover:border-ink-600 hover:text-white">
                  {data.sessions.some((session) => session.status === 'completed') ? 'Sesión completada hoy' : 'Registrar sesión'}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <EmptyState
                icon={<Dumbbell className="h-5 w-5" />}
                title="Sin rutina para hoy"
                description="Asigna un entrenamiento o un descanso a este día."
                action={
                  <Link to="/training">
                    <Button size="sm">Configurar rutina</Button>
                  </Link>
                }
              />
            )}
          </Card>
        </section>
      </div>

      <section>
        <SectionHeader
          title="Objetivos activos"
          subtitle="Progreso del periodo actual"
          action={
            <Link to="/progress" className="text-[11px] text-zinc-500 hover:text-white">
              Ver progreso
            </Link>
          }
        />
        <Card>
          {data.goals.length ? (
            <div className="grid gap-px overflow-hidden rounded-2xl bg-ink-700/60 sm:grid-cols-2 lg:grid-cols-3">
              {data.goals.slice(0, 6).map((goal) => {
                const periodStart = goal.period === 'weekly' ? weekStart : monthStart
                const entries = data.goalProgress.filter(
                  (entry) => entry.goal_id === goal.id && parseLocalDate(entry.recorded_on) >= periodStart,
                )
                const current = goalProgressTotal(goal, entries)
                const percent = percentage(current, goal.target_value)
                return (
                  <div key={goal.id} className="bg-ink-850 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-lime" />
                        <p className="text-sm font-medium text-white">{goal.title}</p>
                      </div>
                      <span className="text-xs font-semibold text-lime">{Math.round(percent)}%</span>
                    </div>
                    <p className="mt-2 text-[11px] text-zinc-500">
                      {formatNumber(current)} / {formatNumber(goal.target_value)} {goal.metric_unit}
                    </p>
                    <ProgressBar value={percent} className="mt-3" />
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Target className="h-5 w-5" />}
              title="Sin objetivos activos"
              description="Crea una meta semanal o mensual y registra tu avance real."
              action={
                <Link to="/progress">
                  <Button size="sm">
                    <Plus className="h-3.5 w-3.5" /> Crear objetivo
                  </Button>
                </Link>
              }
            />
          )}
        </Card>
      </section>

      {(data.foodLogs.length > 0 || data.sessions.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime/10 text-lime">
              <Flame className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Registros alimentarios hoy</p>
              <p className="text-sm font-semibold text-white">{data.foodLogs.length} comidas o alimentos</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-300">
              <Dumbbell className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Entrenamiento hoy</p>
              <p className="text-sm font-semibold text-white">
                {sum(data.sessions.map((session) => session.duration_min))} min registrados
              </p>
            </div>
          </Card>
        </div>
      )}

      <QuickAdd open={quickOpen} onClose={() => setQuickOpen(false)} onSaved={query.reload} initialTab={quickTab} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar tarea"
        description={`Se eliminará «${deleteTarget?.title ?? ''}» de forma permanente.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteTask}
        loading={deleting}
      />

      <div className="flex items-center justify-between border-t border-ink-700/60 pt-4 text-[11px] text-zinc-600">
        <span className="inline-flex items-center gap-1.5">
          <Circle className={cn('h-2 w-2', online ? 'fill-lime text-lime' : 'fill-amber-400 text-amber-400')} />
          {online ? 'Datos sincronizados con Supabase' : 'Sin conexión · los datos pueden estar desactualizados'}
        </span>
        <Link to="/agenda/tasks" className="inline-flex items-center gap-1 hover:text-zinc-400">
          Ver todas las tareas <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
