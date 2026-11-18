import type { Activity, ActivityOccurrence, Recurrence } from '../types'

export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const WEEKDAYS_LONG = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

export function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function addMonths(date: Date, months: number) {
  const result = new Date(date)
  const day = result.getDate()
  result.setDate(1)
  result.setMonth(result.getMonth() + months)
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
  result.setDate(Math.min(day, lastDay))
  return result
}

export function startOfWeek(date: Date) {
  const result = startOfDay(date)
  const day = result.getDay()
  const offset = day === 0 ? -6 : 1 - day
  return addDays(result, offset)
}

export function endOfWeek(date: Date) {
  return endOfDay(addDays(startOfWeek(date), 6))
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function toISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

export function toTimeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function combineDateTime(dateISO: string, time: string) {
  const date = parseLocalDate(dateISO)
  const [hours, minutes] = time.split(':').map(Number)
  date.setHours(hours || 0, minutes || 0, 0, 0)
  return date
}

export function isSameDay(a: Date, b: Date) {
  return toISODate(a) === toISODate(b)
}

export function isToday(date: Date) {
  return isSameDay(date, new Date())
}

export function formatDateLong(date: Date) {
  const value = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function formatDateShort(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(date)
}

export function formatDateNumeric(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function formatMonthYear(date: Date) {
  const value = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(date)
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function formatWeekday(date: Date) {
  const value = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date)
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export function formatTimeRange(start: Date, end: Date, allDay = false) {
  if (allDay) return 'Todo el día'
  return `${formatTime(start)} – ${formatTime(end)}`
}

export function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

export function rangeDays(start: Date, end: Date) {
  const days: Date[] = []
  let cursor = startOfDay(start)
  const last = startOfDay(end)
  while (cursor <= last) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}

export function monthGrid(month: Date) {
  const first = startOfMonth(month)
  const offset = (first.getDay() + 6) % 7
  const gridStart = addDays(first, -offset)
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
}

export function isoInRange(value: string | null | undefined, start: Date, end: Date) {
  if (!value) return false
  const date = parseLocalDate(value)
  return date >= startOfDay(start) && date <= endOfDay(end)
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart
}

export function recurrenceLabel(recurrence: Recurrence) {
  if (recurrence === 'daily') return 'Cada día'
  if (recurrence === 'weekdays') return 'Lunes a viernes'
  if (recurrence === 'weekly') return 'Cada semana'
  if (recurrence === 'monthly') return 'Cada mes'
  if (recurrence === 'custom') return 'Personalizada'
  return 'No se repite'
}

function dateWithTime(base: Date, source: Date) {
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    source.getMilliseconds(),
  )
}

export function expandActivities(activities: Activity[], rangeStart: Date, rangeEnd: Date): ActivityOccurrence[] {
  const rangeStartTime = startOfDay(rangeStart).getTime()
  const rangeEndTime = endOfDay(rangeEnd).getTime()
  const occurrences: ActivityOccurrence[] = []

  for (const activity of activities) {
    const baseStart = new Date(activity.start_at)
    const baseEnd = new Date(activity.end_at)
    if (Number.isNaN(baseStart.getTime()) || Number.isNaN(baseEnd.getTime())) continue
    let duration = Math.max(0, baseEnd.getTime() - baseStart.getTime())
    if (activity.recurrence !== 'none') {
      const startOffset = baseStart.getTime() - startOfDay(baseStart).getTime()
      const endOffset = baseEnd.getTime() - startOfDay(baseEnd).getTime()
      duration = endOffset - startOffset
      if (duration < 0) duration += 24 * 60 * 60 * 1000
    }
    const untilDate = activity.recurrence_until ? endOfDay(parseLocalDate(activity.recurrence_until)) : null
    const sourceDay = startOfDay(baseStart)
    const customWeekdays =
      activity.recurrence === 'custom' && (activity.recurrence_weekdays ?? []).length > 0
        ? activity.recurrence_weekdays
        : [sourceDay.getDay()]
    let customOccurrences = 0

    if (activity.recurrence === 'none') {
      if (baseStart.getTime() <= rangeEndTime && baseEnd.getTime() >= rangeStartTime) {
        occurrences.push({
          ...activity,
          occurrence_date: toISODate(baseStart),
          occurrence_start: baseStart.toISOString(),
          occurrence_end: baseEnd.toISOString(),
          is_recurring_instance: false,
        })
      }
      continue
    }

    let occurrenceDay = new Date(sourceDay)
    let guard = 0

    while (guard < 3660 && occurrenceDay.getTime() <= rangeEndTime) {
      guard += 1
      if (untilDate && occurrenceDay > untilDate) break

      if (activity.recurrence === 'custom') {
        if (!customWeekdays.includes(occurrenceDay.getDay())) {
          occurrenceDay = addDays(occurrenceDay, 1)
          continue
        }
        customOccurrences += 1
        if (activity.recurrence_count && customOccurrences > activity.recurrence_count) break
      }

      const occurrenceStart = dateWithTime(occurrenceDay, baseStart)
      const occurrenceEnd = new Date(occurrenceStart.getTime() + duration)
      const isWeekend = occurrenceDay.getDay() === 0 || occurrenceDay.getDay() === 6

      if (
        !(activity.recurrence === 'weekdays' && isWeekend) &&
        occurrenceStart.getTime() <= rangeEndTime &&
        occurrenceEnd.getTime() >= rangeStartTime
      ) {
        occurrences.push({
          ...activity,
          occurrence_date: toISODate(occurrenceDay),
          occurrence_start: occurrenceStart.toISOString(),
          occurrence_end: occurrenceEnd.toISOString(),
          is_recurring_instance: true,
        })
      }

      if (activity.recurrence === 'custom') occurrenceDay = addDays(occurrenceDay, 1)
      else if (activity.recurrence === 'daily') occurrenceDay = addDays(occurrenceDay, 1)
      else if (activity.recurrence === 'weekdays') {
        do {
          occurrenceDay = addDays(occurrenceDay, 1)
        } while (occurrenceDay.getDay() === 0 || occurrenceDay.getDay() === 6)
      } else if (activity.recurrence === 'weekly') occurrenceDay = addDays(occurrenceDay, 7)
      else {
        const next = addMonths(occurrenceDay, 1)
        occurrenceDay = next
      }
    }
  }

  return occurrences.sort((a, b) => new Date(a.occurrence_start).getTime() - new Date(b.occurrence_start).getTime())
}

export function findActivityConflicts(
  activities: Activity[],
  start: Date,
  end: Date,
  excludeId?: string,
): ActivityOccurrence[] {
  const occurrences = expandActivities(activities, start, end)
  return occurrences.filter((activity) => {
    if (activity.id === excludeId) return false
    const otherStart = new Date(activity.occurrence_start)
    const otherEnd = new Date(activity.occurrence_end)
    return overlaps(start, end, otherStart, otherEnd)
  })
}

export function getWeekRange(date: Date) {
  return { start: startOfWeek(date), end: endOfWeek(date) }
}

export function getMonthRange(date: Date) {
  return { start: startOfMonth(date), end: endOfMonth(date) }
}

export function hourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}
