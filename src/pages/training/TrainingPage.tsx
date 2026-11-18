import {
  Activity,
  BedDouble,
  CalendarCheck2,
  Dumbbell,
  Pencil,
  Plus,
  Timer,
  TrendingUp,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { RoutineEditorModal } from '../../components/training/RoutineEditorModal'
import { SessionModal } from '../../components/training/SessionModal'
import { TrainingHistory } from '../../components/training/TrainingHistory'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Segmented,
  useToast,
} from '../../components/ui'
import { useQuery } from '../../hooks/useQuery'
import { db } from '../../lib/supabase'
import {
  WEEKDAYS_LONG,
  addDays,
  endOfWeek,
  formatDateShort,
  isToday,
  startOfWeek,
  toISODate,
} from '../../lib/dates'
import { percentage, trainingVolume } from '../../lib/calculations'
import { WORKOUT_LABELS } from '../../lib/constants'
import { cn, errorMessage, formatNumber } from '../../lib/utils'
import type {
  Exercise,
  ExerciseLog,
  WorkoutRoutineWithItems,
  WorkoutSessionWithLogs,
} from '../../types'

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
type Tab = 'routine' | 'history'
type TrainingData = {
  routines: WorkoutRoutineWithItems[]
  exercises: Exercise[]
  sessions: WorkoutSessionWithLogs[]
  recentLogs: ExerciseLog[]
}
const EMPTY: TrainingData = { routines: [], exercises: [], sessions: [], recentLogs: [] }

export default function TrainingPage() {
  const { push } = useToast()
  const [tab, setTab] = useState<Tab>('routine')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingWeekday, setEditingWeekday] = useState(1)
  const [editingRoutine, setEditingRoutine] = useState<WorkoutRoutineWithItems | null>(null)
  const [sessionOpen, setSessionOpen] = useState(false)
  const [sessionRoutine, setSessionRoutine] = useState<WorkoutRoutineWithItems | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WorkoutRoutineWithItems | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const today = new Date()
  const currentWeekday = today.getDay()
  const weekStart = startOfWeek(today)
  const weekEnd = endOfWeek(today)

  const query = useQuery<TrainingData>(
    async () => {
      const client = db()
      const [routines, exercises, sessions, recentLogs] = await Promise.all([
        client
          .from('workout_routines')
          .select('*, routine_items(*, exercises(id, name, muscle_group, exercise_type))')
          .order('weekday'),
        client.from('exercises').select('*').order('name'),
        client
          .from('workout_sessions')
          .select('*, exercise_logs(*)')
          .gte('session_date', toISODate(weekStart))
          .lte('session_date', toISODate(weekEnd))
          .order('session_date', { ascending: false }),
        client.from('exercise_logs').select('*').order('created_at', { ascending: false }).limit(300),
      ])
      for (const result of [routines, exercises, sessions, recentLogs]) {
        if (result.error) throw result.error
      }
      return {
        routines: (routines.data ?? []) as WorkoutRoutineWithItems[],
        exercises: (exercises.data ?? []) as Exercise[],
        sessions: (sessions.data ?? []) as WorkoutSessionWithLogs[],
        recentLogs: (recentLogs.data ?? []) as ExerciseLog[],
      }
    },
    [toISODate(weekStart), toISODate(weekEnd)],
    EMPTY,
  )

  const todayRoutine = query.data.routines.find((routine) => routine.weekday === currentWeekday) ?? null
  const completedSessions = query.data.sessions.filter((session) => session.status === 'completed')
  const plannedDays = query.data.routines.filter((routine) => !routine.is_rest).length
  const weeklyRate = percentage(completedSessions.length, plannedDays)
  const weeklyVolume = trainingVolume(completedSessions.flatMap((session) => session.exercise_logs))
  const todayCompleted = query.data.sessions.some(
    (session) => session.session_date === toISODate(today) && session.status === 'completed',
  )

  const routinesByDay = useMemo(
    () => new Map(query.data.routines.map((routine) => [routine.weekday, routine])),
    [query.data.routines],
  )

  function openEditor(weekday: number, routine: WorkoutRoutineWithItems | null) {
    setEditingWeekday(weekday)
    setEditingRoutine(routine)
    setEditorOpen(true)
  }

  function openSession(routine: WorkoutRoutineWithItems | null) {
    setSessionRoutine(routine?.is_rest ? null : routine)
    setSessionOpen(true)
  }

  async function deleteRoutine() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('workout_routines').delete().eq('id', deleteTarget.id)
      if (error) throw error
      push('Rutina eliminada')
      setDeleteTarget(null)
      setEditorOpen(false)
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (query.loading) return <LoadingState label="Cargando entrenamiento" />
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        eyebrow="Entrenamiento"
        title="Rutina y sesiones"
        description="Planifica la semana, registra lo que haces y deja que los datos hablen."
        actions={
          <Button variant="primary" onClick={() => openSession(todayRoutine)}>
            <Plus className="h-4 w-4" /> Registrar sesión
          </Button>
        }
      />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'routine', label: 'Rutina semanal', icon: <CalendarCheck2 className="h-3.5 w-3.5" /> },
          { value: 'history', label: 'Historial', icon: <TrendingUp className="h-3.5 w-3.5" /> },
        ]}
      />

      {tab === 'history' ? (
        <TrainingHistory refreshKey={historyVersion} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="p-4">
              <p className="muted-label">Días de entrenamiento</p>
              <p className="mt-2 text-2xl font-semibold text-white">{plannedDays}</p>
              <p className="text-[10px] text-zinc-600">planificados esta semana</p>
            </Card>
            <Card className="p-4">
              <p className="muted-label">Sesiones esta semana</p>
              <p className="mt-2 text-2xl font-semibold text-white">{completedSessions.length}</p>
              <p className="text-[10px] text-zinc-600">completadas</p>
            </Card>
            <Card className="p-4">
              <div className="flex justify-between">
                <p className="muted-label">Consistencia</p>
                <span className="text-xs text-lime">{Math.round(weeklyRate)}%</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-white">
                {completedSessions.length}
                <span className="text-base font-normal text-zinc-600"> / {plannedDays}</span>
              </p>
            </Card>
            <Card className="p-4">
              <p className="muted-label">Volumen semanal</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(weeklyVolume / 1000, 1)}k</p>
              <p className="text-[10px] text-zinc-600">kg · series × reps × peso</p>
            </Card>
          </div>

          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl',
                  todayRoutine?.is_rest ? 'bg-ink-800 text-zinc-500' : 'bg-lime/10 text-lime',
                )}
              >
                {todayRoutine?.is_rest ? <BedDouble className="h-4 w-4" /> : <Dumbbell className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Hoy · {WEEKDAYS_LONG[(currentWeekday + 6) % 7]}</p>
                <p className="mt-0.5 text-sm font-semibold text-white">
                  {todayRoutine ? todayRoutine.title : 'Sin rutina definida'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {todayCompleted && <Badge tone="accent"><CalendarCheck2 className="h-3 w-3" /> Completada</Badge>}
              {todayRoutine && (
                <Button variant="secondary" size="sm" onClick={() => openEditor(currentWeekday, todayRoutine)}>
                  <Pencil className="h-3.5 w-3.5" /> Editar hoy
                </Button>
              )}
              {!todayRoutine?.is_rest && (
                <Button size="sm" onClick={() => openSession(todayRoutine)}>
                  <Timer className="h-3.5 w-3.5" /> Entrenar
                </Button>
              )}
            </div>
          </Card>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Semana</h2>
              <p className="text-[10px] text-zinc-700">
                {formatDateShort(weekStart)} – {formatDateShort(weekEnd)}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {WEEK_ORDER.map((weekday) => {
                const routine = routinesByDay.get(weekday) ?? null
                const jsDate = addDays(weekStart, WEEK_ORDER.indexOf(weekday))
                const isCurrent = isToday(jsDate)
                const dayName = WEEKDAYS_LONG[(weekday + 6) % 7]
                return (
                  <Card
                    key={weekday}
                    className={cn(
                      'flex flex-col overflow-hidden',
                      isCurrent && 'border-lime/25',
                      !routine && 'border-dashed',
                    )}
                  >
                    <div className={cn('flex items-center justify-between border-b border-ink-700/60 px-3 py-2', isCurrent && 'bg-lime/[0.03]')}>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">{dayName.slice(0, 3)}</p>
                        <p className={cn('text-xs font-semibold', isCurrent ? 'text-lime' : 'text-zinc-300')}>
                          {jsDate.getDate()} {new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(jsDate)}
                        </p>
                      </div>
                      <button
                        onClick={() => openEditor(weekday, routine)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 hover:bg-ink-800 hover:text-white"
                        aria-label={routine ? 'Editar rutina' : 'Crear rutina'}
                      >
                        {routine ? <Pencil className="h-3 w-3" /> : <Plus className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {routine ? (
                      <div className="flex flex-1 flex-col p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-white">{routine.title}</p>
                          <Badge tone={routine.is_rest ? 'muted' : 'accent'}>
                            {routine.is_rest ? 'Descanso' : WORKOUT_LABELS[routine.workout_type]}
                          </Badge>
                        </div>
                        {routine.muscle_groups.length > 0 && (
                          <p className="mt-1 text-[10px] text-zinc-500">{routine.muscle_groups.join(' · ')}</p>
                        )}
                        {!routine.is_rest && routine.routine_items.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {routine.routine_items.slice(0, 4).map((item) => (
                              <div key={item.id} className="flex justify-between gap-2 text-[10px]">
                                <span className="truncate text-zinc-400">{item.exercises?.name}</span>
                                <span className="shrink-0 text-zinc-600">
                                  {item.sets ? `${item.sets}×${item.reps ?? '—'}` : item.duration_min ? `${item.duration_min} min` : ''}
                                </span>
                              </div>
                            ))}
                            {routine.routine_items.length > 4 && (
                              <p className="text-[9px] text-zinc-700">+{routine.routine_items.length - 4} más</p>
                            )}
                          </div>
                        )}
                        {routine.is_rest && (
                          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-600">
                            <BedDouble className="h-3 w-3" /> Recuperación planificada
                          </p>
                        )}
                        {!routine.is_rest && (
                          <button
                            onClick={() => openSession(routine)}
                            className="mt-auto pt-3 text-left text-[10px] font-medium text-lime hover:text-lime-soft"
                          >
                            Registrar sesión
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => openEditor(weekday, null)}
                        className="flex flex-1 flex-col items-center justify-center gap-2 p-5 text-zinc-600 transition hover:bg-ink-800/40 hover:text-zinc-400"
                      >
                        <Plus className="h-4 w-4" />
                        <span className="text-[10px]">Configurar día</span>
                      </button>
                    )}
                  </Card>
                )
              })}
            </div>
          </div>

          {!query.data.routines.length && (
            <Card>
              <EmptyState
                icon={<Dumbbell className="h-5 w-5" />}
                title="Configura tu primera rutina"
                description="Asigna entrenamientos o descansos a cada día. Después podrás registrar sesiones y comparar tu progreso."
                action={
                  <Button onClick={() => openEditor(1, null)}>
                    <Plus className="h-4 w-4" /> Configurar lunes
                  </Button>
                }
              />
            </Card>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-[11px] leading-relaxed text-zinc-500">
            <Activity className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
            Las rutinas son plantillas semanales. Cada sesión que registras es un registro independiente con su fecha, duración y ejercicios.
          </div>
        </>
      )}

      <RoutineEditorModal
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false)
          setEditingRoutine(null)
        }}
        onSaved={query.reload}
        weekday={editingWeekday}
        routine={editingRoutine}
        exercises={query.data.exercises}
        onExercisesChanged={query.reload}
        onDelete={(routine) => setDeleteTarget(routine)}
      />

      <SessionModal
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        onSaved={() => {
          query.reload()
          setHistoryVersion((value) => value + 1)
        }}
        routine={sessionRoutine}
        exercises={query.data.exercises}
        onExercisesChanged={query.reload}
        recentLogs={query.data.recentLogs}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar rutina del día"
        description="Se eliminará la plantilla semanal de ese día. Las sesiones ya registradas se conservarán."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteRoutine}
        loading={deleting}
      />
    </div>
  )
}
