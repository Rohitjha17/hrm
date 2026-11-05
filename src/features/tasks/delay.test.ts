import { describe, expect, it } from 'vitest'
import { getTaskDelay } from './delay'

const today = new Date(2026, 9, 20, 12)

describe('getTaskDelay', () => {
  it('classifies open task due dates', () => {
    expect(getTaskDelay(null, null, today).state).toBe('no_due_date')
    expect(getTaskDelay('2026-10-21', null, today).state).toBe('upcoming')
    expect(getTaskDelay('2026-10-20', null, today).state).toBe('due_today')
    expect(getTaskDelay('2026-10-18', null, today)).toMatchObject({
      state: 'overdue',
      days: 2,
      isDelayed: true,
    })
  })

  it('uses the actual completion date for completed tasks', () => {
    expect(getTaskDelay('2026-10-20', '2026-10-20T18:00:00+05:30', today).state).toBe(
      'completed_on_time',
    )
    expect(getTaskDelay('2026-10-18', '2026-10-20T09:00:00+05:30', today)).toMatchObject({
      state: 'completed_late',
      days: 2,
      isDelayed: true,
    })
  })

  it('does not produce a negative delay for early completion', () => {
    expect(getTaskDelay('2026-10-25', '2026-10-20T09:00:00+05:30', today)).toMatchObject({
      state: 'completed_on_time',
      days: 0,
    })
  })
})
