import type { FinancePlan, FinanceTransaction } from '../types'
import { percentage, sum } from './calculations'
import { toISODate } from './dates'

export function financeTotals(transactions: FinanceTransaction[]) {
  const income = sum(transactions.filter((item) => item.kind === 'income').map((item) => item.amount))
  const expenses = sum(transactions.filter((item) => item.kind === 'expense').map((item) => item.amount))
  const saved = sum(transactions.filter((item) => item.kind === 'saving').map((item) => item.amount))
  const withdrawn = sum(transactions.filter((item) => item.kind === 'withdrawal').map((item) => item.amount))
  const savedNet = saved - withdrawn
  const balance = income - expenses
  const savingsRate = income > 0 ? percentage(Math.max(0, savedNet), income) : 0
  return { income, expenses, saved, withdrawn, savedNet, balance, savingsRate }
}

export type ExpenseCategory = {
  category: string
  amount: number
  share: number
  count: number
}

export function expenseBreakdown(transactions: FinanceTransaction[]): ExpenseCategory[] {
  const map = new Map<string, { amount: number; count: number }>()
  transactions
    .filter((item) => item.kind === 'expense')
    .forEach((item) => {
      const key = item.category?.trim() || 'Sin categoría'
      const current = map.get(key) ?? { amount: 0, count: 0 }
      map.set(key, { amount: current.amount + item.amount, count: current.count + 1 })
    })

  const total = sum(Array.from(map.values()).map((value) => value.amount))

  return Array.from(map.entries())
    .map(([category, value]) => ({
      category,
      amount: value.amount,
      count: value.count,
      share: percentage(value.amount, total),
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function dailyExpenseSeries(transactions: FinanceTransaction[], days: Date[]) {
  const byDay = new Map<string, number>()
  transactions
    .filter((item) => item.kind === 'expense')
    .forEach((item) => byDay.set(item.tx_date, (byDay.get(item.tx_date) ?? 0) + item.amount))

  let cumulative = 0
  return days.map((day) => {
    const iso = toISODate(day)
    const amount = byDay.get(iso) ?? 0
    cumulative += amount
    return { date: iso, label: String(day.getDate()), amount, cumulative }
  })
}

export function savingsSeries(transactions: FinanceTransaction[], days: Date[]) {
  const byDay = new Map<string, number>()
  transactions
    .filter((item) => item.kind === 'saving' || item.kind === 'withdrawal')
    .forEach((item) => {
      const delta = item.kind === 'withdrawal' ? -item.amount : item.amount
      byDay.set(item.tx_date, (byDay.get(item.tx_date) ?? 0) + delta)
    })

  let cumulative = 0
  return days.map((day) => {
    const iso = toISODate(day)
    const amount = byDay.get(iso) ?? 0
    cumulative += amount
    return { date: iso, label: String(day.getDate()), amount, cumulative }
  })
}

export function savingsProgress(saved: number, target: number) {
  return percentage(Math.max(0, saved), target)
}

export function emergencyProgress(plan: FinancePlan | null) {
  if (!plan) return 0
  return percentage(plan.emergency_balance, plan.emergency_target)
}

export function monthlyBudget(plan: FinancePlan | null) {
  if (!plan) return 0
  return Math.max(0, plan.monthly_income - plan.savings_target)
}

export function remainingToSave(saved: number, target: number) {
  return Math.max(0, target - Math.max(0, saved))
}

export function remainingEmergency(plan: FinancePlan | null) {
  if (!plan) return 0
  return Math.max(0, plan.emergency_target - plan.emergency_balance)
}

export function compactMoney(value: number) {
  return new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
