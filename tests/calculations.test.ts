import { describe, expect, it } from 'vitest'
import {
  average,
  cardioTotals,
  daysUntil,
  goalPercentage,
  goalProgressTotal,
  nutritionTotals,
  pantryStatus,
  percentage,
  sessionMinutes,
  shoppingLineTotal,
  shoppingTotal,
  shoppingUnitPrice,
  sum,
  taskCompletionRate,
  trainingVolume,
  weeklyBuckets,
} from '../src/lib/calculations'
import type { ExerciseLog, FoodLog, Goal, GoalProgress, PantryItem, ShoppingListItem, Task, WorkoutSession } from '../src/types'

const exerciseLog = (overrides: Partial<ExerciseLog>): ExerciseLog =>
  ({
    id: 'log',
    user_id: 'user',
    session_id: 'session',
    exercise_id: null,
    exercise_name: 'Sentadilla',
    muscle_group: 'Piernas',
    sets: null,
    reps: null,
    weight_kg: null,
    distance_m: null,
    duration_sec: null,
    notes: null,
    position: 0,
    created_at: '2026-10-19T10:00:00.000Z',
    ...overrides,
  }) as ExerciseLog

const task = (overrides: Partial<Task>): Task =>
  ({
    id: 'task',
    user_id: 'user',
    title: 'Tarea',
    notes: null,
    priority: 'medium',
    due_date: null,
    category_id: null,
    status: 'pending',
    completed_at: null,
    created_at: '2026-10-19T10:00:00.000Z',
    updated_at: '2026-10-19T10:00:00.000Z',
    ...overrides,
  }) as Task

describe('percentage', () => {
  it('calculates and clamps percentages', () => {
    expect(percentage(1, 4)).toBe(25)
    expect(percentage(3, 2)).toBe(100)
    expect(percentage(-3, 10)).toBe(0)
  })

  it('returns zero for invalid totals', () => {
    expect(percentage(1, 0)).toBe(0)
    expect(percentage(Number.NaN, 10)).toBe(0)
    expect(percentage(1, Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('aggregates', () => {
  it('sums finite numbers only', () => {
    expect(sum([1, 2, Number.NaN, Number.POSITIVE_INFINITY, 3])).toBe(6)
    expect(average([])).toBe(0)
    expect(average([2, 4])).toBe(3)
  })

  it('calculates task completion rate', () => {
    expect(taskCompletionRate([])).toBe(0)
    expect(taskCompletionRate([task({ status: 'completed' }), task({})])).toBe(50)
  })
})

describe('training calculations', () => {
  it('calculates volume from sets × reps × weight', () => {
    const logs = [
      exerciseLog({ sets: 4, reps: 8, weight_kg: 100 }),
      exerciseLog({ sets: 3, reps: 10, weight_kg: 50 }),
      exerciseLog({ sets: 5, reps: 20, weight_kg: null }),
    ]
    expect(trainingVolume(logs)).toBe(4700)
  })

  it('totals cardio distance and duration', () => {
    const totals = cardioTotals([
      exerciseLog({ distance_m: 5000, duration_sec: 1800 }),
      exerciseLog({ distance_m: 2000, duration_sec: 900 }),
      exerciseLog({ distance_m: null, duration_sec: null }),
    ])
    expect(totals).toEqual({ distance: 7000, seconds: 2700 })
  })

  it('counts only completed session minutes', () => {
    const sessions = [
      { duration_min: 45, status: 'completed' },
      { duration_min: 30, status: 'completed' },
      { duration_min: 99, status: 'skipped' },
    ] as WorkoutSession[]
    expect(sessionMinutes(sessions)).toBe(75)
  })
})

describe('food calculations', () => {
  it('totals only nutrition values that exist', () => {
    const logs = [
      {
        calories: 500,
        protein_g: 30,
        carbs_g: 50,
        fat_g: 15,
      },
      {
        calories: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
      },
      {
        calories: 250,
        protein_g: 20,
        carbs_g: null,
        fat_g: 5,
      },
    ] as FoodLog[]
    expect(nutritionTotals(logs)).toEqual({
      calories: 750,
      protein: 50,
      carbs: 50,
      fat: 20,
      fiber: 0,
      withNutrition: 2,
    })
  })

  it('prices shopping items by line total', () => {
    const items = [
      { quantity: 2, estimated_price: 1.5, actual_price: 1.8 },
      { quantity: 1, estimated_price: null, actual_price: null },
      { quantity: 3, estimated_price: 2, actual_price: null },
    ] as ShoppingListItem[]
    expect(shoppingTotal(items)).toBe(3.5)
    expect(shoppingTotal(items, 'actual')).toBe(3.8)
  })

  it('multiplies unit price by quantity and recovers the unit price', () => {
    expect(shoppingLineTotal(2, 10100)).toBe(20200)
    expect(shoppingLineTotal(20, 1000)).toBe(20000)
    expect(shoppingLineTotal(3, 3.3333)).toBe(10)
    expect(shoppingUnitPrice(20200, 2)).toBe(10100)
    expect(shoppingUnitPrice(10, 3)).toBe(3.3333)
    expect(shoppingLineTotal(2, Number.NaN)).toBe(0)
    expect(shoppingUnitPrice(100, 0)).toBe(0)
  })

  it('classifies pantry stock', () => {
    const base = { quantity: 0, min_quantity: 2 } as PantryItem
    expect(pantryStatus(base)).toBe('out')
    expect(pantryStatus({ ...base, quantity: 1 })).toBe('low')
    expect(pantryStatus({ ...base, quantity: 2 })).toBe('low')
    expect(pantryStatus({ ...base, quantity: 10 })).toBe('ok')
  })
})

describe('goals and dates', () => {
  const goal = { id: 'g', target_value: 10 } as Goal
  const entries = [
    { id: '1', goal_id: 'g', value: 3 },
    { id: '2', goal_id: 'g', value: 2 },
    { id: '3', goal_id: 'other', value: 8 },
  ] as GoalProgress[]

  it('sums progress only for the requested goal', () => {
    expect(goalProgressTotal(goal, entries)).toBe(5)
    expect(goalPercentage(goal, entries)).toBe(50)
  })

  it('buckets values by ISO week', () => {
    const buckets = weeklyBuckets(
      [new Date(2026, 9, 19), new Date(2026, 9, 20), new Date(2026, 9, 26)],
      [1, 2, 5],
    )
    expect(buckets).toEqual([
      { week: '2026-10-19', value: 3 },
      { week: '2026-10-26', value: 5 },
    ])
  })

  it('counts calendar days without timezone drift', () => {
    const today = new Date(2026, 9, 20, 12)
    expect(daysUntil('2026-10-20', today)).toBe(0)
    expect(daysUntil('2026-10-19', today)).toBe(-1)
    expect(daysUntil('2026-10-27', today)).toBe(7)
  })
})
