import { CheckCircle2, Link2, Pencil, Plus, RotateCcw, Target, Trash2, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Category, Goal, GoalProgress, GoalStatus, GoalTaskLink, Task } from '../../types'
import { useQuery } from '../../hooks/useQuery'
import { db } from '../../lib/supabase'
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, toISODate } from '../../lib/dates'
import { percentage } from '../../lib/calculations'
import { errorMessage, formatNumber } from '../../lib/utils'
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, LoadingState, ProgressBar, useToast } from '../ui'
import { GoalModal } from './GoalModal'
import { GoalProgressModal } from './GoalProgressModal'

type GoalsData = { goals: Goal[]; progress: GoalProgress[]; links: GoalTaskLink[] }
const EMPTY: GoalsData = { goals: [], progress: [], links: [] }

export function GoalsPanel({
  tasks,
  categories,
  onCategoriesChanged,
}: {
  tasks: Task[]
  categories: Category[]
  onCategoriesChanged: () => void
}) {
  const { push } = useToast()
  const [goalModalOpen, setGoalModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [progressGoal, setProgressGoal] = useState<Goal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const query = useQuery<GoalsData>(
    async () => {
      const client = db()
      const [goals, progress, links] = await Promise.all([
        client.from('goals').select('*').order('created_at', { ascending: false }),
        client.from('goal_progress').select('*').order('recorded_on', { ascending: false }),
        client.from('goal_task_links').select('*'),
      ])
      for (const result of [goals, progress, links]) {
        if (result.error) throw result.error
      }
      return {
        goals: (goals.data ?? []) as Goal[],
        progress: (progress.data ?? []) as GoalProgress[],
        links: (links.data ?? []) as GoalTaskLink[],
      }
    },
    [],
    EMPTY,
  )

  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])
  const linksByGoal = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const link of query.data.links) {
      map.set(link.goal_id, [...(map.get(link.goal_id) ?? []), link.task_id])
    }
    return map
  }, [query.data.links])

  const archived = query.data.goals.filter((goal) => goal.status === 'archived')
  const active = query.data.goals.filter((goal) => goal.status === 'active')
  const completed = query.data.goals.filter((goal) => goal.status === 'completed')
  const visible = showArchived ? query.data.goals : [...active, ...completed]
  const activeAverages = active.map((goal) => goalPeriodProgress(goal, query.data.progress).percentage)
  const averageProgress = activeAverages.length
    ? activeAverages.reduce((total, value) => total + value, 0) / activeAverages.length
    : 0
  const linkedTasks = query.data.links.filter((link) => taskMap.has(link.task_id))

  function openCreate() {
    setEditingGoal(null)
    setGoalModalOpen(true)
  }

  function openEdit(goal: Goal) {
    setEditingGoal(goal)
    setGoalModalOpen(true)
  }

  async function changeStatus(goal: Goal, status: GoalStatus) {
    try {
      const { error } = await db().from('goals').update({ status }).eq('id', goal.id)
      if (error) throw error
      push(status === 'completed' ? 'Objetivo completado' : 'Objetivo reabierto')
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    }
  }

  async function removeGoal() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('goals').delete().eq('id', deleteTarget.id)
      if (error) throw error
      push('Objetivo eliminado')
      setDeleteTarget(null)
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (query.loading) return <LoadingState label="Cargando objetivos" />
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Objetivos activos</p>
            <Target className="h-4 w-4 text-lime/70" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{active.length}</p>
          <p className="mt-1.5 text-[10px] text-zinc-600">en seguimiento</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Cumplimiento medio</p>
            <TrendingUp className="h-4 w-4 text-lime/70" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{Math.round(averageProgress)}%</p>
          <ProgressBar value={averageProgress} className="mt-2.5" />
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Tareas vinculadas</p>
            <Link2 className="h-4 w-4 text-sky-400/70" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{linkedTasks.length}</p>
          <p className="mt-1.5 text-[10px] text-zinc-600">con contexto de objetivo</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Completados</p>
            <CheckCircle2 className="h-4 w-4 text-zinc-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{completed.length}</p>
          <p className="mt-1.5 text-[10px] text-zinc-600">objetivos conseguidos</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Objetivos</h2>
          <p className="mt-0.5 text-[10px] text-zinc-500">
            El avance se mide por el periodo actual de cada objetivo · {new Date().getFullYear()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(archived.length > 0 || showArchived) && (
            <Button variant="ghost" size="sm" onClick={() => setShowArchived((current) => !current)}>
              {showArchived ? 'Ocultar archivados' : `Archivados (${archived.length})`}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Nuevo objetivo
          </Button>
        </div>
      </div>

      {visible.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((goal) => {
            const period = goalPeriodProgress(goal, query.data.progress)
            const total = query.data.progress
              .filter((entry) => entry.goal_id === goal.id)
              .reduce((sum, entry) => sum + entry.value, 0)
            const linkedIds = linksByGoal.get(goal.id) ?? []
            const linked = linkedIds.map((id) => taskMap.get(id)).filter(Boolean) as Task[]
            const linkedCompleted = linked.filter((task) => task.status === 'completed').length
            const category = goal.category_id ? categoryMap.get(goal.category_id) : null
            const latest = query.data.progress
              .filter((entry) => entry.goal_id === goal.id)
              .sort((a, b) => b.recorded_on.localeCompare(a.recorded_on))[0]
            return (
              <Card key={goal.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={goal.status === 'completed' ? 'muted' : goal.status === 'archived' ? 'neutral' : 'accent'}>
                        {goal.status === 'completed' ? 'Completado' : goal.status === 'archived' ? 'Archivado' : 'Activo'}
                      </Badge>
                      <Badge tone="muted">{goal.period === 'weekly' ? 'Semanal' : 'Mensual'}</Badge>
                      {category && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} />
                          {category.name}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-white">{goal.title}</h3>
                    {goal.description && (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">{goal.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      onClick={() => openEdit(goal)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-ink-800 hover:text-white"
                      aria-label="Editar objetivo"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => changeStatus(goal, goal.status === 'completed' ? 'active' : 'completed')}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-ink-800 hover:text-lime"
                      aria-label={goal.status === 'completed' ? 'Reabrir objetivo' : 'Completar objetivo'}
                    >
                      {goal.status === 'completed' ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(goal)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-red-950/30 hover:text-red-300"
                      aria-label="Eliminar objetivo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-lg font-semibold text-white">
                      {formatNumber(period.total, 2)}
                      <span className="ml-1 text-xs font-normal text-zinc-600">
                        / {formatNumber(goal.target_value, 2)} {goal.metric_unit}
                      </span>
                    </p>
                    <span className="text-xs font-medium text-lime">{Math.round(period.percentage)}%</span>
                  </div>
                  <ProgressBar value={period.percentage} className="mt-2" />
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-600">
                    <span>{goal.period === 'weekly' ? 'Esta semana' : 'Este mes'}</span>
                    <span>{formatNumber(total, 2)} acumulados</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-lg bg-ink-900 px-2.5 py-2 text-[10px]">
                  <Link2 className="h-3 w-3 shrink-0 text-zinc-600" />
                  {linked.length ? (
                    <span className="text-zinc-500">
                      {linkedCompleted}/{linked.length} tareas vinculadas completadas
                    </span>
                  ) : (
                    <span className="text-zinc-600">Sin tareas vinculadas</span>
                  )}
                </div>

                {latest?.note && (
                  <p className="mt-2 line-clamp-1 text-[10px] italic text-zinc-600">“{latest.note}”</p>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <Button variant="secondary" size="sm" onClick={() => setProgressGoal(goal)}>
                    <Plus className="h-3.5 w-3.5" /> Registrar avance
                  </Button>
                  <span className="text-[10px] text-zinc-700">
                    {query.data.progress.filter((entry) => entry.goal_id === goal.id).length} registros
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Target className="h-5 w-5" />}
            title="Define tu primer objetivo"
            description="Convierte una intención en un número medible. Puedes vincular tareas y registrar avances cuando quieras."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Nuevo objetivo
              </Button>
            }
          />
        </Card>
      )}

      <GoalModal
        open={goalModalOpen}
        onClose={() => {
          setGoalModalOpen(false)
          setEditingGoal(null)
        }}
        onSaved={query.reload}
        goal={editingGoal}
        categories={categories}
        tasks={tasks}
        linkedTaskIds={editingGoal ? linksByGoal.get(editingGoal.id) ?? [] : []}
        onCategoriesChanged={onCategoriesChanged}
      />

      {progressGoal && (
        <GoalProgressModal
          open={Boolean(progressGoal)}
          onClose={() => setProgressGoal(null)}
          onSaved={query.reload}
          goal={progressGoal}
          entries={query.data.progress.filter((entry) => entry.goal_id === progressGoal.id)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar objetivo"
        description="Se eliminarán también sus registros de avance y vínculos con tareas. Esta acción no se puede deshacer."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeGoal}
        loading={deleting}
      />
    </div>
  )
}

function goalPeriodProgress(goal: Goal, progress: GoalProgress[]) {
  const now = new Date()
  const start = goal.period === 'weekly' ? startOfWeek(now) : startOfMonth(now)
  const end = goal.period === 'weekly' ? endOfWeek(now) : endOfMonth(now)
  const startISO = toISODate(start)
  const endISO = toISODate(end)
  const entries = progress.filter(
    (entry) => entry.goal_id === goal.id && entry.recorded_on >= startISO && entry.recorded_on <= endISO,
  )
  const total = entries.reduce((sum, entry) => sum + entry.value, 0)
  return { total, percentage: percentage(total, goal.target_value), entries, startISO, endISO }
}
