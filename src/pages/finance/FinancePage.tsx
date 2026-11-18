import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  PiggyBank,
  Plus,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { FinancePlan, FinanceTransaction, FinanceTransactionKind } from '../../types'
import { useQuery } from '../../hooks/useQuery'
import { db } from '../../lib/supabase'
import { CHART_COLORS } from '../../lib/constants'
import { addMonths, endOfMonth, formatMonthYear, parseLocalDate, rangeDays, startOfMonth, toISODate } from '../../lib/dates'
import { percentage, sum } from '../../lib/calculations'
import {
  compactMoney,
  dailyExpenseSeries,
  emergencyProgress,
  expenseBreakdown,
  financeTotals,
  monthlyBudget,
  remainingEmergency,
  remainingToSave,
  savingsProgress,
  savingsSeries,
} from '../../lib/finance'
import { cn, errorMessage, formatMoney } from '../../lib/utils'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  ProgressBar,
  Segmented,
  useToast,
} from '../../components/ui'
import { ChartCard, chartAxis, chartGrid, chartTooltipLabelStyle, chartTooltipStyle } from '../../components/progress/ChartCard'
import { FinancePlanModal } from '../../components/finance/FinancePlanModal'
import { TransactionModal } from '../../components/finance/TransactionModal'

type FinanceData = {
  plan: FinancePlan | null
  transactions: FinanceTransaction[]
  savingsTotal: number
  savingsCount: number
}

const EMPTY: FinanceData = { plan: null, transactions: [], savingsTotal: 0, savingsCount: 0 }
type Filter = 'all' | 'expense' | 'income' | 'saving'

function dateLabel(value: string) {
  const label = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).format(
    parseLocalDate(value),
  )
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function FinancePage() {
  const { push } = useToast()
  const [anchor, setAnchor] = useState(new Date())
  const [filter, setFilter] = useState<Filter>('all')
  const [transactionOpen, setTransactionOpen] = useState(false)
  const [newKind, setNewKind] = useState<FinanceTransactionKind>('expense')
  const [editing, setEditing] = useState<FinanceTransaction | null>(null)
  const [planOpen, setPlanOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FinanceTransaction | null>(null)
  const [deleting, setDeleting] = useState(false)

  const start = startOfMonth(anchor)
  const end = endOfMonth(anchor)
  const startISO = toISODate(start)
  const endISO = toISODate(end)
  const days = useMemo(() => rangeDays(startOfMonth(anchor), endOfMonth(anchor)), [startISO, endISO])

  const query = useQuery<FinanceData>(
    async () => {
      const client = db()
      const [plan, transactions, savings] = await Promise.all([
        client.from('finance_plan').select('*').maybeSingle(),
        client
          .from('finance_transactions')
          .select('*')
          .gte('tx_date', startISO)
          .lte('tx_date', endISO)
          .order('tx_date', { ascending: false })
          .order('created_at', { ascending: false }),
        client
          .from('finance_transactions')
          .select('kind, amount')
          .in('kind', ['saving', 'withdrawal']),
      ])
      for (const result of [plan, transactions, savings]) {
        if (result.error) throw result.error
      }
      const savingsRows = (savings.data ?? []) as Pick<FinanceTransaction, 'kind' | 'amount'>[]
      return {
        plan: (plan.data as FinancePlan | null) ?? null,
        transactions: (transactions.data ?? []) as FinanceTransaction[],
        savingsTotal: sum(
          savingsRows.map((item) => (item.kind === 'withdrawal' ? -item.amount : item.amount)),
        ),
        savingsCount: savingsRows.filter((item) => item.kind === 'saving').length,
      }
    },
    [startISO, endISO],
    EMPTY,
  )

  const plan = query.data.plan
  const transactions = query.data.transactions
  const totals = useMemo(() => financeTotals(transactions), [transactions])
  const breakdown = useMemo(() => expenseBreakdown(transactions), [transactions])
  const daily = useMemo(() => dailyExpenseSeries(transactions, days), [transactions, days])
  const savings = useMemo(() => savingsSeries(transactions, days), [transactions, days])
  const budget = monthlyBudget(plan)
  const budgetPerDay = days.length ? budget / days.length : 0
  const budgetRemaining = budget - totals.expenses
  const budgetUsed = percentage(totals.expenses, budget)
  const savedThisMonth = totals.saved
  const withdrawnThisMonth = totals.withdrawn
  const savingsTotal = query.data.savingsTotal
  const savingsCount = query.data.savingsCount
  const savingsPercent = plan ? savingsProgress(savedThisMonth, plan.savings_target) : 0
  const emergencyPercent = emergencyProgress(plan)
  const isCurrentMonth = startISO === toISODate(startOfMonth(new Date()))

  const pieData = useMemo(() => {
    const top = breakdown.slice(0, 5)
    const rest = breakdown.slice(5)
    const restAmount = sum(rest.map((entry) => entry.amount))
    const data = [...top]
    if (restAmount > 0) {
      data.push({
        category: 'Otras',
        amount: restAmount,
        count: sum(rest.map((entry) => entry.count)),
        share: percentage(restAmount, totals.expenses),
      })
    }
    return data.map((entry, index) => ({ ...entry, color: CHART_COLORS[index % CHART_COLORS.length] }))
  }, [breakdown, totals.expenses])

  const filtered = transactions.filter((item) => {
    if (filter === 'all') return true
    if (filter === 'saving') return item.kind === 'saving' || item.kind === 'withdrawal'
    return item.kind === filter
  })
  const groups = useMemo(() => {
    const map = new Map<string, FinanceTransaction[]>()
    filtered.forEach((item) => map.set(item.tx_date, [...(map.get(item.tx_date) ?? []), item]))
    return Array.from(map.entries())
  }, [filtered])

  function openNew(kind: FinanceTransactionKind = 'expense') {
    setEditing(null)
    setNewKind(kind)
    setTransactionOpen(true)
  }

  function openEdit(item: FinanceTransaction) {
    setEditing(item)
    setTransactionOpen(true)
  }

  async function deleteTransaction() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('finance_transactions').delete().eq('id', deleteTarget.id)
      if (error) throw error
      push('Movimiento eliminado')
      setDeleteTarget(null)
      setEditing(null)
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (query.loading) return <LoadingState label="Cargando finanzas" />
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        eyebrow="Finanzas"
        title="Panel financiero"
        description="Registra tus gastos e ingresos, descubre en qué se va el dinero y controla tu ahorro y fondo de emergencia."
        actions={
          <>
            <Button variant="secondary" onClick={() => setPlanOpen(true)}>
              <Settings2 className="h-4 w-4" /> Plan
            </Button>
            <Button variant="primary" onClick={() => openNew()}>
              <Plus className="h-4 w-4" /> Registrar
            </Button>
          </>
        }
      />

      <Card className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setAnchor((current) => addMonths(current, -1))}
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-36 text-center text-sm font-medium text-zinc-200">{formatMonthYear(anchor)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setAnchor((current) => addMonths(current, 1))}
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())} disabled={isCurrentMonth}>
              Actual
            </Button>
          </div>
          <p className="text-[11px] text-zinc-500">
            {transactions.length} movimiento{transactions.length === 1 ? '' : 's'} en el mes
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Ingresos</p>
            <TrendingUp className="h-4 w-4 text-lime/70" />
          </div>
          <p className="mt-2 text-xl font-semibold text-lime sm:text-2xl">{formatMoney(totals.income)}</p>
          <p className="mt-1.5 text-[10px] text-zinc-600">
            {plan ? `Previsto: ${formatMoney(plan.monthly_income)}` : 'Registra tus ingresos del mes'}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Gastos</p>
            <TrendingDown className="h-4 w-4 text-red-400/70" />
          </div>
          <p className="mt-2 text-xl font-semibold text-red-300 sm:text-2xl">{formatMoney(totals.expenses)}</p>
          <p className="mt-1.5 text-[10px] text-zinc-600">
            {breakdown.length} categoría{breakdown.length === 1 ? '' : 's'} con gasto
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Balance</p>
            <Wallet className="h-4 w-4 text-zinc-500" />
          </div>
          <p className={cn('mt-2 text-xl font-semibold sm:text-2xl', totals.balance >= 0 ? 'text-lime' : 'text-red-300')}>
            {formatMoney(totals.balance)}
          </p>
          <p className="mt-1.5 text-[10px] text-zinc-600">
            {totals.balance >= 0 ? 'Ingresos menos gastos' : 'Estás gastando más de lo que ingresas'}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="muted-label">Tasa de ahorro</p>
            <PiggyBank className="h-4 w-4 text-lime/70" />
          </div>
          <p className="mt-2 text-xl font-semibold text-white sm:text-2xl">{Math.round(totals.savingsRate)}%</p>
          <ProgressBar value={totals.savingsRate} className="mt-2.5" />
          <p className="mt-1.5 text-[10px] text-zinc-600">del ingreso registrado</p>
          <p className="mt-1 text-[10px] text-zinc-600">
            Ahorro neto: <span className="text-sky-300">{formatMoney(totals.savedNet)}</span>
          </p>
        </Card>
      </div>

      {plan ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Presupuesto del mes</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">Ingreso previsto menos ahorro objetivo</p>
              </div>
              <Wallet className="h-4 w-4 text-zinc-500" />
            </div>
            <p className="mt-3 text-lg font-semibold text-white">{formatMoney(budget)}</p>
            <ProgressBar value={budgetUsed} tone={budgetUsed >= 100 ? 'warning' : 'accent'} className="mt-2" />
            <div className="mt-2 flex justify-between text-[10px] text-zinc-500">
              <span>
                Gastado <span className="text-red-300">{formatMoney(totals.expenses)}</span>
              </span>
              <span className={budgetRemaining >= 0 ? 'text-lime' : 'text-red-300'}>
                {budgetRemaining >= 0 ? `Quedan ${formatMoney(budgetRemaining)}` : `Excedido ${formatMoney(Math.abs(budgetRemaining))}`}
              </span>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Objetivo de ahorro</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">Meta mensual</p>
              </div>
              <Target className="h-4 w-4 text-lime/70" />
            </div>
            <p className="mt-3 text-lg font-semibold text-white">
              {formatMoney(savedThisMonth)}
              <span className="text-xs font-normal text-zinc-600"> / {formatMoney(plan.savings_target)}</span>
            </p>
            <ProgressBar value={savingsPercent} className="mt-2" />
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="text-[10px] text-zinc-500">
                {plan.savings_target <= 0
                  ? 'Define un objetivo para medir tu ahorro.'
                  : savingsPercent >= 100
                    ? 'Meta cumplida. Excelente.'
                    : `Faltan ${formatMoney(remainingToSave(savedThisMonth, plan.savings_target))}`}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-[10px]"
                onClick={() => openNew('saving')}
              >
                <Plus className="h-3 w-3" /> Aportar
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Fondo de emergencia</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">Colchón disponible</p>
              </div>
              <ShieldCheck className="h-4 w-4 text-sky-400/80" />
            </div>
            <p className="mt-3 text-lg font-semibold text-white">
              {formatMoney(plan.emergency_balance)}
              <span className="text-xs font-normal text-zinc-600"> / {formatMoney(plan.emergency_target)}</span>
            </p>
            <ProgressBar value={emergencyPercent} tone="info" className="mt-2" />
            <p className="mt-2 text-[10px] text-zinc-500">
              {plan.emergency_target <= 0
                ? 'Define la meta de tu fondo de emergencia.'
                : emergencyPercent >= 100
                  ? 'Fondo completo.'
                  : `Faltan ${formatMoney(remainingEmergency(plan))}`}
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Ahorro total</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">Aportes menos retiros</p>
              </div>
              <PiggyBank className="h-4 w-4 text-sky-300/80" />
            </div>
            <p className={cn('mt-3 text-lg font-semibold', savingsTotal >= 0 ? 'text-sky-300' : 'text-red-300')}>
              {formatMoney(savingsTotal)}
            </p>
            <div className="mt-2 flex justify-between text-[10px] text-zinc-500">
              <span>
                Este mes{' '}
                <span className={savedThisMonth - withdrawnThisMonth >= 0 ? 'text-sky-300' : 'text-red-300'}>
                  {formatMoney(savedThisMonth - withdrawnThisMonth)}
                </span>
              </span>
              <span>
                {savingsCount} aporte{savingsCount === 1 ? '' : 's'}
              </span>
            </div>
            {withdrawnThisMonth > 0 && (
              <p className="mt-1 text-[10px] text-red-300">Retiros este mes: −{formatMoney(withdrawnThisMonth)}</p>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="mt-1.5 h-7 px-2 text-[10px]"
              onClick={() => openNew('withdrawal')}
            >
              <ArrowUpRight className="h-3 w-3" /> Retirar
            </Button>
          </Card>
        </div>
      ) : (
        <Card className="p-4">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime/10 text-lime">
                <PiggyBank className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Configura tu plan financiero</p>
                <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-zinc-500">
                  Define tu ingreso previsto, el ahorro mensual que quieres lograr y la meta de tu fondo de emergencia para
                  activar las barras de progreso.
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setPlanOpen(true)}>
              <Settings2 className="h-3.5 w-3.5" /> Configurar plan
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <ChartCard
          title="¿En qué se va el dinero?"
          subtitle="Distribución de gastos por categoría"
          empty={!breakdown.length}
        >
          <div className="grid items-center gap-3 sm:grid-cols-[190px_1fr]">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="amount"
                  nameKey="category"
                  innerRadius={50}
                  outerRadius={82}
                  paddingAngle={2}
                  stroke="none"
                  animationDuration={650}
                  animationEasing="ease-out"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.category} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatMoney(Number(value))}
                  contentStyle={chartTooltipStyle}
                  labelStyle={chartTooltipLabelStyle}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {pieData.map((entry) => (
                <div key={entry.category} className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color }} />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-300">{entry.category}</span>
                  <span className="shrink-0 text-[10px] text-zinc-500">{Math.round(entry.share)}%</span>
                  <span className="w-20 shrink-0 text-right text-[11px] font-medium text-zinc-400">
                    {formatMoney(entry.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Ritmo de gasto"
          subtitle={budgetPerDay > 0 ? `Presupuesto diario sugerido: ${formatMoney(budgetPerDay)}` : 'Gasto por día del mes'}
          empty={!daily.some((point) => point.amount > 0)}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={daily} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" />
              <YAxis {...chartAxis} width={38} tickFormatter={(value) => compactMoney(Number(value))} />
              <Tooltip
                formatter={(value) => formatMoney(Number(value))}
                contentStyle={chartTooltipStyle}
                labelStyle={chartTooltipLabelStyle}
              />
              {budgetPerDay > 0 && <ReferenceLine y={budgetPerDay} stroke="#fbbf24" strokeDasharray="4 4" />}
              <Bar
                dataKey="amount"
                name="Gasto"
                fill="#f87171"
                radius={[3, 3, 0, 0]}
                maxBarSize={18}
                animationDuration={650}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard
        title="Evolución del ahorro"
        subtitle={
          plan && plan.savings_target > 0
            ? `Aportes netos del mes · objetivo ${formatMoney(plan.savings_target)}`
            : 'Aportes y retiros acumulados'
        }
        empty={!transactions.some((item) => item.kind === 'saving' || item.kind === 'withdrawal')}
        action={
          plan && plan.savings_target > 0 ? (
            <Badge tone={savingsPercent >= 100 ? 'accent' : 'muted'}>{Math.round(savingsPercent)}% de la meta</Badge>
          ) : undefined
        }
      >
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={savings} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b8f36b" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#b8f36b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...chartGrid} />
            <XAxis dataKey="label" {...chartAxis} interval="preserveStartEnd" />
            <YAxis {...chartAxis} width={46} tickFormatter={(value) => compactMoney(Number(value))} />
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelStyle={chartTooltipLabelStyle}
              formatter={(value) => [formatMoney(Number(value)), 'Ahorro acumulado']}
            />
            <ReferenceLine y={0} stroke="#3f3f46" />
            {plan && plan.savings_target > 0 && (
              <ReferenceLine
                y={plan.savings_target}
                stroke="#fbbf24"
                strokeDasharray="4 4"
                label={{ value: 'Objetivo', position: 'insideTopRight', fill: '#fbbf24', fontSize: 10 }}
              />
            )}
            <Area
              type="monotone"
              dataKey="cumulative"
              name="Ahorro acumulado"
              stroke="#b8f36b"
              strokeWidth={2}
              fill="url(#savingsFill)"
              dot={false}
              activeDot={{ r: 4, fill: '#b8f36b', strokeWidth: 0 }}
              animationDuration={650}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Movimientos del mes</h2>
            <p className="mt-0.5 text-[10px] text-zinc-600">Toca un movimiento para editarlo</p>
          </div>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'expense', label: 'Gastos' },
              { value: 'income', label: 'Ingresos' },
              { value: 'saving', label: 'Ahorro' },
            ]}
          />
        </div>

        {filtered.length ? (
          <div className="space-y-3">
            {groups.map(([date, items]) => {
              const dayTotal = sum(
                items
                  .filter((item) => item.kind === 'income' || item.kind === 'expense')
                  .map((item) => (item.kind === 'income' ? item.amount : -item.amount)),
              )
              const daySavings = sum(
                items
                  .filter((item) => item.kind === 'saving' || item.kind === 'withdrawal')
                  .map((item) => (item.kind === 'withdrawal' ? -item.amount : item.amount)),
              )
              return (
                <div key={date}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                    <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-600">{dateLabel(date)}</span>
                    <div className="flex items-center gap-2">
                      {daySavings !== 0 && (
                        <span className={cn('text-[10px]', daySavings > 0 ? 'text-sky-300/80' : 'text-red-300/80')}>
                          Ahorro {formatMoney(daySavings)}
                        </span>
                      )}
                      {(dayTotal !== 0 || daySavings === 0) && (
                        <span className={cn('text-[10px]', dayTotal >= 0 ? 'text-lime/80' : 'text-red-300/80')}>
                          {formatMoney(dayTotal)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Card className="divide-y divide-ink-700/60">
                    {items.map((item, index) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-3 py-3 transition-colors duration-200 hover:bg-ink-800/35 motion-safe:animate-row-in sm:px-4"
                        style={{ animationDelay: `${index * 35}ms` }}
                      >
                        <div
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                            item.kind === 'income'
                              ? 'bg-lime/10 text-lime'
                              : item.kind === 'saving'
                                ? 'bg-sky-500/10 text-sky-300'
                                : 'bg-red-500/10 text-red-300',
                          )}
                        >
                          {item.kind === 'income' ? (
                            <ArrowDownLeft className="h-4 w-4" />
                          ) : item.kind === 'saving' ? (
                            <PiggyBank className="h-4 w-4" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4" />
                          )}
                        </div>
                        <button onClick={() => openEdit(item)} className="min-w-0 flex-1 text-left">
                          <p className="truncate text-sm text-white">{item.description}</p>
                          <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                            {item.category || 'Sin categoría'}
                            {item.notes ? ` · ${item.notes}` : ''}
                          </p>
                        </button>
                        <span
                          className={cn(
                            'shrink-0 text-sm font-medium tabular-nums',
                            item.kind === 'income'
                              ? 'text-lime'
                              : item.kind === 'saving'
                                ? 'text-sky-300'
                                : 'text-red-300',
                          )}
                        >
                          {item.kind === 'expense' || item.kind === 'withdrawal' ? '−' : '+'}
                          {formatMoney(item.amount)}
                        </span>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-700 hover:bg-red-500/10 hover:text-red-400"
                          aria-label="Eliminar movimiento"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </Card>
                </div>
              )
            })}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<ReceiptText className="h-5 w-5" />}
              title={transactions.length ? 'Sin movimientos con este filtro' : 'Todavía no hay movimientos'}
              description={
                transactions.length
                  ? 'Cambia el filtro para ver gastos, ingresos, ahorro o retiros de este mes.'
                  : 'Registra tu primer gasto, ingreso o aporte de ahorro para empezar a ver estadísticas reales de tu dinero.'
              }
              action={
                <Button onClick={() => openNew()}>
                  <Plus className="h-4 w-4" /> Registrar movimiento
                </Button>
              }
            />
          </Card>
        )}
      </section>

      {plan?.notes && (
        <Card className="p-4">
          <p className="muted-label">Notas del plan</p>
          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">{plan.notes}</p>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-700/70 bg-ink-850 p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <Badge tone={totals.balance >= 0 ? 'accent' : 'danger'}>
            {totals.balance >= 0 ? 'Balance positivo' : 'Balance negativo'}
          </Badge>
          <span className="min-w-0 text-[11px] leading-relaxed text-zinc-500">
            <span className="text-lime">{formatMoney(totals.income)}</span> ingresos ·{' '}
            <span className="text-red-300">{formatMoney(totals.expenses)}</span> gastos ·{' '}
            <span className="text-sky-300">{formatMoney(totals.savedNet)}</span> ahorro neto
          </span>
        </div>
        <Wallet className="h-4 w-4 shrink-0 text-zinc-600" />
      </div>

      <TransactionModal
        open={transactionOpen}
        onClose={() => {
          setTransactionOpen(false)
          setEditing(null)
        }}
        onSaved={query.reload}
        transaction={editing}
        initialKind={newKind}
        onDelete={(item) => {
          setTransactionOpen(false)
          setDeleteTarget(item)
        }}
      />

      <FinancePlanModal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        onSaved={query.reload}
        plan={plan}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar movimiento"
        description="Se eliminará este movimiento del panel financiero."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteTransaction}
        loading={deleting}
      />
    </div>
  )
}
