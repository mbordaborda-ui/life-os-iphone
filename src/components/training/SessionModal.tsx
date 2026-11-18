import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type {
  Exercise,
  ExerciseLog,
  SessionStatus,
  WorkoutRoutineWithItems,
  WorkoutType,
} from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/supabase'
import { toISODate } from '../../lib/dates'
import { errorMessage, formatNumber, toNumber, uid } from '../../lib/utils'
import { ExerciseSelect } from './ExerciseSelect'
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '../ui'

type LogDraft = {
  key: string
  exercise_id: string
  exercise_name: string
  sets: string
  reps: string
  weight_kg: string
  distance_m: string
  duration_sec: string
  notes: string
}

function emptyLog(): LogDraft {
  return {
    key: uid(),
    exercise_id: '',
    exercise_name: '',
    sets: '3',
    reps: '8',
    weight_kg: '',
    distance_m: '',
    duration_sec: '',
    notes: '',
  }
}

export function SessionModal({
  open,
  onClose,
  onSaved,
  routine,
  exercises,
  onExercisesChanged,
  recentLogs,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  routine: WorkoutRoutineWithItems | null
  exercises: Exercise[]
  onExercisesChanged: () => void
  recentLogs: ExerciseLog[]
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const [date, setDate] = useState(toISODate(new Date()))
  const [duration, setDuration] = useState('45')
  const [type, setType] = useState<Exclude<WorkoutType, 'rest'>>('strength')
  const [status, setStatus] = useState<SessionStatus>('completed')
  const [notes, setNotes] = useState('')
  const [logs, setLogs] = useState<LogDraft[]>([emptyLog()])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const routineType = routine && routine.workout_type !== 'rest' ? routine.workout_type : 'strength'
    setDate(toISODate(new Date()))
    setDuration(routine && !routine.is_rest ? '45' : '30')
    setType(routineType)
    setStatus('completed')
    setNotes('')
    setLogs(
      routine && !routine.is_rest && routine.routine_items.length
        ? routine.routine_items
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((item) => ({
              key: item.id,
              exercise_id: item.exercise_id,
              exercise_name: item.exercises?.name ?? '',
              sets: item.sets === null ? '' : String(item.sets),
              reps: item.reps === null ? '' : String(item.reps),
              weight_kg: '',
              distance_m: item.distance_m === null ? '' : String(item.distance_m),
              duration_sec: item.duration_min === null ? '' : String(Math.round(item.duration_min * 60)),
              notes: item.notes ?? '',
            }))
        : [emptyLog()],
    )
    setSaving(false)
  }, [open, routine])

  function updateLog(key: string, values: Partial<LogDraft>) {
    setLogs((current) => current.map((log) => (log.key === key ? { ...log, ...values } : log)))
  }

  function lastFor(exerciseId: string) {
    if (!exerciseId) return null
    return (
      recentLogs
        .filter((log) => log.exercise_id === exerciseId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
    )
  }

  async function save() {
    if (!user) return
    if (toNumber(duration) < 0) {
      push('La duración no puede ser negativa.', 'error')
      return
    }
    const validLogs = logs.filter((log) => log.exercise_name.trim())
    if (status === 'completed' && !validLogs.length) {
      push('Añade al menos un ejercicio para completar la sesión.', 'error')
      return
    }
    setSaving(true)
    try {
      const payloadLogs =
        status === 'skipped'
          ? []
          : validLogs.map((log) => ({
              exercise_id: log.exercise_id || null,
              exercise_name: log.exercise_name.trim(),
              sets: type === 'strength' && log.sets ? toNumber(log.sets) : null,
              reps: type === 'strength' && log.reps ? toNumber(log.reps) : null,
              weight_kg: type === 'strength' && log.weight_kg ? toNumber(log.weight_kg) : null,
              distance_m: type === 'cardio' && log.distance_m ? toNumber(log.distance_m) : null,
              duration_sec: type !== 'strength' && log.duration_sec ? Math.round(toNumber(log.duration_sec)) : null,
              notes: log.notes.trim() || null,
            }))
      const { error } = await db().rpc('save_workout_session', {
        p_session_date: date,
        p_workout_type: type,
        p_duration_min: Math.round(toNumber(duration)),
        p_status: status,
        p_notes: notes.trim() || null,
        p_started_at: status === 'completed' ? new Date().toISOString() : null,
        p_routine_id: routine?.id ?? null,
        p_logs: payloadLogs,
      })
      if (error) throw error
      push(status === 'completed' ? 'Sesión registrada' : 'Sesión omitida registrada')
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
      title="Registrar sesión"
      description={routine ? routine.title : 'Sesión libre'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Guardar sesión
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Fecha">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Duración (min)">
            <Input type="number" min="0" value={duration} onChange={(event) => setDuration(event.target.value)} />
          </Field>
          <Field label="Tipo">
            <Select value={type} onChange={(event) => setType(event.target.value as Exclude<WorkoutType, 'rest'>)}>
              <option value="strength">Fuerza</option>
              <option value="cardio">Cardio</option>
              <option value="other">Otro</option>
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={status} onChange={(event) => setStatus(event.target.value as SessionStatus)}>
              <option value="completed">Completada</option>
              <option value="skipped">Omitida</option>
            </Select>
          </Field>
        </div>

        {status === 'skipped' && (
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-3.5 py-3 text-[11px] leading-relaxed text-amber-200/70">
            La sesión quedará registrada como omitida y no contará en el volumen ni en la consistencia de entrenamiento.
          </div>
        )}

        {status === 'completed' && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">Ejercicios</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setLogs((current) => [...current, emptyLog()])}>
                <Plus className="h-3.5 w-3.5" /> Añadir
              </Button>
            </div>
            <div className="space-y-2">
              {logs.map((log) => {
                const previous = lastFor(log.exercise_id)
                return (
                  <div key={log.key} className="rounded-xl border border-ink-700 bg-ink-900 p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <ExerciseSelect
                          exercises={exercises}
                          value={log.exercise_id}
                          onChange={(exercise) =>
                            updateLog(log.key, {
                              exercise_id: exercise?.id ?? '',
                              exercise_name: exercise?.name ?? '',
                            })
                          }
                          onCreated={onExercisesChanged}
                          defaultType={type}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setLogs((current) => current.filter((entry) => entry.key !== log.key))}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
                        aria-label="Eliminar ejercicio"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {previous && (
                      <p className="mt-1.5 text-[10px] text-zinc-600">
                        Último registro: {previous.sets ?? '—'} × {previous.reps ?? '—'}
                        {previous.weight_kg !== null ? ` · ${formatNumber(previous.weight_kg)} kg` : ''}
                        {previous.distance_m !== null ? ` · ${formatNumber(previous.distance_m, 0)} m` : ''}
                        {previous.duration_sec !== null ? ` · ${Math.round(previous.duration_sec / 60)} min` : ''}
                      </p>
                    )}
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {type === 'strength' && (
                        <>
                          <Field label="Series">
                            <Input
                              type="number"
                              min="1"
                              value={log.sets}
                              onChange={(event) => updateLog(log.key, { sets: event.target.value })}
                              className="h-9 text-xs"
                            />
                          </Field>
                          <Field label="Reps">
                            <Input
                              type="number"
                              min="1"
                              value={log.reps}
                              onChange={(event) => updateLog(log.key, { reps: event.target.value })}
                              className="h-9 text-xs"
                            />
                          </Field>
                          <Field label="Peso (kg)">
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={log.weight_kg}
                              onChange={(event) => updateLog(log.key, { weight_kg: event.target.value })}
                              className="h-9 text-xs"
                              placeholder="—"
                            />
                          </Field>
                        </>
                      )}
                      {type === 'cardio' && (
                        <>
                          <Field label="Distancia (m)">
                            <Input
                              type="number"
                              min="0"
                              value={log.distance_m}
                              onChange={(event) => updateLog(log.key, { distance_m: event.target.value })}
                              className="h-9 text-xs"
                              placeholder="—"
                            />
                          </Field>
                          <Field label="Duración (seg)">
                            <Input
                              type="number"
                              min="0"
                              value={log.duration_sec}
                              onChange={(event) => updateLog(log.key, { duration_sec: event.target.value })}
                              className="h-9 text-xs"
                              placeholder="—"
                            />
                          </Field>
                        </>
                      )}
                      {type === 'other' && (
                        <Field label="Duración (seg)">
                          <Input
                            type="number"
                            min="0"
                            value={log.duration_sec}
                            onChange={(event) => updateLog(log.key, { duration_sec: event.target.value })}
                            className="h-9 text-xs"
                            placeholder="—"
                          />
                        </Field>
                      )}
                      <Field label="Nota" className="col-span-2">
                        <Input
                          value={log.notes}
                          onChange={(event) => updateLog(log.key, { notes: event.target.value })}
                          className="h-9 text-xs"
                          placeholder="Opcional"
                        />
                      </Field>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <Field label="Notas de la sesión">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Sensaciones, incidencias, progresión…" className="min-h-20" />
        </Field>
        <p className="text-[11px] leading-relaxed text-zinc-600">
          El volumen de fuerza se calcula como series × repeticiones × peso. Las sesiones de cardio no mezclan métricas de fuerza.
        </p>
      </div>
    </Modal>
  )
}
