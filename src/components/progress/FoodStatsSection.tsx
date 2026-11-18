import { Leaf, PackageX, Salad, UtensilsCrossed } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { FoodLog, MealPlan, PantryTransaction, PriorityFood, PriorityFoodLog } from '../../types'
import { percentage } from '../../lib/calculations'
import { formatDateShort, toISODate } from '../../lib/dates'
import { buildHabitSeries } from '../../lib/progress'
import { formatNumber } from '../../lib/utils'
import { Card, ProgressBar } from '../ui'
import { ChartCard, chartAxis, chartGrid, chartTooltipLabelStyle, chartTooltipStyle } from './ChartCard'

type WasteTransaction = PantryTransaction & {
  pantry_items: { name: string; unit: string } | null
}

export function FoodStatsSection({
  meals,
  foodLogs,
  priorityFoods,
  priorityLogs,
  waste,
  days,
  start,
  end,
  periodType,
}: {
  meals: MealPlan[]
  foodLogs: FoodLog[]
  priorityFoods: PriorityFood[]
  priorityLogs: PriorityFoodLog[]
  waste: WasteTransaction[]
  days: Date[]
  start: Date
  end: Date
  periodType: 'week' | 'month'
}) {
  const consumedMeals = meals.filter((meal) => meal.is_consumed)
  const adherence = percentage(consumedMeals.length, meals.length)
  const wasteItems = Array.from(new Set(waste.map((item) => item.pantry_items?.name).filter(Boolean)))
  const habitSeries = buildHabitSeries(meals, foodLogs, days, days.length > 7 ? 'week' : 'day')
  const startISO = toISODate(start)
  const endISO = toISODate(end)

  const wantedPeriod = periodType === 'week' ? 'weekly' : 'monthly'
  const priorityRows = priorityFoods
    .filter((food) => food.is_active && food.period === wantedPeriod)
    .map((food) => {
      const logs = priorityLogs.filter(
        (log) => log.priority_food_id === food.id && log.logged_on >= startISO && log.logged_on <= endISO,
      )
      const count = logs.reduce((total, log) => total + log.quantity, 0)
      return {
        ...food,
        count,
        compliance: percentage(count, food.target_count),
      }
    })
    .sort((a, b) => b.compliance - a.compliance)

  const priorityChart = priorityRows.slice(0, 8).map((food) => ({
    name: food.name,
    actual: food.count,
    target: food.target_count,
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Plan cumplido</p>
            <UtensilsCrossed className="h-4 w-4 text-lime/70" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">
            {consumedMeals.length}
            <span className="text-base font-normal text-zinc-600"> / {meals.length}</span>
          </p>
          <ProgressBar value={adherence} className="mt-2.5" />
          <p className="mt-1.5 text-[10px] text-zinc-600">{Math.round(adherence)}% de comidas planificadas</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Registros de comida</p>
            <Salad className="h-4 w-4 text-lime/70" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{foodLogs.length}</p>
          <p className="mt-1.5 text-[10px] text-zinc-600">alimentos registrados en el periodo</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Prioritarios</p>
            <Leaf className="h-4 w-4 text-lime/70" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{priorityRows.length}</p>
          <p className="mt-1.5 text-[10px] text-zinc-600">objetivos {wantedPeriod === 'weekly' ? 'semanales' : 'mensuales'} activos</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Desperdicio</p>
            <PackageX className="h-4 w-4 text-amber-400/70" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{waste.length}</p>
          <p className="mt-1.5 text-[10px] text-zinc-600">
            {wasteItems.length ? `${wasteItems.length} alimento${wasteItems.length === 1 ? '' : 's'} afectado${wasteItems.length === 1 ? '' : 's'}` : 'movimientos registrados'}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <ChartCard
          title="Evolución de hábitos"
          subtitle={`${formatDateShort(start)} – ${formatDateShort(end)} · planificación y registros`}
          empty={!habitSeries.some((point) => point.planificadas || point.registros)}
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={habitSeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" />
              <YAxis {...chartAxis} allowDecimals={false} width={30} />
              <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} />
              <Legend wrapperStyle={{ fontSize: 10, color: '#a1a1aa' }} iconType="circle" iconSize={6} />
              <Line
                type="monotone"
                dataKey="planificadas"
                name="Planificadas"
                stroke="#a78bfa"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                animationDuration={650}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="consumidas"
                name="Consumidas"
                stroke="#b8f36b"
                strokeWidth={2}
                dot={{ r: 2.5, fill: '#b8f36b', strokeWidth: 0 }}
                animationDuration={650}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="registros"
                name="Registros"
                stroke="#7dd3fc"
                strokeWidth={1.5}
                dot={false}
                animationDuration={650}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Alimentos prioritarios"
          subtitle={`Frecuencia ${wantedPeriod === 'weekly' ? 'semanal' : 'mensual'} · real vs objetivo`}
          empty={!priorityChart.length}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={priorityChart} layout="vertical" margin={{ top: 4, right: 12, left: 6, bottom: 0 }}>
              <CartesianGrid stroke="#27272a" horizontal={false} />
              <XAxis type="number" {...chartAxis} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                {...chartAxis}
                width={84}
                tickFormatter={(value: string) => (value.length > 13 ? `${value.slice(0, 12)}…` : value)}
              />
              <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} />
              <Bar
                dataKey="target"
                name="Objetivo"
                fill="#a78bfa"
                radius={[0, 4, 4, 0]}
                maxBarSize={10}
                animationDuration={650}
              />
              <Bar
                dataKey="actual"
                name="Real"
                fill="#b8f36b"
                radius={[0, 4, 4, 0]}
                maxBarSize={10}
                animationDuration={650}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-white">Cumplimiento de prioritarios</h3>
          <p className="mt-0.5 text-[10px] text-zinc-500">Frecuencia registrada en el periodo seleccionado</p>
          {priorityRows.length ? (
            <div className="mt-3 space-y-3">
              {priorityRows.slice(0, 6).map((food) => (
                <div key={food.id}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-zinc-300">{food.name}</span>
                    <span className="shrink-0 text-[10px] text-zinc-500">
                      {formatNumber(food.count, 1)} / {formatNumber(food.target_count, 0)} {food.unit}
                    </span>
                  </div>
                  <ProgressBar value={food.compliance} className="mt-1.5" tone={food.compliance >= 100 ? 'accent' : 'info'} />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs leading-relaxed text-zinc-600">
              No hay alimentos prioritarios activos con frecuencia {wantedPeriod === 'weekly' ? 'semanal' : 'mensual'}.
            </p>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-white">Desperdicio registrado</h3>
          <p className="mt-0.5 text-[10px] text-zinc-500">Solo movimientos marcados como desperdicio</p>
          {waste.length ? (
            <div className="mt-3 space-y-2">
              {waste.slice(0, 6).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-ink-900 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs text-zinc-300">{transaction.pantry_items?.name ?? 'Alimento'}</p>
                    {transaction.note && <p className="truncate text-[10px] text-zinc-600">{transaction.note}</p>}
                  </div>
                  <span className="shrink-0 text-[10px] text-amber-300/80">
                    {formatNumber(Math.abs(transaction.delta), 1)} {transaction.pantry_items?.unit ?? ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs leading-relaxed text-zinc-600">
              Sin desperdicio registrado en este periodo. Se calcula a partir de los ajustes de despensa.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
