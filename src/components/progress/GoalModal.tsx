import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Category, Goal, GoalPeriod, GoalStatus, Task } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/supabase'
import { toISODate } from '../../lib/dates'
import { errorMessage } from '../../lib/utils'
import { CategoryPicker } from '../CategoryPicker'
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '../ui'

export interface GoalDraft {
  title: string
  description: string
  period: GoalPeriod
  metric_unit: string
  target_value: string
  start_date: string
  end_date: string
  category_id: string | null
  status: GoalStatus
}

export function GoalModal({
  open,
  onClose,
  onSaved,
  goal,
  categories,
  tasks,
  linkedTaskIds,
  onCategoriesChanged,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  goal: Goal | null
  categories: Category[]
  tasks: Task[]
  linkedTaskIds: string[]
  onCategoriesChanged: () => void
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const [draft, setDraft] = useState<GoalDraft>(() => initialDraft(goal))
  const [taskIds, setTaskIds] = useState<string[]>(linkedTaskIds)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(initialDraft(goal))
    setTaskIds(linkedTaskIds)
    setSearch('')
  }, [open, goal?.id])

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tasks
    return tasks.filter((task) => task.title.toLowerCase().includes(term))
  }, [tasks, search])

  function set<K extends keyof GoalDraft>(key: K, value: GoalDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    if (!user) return
    if (!draft.title.trim()) {
      push('Ponle un título al objetivo', 'error')
      return
    }
    if (Number(draft.target_value) <= 0) {
      push('La meta debe ser mayor que cero', 'error')
      return
    }
    if (draft.end_date && draft.end_date < draft.start_date) {
      push('La fecha de fin no puede ser anterior al inicio', 'error')
      return
    }
    setSaving(true)
    try {
      const { error } = await db().rpc('save_goal', {
        p_goal_id: goal?.id ?? null,
        p_goal: {
          title: draft.title.trim(),
          description: draft.description.trim(),
          period: draft.period,
          metric_unit: draft.metric_unit.trim() || 'acciones',
          target_value: Number(draft.target_value),
          start_date: draft.start_date,
          end_date: draft.end_date || '',
          status: draft.status,
          category_id: draft.category_id ?? '',
        },
        p_task_ids: taskIds,
      })
      if (error) throw error
      push(goal ? 'Objetivo actualizado' : 'Objetivo creado')
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
      title={goal ? 'Editar objetivo' : 'Nuevo objetivo'}
      description="Define una meta medible. Puedes vincular tareas para dar contexto, pero el avance se registra manualmente."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            {goal ? 'Guardar cambios' : 'Crear objetivo'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Título">
          <Input
            value={draft.title}
            onChange={(event) => set('title', event.target.value)}
            placeholder="Ej. Entrenar 4 veces por semana"
            autoFocus
          />
        </Field>
        <Field label="Descripción" hint="Opcional. Qué significa conseguirlo y cómo lo vas a medir.">
          <Textarea
            value={draft.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder="Contexto, intención o criterio de éxito"
            className="min-h-20"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Periodo">
            <Select value={draft.period} onChange={(event) => set('period', event.target.value as GoalPeriod)}>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={draft.status} onChange={(event) => set('status', event.target.value as GoalStatus)}>
              <option value="active">Activo</option>
              <option value="completed">Completado</option>
              <option value="archived">Archivado</option>
            </Select>
          </Field>
          <Field label="Meta">
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={draft.target_value}
              onChange={(event) => set('target_value', event.target.value)}
            />
          </Field>
          <Field label="Unidad">
            <Input
              value={draft.metric_unit}
              onChange={(event) => set('metric_unit', event.target.value)}
              placeholder="sesiones, páginas, kg…"
            />
          </Field>
          <Field label="Inicio">
            <Input type="date" value={draft.start_date} onChange={(event) => set('start_date', event.target.value)} />
          </Field>
          <Field label="Fin" hint="Opcional.">
            <Input type="date" value={draft.end_date} onChange={(event) => set('end_date', event.target.value)} />
          </Field>
        </div>
        <Field label="Categoría">
          <CategoryPicker
            categories={categories}
            value={draft.category_id}
            onChange={(value) => set('category_id', value)}
            kind="task"
            onCreated={onCategoriesChanged}
          />
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
              Tareas vinculadas
            </span>
            <span className="text-[10px] text-zinc-600">{taskIds.length} seleccionadas</span>
          </div>
          <div className="rounded-xl border border-ink-700 bg-ink-900">
            <div className="flex items-center gap-2 border-b border-ink-700/70 px-3">
              <Search className="h-3.5 w-3.5 text-zinc-600" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar tareas…"
                className="h-9 w-full bg-transparent text-xs text-white placeholder:text-zinc-600 focus:outline-none"
              />
            </div>
            <div className="max-h-44 overflow-y-auto p-1.5">
              {filteredTasks.length ? (
                filteredTasks.map((task) => {
                  const checked = taskIds.includes(task.id)
                  return (
                    <label
                      key={task.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-ink-800"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setTaskIds((current) =>
                            checked ? current.filter((id) => id !== task.id) : [...current, task.id],
                          )
                        }
                        className="h-3.5 w-3.5 accent-lime"
                      />
                      <span className="min-w-0 flex-1">
                        <span className={task.status === 'completed' ? 'block truncate text-xs text-zinc-500 line-through' : 'block truncate text-xs text-zinc-300'}>
                          {task.title}
                        </span>
                      </span>
                      {task.due_date && <span className="shrink-0 text-[9px] text-zinc-600">{task.due_date}</span>}
                    </label>
                  )
                })
              ) : (
                <p className="px-2.5 py-4 text-center text-[11px] text-zinc-600">
                  {tasks.length ? 'No hay tareas que coincidan.' : 'Todavía no tienes tareas creadas.'}
                </p>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
            Las tareas vinculadas muestran su propio progreso y no modifican el valor del objetivo.
          </p>
        </div>
      </div>
    </Modal>
  )
}

function initialDraft(goal: Goal | null): GoalDraft {
  return {
    title: goal?.title ?? '',
    description: goal?.description ?? '',
    period: goal?.period ?? 'weekly',
    metric_unit: goal?.metric_unit ?? 'acciones',
    target_value: goal ? String(goal.target_value) : '1',
    start_date: goal?.start_date ?? toISODate(new Date()),
    end_date: goal?.end_date ?? '',
    category_id: goal?.category_id ?? null,
    status: goal?.status ?? 'active',
  }
}
