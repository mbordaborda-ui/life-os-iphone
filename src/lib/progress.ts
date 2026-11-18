import type {
  ActivityOccurrence,
  Category,
  ExerciseLog,
  FoodLog,
  MealPlan,
  Task,
  WorkoutRoutine,
  WorkoutSessionWithLogs,
} from '../types'
import { percentage, sum } from './calculations'
import { addDays, formatDateShort, parseLocalDate, startOfWeek, toISODate } from './dates'

export type PeriodType = 'week' | 'month'

export interface CompliancePoint {
  key: string
  label: string
  tasks: number
  activities: number
  completed: number
  planned: number
  compliance: number | null
}

export interface TrainingPeriodPoint {
  key: string
  label: string
  planned: number
  completed: number
  compliance: number
  minutes: number
}

export interface LoadPoint {
  key: string
  label: string
  weight: number
  reps: number
  volume: number
}

export interface CardioPoint {
  key: string
  label: string
  distanceKm: number
  minutes: number
}

export interface HabitPoint {
  key: string
  label: string
  registros: number
  planificadas: number
  consumidas: number
}

function dayKey(date: Date) {
  return toISODate(date)
}

export function buildComplianceSeries(
  tasks: Task[],
  occurrences: ActivityOccurrence[],
  days: Date[],
): CompliancePoint[] {
  return days.map((day) => {
    const key = dayKey(day)
    const dayTasks = tasks.filter((task) => task.due_date === key)
    const dayActivities = occurrences.filter((activity) => activity.occurrence_date === key)
    const completed =
      dayTasks.filter((task) => task.status === 'completed').length +
      dayActivities.filter((activity) => activity.completed).length
    const planned = dayTasks.length + dayActivities.length
    return {
      key,
      label: formatDateShort(day),
      tasks: dayTasks.length,
      activities: dayActivities.length,
      completed,
      planned,
      compliance: planned > 0 ? percentage(completed, planned) : null,
    }
  })
}

export function buildHoursByCategory(occurrences: ActivityOccurrence[], categories: Category[]) {
  const totals = new Map<string, number>()
  for (const activity of occurrences) {
    if (activity.all_day) continue
    const minutes = Math.max(
      0,
      Math.round((new Date(activity.occurrence_end).getTime() - new Date(activity.occurrence_start).getTime()) / 60000),
    )
    const key = activity.category_id ?? 'none'
    totals.set(key, (totals.get(key) ?? 0) + minutes)
  }
  const totalMinutes = sum(Array.from(totals.values()))
  return Array.from(totals.entries())
    .map(([id, minutes]) => {
      const category = categories.find((item) => item.id === id)
      return {
        id,
        name: category?.name ?? 'Sin categoría',
        color: category?.color ?? '#71717a',
        minutes,
        hours: minutes / 60,
        share: percentage(minutes, totalMinutes),
      }
    })
    .sort((a, b) => b.minutes - a.minutes)
}

export function buildHabitSeries(
  meals: MealPlan[],
  logs: FoodLog[],
  days: Date[],
  granularity: 'day' | 'week' = 'day',
): HabitPoint[] {
  const points = new Map<string, HabitPoint>()
  const keyFor = (date: Date) => {
    if (granularity === 'day') return dayKey(date)
    return dayKey(startOfWeek(date))
  }
  const labelFor = (date: Date) => {
    if (granularity === 'day') return formatDateShort(date)
    return `Sem ${formatDateShort(startOfWeek(date))}`
  }

  for (const day of days) {
    const key = keyFor(day)
    if (!points.has(key)) {
      points.set(key, { key, label: labelFor(day), registros: 0, planificadas: 0, consumidas: 0 })
    }
  }
  for (const meal of meals) {
    const day = parseLocalDate(meal.plan_date)
    const point = points.get(keyFor(day))
    if (!point) continue
    point.planificadas += 1
    if (meal.is_consumed) point.consumidas += 1
  }
  for (const log of logs) {
    const point = points.get(keyFor(parseLocalDate(log.log_date)))
    if (point) point.registros += 1
  }
  return Array.from(points.values())
}

export function buildTrainingPeriods(
  sessions: WorkoutSessionWithLogs[],
  routines: WorkoutRoutine[],
  days: Date[],
): TrainingPeriodPoint[] {
  const weekly = days.length > 7
  const groups = new Map<string, TrainingPeriodPoint>()
  const plannedByWeekday = new Map(routines.filter((routine) => !routine.is_rest).map((routine) => [routine.weekday, routine]))

  const keyFor = (date: Date) => (weekly ? dayKey(startOfWeek(date)) : dayKey(date))
  const labelFor = (date: Date) => (weekly ? `Sem ${formatDateShort(startOfWeek(date))}` : formatDateShort(date))

  for (const day of days) {
    const key = keyFor(day)
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: labelFor(day),
        planned: 0,
        completed: 0,
        compliance: 0,
        minutes: 0,
      })
    }
    if (plannedByWeekday.has(day.getDay())) {
      groups.get(key)!.planned += 1
    }
  }

  for (const session of sessions) {
    if (session.status !== 'completed') continue
    const point = groups.get(keyFor(parseLocalDate(session.session_date)))
    if (!point) continue
    point.completed += 1
    point.minutes += session.duration_min
  }

  return Array.from(groups.values()).map((point) => ({
    ...point,
    compliance: percentage(point.completed, point.planned),
  }))
}

export function buildLoadSeries(
  sessions: WorkoutSessionWithLogs[],
  exerciseName: string,
): LoadPoint[] {
  const points: LoadPoint[] = []
  for (const session of sessions) {
    if (session.status !== 'completed') continue
    const logs = session.exercise_logs.filter(
      (log) => log.exercise_name.toLowerCase() === exerciseName.trim().toLowerCase(),
    )
    if (!logs.length) continue
    const weight = Math.max(...logs.map((log) => log.weight_kg ?? 0))
    const reps = Math.max(...logs.map((log) => log.reps ?? 0))
    points.push({
      key: `${session.session_date}-${session.id}`,
      label: formatDateShort(parseLocalDate(session.session_date)),
      weight,
      reps,
      volume: sum(logs.map((log) => (log.sets ?? 0) * (log.reps ?? 0) * (log.weight_kg ?? 0))),
    })
  }
  return points.sort((a, b) => a.key.localeCompare(b.key))
}

export function buildCardioSeries(sessions: WorkoutSessionWithLogs[]): CardioPoint[] {
  const points: CardioPoint[] = []
  for (const session of sessions) {
    if (session.status !== 'completed') continue
    const logs = session.exercise_logs
    const distance = sum(logs.map((log) => log.distance_m ?? 0))
    if (distance <= 0) continue
    const loggedSeconds = sum(logs.map((log) => log.duration_sec ?? 0))
    points.push({
      key: `${session.session_date}-${session.id}`,
      label: formatDateShort(parseLocalDate(session.session_date)),
      distanceKm: distance / 1000,
      minutes: loggedSeconds > 0 ? loggedSeconds / 60 : session.duration_min,
    })
  }
  return points.sort((a, b) => a.key.localeCompare(b.key))
}

export function exerciseNamesFromSessions(sessions: WorkoutSessionWithLogs[]) {
  const names = new Set<string>()
  for (const session of sessions) {
    for (const log of session.exercise_logs) {
      if (log.exercise_name.trim()) names.add(log.exercise_name.trim())
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'es'))
}

export function rangeWeekList(days: Date[]) {
  const weeks = new Map<string, Date[]>()
  for (const day of days) {
    const key = dayKey(startOfWeek(day))
    weeks.set(key, [...(weeks.get(key) ?? []), day])
  }
  return Array.from(weeks.entries()).map(([key, weekDays]) => ({
    key,
    start: parseLocalDate(key),
    end: weekDays[weekDays.length - 1] ?? addDays(parseLocalDate(key), 6),
    days: weekDays,
  }))
}

export function bestLogsByExercise(sessions: WorkoutSessionWithLogs[]) {
  const best = new Map<string, ExerciseLog>()
  for (const session of sessions) {
    if (session.status !== 'completed') continue
    for (const log of session.exercise_logs) {
      const current = best.get(log.exercise_name)
      const currentScore = current ? (current.weight_kg ?? 0) * (current.reps ?? 0) : -1
      const score = (log.weight_kg ?? 0) * (log.reps ?? 0)
      if (!current || score > currentScore) best.set(log.exercise_name, log)
    }
  }
  return Array.from(best.values()).sort(
    (a, b) => (b.weight_kg ?? 0) - (a.weight_kg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0),
  )
}
