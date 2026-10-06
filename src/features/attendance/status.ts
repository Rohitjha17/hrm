/**
 * One colour per attendance status, shared by the punch page, the admin
 * monitor/register and the attendance report so they always agree.
 */
export interface StatusMeta {
  label: string
  /** Short code for the monthly register grid. */
  code: string
  /** Badge / grid-cell classes. */
  className: string
  /** RGB fill for PDF export. */
  rgb: [number, number, number]
}

export const ATTENDANCE_STATUS: Record<string, StatusMeta> = {
  full_day: { label: 'Full Day', code: 'F', className: 'bg-emerald-100 text-emerald-800', rgb: [209, 250, 229] },
  half_day: { label: 'Half Day', code: 'H', className: 'bg-amber-100 text-amber-800', rgb: [254, 243, 199] },
  quarter_day: { label: 'Quarter Day', code: 'Q', className: 'bg-purple-100 text-purple-800', rgb: [243, 232, 255] },
  absent: { label: 'Absent', code: 'A', className: 'bg-red-100 text-red-800', rgb: [254, 226, 226] },
  present: { label: 'Present (in progress)', code: 'P', className: 'bg-blue-100 text-blue-800', rgb: [219, 234, 254] },
}

export const SUNDAY_META: StatusMeta = {
  label: 'Sunday',
  code: 'S',
  className: 'bg-slate-200 text-slate-600',
  rgb: [226, 232, 240],
}

export const LEGEND: StatusMeta[] = [
  ATTENDANCE_STATUS.full_day,
  ATTENDANCE_STATUS.half_day,
  ATTENDANCE_STATUS.quarter_day,
  ATTENDANCE_STATUS.absent,
  ATTENDANCE_STATUS.present,
  SUNDAY_META,
]

export const statusLabel = (status: string) => ATTENDANCE_STATUS[status]?.label ?? status

/** True when a YYYY-MM-DD date falls on a Sunday. */
export function isSunday(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() === 0
}

/** "1h 5m" style lateness, e.g. for a Late-by column. */
export function formatLateBy(minutes: number): string {
  if (minutes <= 0) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}
