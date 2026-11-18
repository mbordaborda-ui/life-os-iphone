import { CalendarPlus, CheckSquare, NotebookPen, Utensils } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { db } from '../lib/supabase'
import { combineDateTime, toISODate, toTimeInput } from '../lib/dates'
import { errorMessage } from '../lib/utils'
import { Button, Field, Input, Modal, Select, Textarea, useToast } from './ui'

type QuickTab = 'task' | 'activity' | 'note' | 'food'

export function QuickAdd({
  open,
  onClose,
  onSaved,
  initialTab = 'task',
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  initialTab?: QuickTab
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const now = new Date()
  const [tab, setTab] = useState<QuickTab>(initialTab)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(toISODate(now))
  const [startTime, setStartTime] = useState(toTimeInput(new Date(now.getTime() + 30 * 60000)))
  const [endTime, setEndTime] = useState(toTimeInput(new Date(now.getTime() + 90 * 60000)))
  const [priority, setPriority] = useState('medium')
  const [mealType, setMealType] = useState('lunch')

  useEffect(() => {
    if (open) {
      setTab(initialTab)
      setTitle('')
      setNotes('')
      setDate(toISODate(new Date()))
      setSaving(false)
    }
  }, [open, initialTab])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!user || !title.trim()) return
    setSaving(true)
    try {
      if (tab === 'task') {
        const { error } = await db().from('tasks').insert({
          user_id: user.id,
          title: title.trim(),
          priority,
          due_date: date,
          notes: notes.trim() || null,
        })
        if (error) throw error
      } else if (tab === 'activity') {
        const start = combineDateTime(date, startTime)
        const end = combineDateTime(date, endTime)
        if (end < start) throw new Error('La hora final debe ser posterior a la inicial.')
        const { error } = await db().from('activities').insert({
          user_id: user.id,
          title: title.trim(),
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          notes: notes.trim() || null,
        })
        if (error) throw error
      } else if (tab === 'note') {
        const { error } = await db().from('notes').insert({
          user_id: user.id,
          title: title.trim(),
          content: notes,
        })
        if (error) throw error
      } else {
        const { error } = await db().from('food_logs').insert({
          user_id: user.id,
          log_date: date,
          meal_type: mealType,
          food_name: title.trim(),
          quantity: 1,
          unit: 'ración',
          notes: notes.trim() || null,
        })
        if (error) throw error
      }
      push('Añadido correctamente')
      onSaved()
      onClose()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setSaving(false)
    }
  }

  const tabs: Array<{ value: QuickTab; label: string; icon: typeof CheckSquare }> = [
    { value: 'task', label: 'Tarea', icon: CheckSquare },
    { value: 'activity', label: 'Evento', icon: CalendarPlus },
    { value: 'note', label: 'Nota', icon: NotebookPen },
    { value: 'food', label: 'Comida', icon: Utensils },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Creación rápida"
      description="Añade algo sin salir de tu día."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={!title.trim()}>
            Guardar
          </Button>
        </div>
      }
    >
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-ink-700 bg-ink-900 p-1">
          {tabs.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setTab(item.value)}
                className={`flex h-10 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium ${
                  tab === item.value ? 'bg-ink-750 text-lime' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </div>

        <Field label={tab === 'food' ? 'Alimento' : tab === 'note' ? 'Título' : 'Título'}>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={tab === 'food' ? 'Ej. Yogur con fruta' : 'Escribe un título'}
            autoFocus
            required
          />
        </Field>

        {tab === 'task' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Fecha límite">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Prioridad">
              <Select value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </Select>
            </Field>
          </div>
        )}

        {tab === 'activity' && (
          <>
            <Field label="Fecha">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Inicio">
                <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
              </Field>
              <Field label="Fin">
                <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
              </Field>
            </div>
          </>
        )}

        {tab === 'food' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Fecha">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Momento">
              <Select value={mealType} onChange={(event) => setMealType(event.target.value)}>
                <option value="breakfast">Desayuno</option>
                <option value="lunch">Comida</option>
                <option value="dinner">Cena</option>
                <option value="snack">Snack</option>
              </Select>
            </Field>
          </div>
        )}

        <Field label={tab === 'note' ? 'Contenido' : 'Notas'}>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={tab === 'note' ? 'Escribe aquí…' : 'Opcional'}
            className={tab === 'note' ? 'min-h-36' : 'min-h-20'}
          />
        </Field>
      </form>
    </Modal>
  )
}
