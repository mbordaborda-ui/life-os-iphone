import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Exercise, WorkoutRoutineWithItems, WorkoutType } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/supabase'
import { WEEKDAYS_LONG } from '../../lib/dates'
import { uid, errorMessage } from '../../lib/utils'
import { MUSCLE_GROUPS } from '../../lib/constants'
import { ExerciseSelect } from './ExerciseSelect'
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '../ui'

type ItemDraft = {
  key: string
  exercise_id: string
  exercise_name: string
  sets: string
  reps: string
  distance_m: string
  duration_min: string
  notes: string
}

function emptyItem(): ItemDraft {
  return { key: uid(), exercise_id: '', exercise_name: '', sets: '3', reps: '8', distance_m: '', duration_min: '', notes: '' }
}

export function RoutineEditorModal({
  open,
  onClose,
  onSaved,
  weekday,
  routine,
  exercises,
  onExercisesChanged,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  weekday: number
  routine: WorkoutRoutineWithItems | null
  exercises: Exercise[]
  onExercisesChanged: () => void
  onDelete?: (routine: WorkoutRoutineWithItems) => void
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const [title, setTitle] = useState('')
  const [workoutType, setWorkoutType] = useState<Exclude<WorkoutType, 'rest'>>('strength')
  const [isRest, setIsRest] = useState(false)
  const [muscles, setMuscles] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ItemDraft[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (routine) {
      setTitle(routine.title)
      setWorkoutType(routine.workout_type === 'rest' ? 'strength' : routine.workout_type)
      setIsRest(routine.is_rest)
      setMuscles(routine.muscle_groups.join(', '))
      setNotes(routine.notes ?? '')
      setItems(
        routine.routine_items.length
          ? routine.routine_items
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((item) => ({
                key: item.id,
                exercise_id: item.exercise_id,
                exercise_name: item.exercises?.name ?? '',
                sets: item.sets === null ? '' : String(item.sets),
                reps: item.reps === null ? '' : String(item.reps),
                distance_m: item.distance_m === null ? '' : String(item.distance_m),
                duration_min: item.duration_min === null ? '' : String(item.duration_min),
                notes: item.notes ?? '',
              }))
          : [emptyItem()],
      )
    } else {
      setTitle('Entrenamiento')
      setWorkoutType('strength')
      setIsRest(false)
      setMuscles('')
      setNotes('')
      setItems([emptyItem()])
    }
    setSaving(false)
  }, [open, routine])

  function updateItem(key: string, values: Partial<ItemDraft>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...values } : item)))
  }

  function toggleRest(rest: boolean) {
    setIsRest(rest)
    if (rest) setTitle('Descanso')
    else if (title === 'Descanso' || !title.trim()) setTitle('Entrenamiento')
  }

  async function save() {
    if (!user) return
    if (!title.trim()) {
      push('El título es obligatorio.', 'error')
      return
    }
    if (!isRest && items.some((item) => item.exercise_id && !item.exercise_name)) {
      push('Revisa los ejercicios seleccionados.', 'error')
      return
    }
    setSaving(true)
    try {
      const { error } = await db().rpc('save_workout_routine', {
        p_routine_id: routine?.id ?? null,
        p_weekday: weekday,
        p_routine: {
          title: title.trim(),
          workout_type: workoutType,
          is_rest: isRest,
          muscle_groups: muscles
            .split(',')
            .map((muscle) => muscle.trim())
            .filter(Boolean),
          notes: notes.trim() || null,
        },
        p_items: isRest
          ? []
          : items
              .filter((item) => item.exercise_id)
              .map((item) => ({
                exercise_id: item.exercise_id,
                sets: item.sets || null,
                reps: item.reps || null,
                distance_m: item.distance_m || null,
                duration_min: item.duration_min || null,
                notes: item.notes.trim() || null,
              })),
      })
      if (error) throw error
      push('Rutina guardada')
      onSaved()
      onClose()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setSaving(false)
    }
  }

  const dayName = WEEKDAYS_LONG[(weekday + 6) % 7]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Rutina del ${dayName.toLowerCase()}`}
      description="Define el plan semanal. Las sesiones son registros independientes."
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>
            {routine && onDelete && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(routine)} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-4 w-4" /> Eliminar rutina
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={!title.trim()}>
              Guardar rutina
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Título">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Push · pecho y hombro" />
          </Field>
          <Field label="Tipo" hint={isRest ? 'El día de descanso no admite ejercicios.' : undefined}>
            <Select
              value={workoutType}
              onChange={(event) => setWorkoutType(event.target.value as Exclude<WorkoutType, 'rest'>)}
              disabled={isRest}
            >
              <option value="strength">Fuerza</option>
              <option value="cardio">Cardio</option>
              <option value="other">Otro</option>
            </Select>
          </Field>
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-ink-700 bg-ink-900 px-3.5 py-3">
          <span className="text-sm text-zinc-300">Día de descanso</span>
          <input
            type="checkbox"
            checked={isRest}
            onChange={(event) => toggleRest(event.target.checked)}
            className="h-4 w-4 accent-[#b8f36b]"
          />
        </label>

        {!isRest && (
          <>
            <Field label="Grupos musculares" hint="Separados por comas.">
              <Input
                list="routine-muscles"
                value={muscles}
                onChange={(event) => setMuscles(event.target.value)}
                placeholder="Pecho, hombros, tríceps"
              />
              <datalist id="routine-muscles">
                {MUSCLE_GROUPS.map((group) => (
                  <option key={group} value={group} />
                ))}
              </datalist>
            </Field>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">Ejercicios</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setItems((current) => [...current, emptyItem()])}>
                  <Plus className="h-3.5 w-3.5" /> Añadir
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.key} className="rounded-xl border border-ink-700 bg-ink-900 p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <ExerciseSelect
                          exercises={exercises}
                          value={item.exercise_id}
                          onChange={(exercise) =>
                            updateItem(item.key, {
                              exercise_id: exercise?.id ?? '',
                              exercise_name: exercise?.name ?? '',
                            })
                          }
                          onCreated={onExercisesChanged}
                          defaultType={workoutType}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setItems((current) => current.filter((entry) => entry.key !== item.key))}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
                        aria-label="Eliminar ejercicio"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {workoutType === 'strength' && (
                        <>
                          <Field label="Series">
                            <Input
                              type="number"
                              min="1"
                              value={item.sets}
                              onChange={(event) => updateItem(item.key, { sets: event.target.value })}
                              className="h-9 text-xs"
                            />
                          </Field>
                          <Field label="Reps">
                            <Input
                              type="number"
                              min="1"
                              value={item.reps}
                              onChange={(event) => updateItem(item.key, { reps: event.target.value })}
                              className="h-9 text-xs"
                            />
                          </Field>
                        </>
                      )}
                      {workoutType === 'cardio' && (
                        <>
                          <Field label="Distancia (m)">
                            <Input
                              type="number"
                              min="0"
                              value={item.distance_m}
                              onChange={(event) => updateItem(item.key, { distance_m: event.target.value })}
                              className="h-9 text-xs"
                              placeholder="—"
                            />
                          </Field>
                          <Field label="Duración (min)">
                            <Input
                              type="number"
                              min="0"
                              value={item.duration_min}
                              onChange={(event) => updateItem(item.key, { duration_min: event.target.value })}
                              className="h-9 text-xs"
                              placeholder="—"
                            />
                          </Field>
                        </>
                      )}
                      {workoutType === 'other' && (
                        <Field label="Duración (min)">
                          <Input
                            type="number"
                            min="0"
                            value={item.duration_min}
                            onChange={(event) => updateItem(item.key, { duration_min: event.target.value })}
                            className="h-9 text-xs"
                            placeholder="—"
                          />
                        </Field>
                      )}
                      <Field label="Nota" className="col-span-2">
                        <Input
                          value={item.notes}
                          onChange={(event) => updateItem(item.key, { notes: event.target.value })}
                          className="h-9 text-xs"
                          placeholder="Opcional"
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Field label="Notas de la rutina">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" className="min-h-20" />
        </Field>
      </div>
    </Modal>
  )
}
