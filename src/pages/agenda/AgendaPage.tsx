import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { ActivityModal } from '../../components/agenda/ActivityModal'
import { AgendaNav } from '../../components/agenda/AgendaNav'
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
import { useCategories } from '../../hooks/useCategories'
import { useQuery } from '../../hooks/useQuery'
import {
  WEEKDAYS_SHORT,
  addDays,
  addMonths,
  formatDateLong,
  formatMonthYear,
  formatTimeRange,
  formatWeekday,
  hourLabel,
  isSameDay,
  isToday,
  monthGrid,
  rangeDays,
  startOfWeek,
  expandActivities,
  toISODate,
} from '../../lib/dates'
import { db } from '../../lib/supabase'
import { cn, errorMessage } from '../../lib/utils'
import type { Activity, ActivityOccurrence, Category } from '../../types'

type View = 'month' | 'week' | 'day'

export default function AgendaPage() {
  const { push } = useToast()
  const [view, setView] = useState<View>('month')
  const [anchor, setAnchor] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Activity | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null)
  const [deleting, setDeleting] = useState(false)
  const categories = useCategories('activity')

  const activitiesQuery = useQuery<Activity[]>(
    async () => {
      const { data, error } = await db().from('activities').select('*').order('start_at')
      if (error) throw error
      return (data ?? []) as Activity[]
    },
    [],
    [],
  )

  const monthDays = useMemo(() => monthGrid(anchor), [anchor])
  const weekDays = useMemo(() => rangeDays(startOfWeek(anchor), addDays(startOfWeek(anchor), 6)), [anchor])
  const viewedRange = useMemo(() => {
    if (view === 'month') return { start: monthDays[0], end: monthDays[monthDays.length - 1] }
    if (view === 'week') return { start: weekDays[0], end: weekDays[6] }
    return { start: selectedDate, end: selectedDate }
  }, [view, monthDays, weekDays, selectedDate])

  const occurrences = useMemo(
    () => expandActivities(activitiesQuery.data, viewedRange.start, viewedRange.end),
    [activitiesQuery.data, viewedRange],
  )

  const selectedOccurrences = useMemo(
    () => expandActivities(activitiesQuery.data, selectedDate, selectedDate),
    [activitiesQuery.data, selectedDate],
  )

  function eventsFor(date: Date) {
    return occurrences.filter((occurrence) => occurrence.occurrence_date === toISODate(date))
  }

  function move(direction: number) {
    if (view === 'month') setAnchor((current) => addMonths(current, direction))
    else if (view === 'week') setAnchor((current) => addDays(current, direction * 7))
    else {
      const next = addDays(selectedDate, direction)
      setSelectedDate(next)
      setAnchor(next)
    }
  }

  function goToday() {
    const today = new Date()
    setAnchor(today)
    setSelectedDate(today)
  }

  function selectDay(day: Date, switchView = false) {
    setSelectedDate(day)
    setAnchor(day)
    if (switchView) setView('day')
  }

  function openNew(date = selectedDate) {
    setEditing(null)
    setSelectedDate(date)
    setModalOpen(true)
  }

  function openEdit(activity: Activity) {
    setEditing(activity)
    setModalOpen(true)
  }

  async function toggleActivity(activity: Activity, occurrence?: ActivityOccurrence) {
    try {
      const completed = !activity.completed
      const { error } = await db()
        .from('activities')
        .update({ completed, completed_at: completed ? new Date().toISOString() : null })
        .eq('id', activity.id)
      if (error) throw error
      if (activity.recurrence !== 'none' && occurrence?.is_recurring_instance) {
        push(completed ? 'Serie marcada como completada' : 'Serie marcada como pendiente', 'info')
      }
      activitiesQuery.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    }
  }

  async function deleteActivity() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('activities').delete().eq('id', deleteTarget.id)
      if (error) throw error
      push('Actividad eliminada')
      setDeleteTarget(null)
      setModalOpen(false)
      activitiesQuery.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const title =
    view === 'month'
      ? formatMonthYear(anchor)
      : view === 'week'
        ? `${WEEKDAYS_SHORT[0]} ${weekDays[0].getDate()} – ${WEEKDAYS_SHORT[6]} ${weekDays[6].getDate()}`
        : formatDateLong(selectedDate)

  if (activitiesQuery.loading || categories.loading) return <LoadingState label="Cargando agenda" />
  if (activitiesQuery.error) return <ErrorState message={activitiesQuery.error} onRetry={activitiesQuery.reload} />
  if (categories.error) return <ErrorState message={categories.error} onRetry={categories.reload} />

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        eyebrow="Agenda"
        title="Tu tiempo, con intención."
        description="Calendario, bloques y recurrencias en una única fuente de verdad."
        actions={
          <Button variant="primary" onClick={() => openNew()}>
            <Plus className="h-4 w-4" /> Nueva actividad
          </Button>
        }
      />

      <AgendaNav />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1 text-center sm:min-w-[220px]">
              <h2 className="truncate text-base font-semibold tracking-tight text-white">{title}</h2>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                {occurrences.length} bloques en vista
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label="Siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'month', label: 'Mes' },
                { value: 'week', label: 'Semana' },
                { value: 'day', label: 'Día' },
              ]}
            />
            <Button variant="secondary" size="sm" onClick={goToday}>
              Hoy
            </Button>
          </div>
        </div>

        <div className="mt-5">
          {view === 'month' && (
            <div>
              <div className="mb-2 grid grid-cols-7 border-b border-ink-700/60 pb-2">
                {WEEKDAYS_SHORT.map((day) => (
                  <span key={day} className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                    {day}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-ink-700/60">
                {monthDays.map((day) => {
                  const dayEvents = eventsFor(day)
                  const inMonth = day.getMonth() === anchor.getMonth()
                  const selected = isSameDay(day, selectedDate)
                  return (
                    <button
                      key={toISODate(day)}
                      onClick={() => selectDay(day, true)}
                      className={cn(
                        'group relative min-h-[72px] border-b border-r border-ink-700/50 p-1.5 text-left transition hover:bg-ink-800/60 sm:min-h-[104px] sm:p-2',
                        !inMonth && 'bg-ink-900/40',
                        selected && 'bg-ink-800',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium',
                          isToday(day) ? 'bg-lime text-ink-950' : inMonth ? 'text-zinc-300' : 'text-zinc-700',
                        )}
                      >
                        {day.getDate()}
                      </span>
                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div key={`${event.id}-${event.occurrence_start}`} className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime/80" />
                            <span className="hidden truncate text-[10px] text-zinc-400 sm:block">{event.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="block text-[9px] text-zinc-600">+{dayEvents.length - 2}</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {view === 'week' && (
            <div className="overflow-x-auto pb-1">
              <div className="grid min-w-[760px] grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const dayEvents = eventsFor(day)
                  return (
                    <div
                      key={toISODate(day)}
                      className={cn(
                        'min-h-[280px] rounded-xl border border-ink-700/60 bg-ink-900/40 p-2',
                        isToday(day) && 'border-lime/25 bg-lime/[0.025]',
                      )}
                    >
                      <button onClick={() => selectDay(day, true)} className="mb-3 flex w-full items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                          {WEEKDAYS_SHORT[(day.getDay() + 6) % 7]}
                        </span>
                        <span
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full text-[11px]',
                            isToday(day) ? 'bg-lime font-semibold text-ink-950' : 'text-zinc-400',
                          )}
                        >
                          {day.getDate()}
                        </span>
                      </button>
                      <div className="space-y-1.5">
                        {dayEvents.map((event) => (
                          <button
                            key={`${event.id}-${event.occurrence_start}`}
                            onClick={() => openEdit(event)}
                            className="w-full rounded-lg border border-ink-700 bg-ink-850 p-2 text-left transition hover:border-ink-600"
                          >
                            <p className={cn('text-[10px] text-zinc-500', event.completed && 'text-zinc-600')}>
                              {formatTimeRange(new Date(event.occurrence_start), new Date(event.occurrence_end), event.all_day)}
                            </p>
                            <p className={cn('mt-0.5 text-[11px] font-medium leading-snug text-white', event.completed && 'text-zinc-500 line-through')}>
                              {event.title}
                            </p>
                          </button>
                        ))}
                        {!dayEvents.length && <p className="pt-6 text-center text-[10px] text-zinc-700">Libre</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {view === 'day' && (
            <div>
              <div className="mb-4 flex items-center justify-between rounded-xl border border-ink-700/60 bg-ink-900/40 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">{formatWeekday(selectedDate)}</p>
                  <p className="text-xs text-zinc-500">{formatDateLong(selectedDate)}</p>
                </div>
                <Button size="sm" onClick={() => openNew(selectedDate)}>
                  <Plus className="h-3.5 w-3.5" /> Añadir
                </Button>
              </div>
              <div className="overflow-hidden rounded-xl border border-ink-700/60">
                {Array.from({ length: 24 }, (_, hour) => {
                  const slotStart = new Date(selectedDate)
                  slotStart.setHours(hour, 0, 0, 0)
                  const slotEnd = new Date(slotStart.getTime() + 60 * 60000)
                  const hourEvents = selectedOccurrences.filter((event) => {
                    if (event.all_day) return hour === 0
                    return new Date(event.occurrence_start) < slotEnd && new Date(event.occurrence_end) > slotStart
                  })
                  const visible = hourEvents
                  return (
                    <div key={hour} className="grid min-h-[56px] grid-cols-[58px_1fr] border-b border-ink-700/40 last:border-b-0">
                      <div className="border-r border-ink-700/40 px-2 py-2 text-right">
                        <span className="text-[10px] tabular-nums text-zinc-600">{hourLabel(hour)}</span>
                      </div>
                      <div className="space-y-1 p-1.5">
                        {visible.map((event) => (
                          <div
                            key={`${event.id}-${event.occurrence_start}`}
                            className="group flex items-center gap-2 rounded-lg border border-ink-700/70 bg-ink-850 px-2.5 py-2 transition hover:border-ink-600"
                          >
                            <button
                              onClick={() => toggleActivity(event, event)}
                              className={cn(
                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
                                event.completed ? 'border-lime bg-lime text-ink-950' : 'border-ink-600 text-transparent hover:border-lime',
                              )}
                              aria-label="Alternar completada"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button onClick={() => openEdit(event)} className="min-w-0 flex-1 text-left">
                              <p className={cn('truncate text-xs font-medium text-white', event.completed && 'text-zinc-500 line-through')}>
                                {event.title}
                              </p>
                              <p className="mt-0.5 text-[10px] text-zinc-500">
                                {formatTimeRange(new Date(event.occurrence_start), new Date(event.occurrence_end), event.all_day)}
                                {event.is_recurring_instance && ' · serie'}
                                {event.location ? ` · ${event.location}` : ''}
                              </p>
                            </button>
                            {event.recurrence !== 'none' && <RotateCcw className="h-3 w-3 shrink-0 text-zinc-600" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </Card>

      {selectedOccurrences.length > 0 && view !== 'day' && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="muted-label">Seleccionado</p>
              <h3 className="mt-1 text-sm font-semibold capitalize text-white">{formatDateLong(selectedDate)}</h3>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setView('day')}>
              Ver día
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {selectedOccurrences.map((event) => (
              <button
                key={`${event.id}-${event.occurrence_start}`}
                onClick={() => openEdit(event)}
                className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900/50 px-3 py-2.5 text-left transition hover:border-ink-600"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-800 text-zinc-500">
                  <Clock3 className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-white">{event.title}</span>
                  <span className="mt-0.5 block text-[10px] text-zinc-500">
                    {formatTimeRange(new Date(event.occurrence_start), new Date(event.occurrence_end), event.all_day)}
                  </span>
                </span>
                {event.location && <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-600" />}
              </button>
            ))}
          </div>
        </Card>
      )}

      {occurrences.length === 0 && (
        <Card>
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="No hay actividades en este periodo"
            description="Crea un bloque y empieza a dar forma a tu semana."
            action={
              <Button onClick={() => openNew(viewedRange.start)}>
                <Plus className="h-4 w-4" /> Crear actividad
              </Button>
            }
          />
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-600">
        <Badge tone="muted">
          <RotateCcw className="h-3 w-3" /> Las series se expanden automáticamente
        </Badge>
        <span>Haz clic en un día para abrir la vista diaria.</span>
      </div>

      <ActivityModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onSaved={activitiesQuery.reload}
        activity={editing}
        activities={activitiesQuery.data}
        categories={categories.data as Category[]}
        onCategoriesChanged={categories.reload}
        defaultDate={selectedDate}
        onDelete={(activity) => setDeleteTarget(activity)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar actividad"
        description={
          deleteTarget?.recurrence !== 'none'
            ? 'Se eliminará toda la serie recurrente, no solo esta aparición. Esta acción no se puede deshacer.'
            : 'Esta actividad se eliminará de forma permanente.'
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteActivity}
        loading={deleting}
      />
    </div>
  )
}
