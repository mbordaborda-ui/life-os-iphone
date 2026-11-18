import { CheckCircle2, Clock3, ListChecks, PieChart as PieIcon, TimerReset } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ActivityOccurrence, Category, Task } from '../../types'
import { CHART_COLORS } from '../../lib/constants'
import { percentage } from '../../lib/calculations'
import { buildComplianceSeries, buildHoursByCategory } from '../../lib/progress'
import { formatDateShort, toISODate } from '../../lib/dates'
import { formatNumber } from '../../lib/utils'
import { Card, ProgressBar } from '../ui'
import { ChartCard, chartAxis, chartGrid, chartTooltipLabelStyle, chartTooltipStyle } from './ChartCard'

export function ProductivitySection({
  tasks,
  occurrences,
  categories,
  days,
  start,
  end,
}: {
  tasks: Task[]
  occurrences: ActivityOccurrence[]
  categories: Category[]
  days: Date[]
  start: Date
  end: Date
}) {
  const rangeStart = formatDateShort(start)
  const rangeEnd = formatDateShort(end)
  const rangeStartISO = toISODate(start)
  const rangeEndISO = toISODate(end)

  const dueTasks = tasks.filter(
    (task) => task.due_date && task.due_date >= rangeStartISO && task.due_date <= rangeEndISO,
  )
  const completedDueTasks = dueTasks.filter((task) => task.status === 'completed')
  const pendingDueTasks = dueTasks.filter((task) => task.status === 'pending')
  const taskRate = percentage(completedDueTasks.length, dueTasks.length)
  const completedActivities = occurrences.filter((activity) => activity.completed)
  const activityRate = percentage(completedActivities.length, occurrences.length)

  const totalMinutes = occurrences.reduce(
    (total, activity) =>
      total +
      (activity.all_day
        ? 0
        : Math.max(
            0,
            Math.round(
              (new Date(activity.occurrence_end).getTime() - new Date(activity.occurrence_start).getTime()) / 60000,
            ),
          )),
    0,
  )
  const hours = buildHoursByCategory(occurrences, categories)
  const hasRepeatedColors = new Set(hours.map((entry) => entry.color)).size < hours.length
  const hoursChart = hasRepeatedColors
    ? hours.map((entry, index) => ({ ...entry, color: CHART_COLORS[index % CHART_COLORS.length] }))
    : hours
  const compliance = buildComplianceSeries(tasks, occurrences, days).filter((point) => point.compliance !== null)
  const nearestPending = [...pendingDueTasks]
    .filter((task) => task.due_date)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    .slice(0, 4)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Tareas completadas</p>
            <CheckCircle2 className="h-4 w-4 text-lime/70" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">
            {completedDueTasks.length}
            <span className="text-base font-normal text-zinc-600"> / {dueTasks.length}</span>
          </p>
          <ProgressBar value={taskRate} className="mt-2.5" />
          <p className="mt-1.5 text-[10px] text-zinc-600">{Math.round(taskRate)}% de las tareas con fecha</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Actividades</p>
            <ListChecks className="h-4 w-4 text-sky-400/70" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">
            {completedActivities.length}
            <span className="text-base font-normal text-zinc-600"> / {occurrences.length}</span>
          </p>
          <ProgressBar value={activityRate} tone="info" className="mt-2.5" />
          <p className="mt-1.5 text-[10px] text-zinc-600">{Math.round(activityRate)}% del calendario</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Tiempo planificado</p>
            <Clock3 className="h-4 w-4 text-zinc-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatNumber(totalMinutes / 60, 1)}
            <span className="text-base font-normal text-zinc-600"> h</span>
          </p>
          <p className="mt-1.5 text-[10px] text-zinc-600">actividades con hora</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Pendientes con fecha</p>
            <TimerReset className="h-4 w-4 text-amber-400/70" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{pendingDueTasks.length}</p>
          <p className="mt-1.5 text-[10px] text-zinc-600">en el periodo seleccionado</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <ChartCard
          title="Evolución del cumplimiento"
          subtitle={`${rangeStart} – ${rangeEnd} · tareas y actividades combinadas`}
          empty={!compliance.length}
        >
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={compliance} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="complianceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#b8f36b" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#b8f36b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" />
              <YAxis {...chartAxis} domain={[0, 100]} tickFormatter={(value) => `${value}%`} width={34} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                labelStyle={chartTooltipLabelStyle}
                formatter={(value) => [`${Math.round(Number(value))}%`, 'Cumplimiento']}
              />
              <Area
                type="monotone"
                dataKey="compliance"
                name="Cumplimiento"
                stroke="#b8f36b"
                strokeWidth={2}
                fill="url(#complianceFill)"
                dot={{ r: 2.5, fill: '#b8f36b', strokeWidth: 0 }}
                animationDuration={650}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Horas por categoría"
          subtitle="Actividades con hora en el periodo"
          empty={!hours.length}
          action={<PieIcon className="h-4 w-4 text-zinc-600" />}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="h-40 w-full sm:w-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={hours}
                    dataKey="minutes"
                    nameKey="name"
                    innerRadius={42}
                    outerRadius={66}
                    paddingAngle={2}
                    stroke="none"
                    animationDuration={650}
                    animationEasing="ease-out"
                  >
                    {hoursChart.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelStyle={chartTooltipLabelStyle}
                    formatter={(value) => [`${formatNumber(Number(value) / 60, 1)} h`, 'Tiempo']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {hoursChart.slice(0, 6).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="truncate text-zinc-400">{entry.name}</span>
                  </span>
                  <span className="shrink-0 text-zinc-500">{formatNumber(entry.hours, 1)} h</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-white">Tareas pendientes del periodo</h3>
          <p className="mt-0.5 text-[10px] text-zinc-500">Las más próximas por fecha</p>
          {nearestPending.length ? (
            <div className="mt-3 space-y-2">
              {nearestPending.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg bg-ink-900 px-3 py-2">
                  <span className="truncate text-xs text-zinc-300">{task.title}</span>
                  <span className="shrink-0 text-[10px] text-zinc-600">
                    {task.due_date ? formatDateShort(new Date(`${task.due_date}T00:00:00`)) : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-zinc-600">No quedan tareas pendientes con fecha en este periodo.</p>
          )}
        </Card>

        <ChartCard
          title="Tareas planificadas por día"
          subtitle={`${rangeStart} – ${rangeEnd}`}
          empty={!tasks.some((task) => task.due_date && task.due_date >= rangeStartISO && task.due_date <= rangeEndISO)}
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={buildComplianceSeries(tasks, occurrences, days)}
              margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
            >
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" />
              <YAxis {...chartAxis} allowDecimals={false} width={30} />
              <Tooltip
                contentStyle={chartTooltipStyle}
                labelStyle={chartTooltipLabelStyle}
                formatter={(value, name) => [Number(value), name === 'tasks' ? 'Tareas' : 'Actividades']}
              />
              <Bar
                dataKey="tasks"
                name="Tareas"
                fill="#b8f36b"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                animationDuration={650}
              />
              <Bar
                dataKey="activities"
                name="Actividades"
                fill="#7dd3fc"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                animationDuration={650}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
