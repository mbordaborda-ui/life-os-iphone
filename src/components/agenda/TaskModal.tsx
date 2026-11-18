import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Category, Task, TaskPriority } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/supabase'
import { toISODate } from '../../lib/dates'
import { errorMessage } from '../../lib/utils'
import { CategoryPicker } from '../CategoryPicker'
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '../ui'

export function TaskModal({
  open,
  onClose,
  onSaved,
  task,
  categories,
  onCategoriesChanged,
  defaultDate,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  task?: Task | null
  categories: Category[]
  onCategoriesChanged: () => void
  defaultDate?: string
  onDelete?: (task: Task) => void
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (task) {
      setTitle(task.title)
      setNotes(task.notes ?? '')
      setPriority(task.priority)
      setDueDate(task.due_date ?? '')
      setCategoryId(task.category_id)
    } else {
      setTitle('')
      setNotes('')
      setPriority('medium')
      setDueDate(defaultDate ?? toISODate(new Date()))
      setCategoryId(null)
    }
    setSaving(false)
  }, [open, task, defaultDate])

  async function save() {
    if (!user || !title.trim()) return
    setSaving(true)
    try {
      const payload = {
        user_id: user.id,
        title: title.trim(),
        notes: notes.trim() || null,
        priority,
        due_date: dueDate || null,
        category_id: categoryId,
      }
      if (task) {
        const { error } = await db().from('tasks').update(payload).eq('id', task.id)
        if (error) throw error
      } else {
        const { error } = await db().from('tasks').insert(payload)
        if (error) throw error
      }
      push(task ? 'Tarea actualizada' : 'Tarea creada')
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
      title={task ? 'Editar tarea' : 'Nueva tarea'}
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>
            {task && onDelete && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(task)} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={!title.trim()}>
              {task ? 'Guardar cambios' : 'Crear tarea'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Título">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="¿Qué hay que hacer?" autoFocus />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prioridad">
            <Select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
            </Select>
          </Field>
          <Field label="Fecha límite" hint="Déjala vacía si no tiene fecha.">
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
        </div>
        <Field label="Categoría">
          <CategoryPicker
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            kind="task"
            onCreated={onCategoriesChanged}
          />
        </Field>
        <Field label="Notas">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contexto opcional" />
        </Field>
      </div>
    </Modal>
  )
}
