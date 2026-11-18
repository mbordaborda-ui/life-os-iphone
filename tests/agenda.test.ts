import { describe, expect, it } from 'vitest'
import type { Activity, Recurrence } from '../src/types'
import { expandActivities, recurrenceLabel } from '../src/lib/dates'

function activity(overrides: Partial<Activity> & { recurrence: Recurrence }): Activity {
  return {
    id: 'activity-1',
    user_id: 'user-1',
    title: 'Trabajo',
    notes: null,
    location: null,
    category_id: null,
    start_at: new Date(2026, 9, 1, 7, 30).toISOString(),
    end_at: new Date(2026, 9, 1, 19, 0).toISOString(),
    all_day: false,
    recurrence_until: null,
    recurrence_weekdays: [],
    recurrence_count: null,
    completed: false,
    completed_at: null,
    created_at: new Date(2026, 9, 1).toISOString(),
    updated_at: new Date(2026, 9, 1).toISOString(),
    ...overrides,
  }
}

describe('agenda recurrence', () => {
  it('does not duplicate a recurring event when its stored end date spans several days', () => {
    const work = activity({
      recurrence: 'daily',
      start_at: new Date(2026, 9, 1, 7, 30).toISOString(),
      end_at: new Date(2026, 9, 21, 19, 0).toISOString(),
      recurrence_until: '2026-12-31',
    })

    const today = expandActivities([work], new Date(2026, 9, 21), new Date(2026, 9, 21))
    expect(today).toHaveLength(1)
    expect(new Date(today[0].occurrence_start).getHours()).toBe(7)
    expect(new Date(today[0].occurrence_start).getMinutes()).toBe(30)
    expect(new Date(today[0].occurrence_end).getHours()).toBe(19)
    expect(new Date(today[0].occurrence_end).getMinutes()).toBe(0)
  })

  it('expands Monday to Friday without weekend occurrences', () => {
    const work = activity({
      recurrence: 'weekdays',
      start_at: new Date(2026, 9, 19, 7, 30).toISOString(),
      end_at: new Date(2026, 9, 19, 19, 0).toISOString(),
      recurrence_until: '2026-10-25',
    })

    const week = expandActivities([work], new Date(2026, 9, 19), new Date(2026, 9, 25))
    expect(week).toHaveLength(5)
    expect(week.map((item) => item.occurrence_date)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
    ])
    expect(recurrenceLabel('weekdays')).toBe('Lunes a viernes')
  })

  it('repeats only the selected weekdays up to the occurrence limit', () => {
    const gym = activity({
      recurrence: 'custom',
      recurrence_weekdays: [1],
      recurrence_count: 3,
      start_at: new Date(2026, 9, 22, 5, 30).toISOString(),
      end_at: new Date(2026, 9, 22, 6, 0).toISOString(),
    })

    const occurrences = expandActivities([gym], new Date(2026, 9, 19), new Date(2026, 10, 15))
    expect(occurrences.map((item) => item.occurrence_date)).toEqual([
      '2026-10-26',
      '2026-11-02',
      '2026-11-09',
    ])
    expect(recurrenceLabel('custom')).toBe('Personalizada')
  })
})
