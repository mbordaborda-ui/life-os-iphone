import { Check, CheckSquare2, CircleAlert, ListTodo, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AgendaNav } from '../../components/agenda/AgendaNav'
import { TaskModal } from '../../components/agenda/TaskModal'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  ProgressBar,
  Select,
  useToast,
} from '../../components/ui'
import { useCategories } from '../../hooks/useCategories'
import { useQuery } from '../../hooks/useQuery'
import { endOfWeek, formatDateShort, parseLocalDate, startOfWeek, toISODate } from '../../lib/dates'
import { isTaskOverdue, taskCompletionRate } from '../../lib/calculations'
import { PRIORITY_LABELS } from '../../lib/constants'
import { db } from '../../lib/supabase'
import { cn, errorMessage } from '../../lib/utils'
import type { Category, Task, TaskPriority, TaskStatus } from '../../types'

type StatusFilter = 'all' | TaskStatus

export default function TasksPage() {
  const { push } = useToast()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState(false)
  const todayISO = toISODate(new Date())
  const weekStart = startOfWeek(new Date())
  const weekEnd = endOfWeek(new Date())
  const categories = useCategories('task')

  const tasksQuery = useQuery<Task[]>(
    async () => {
      const { data, error } = await db().from('tasks').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Task[]
    },
    [],
    [],
  )

  const weekTasks = useMemo(
    () =>
      tasksQuery.data.filter((task) => {
        if (task.due_date) {
          const due = parseLocalDate(task.due_date)
          if (due >= weekStart && due <= weekEnd) return true
        }
        if (task.completed_at) {
          const completed = new Date(task.completed_at)
          if (completed >= weekStart && completed <= weekEnd) return true
        }
        return false
      }),
    [tasksQuery.data, weekStart, weekEnd],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return tasksQuery.data
      .filter((task) => statusFilter === 'all' || task.status === statusFilter)
      .filter((task) => priorityFilter === 'all' || task.priority === priorityFilter)
      .filter((task) => !term || task.title.toLowerCase().includes(term) || task.notes?.toLowerCase().includes(term))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'pending' ? -1 : 1
        const priority = { high: 0, medium: 1, low: 2 }
        return (
          priority[a.priority] - priority[b.priority] ||
          (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31') ||
          b.created_at.localeCompare(a.created_at)
        )
      })
  }, [tasksQuery.data, statusFilter, priorityFilter, search])

  const pending = tasksQuery.data.filter((task) => task.status === 'pending')
  const overdue = pending.filter((task) => isTaskOverdue(task, todayISO))
  const weeklyRate = taskCompletionRate(weekTasks)
  const categoryMap = useMemo(
    () => new Map(categories.data.map((category) => [category.id, category])),
    [categories.data],
  )

  const groups = useMemo(() => {
    const overdueTasks = filtered.filter((task) => isTaskOverdue(task, todayISO))
    const todayTasks = filtered.filter((task) => task.status === 'pending' && task.due_date === todayISO)
    const upcomingTasks = filtered.filter(
      (task) => task.status === 'pending' && task.due_date && task.due_date > todayISO,
    )
    const undatedTasks = filtered.filter((task) => task.status === 'pending' && !task.due_date)
    const completedTasks = filtered.filter((task) => task.status === 'completed')
    return [
      { label: 'Atrasadas', tasks: overdueTasks, tone: 'red' as const },
      { label: 'Hoy', tasks: todayTasks, tone: 'accent' as const },
      { label: 'Próximas', tasks: upcomingTasks, tone: 'neutral' as const },
      { label: 'Sin fecha', tasks: undatedTasks, tone: 'neutral' as const },
      { label: 'Completadas', tasks: completedTasks, tone: 'muted' as const },
    ].filter((group) => group.tasks.length)
  }, [filtered, todayISO])

  async function toggleTask(task: Task) {
    try {
      const completed = task.status !== 'completed'
      const { error } = await db()
        .from('tasks')
        .update({
          status: completed ? 'completed' : 'pending',
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', task.id)
      if (error) throw error
      tasksQuery.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    }
  }

  async function deleteTask() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('tasks').delete().eq('id', deleteTarget.id)
      if (error) throw error
      push('Tarea eliminada')
      setDeleteTarget(null)
      setModalOpen(false)
      tasksQuery.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (tasksQuery.loading || categories.loading) return <LoadingState label="Cargando tareas" />
  if (tasksQuery.error) return <ErrorState message={tasksQuery.error} onRetry={tasksQuery.reload} />

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        eyebrow="Agenda"
        title="Tareas"
        description="Decide qué importa, cuándo vence y qué has terminado de verdad."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4" /> Nueva tarea
          </Button>
        }
      />

      <AgendaNav />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="muted-label">Pendientes</p>
          <p className="mt-2 text-2xl font-semibold text-white">{pending.length}</p>
          <p className="mt-1 text-[11px] text-zinc-500">Tareas abiertas</p>
        </Card>
        <Card className={cn('p-4', overdue.length > 0 && 'border-red-500/20')}>
          <p className="muted-label">Atrasadas</p>
          <p className={cn('mt-2 text-2xl font-semibold', overdue.length ? 'text-red-300' : 'text-white')}>
            {overdue.length}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">Requieren atención</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Cumplimiento semanal</p>
            <span className="text-xs font-semibold text-lime">{Math.round(weeklyRate)}%</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">
            {weekTasks.filter((task) => task.status === 'completed').length}
            <span className="text-base font-normal text-zinc-600"> / {weekTasks.length}</span>
          </p>
          <ProgressBar value={weeklyRate} className="mt-3" />
        </Card>
      </div>

      <Card className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar tareas"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="min-w-[120px]"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="completed">Completadas</option>
            </Select>
            <Select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as 'all' | TaskPriority)}
              className="min-w-[120px]"
            >
              <option value="all">Toda prioridad</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </Select>
          </div>
        </div>
      </Card>

      {groups.length ? (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.label}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{group.label}</h2>
                <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] text-zinc-500">{group.tasks.length}</span>
              </div>
              <Card className="overflow-hidden">
                <div className="divide-y divide-ink-700/60">
                  {group.tasks.map((task) => {
                    const category = task.category_id ? categoryMap.get(task.category_id) : null
                    const taskOverdue = isTaskOverdue(task, todayISO)
                    return (
                      <div key={task.id} className="group flex items-center gap-3 px-4 py-3">
                        <button
                          onClick={() => toggleTask(task)}
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition',
                            task.status === 'completed'
                              ? 'border-lime bg-lime text-ink-950'
                              : 'border-ink-600 text-transparent hover:border-lime/70',
                          )}
                          aria-label={task.status === 'completed' ? 'Reabrir tarea' : 'Completar tarea'}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditing(task)
                            setModalOpen(true)
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={cn(
                                'truncate text-sm font-medium text-white',
                                task.status === 'completed' && 'text-zinc-500 line-through',
                              )}
                            >
                              {task.title}
                            </p>
                            <Badge
                              tone={task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'muted'}
                            >
                              {PRIORITY_LABELS[task.priority]}
                            </Badge>
                            {category && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                                {category.name}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px]">
                            <span className={cn(taskOverdue ? 'text-red-400' : 'text-zinc-500')}>
                              {task.due_date
                                ? task.due_date === todayISO
                                  ? 'Vence hoy'
                                  : taskOverdue
                                    ? `Atrasada desde ${formatDateShort(parseLocalDate(task.due_date))}`
                                    : `Vence ${formatDateShort(parseLocalDate(task.due_date))}`
                                : 'Sin fecha límite'}
                            </span>
                            {task.notes && <span className="truncate text-zinc-600">{task.notes}</span>}
                          </div>
                        </button>
                        {taskOverdue && <CircleAlert className="h-4 w-4 shrink-0 text-red-400 sm:hidden" />}
                        <button
                          onClick={() => setDeleteTarget(task)}
                          className="hidden h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400 sm:flex"
                          aria-label="Eliminar tarea"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<ListTodo className="h-5 w-5" />}
            title={tasksQuery.data.length ? 'No hay tareas con estos filtros' : 'Aún no hay tareas'}
            description={
              tasksQuery.data.length
                ? 'Prueba con otro estado, prioridad o término de búsqueda.'
                : 'Añade la primera tarea y empieza con lo que de verdad importa.'
            }
            action={
              tasksQuery.data.length ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStatusFilter('all')
                    setPriorityFilter('all')
                    setSearch('')
                  }}
                >
                  Limpiar filtros
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setEditing(null)
                    setModalOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4" /> Añadir tarea
                </Button>
              )
            }
          />
        </Card>
      )}

      <TaskModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onSaved={tasksQuery.reload}
        task={editing}
        categories={categories.data as Category[]}
        onCategoriesChanged={categories.reload}
        defaultDate={todayISO}
        onDelete={(task) => setDeleteTarget(task)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar tarea"
        description="La tarea se eliminará de forma permanente. Esta acción no se puede deshacer."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteTask}
        loading={deleting}
      />

      {!filtered.length && tasksQuery.data.length > 0 && (
        <p className="text-center text-[11px] text-zinc-600">
          <CheckSquare2 className="mr-1 inline h-3 w-3" />
          {tasksQuery.data.filter((task) => task.status === 'completed').length} tareas completadas en total
        </p>
      )}
    </div>
  )
}
