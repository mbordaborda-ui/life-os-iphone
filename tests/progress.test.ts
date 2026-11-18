import { describe, expect, it } from 'vitest'
import {
  bestLogsByExercise,
  buildCardioSeries,
  buildComplianceSeries,
  buildHabitSeries,
  buildHoursByCategory,
  buildLoadSeries,
  buildTrainingPeriods,
  exerciseNamesFromSessions,
} from '../src/lib/progress'
import type {
  ActivityOccurrence,
  Category,
  FoodLog,
  MealPlan,
  Task,
  WorkoutRoutine,
  WorkoutSessionWithLogs,
} from '../src/types'

const days = [new Date(2026, 9, 19), new Date(2026, 9, 20), new Date(2026, 9, 21)]

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
    created_at: '',
    updated_at: '',
    ...overrides,
  }) as Task

const occurrence = (overrides: Partial<ActivityOccurrence>): ActivityOccurrence =>
  ({
    id: 'activity',
    user_id: 'user',
    title: 'Actividad',
    notes: null,
    location: null,
    category_id: null,
    start_at: '2026-10-19T10:00:00.000Z',
    end_at: '2026-10-19T11:00:00.000Z',
    all_day: false,
    recurrence: 'none',
    recurrence_until: null,
    recurrence_weekdays: [],
    recurrence_count: null,
    completed: false,
    completed_at: null,
    created_at: '',
    updated_at: '',
    occurrence_date: '2026-10-19',
    occurrence_start: '2026-10-19T10:00:00.000Z',
    occurrence_end: '2026-10-19T11:00:00.000Z',
    is_recurring_instance: false,
    ...overrides,
  }) as ActivityOccurrence

const session = (overrides: Partial<WorkoutSessionWithLogs>): WorkoutSessionWithLogs =>
  ({
    id: 'session',
    user_id: 'user',
    session_date: '2026-10-19',
    started_at: null,
    duration_min: 45,
    workout_type: 'strength',
    status: 'completed',
    notes: null,
    routine_id: null,
    created_at: '',
    updated_at: '',
    exercise_logs: [],
    ...overrides,
  }) as WorkoutSessionWithLogs

const log = (overrides: Record<string, unknown> = {}) => ({
  id: 'log',
  user_id: 'user',
  session_id: 'session',
  exercise_id: null,
  exercise_name: 'Sentadilla',
  muscle_group: 'Piernas',
  sets: 4,
  reps: 8,
  weight_kg: 100,
  distance_m: null,
  duration_sec: null,
  notes: null,
  position: 0,
  created_at: '',
  ...overrides,
})

describe('productivity series', () => {
  it('combines tasks and activities into daily compliance', () => {
    const data = buildComplianceSeries(
      [task({ id: 'a', due_date: '2026-10-19', status: 'completed' }), task({ id: 'b', due_date: '2026-10-20' })],
      [occurrence({ id: 'c', occurrence_date: '2026-10-19', completed: true })],
      days,
    )
    expect(data).toHaveLength(3)
    expect(data[0]).toMatchObject({ tasks: 1, activities: 1, completed: 2, planned: 2, compliance: 100 })
    expect(data[1]).toMatchObject({ tasks: 1, activities: 0, completed: 0, planned: 1, compliance: 0 })
    expect(data[2].compliance).toBeNull()
  })

  it('groups scheduled hours by category and ignores all-day events', () => {
    const categories = [
      { id: 'cat', name: 'Trabajo', color: '#abcdef' },
      { id: 'other', name: 'Personal', color: '#111111' },
    ] as Category[]
    const data = buildHoursByCategory(
      [
        occurrence({ category_id: 'cat', occurrence_start: '2026-10-19T08:00:00.000Z', occurrence_end: '2026-10-19T09:30:00.000Z' }),
        occurrence({ category_id: 'other', occurrence_start: '2026-10-19T10:00:00.000Z', occurrence_end: '2026-10-19T10:30:00.000Z' }),
        occurrence({ all_day: true, occurrence_start: '2026-10-19T00:00:00.000Z', occurrence_end: '2026-10-20T00:00:00.000Z' }),
      ],
      categories,
    )
    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({ id: 'cat', name: 'Trabajo', minutes: 90, hours: 1.5, share: 75 })
    expect(data[1]).toMatchObject({ id: 'other', minutes: 30, share: 25 })
  })
})

describe('food habit series', () => {
  it('counts planned, consumed and registered foods per day', () => {
    const meals = [
      { plan_date: '2026-10-19', is_consumed: true },
      { plan_date: '2026-10-19', is_consumed: false },
      { plan_date: '2026-10-21', is_consumed: true },
    ] as MealPlan[]
    const logs = [
      { log_date: '2026-10-19' },
      { log_date: '2026-10-19' },
      { log_date: '2026-10-21' },
    ] as FoodLog[]
    const data = buildHabitSeries(meals, logs, days, 'day')
    expect(data[0]).toMatchObject({ planificadas: 2, consumidas: 1, registros: 2 })
    expect(data[1]).toMatchObject({ planificadas: 0, consumidas: 0, registros: 0 })
    expect(data[2]).toMatchObject({ planificadas: 1, consumidas: 1, registros: 1 })
  })
})

describe('training series', () => {
  const routines = [
    { weekday: 1, is_rest: false },
    { weekday: 3, is_rest: true },
    { weekday: 4, is_rest: false },
  ] as WorkoutRoutine[]

  it('compares completed sessions with planned training days', () => {
    const data = buildTrainingPeriods(
      [session({ id: 's1', session_date: '2026-10-19', duration_min: 50 }), session({ id: 's2', session_date: '2026-10-20' })],
      routines,
      days,
    )
    expect(data).toHaveLength(3)
    expect(data[0]).toMatchObject({ planned: 1, completed: 1, compliance: 100, minutes: 50 })
    expect(data[1]).toMatchObject({ planned: 0, completed: 1 })
    expect(data[2]).toMatchObject({ planned: 0, completed: 0 })
  })

  it('aggregates days into weeks for month views', () => {
    const monthDays = Array.from({ length: 14 }, (_, index) => new Date(2026, 9, 19 + index))
    const data = buildTrainingPeriods(
      [session({ id: 's1', session_date: '2026-10-19' }), session({ id: 's2', session_date: '2026-10-22' })],
      routines,
      monthDays,
    )
    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({ planned: 2, completed: 2 })
    expect(data[1]).toMatchObject({ planned: 2, completed: 0 })
  })

  it('orders load points chronologically and extracts best sets', () => {
    const sessions = [
      session({
        id: 'later',
        session_date: '2026-10-21',
        exercise_logs: [log({ id: 'l2', weight_kg: 110, reps: 6 }) as never],
      }),
      session({
        id: 'earlier',
        session_date: '2026-10-19',
        exercise_logs: [log({ id: 'l1', weight_kg: 100, reps: 8 }) as never],
      }),
    ]
    const load = buildLoadSeries(sessions, 'sentadilla')
    expect(load.map((point) => point.weight)).toEqual([100, 110])
    expect(load.map((point) => point.volume)).toEqual([3200, 2640])
    expect(bestLogsByExercise(sessions)[0].weight_kg).toBe(100)
  })

  it('extracts unique exercise names and cardio sessions', () => {
    const sessions = [
      session({
        exercise_logs: [
          log({ exercise_name: 'Press banca' }) as never,
          log({ id: 'l2', exercise_name: 'Remo' }) as never,
        ],
      }),
      session({
        id: 'cardio',
        session_date: '2026-10-20',
        exercise_logs: [
          log({ id: 'l3', exercise_name: 'Press banca', weight_kg: null, distance_m: 5000, duration_sec: 1800 }) as never,
        ],
      }),
    ]
    expect(exerciseNamesFromSessions(sessions)).toEqual(['Press banca', 'Remo'])
    expect(buildCardioSeries(sessions)).toEqual([
      expect.objectContaining({ distanceKm: 5, minutes: 30 }),
    ])
  })
})
