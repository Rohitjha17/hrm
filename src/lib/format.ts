const pad = (n: number) => String(n).padStart(2, '0')

/** DD-MM-YYYY. Accepts a date-only string (YYYY-MM-DD) or an ISO timestamp. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) return `${dateOnly[3]}-${dateOnly[2]}-${dateOnly[1]}`
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}

/** hh:mm AM/PM in the viewer's local time. */
export function formatTime(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const h = d.getHours()
  return `${pad(h % 12 || 12)}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`
}

/** DD-MM-YYYY hh:mm AM/PM in the viewer's local time. */
export function formatDateTime(value: string | null | undefined): string {
  const date = formatDate(value)
  return date ? `${date} ${formatTime(value)}` : ''
}
