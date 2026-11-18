import { AlertTriangle, Clock, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Activity, Category, Recurrence } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/supabase'
import {
  combineDateTime,
  findActivityConflicts,
  formatTime,
  toISODate,
  toTimeInput,
} from '../../lib/dates'
import { errorMessage } from '../../lib/utils'
import { CategoryPicker } from '../CategoryPicker'
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '../ui'

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'L', name: 'Lunes' },
  { value: 2, label: 'M', name: 'Martes' },
  { value: 3, label: 'X', name: 'Miércoles' },
  { value: 4, label: 'J', name: 'Jueves' },
  { value: 5, label: 'V', name: 'Viernes' },
  { value: 6, label: 'S', name: 'Sábado' },
  { value: 0, label: 'D', name: 'Domingo' },
]

function weekdayOf(date: string) {
  return new Date(`${date}T00:00:00`).getDay()
}

function defaults(day?: Date, startAt?: Date) {
  const base = startAt ?? new Date()
  const date = day ?? base
  const start = startAt ?? new Date(base.getTime() + 30 * 60000)
  start.setSeconds(0, 0)
  const end = new Date(start.getTime() + 60 * 60000)
  return {
    startDate: toISODate(date),
    endDate: toISODate(end),
    startTime: toTimeInput(start),
    endTime: toTimeInput(end),
  }
}

export function ActivityModal({
  open,
  onClose,
  onSaved,
  activity,
  activities,
  categories,
  onCategoriesChanged,
  defaultDate,
  defaultStart,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  activity?: Activity | null
  activities: Activity[]
  categories: Category[]
  onCategoriesChanged: () => void
  defaultDate?: Date
  defaultStart?: Date
  onDelete?: (activity: Activity) => void
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const initial = defaults(defaultDate, defaultStart)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [location, setLocation] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(initial.startDate)
  const [endDate, setEndDate] = useState(initial.endDate)
  const [startTime, setStartTime] = useState(initial.startTime)
  const [endTime, setEndTime] = useState(initial.endTime)
  const [allDay, setAllDay] = useState(false)
  const [recurrence, setRecurrence] = useState<Recurrence>('none')
  const [recurrenceUntil, setRecurrenceUntil] = useState('')
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([])
  const [recurrenceCount, setRecurrenceCount] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (activity) {
      const start = new Date(activity.start_at)
      const end = new Date(activity.end_at)
      setTitle(activity.title)
      setNotes(activity.notes ?? '')
      setLocation(activity.location ?? '')
      setCategoryId(activity.category_id)
      setStartDate(toISODate(start))
      setEndDate(toISODate(end))
      setStartTime(toTimeInput(start))
      setEndTime(toTimeInput(end))
      setAllDay(activity.all_day)
      setRecurrence(activity.recurrence)
      setRecurrenceUntil(activity.recurrence_until ?? '')
      setRecurrenceWeekdays(activity.recurrence === 'custom' ? (activity.recurrence_weekdays ?? []) : [])
      setRecurrenceCount(activity.recurrence_count ? String(activity.recurrence_count) : '')
    } else {
      const next = defaults(defaultDate, defaultStart)
      setTitle('')
      setNotes('')
      setLocation('')
      setCategoryId(null)
      setStartDate(next.startDate)
      setEndDate(next.endDate)
      setStartTime(next.startTime)
      setEndTime(next.endTime)
      setAllDay(false)
      setRecurrence('none')
      setRecurrenceUntil('')
      setRecurrenceWeekdays([])
      setRecurrenceCount('')
    }
    setSaving(false)
  }, [open, activity, defaultDate, defaultStart])

  const start = useMemo(() => combineDateTime(startDate, allDay ? '00:00' : startTime), [startDate, startTime, allDay])
  const end = useMemo(
    () => combineDateTime(recurrence === 'none' ? endDate : startDate, allDay ? '23:59' : endTime),
    [recurrence, endDate, startDate, endTime, allDay],
  )
  const conflicts = useMemo(() => {
    if (!open || end <= start) return []
    return findActivityConflicts(activities, start, end, activity?.id)
  }, [activities, activity?.id, end, open, start])

  async function save() {
    if (!user) return
    if (!title.trim()) {
      push('El título es obligatorio.', 'error')
      return
    }
    if (end < start) {
      push('La fecha final debe ser posterior a la inicial.', 'error')
      return
    }
    if (recurrence !== 'none' && recurrenceUntil && recurrenceUntil < startDate) {
      push('La repetición debe terminar después del inicio.', 'error')
      return
    }
    if (recurrence === 'custom' && recurrenceWeekdays.length === 0) {
      push('Selecciona al menos un día para la repetición personalizada.', 'error')
      return
    }
    const parsedCount = recurrence !== 'none' && recurrenceCount ? Number(recurrenceCount) : null
    if (parsedCount !== null && (!Number.isInteger(parsedCount) || parsedCount < 1)) {
      push('El número de repeticiones debe ser mayor a 0.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        user_id: user.id,
        title: title.trim(),
        notes: notes.trim() || null,
        location: location.trim() || null,
        category_id: categoryId,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        all_day: allDay,
        recurrence,
        recurrence_until: recurrence !== 'none' && recurrenceUntil ? recurrenceUntil : null,
        recurrence_weekdays:
          recurrence === 'custom' ? [...recurrenceWeekdays].sort((a, b) => a - b) : [],
        recurrence_count: parsedCount,
      }
      if (activity) {
        const { error } = await db().from('activities').update(payload).eq('id', activity.id)
        if (error) throw error
      } else {
        const { error } = await db().from('activities').insert(payload)
        if (error) throw error
      }
      push(activity ? 'Actividad actualizada' : 'Actividad creada')
      onSaved()
      onClose()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={activity ? 'Editar actividad' : 'Nueva actividad'}
      description={activity && activity.recurrence !== 'none' ? 'Los cambios se aplicarán a toda la serie.' : undefined}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>
            {activity && onDelete && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(activity)} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={!title.trim()}>
              {activity ? 'Guardar cambios' : 'Crear actividad'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Título">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="¿Qué vas a hacer?" autoFocus />
        </Field>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-ink-700 bg-ink-900 px-3.5 py-3">
          <span className="flex items-center gap-2 text-sm text-zinc-300">
            <Clock className="h-4 w-4 text-zinc-500" /> Todo el día
          </span>
          <input
            type="checkbox"
            checked={allDay}
            onChange={(event) => setAllDay(event.target.checked)}
            className="h-4 w-4 accent-[#b8f36b]"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fecha de inicio">
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
          </Field>
          {recurrence === 'none' && (
            <Field label="Fecha de fin">
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
            </Field>
          )}
          {!allDay && (
            <>
              <Field label="Hora de inicio">
                <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
              </Field>
              <Field label="Hora de fin">
                <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
              </Field>
            </>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Categoría">
            <CategoryPicker
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              kind="activity"
              onCreated={onCategoriesChanged}
            />
          </Field>
          <Field label="Ubicación">
            <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Opcional" />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Repetición">
            <Select
              value={recurrence}
              onChange={(event) => {
                const next = event.target.value as Recurrence
                setRecurrence(next)
                if (next !== 'none') setEndDate(startDate)
                if (next === 'custom' && recurrenceWeekdays.length === 0) {
                  setRecurrenceWeekdays([weekdayOf(startDate)])
                }
              }}
            >
              <option value="none">No se repite</option>
              <option value="daily">Cada día</option>
              <option value="weekdays">Lunes a viernes</option>
              <option value="weekly">Cada semana</option>
              <option value="monthly">Cada mes</option>
              <option value="custom">Personalizada (elegir días)</option>
            </Select>
          </Field>
          {recurrence !== 'none' && (
            <Field label="Repetir hasta" hint="Opcional. Sin fecha, la serie no termina.">
              <Input
                type="date"
                value={recurrenceUntil}
                min={startDate}
                onChange={(event) => setRecurrenceUntil(event.target.value)}
              />
            </Field>
          )}
        </div>

        {recurrence === 'custom' && (
          <div className="space-y-3 rounded-xl border border-ink-700 bg-ink-900/60 p-3.5">
            <div>
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                Días de la semana
              </span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_OPTIONS.map((day) => {
                  const active = recurrenceWeekdays.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() =>
                        setRecurrenceWeekdays((current) =>
                          current.includes(day.value)
                            ? current.filter((value) => value !== day.value)
                            : [...current, day.value],
                        )
                      }
                      aria-pressed={active}
                      aria-label={day.name}
                      title={day.name}
                      className={`h-9 min-w-9 rounded-lg border px-2 text-xs font-semibold transition ${
                        active
                          ? 'border-[#b8f36b] bg-[#b8f36b]/15 text-[#b8f36b]'
                          : 'border-ink-700 bg-ink-950 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
              <span className="mt-1.5 block text-[11px] leading-relaxed text-zinc-500">
                Toca los días en los que quieres que se repita.
              </span>
            </div>

            <Field
              label="Número de repeticiones"
              hint="Opcional. Ej. 8 para repetirlo 8 veces. Si lo dejas vacío, se repite hasta la fecha límite o sin fin."
            >
              <Input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={recurrenceCount}
                onChange={(event) => setRecurrenceCount(event.target.value)}
                placeholder="Ej. 8"
              />
            </Field>
          </div>
        )}

        {recurrence !== 'none' && (
          <p className="text-[11px] leading-relaxed text-zinc-600">
            La serie usa la fecha de inicio y el mismo horario en cada repetición.
            {recurrence === 'weekdays' ? ' Sábados y domingos se omiten.' : ''}
            {recurrence === 'custom' ? ' Solo aparecerá en los días seleccionados.' : ''}
          </p>
        )}

        {conflicts.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-3">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
              <AlertTriangle className="h-4 w-4" /> Posible conflicto de horario
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-amber-200/70">
              {conflicts.slice(0, 3).map((conflict) => `${conflict.title} (${formatTime(new Date(conflict.occurrence_start))}–${formatTime(new Date(conflict.occurrence_end))})`).join(' · ')}
              {conflicts.length > 3 ? ` y ${conflicts.length - 3} más` : ''}. Puedes guardar de todos modos.
            </p>
          </div>
        )}

        <Field label="Notas">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalles opcionales" />
        </Field>

        {activity?.recurrence === 'none' && activity && (
          <p className="text-[11px] leading-relaxed text-zinc-600">
            Las recurrencias se expanden automáticamente en el calendario y comparten una única serie.
          </p>
        )}
      </div>
    </Modal>
  )
}
