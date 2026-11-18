import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import type { Exercise, WorkoutType } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/supabase'
import { MUSCLE_GROUPS } from '../../lib/constants'
import { errorMessage } from '../../lib/utils'
import { Button, Input, Select, useToast } from '../ui'

export function ExerciseSelect({
  exercises,
  value,
  onChange,
  onCreated,
  defaultType = 'strength',
}: {
  exercises: Exercise[]
  value: string
  onChange: (exercise: Exercise | null) => void
  onCreated: () => void
  defaultType?: Exclude<WorkoutType, 'rest'>
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState('')
  const [type, setType] = useState<Exclude<WorkoutType, 'rest'>>(defaultType)
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!user || !name.trim()) return
    setSaving(true)
    try {
      const { data, error } = await db()
        .from('exercises')
        .insert({
          user_id: user.id,
          name: name.trim(),
          muscle_group: muscle.trim() || null,
          exercise_type: type,
        })
        .select('*')
        .single()
      if (error) throw error
      onChange(data as Exercise)
      onCreated()
      setName('')
      setMuscle('')
      setAdding(false)
      push('Ejercicio creado')
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Select
          value={value}
          onChange={(event) => {
            const exercise = exercises.find((item) => item.id === event.target.value) ?? null
            onChange(exercise)
          }}
          className="h-9 flex-1 text-xs"
        >
          <option value="">Selecciona ejercicio</option>
          {exercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name}
              {exercise.muscle_group ? ` · ${exercise.muscle_group}` : ''}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-9 w-9"
          onClick={() => setAdding((current) => !current)}
          aria-label="Nuevo ejercicio"
        >
          {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {adding && (
        <div className="space-y-2 rounded-lg border border-ink-700 bg-ink-900 p-2.5 animate-fade-in">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre del ejercicio"
            className="h-9 text-xs"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              list="exercise-muscles"
              value={muscle}
              onChange={(event) => setMuscle(event.target.value)}
              placeholder="Grupo muscular"
              className="h-9 text-xs"
            />
            <datalist id="exercise-muscles">
              {MUSCLE_GROUPS.map((group) => (
                <option key={group} value={group} />
              ))}
            </datalist>
            <Select value={type} onChange={(event) => setType(event.target.value as Exclude<WorkoutType, 'rest'>)} className="h-9 text-xs">
              <option value="strength">Fuerza</option>
              <option value="cardio">Cardio</option>
              <option value="other">Otro</option>
            </Select>
          </div>
          <Button type="button" size="sm" variant="primary" onClick={create} loading={saving} disabled={!name.trim()} className="w-full">
            Crear y seleccionar
          </Button>
        </div>
      )}
    </div>
  )
}
