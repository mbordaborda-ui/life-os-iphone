import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { FinancePlan, FinanceTransaction } from '../src/types'
import {
  dailyExpenseSeries,
  emergencyProgress,
  expenseBreakdown,
  financeTotals,
  monthlyBudget,
  remainingEmergency,
  remainingToSave,
  savingsProgress,
  savingsSeries,
} from '../src/lib/finance'

const transaction = (overrides: Partial<FinanceTransaction>): FinanceTransaction => ({
  id: 'tx',
  user_id: 'user',
  tx_date: '2026-10-01',
  kind: 'expense',
  category: 'Otros',
  description: 'Movimiento',
  amount: 0,
  notes: null,
  created_at: '2026-10-01T10:00:00.000Z',
  updated_at: '2026-10-01T10:00:00.000Z',
  ...overrides,
})

const plan = (overrides: Partial<FinancePlan>): FinancePlan => ({
  id: 'plan',
  user_id: 'user',
  monthly_income: 0,
  savings_target: 0,
  emergency_target: 0,
  emergency_balance: 0,
  notes: null,
  created_at: '2026-10-01T10:00:00.000Z',
  updated_at: '2026-10-01T10:00:00.000Z',
  ...overrides,
})

describe('finance calculations', () => {
  it('separates income, expenses and savings rate', () => {
    const totals = financeTotals([
      transaction({ kind: 'income', amount: 3000 }),
      transaction({ kind: 'income', amount: 500 }),
      transaction({ kind: 'expense', amount: 1000 }),
      transaction({ kind: 'expense', amount: 500 }),
      transaction({ kind: 'saving', amount: 500 }),
      transaction({ kind: 'withdrawal', amount: 100 }),
    ])
    expect(totals.income).toBe(3500)
    expect(totals.expenses).toBe(1500)
    expect(totals.saved).toBe(500)
    expect(totals.withdrawn).toBe(100)
    expect(totals.savedNet).toBe(400)
    expect(totals.balance).toBe(2000)
    expect(totals.savingsRate).toBeCloseTo((400 / 3500) * 100)
  })

  it('never reports a negative savings rate', () => {
    const totals = financeTotals([transaction({ kind: 'income', amount: 100 }), transaction({ amount: 400 })])
    expect(totals.balance).toBe(-300)
    expect(totals.savingsRate).toBe(0)
  })

  it('groups expenses by category, sorted and with shares', () => {
    const rows = expenseBreakdown([
      transaction({ category: 'Vivienda', amount: 300 }),
      transaction({ category: 'Mercado', amount: 150 }),
      transaction({ category: 'Mercado', amount: 50 }),
      transaction({ category: null, amount: 50 }),
      transaction({ kind: 'income', category: 'Salario', amount: 5000 }),
    ])
    expect(rows.map((row) => row.category)).toEqual(['Vivienda', 'Mercado', 'Sin categoría'])
    expect(rows[1].amount).toBe(200)
    expect(rows[1].count).toBe(2)
    expect(rows[0].share).toBeCloseTo((300 / 550) * 100)
  })

  it('builds a daily expense series with cumulative totals', () => {
    const days = [new Date(2026, 9, 1), new Date(2026, 9, 2), new Date(2026, 9, 3)]
    const series = dailyExpenseSeries(
      [
        transaction({ tx_date: '2026-10-01', amount: 100 }),
        transaction({ tx_date: '2026-10-01', amount: 50 }),
        transaction({ tx_date: '2026-10-03', amount: 20 }),
        transaction({ tx_date: '2026-10-03', kind: 'income', amount: 999 }),
      ],
      days,
    )
    expect(series.map((point) => point.amount)).toEqual([150, 0, 20])
    expect(series.map((point) => point.cumulative)).toEqual([150, 150, 170])
    expect(series.map((point) => point.label)).toEqual(['1', '2', '3'])
  })

  it('builds a cumulative savings series with contributions and withdrawals', () => {
    const days = [new Date(2026, 9, 1), new Date(2026, 9, 2), new Date(2026, 9, 3)]
    const series = savingsSeries(
      [
        transaction({ tx_date: '2026-10-01', kind: 'income', amount: 1000 }),
        transaction({ tx_date: '2026-10-01', kind: 'saving', amount: 200 }),
        transaction({ tx_date: '2026-10-02', amount: 300 }),
        transaction({ tx_date: '2026-10-02', kind: 'withdrawal', amount: 50 }),
        transaction({ tx_date: '2026-10-03', kind: 'saving', amount: 150 }),
      ],
      days,
    )
    expect(series.map((point) => point.amount)).toEqual([200, -50, 150])
    expect(series.map((point) => point.cumulative)).toEqual([200, 150, 300])
  })

  it('tracks savings and emergency fund progress', () => {
    expect(savingsProgress(500, 1000)).toBe(50)
    expect(savingsProgress(-100, 1000)).toBe(0)
    expect(savingsProgress(1500, 1000)).toBe(100)
    expect(emergencyProgress(plan({ emergency_balance: 300, emergency_target: 1000 }))).toBe(30)
    expect(emergencyProgress(null)).toBe(0)
  })

  it('calculates budget and remaining amounts', () => {
    const current = plan({ monthly_income: 3000, savings_target: 1000, emergency_target: 1000, emergency_balance: 400 })
    expect(monthlyBudget(current)).toBe(2000)
    expect(monthlyBudget(null)).toBe(0)
    expect(remainingToSave(300, 1000)).toBe(700)
    expect(remainingToSave(1500, 1000)).toBe(0)
    expect(remainingEmergency(current)).toBe(600)
    expect(remainingEmergency(null)).toBe(0)
  })
})

describe('finance migration static checks', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0007_finance.sql'), 'utf8')

  it('creates the plan and transactions tables', () => {
    expect(sql).toContain('create table public.finance_plan')
    expect(sql).toContain('create table public.finance_transactions')
    expect(sql).toContain('unique (user_id)')
    expect(sql).toContain("check (kind in ('expense', 'income'))")
  })

  it('protects both tables with row level security policies', () => {
    for (const table of ['finance_plan', 'finance_transactions']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`)
      expect(sql).toContain(`create policy "own_select" on public.${table}`)
      expect(sql).toContain(`create policy "own_insert" on public.${table}`)
      expect(sql).toContain(`create policy "own_update" on public.${table}`)
      expect(sql).toContain(`create policy "own_delete" on public.${table}`)
      expect(sql).toContain(`grant select, insert, update, delete on public.${table} to authenticated`)
    }
  })

  it('allows explicit savings contributions', () => {
    const savingsSql = readFileSync(
      join(process.cwd(), 'supabase', 'migrations', '0010_finance_savings.sql'),
      'utf8',
    )
    expect(savingsSql).toContain("check (kind in ('expense', 'income', 'saving'))")
  })

  it('allows savings withdrawals', () => {
    const withdrawalSql = readFileSync(
      join(process.cwd(), 'supabase', 'migrations', '0011_finance_savings_withdrawals.sql'),
      'utf8',
    )
    expect(withdrawalSql).toContain("check (kind in ('expense', 'income', 'saving', 'withdrawal'))")
  })
})
