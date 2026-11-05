export type TaskDelayState =
  | 'no_due_date'
  | 'upcoming'
  | 'due_today'
  | 'overdue'
  | 'completed_on_time'
  | 'completed_late'

export interface TaskDelay {
  state: TaskDelayState
  days: number
  label: string
  isDelayed: boolean
}

function localDateKey(value: string | Date): string | null {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 86_400_000
}

export function getTaskDelay(
  dueDate: string | null | undefined,
  completedAt: string | null | undefined,
  now: Date = new Date(),
): TaskDelay {
  if (!dueDate) {
    return { state: 'no_due_date', days: 0, label: 'No due date', isDelayed: false }
  }

  const dueKey = dueDate.slice(0, 10)
  const comparisonKey = completedAt ? localDateKey(completedAt) : localDateKey(now)
  if (!comparisonKey) {
    return { state: 'no_due_date', days: 0, label: 'Unavailable', isDelayed: false }
  }

  const difference = dayNumber(comparisonKey) - dayNumber(dueKey)
  if (completedAt) {
    if (difference > 0) {
      return {
        state: 'completed_late',
        days: difference,
        label: `Completed ${difference} day${difference === 1 ? '' : 's'} late`,
        isDelayed: true,
      }
    }
    return { state: 'completed_on_time', days: 0, label: 'Completed on time', isDelayed: false }
  }

  if (difference > 0) {
    return {
      state: 'overdue',
      days: difference,
      label: `Overdue by ${difference} day${difference === 1 ? '' : 's'}`,
      isDelayed: true,
    }
  }
  if (difference === 0) {
    return { state: 'due_today', days: 0, label: 'Due today', isDelayed: false }
  }
  return { state: 'upcoming', days: 0, label: 'On schedule', isDelayed: false }
}
