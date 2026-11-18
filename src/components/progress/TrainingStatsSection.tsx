import { Bike, Dumbbell, Flame, Timer, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WorkoutRoutine, WorkoutSessionWithLogs } from '../../types'
import { cardioTotals, sessionMinutes, trainingVolume } from '../../lib/calculations'
import { formatDateShort } from '../../lib/dates'
import {
  bestLogsByExercise,
  buildCardioSeries,
  buildLoadSeries,
  buildTrainingPeriods,
  exerciseNamesFromSessions,
} from '../../lib/progress'
import { formatNumber } from '../../lib/utils'
import { Card } from '../ui'
import { ChartCard, chartAxis, chartGrid, chartTooltipLabelStyle, chartTooltipStyle } from './ChartCard'

export function TrainingStatsSection({
  sessions,
  routines,
  days,
  start,
  end,
}: {
  sessions: WorkoutSessionWithLogs[]
  routines: WorkoutRoutine[]
  days: Date[]
  start: Date
  end: Date
}) {
  const completed = sessions.filter((session) => session.status === 'completed')
  const logs = completed.flatMap((session) => session.exercise_logs)
  const volume = trainingVolume(logs)
  const cardio = cardioTotals(logs)
  const periods = buildTrainingPeriods(sessions, routines, days)
  const names = useMemo(() => exerciseNamesFromSessions(sessions), [sessions])
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const effectiveExercise = selectedExercise && names.includes(selectedExercise) ? selectedExercise : names[0] ?? ''
  const loadSeries = effectiveExercise ? buildLoadSeries(sessions, effectiveExercise) : []
  const cardioSeries = buildCardioSeries(sessions)
  const best = bestLogsByExercise(sessions).slice(0, 6)
  const planned = periods.reduce((total, period) => total + period.planned, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Sesiones</p>
            <Dumbbell className="h-4 w-4 text-lime/70" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">
            {completed.length}
            <span className="text-base font-normal text-zinc-600"> / {planned}</span>
          </p>
          <p className="mt-1.5 text-[10px] text-zinc-600">completadas vs planificadas</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Tiempo entrenado</p>
            <Timer className="h-4 w-4 text-zinc-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatNumber(sessionMinutes(completed) / 60, 1)}
            <span className="text-base font-normal text-zinc-600"> h</span>
          </p>
          <p className="mt-1.5 text-[10px] text-zinc-600">duración registrada</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Volumen</p>
            <TrendingUp className="h-4 w-4 text-lime/70" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(volume / 1000, 1)}k</p>
          <p className="mt-1.5 text-[10px] text-zinc-600">kg totales · series × reps × peso</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Cardio</p>
            <Bike className="h-4 w-4 text-sky-400/70" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(cardio.distance / 1000, 1)}</p>
          <p className="mt-1.5 text-[10px] text-zinc-600">km registrados en el periodo</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Consistencia"
          subtitle={`${formatDateShort(start)} – ${formatDateShort(end)} · sesiones vs días planificados`}
          empty={!periods.some((period) => period.planned || period.completed)}
        >
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={periods} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" />
              <YAxis {...chartAxis} allowDecimals={false} width={28} />
              <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} />
              <Bar
                dataKey="planned"
                name="Planificadas"
                fill="#a78bfa"
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
                animationDuration={650}
              />
              <Bar
                dataKey="completed"
                name="Completadas"
                fill="#b8f36b"
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
                animationDuration={650}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Evolución de cargas y repeticiones"
          subtitle={effectiveExercise || 'Selecciona un ejercicio'}
          empty={!loadSeries.length}
          action={
            names.length > 0 ? (
              <select
                value={effectiveExercise}
                onChange={(event) => setSelectedExercise(event.target.value)}
                className="max-w-36 rounded-lg border border-ink-700 bg-ink-900 px-2 py-1 text-[11px] text-zinc-300 focus:border-lime/50 focus:outline-none"
              >
                {names.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : undefined
          }
        >
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={loadSeries} margin={{ top: 8, right: 0, left: -16, bottom: 0 }}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" />
              <YAxis yAxisId="left" {...chartAxis} width={32} tickFormatter={(value) => `${formatNumber(Number(value) / 1000, 1)}k`} />
              <YAxis yAxisId="right" orientation="right" {...chartAxis} width={28} />
              <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#a1a1aa' }} iconType="circle" iconSize={6} />
              <Bar
                yAxisId="left"
                dataKey="volume"
                name="Volumen (kg)"
                fill="#a78bfa"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                animationDuration={650}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="weight"
                name="Peso máx. (kg)"
                stroke="#b8f36b"
                strokeWidth={2}
                dot={{ r: 2.5, fill: '#b8f36b', strokeWidth: 0 }}
                animationDuration={650}
                animationEasing="ease-out"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="reps"
                name="Reps máx."
                stroke="#7dd3fc"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                animationDuration={650}
                animationEasing="ease-out"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <ChartCard
          title="Progreso de cardio"
          subtitle="Distancia y duración por sesión"
          empty={!cardioSeries.length}
        >
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={cardioSeries} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" />
              <YAxis yAxisId="left" {...chartAxis} width={30} />
              <YAxis yAxisId="right" orientation="right" {...chartAxis} width={30} />
              <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#a1a1aa' }} iconType="circle" iconSize={6} />
              <Bar
                yAxisId="left"
                dataKey="distanceKm"
                name="Distancia (km)"
                fill="#7dd3fc"
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
                animationDuration={650}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="minutes"
                name="Minutos"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={{ r: 2.5, fill: '#fbbf24', strokeWidth: 0 }}
                animationDuration={650}
                animationEasing="ease-out"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-zinc-500" />
            <h3 className="text-sm font-semibold text-white">Mejores series del periodo</h3>
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-500">Calculado a partir de peso × repeticiones</p>
          {best.length ? (
            <div className="mt-3 space-y-2">
              {best.map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-3 rounded-lg bg-ink-900 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-zinc-300">{log.exercise_name}</p>
                    <p className="text-[10px] text-zinc-600">
                      {log.sets ? `${log.sets} series · ` : ''}
                      {log.reps ?? 0} reps
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-lime">
                    {log.weight_kg ? `${formatNumber(log.weight_kg, 1)} kg` : '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs leading-relaxed text-zinc-600">
              Registra sesiones con peso y repeticiones para ver tus mejores series.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
