import { Activity, ChevronDown, Dumbbell, Footprints, HeartPulse, Trash2, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Select,
  useToast,
} from '../ui'
import { useQuery } from '../../hooks/useQuery'
import { db } from '../../lib/supabase'
import { addDays, formatDateShort, parseLocalDate, startOfWeek, toISODate } from '../../lib/dates'
import { cardioTotals, percentage, sessionMinutes, sum, trainingVolume } from '../../lib/calculations'
import { WORKOUT_LABELS } from '../../lib/constants'
import { cn, errorMessage, formatNumber } from '../../lib/utils'
import type { WorkoutRoutine, WorkoutSessionWithLogs } from '../../types'

type HistoryData = { sessions: WorkoutSessionWithLogs[]; routines: WorkoutRoutine[] }
const EMPTY: HistoryData = { sessions: [], routines: [] }

const tooltipStyle = {
  backgroundColor: '#111111',
  border: '1px solid #2a2a2a',
  borderRadius: '12px',
  fontSize: '11px',
  color: '#f5f5f5',
}

export function TrainingHistory({ refreshKey = 0 }: { refreshKey?: number }) {
  const { push } = useToast()
  const [typeFilter, setTypeFilter] = useState('all')
  const [exerciseFilter, setExerciseFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WorkoutSessionWithLogs | null>(null)
  const [deleting, setDeleting] = useState(false)
  const sixMonthsAgo = toISODate(addDays(new Date(), -180))

  const query = useQuery<HistoryData>(
    async () => {
      const client = db()
      const [sessions, routines] = await Promise.all([
        client
          .from('workout_sessions')
          .select('*, exercise_logs(*)')
          .gte('session_date', sixMonthsAgo)
          .order('session_date', { ascending: false })
          .order('created_at', { ascending: false }),
        client.from('workout_routines').select('*'),
      ])
      if (sessions.error) throw sessions.error
      if (routines.error) throw routines.error
      return {
        sessions: (sessions.data ?? []) as WorkoutSessionWithLogs[],
        routines: (routines.data ?? []) as WorkoutRoutine[],
      }
    },
    [sixMonthsAgo, refreshKey],
    EMPTY,
  )

  const filtered = useMemo(
    () =>
      query.data.sessions.filter(
        (session) => typeFilter === 'all' || session.workout_type === typeFilter,
      ),
    [query.data.sessions, typeFilter],
  )

  const exerciseNames = useMemo(() => {
    const map = new Map<string, string>()
    query.data.sessions.forEach((session) =>
      session.exercise_logs.forEach((log) => {
        if (log.exercise_id) map.set(log.exercise_id, log.exercise_name)
      }),
    )
    return Array.from(map.entries()).sort(([, a], [, b]) => a.localeCompare(b))
  }, [query.data.sessions])

  const completed = filtered.filter((session) => session.status === 'completed')
  const allLogs = completed.flatMap((session) => session.exercise_logs)
  const totalVolume = trainingVolume(allLogs)
  const cardio = cardioTotals(allLogs)

  const weeklyData = useMemo(() => {
    const thisWeek = startOfWeek(new Date())
    const targetDays = query.data.routines.filter((routine) => !routine.is_rest).length
    return Array.from({ length: 8 }, (_, index) => {
      const start = addDays(thisWeek, (index - 7) * 7)
      const end = addDays(start, 7)
      const sessions = completed.filter((session) => {
        const date = parseLocalDate(session.session_date)
        return date >= start && date < end
      })
      return {
        week: formatDateShort(start),
        sesiones: sessions.length,
        objetivo: targetDays,
        cumplimiento: Math.round(percentage(sessions.length, targetDays)),
      }
    })
  }, [completed, query.data.routines])

  const volumeData = useMemo(
    () =>
      completed
        .filter((session) => session.workout_type === 'strength')
        .slice(0, 12)
        .reverse()
        .map((session) => ({
          fecha: formatDateShort(parseLocalDate(session.session_date)),
          volumen: Math.round(trainingVolume(session.exercise_logs)),
        })),
    [completed],
  )

  const exerciseData = useMemo(() => {
    if (!exerciseFilter) return []
    return completed
      .map((session) => {
        const logs = session.exercise_logs.filter((log) => log.exercise_id === exerciseFilter)
        if (!logs.length) return null
        return {
          fecha: formatDateShort(parseLocalDate(session.session_date)),
          peso: Math.max(0, ...logs.map((log) => log.weight_kg ?? 0)),
          volumen: Math.round(trainingVolume(logs)),
          distancia: Math.round(sum(logs.map((log) => log.distance_m ?? 0))),
          duracion: Math.round(sum(logs.map((log) => log.duration_sec ?? 0)) / 60),
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .reverse()
  }, [completed, exerciseFilter])

  async function deleteSession() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('workout_sessions').delete().eq('id', deleteTarget.id)
      if (error) throw error
      push('Sesión eliminada')
      setDeleteTarget(null)
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (query.loading) return <LoadingState label="Cargando historial" />
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Sesiones</p>
            <Dumbbell className="h-4 w-4 text-zinc-600" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{completed.length}</p>
          <p className="text-[10px] text-zinc-600">completadas · 180 días</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Minutos</p>
            <Activity className="h-4 w-4 text-zinc-600" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(sessionMinutes(completed), 0)}</p>
          <p className="text-[10px] text-zinc-600">tiempo entrenado</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Volumen</p>
            <TrendingUp className="h-4 w-4 text-zinc-600" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(totalVolume / 1000, 1)}k</p>
          <p className="text-[10px] text-zinc-600">kg levantados</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Cardio</p>
            <Footprints className="h-4 w-4 text-zinc-600" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(cardio.distance / 1000, 1)}</p>
          <p className="text-[10px] text-zinc-600">km registrados</p>
        </Card>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-2 sm:flex sm:gap-2">
          <Select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="w-full sm:w-auto sm:min-w-[150px]"
          >
            <option value="all">Todo tipo</option>
            <option value="strength">Fuerza</option>
            <option value="cardio">Cardio</option>
            <option value="other">Otro</option>
          </Select>
          <Select
            value={exerciseFilter}
            onChange={(event) => setExerciseFilter(event.target.value)}
            className="w-full sm:w-auto sm:min-w-[180px]"
          >
            <option value="">Evolución por ejercicio</option>
            {exerciseNames.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-[11px] text-zinc-600">{filtered.length} sesiones registradas</p>
      </div>

      {!completed.length ? (
        <Card>
          <EmptyState
            icon={<Dumbbell className="h-5 w-5" />}
            title="Sin sesiones completadas"
            description="Registra tu primer entrenamiento para ver volumen, consistencia y evolución por ejercicio."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-white">Consistencia semanal</h3>
              <p className="mt-0.5 text-[10px] text-zinc-500">Sesiones completadas frente a días de rutina</p>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} barGap={2}>
                  <CartesianGrid stroke="#1e1e1e" vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="sesiones" fill="#b8f36b" radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={650} />
                  <Bar dataKey="objetivo" fill="#2a2a2a" radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={650} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-white">Volumen de fuerza</h3>
              <p className="mt-0.5 text-[10px] text-zinc-500">Series × repeticiones × peso por sesión</p>
            </div>
            {volumeData.length ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData}>
                    <CartesianGrid stroke="#1e1e1e" vertical={false} />
                    <XAxis dataKey="fecha" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="volumen" fill="#7dd3fc" radius={[4, 4, 0, 0]} maxBarSize={26} animationDuration={650} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="Sin sesiones de fuerza" description="Registra series, repeticiones y peso para calcular el volumen." className="h-56 py-0" />
            )}
          </Card>

          <Card className="p-4 lg:col-span-2">
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-white">Evolución por ejercicio</h3>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                {exerciseFilter
                  ? 'Peso máximo y volumen por sesión'
                  : 'Selecciona un ejercicio para ver su progresión'}
              </p>
            </div>
            {!exerciseFilter ? (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title="Elige un ejercicio"
                description="Usa el selector superior para comparar pesos, repeticiones, distancia o volumen a lo largo del tiempo."
                className="h-52 py-0"
              />
            ) : exerciseData.length < 2 ? (
              <EmptyState
                title="Aún no hay suficiente historial"
                description="Necesitas al menos dos sesiones con este ejercicio para dibujar una evolución."
                className="h-52 py-0"
              />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={exerciseData}>
                    <CartesianGrid stroke="#1e1e1e" vertical={false} />
                    <XAxis dataKey="fecha" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: '#71717a', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar
                      yAxisId="left"
                      dataKey="volumen"
                      fill="#a78bfa"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                      animationDuration={650}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="peso"
                      stroke="#b8f36b"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#b8f36b' }}
                      animationDuration={650}
                      animationEasing="ease-out"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      )}

      <section>
        <div className="mb-2 flex items-end justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Sesiones</h2>
          <span className="text-[10px] text-zinc-700">Últimos 180 días</span>
        </div>
        {filtered.length ? (
          <div className="space-y-2">
            {filtered.map((session) => {
              const volume = trainingVolume(session.exercise_logs)
              const isExpanded = expanded === session.id
              return (
                <Card key={session.id} className="overflow-hidden">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : session.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                        session.status === 'completed' ? 'bg-lime/10 text-lime' : 'bg-ink-800 text-zinc-600',
                      )}
                    >
                      {session.workout_type === 'cardio' ? <HeartPulse className="h-4 w-4" /> : <Dumbbell className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-white">
                          {formatDateShort(parseLocalDate(session.session_date))} · {WORKOUT_LABELS[session.workout_type]}
                        </p>
                        {session.status === 'skipped' && <Badge tone="warning">Omitida</Badge>}
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {session.duration_min} min · {session.exercise_logs.length} ejercicios
                        {volume > 0 && ` · ${formatNumber(volume / 1000, 1)}k kg volumen`}
                      </p>
                    </div>
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-zinc-600 transition', isExpanded && 'rotate-180')} />
                  </button>
                  {isExpanded && (
                    <div className="border-t border-ink-700/60 px-4 py-3 animate-fade-in">
                      {session.exercise_logs.length ? (
                        <div className="space-y-2">
                          {session.exercise_logs
                            .slice()
                            .sort((a, b) => a.position - b.position)
                            .map((log) => (
                              <div key={log.id} className="flex items-center justify-between gap-3 rounded-lg bg-ink-900 px-3 py-2">
                                <div>
                                  <p className="text-xs text-zinc-200">{log.exercise_name}</p>
                                  {log.notes && <p className="text-[10px] text-zinc-600">{log.notes}</p>}
                                </div>
                                <div className="shrink-0 text-right text-[10px] text-zinc-500">
                                  {log.sets !== null && (
                                    <p>
                                      {log.sets} × {log.reps ?? '—'} {log.weight_kg !== null ? `· ${formatNumber(log.weight_kg)} kg` : ''}
                                    </p>
                                  )}
                                  {log.distance_m !== null && <p>{formatNumber(log.distance_m, 0)} m</p>}
                                  {log.duration_sec !== null && <p>{Math.round(log.duration_sec / 60)} min</p>}
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-zinc-600">Sin ejercicios registrados.</p>
                      )}
                      {session.notes && <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">{session.notes}</p>}
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(session)}
                          className="text-red-400/70 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Eliminar sesión
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        ) : (
          <Card>
            <EmptyState title="Sin sesiones con este filtro" description="Prueba con otro tipo de entrenamiento." />
          </Card>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar sesión"
        description="Se eliminarán la sesión y todos sus registros de ejercicios. Esta acción no se puede deshacer."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteSession}
        loading={deleting}
      />
    </div>
  )
}
