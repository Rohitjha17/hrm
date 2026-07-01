export interface SlotBoundary {
  index: number
  label: string
}

/** Generate planning slot boundaries from the configured cadence + window. */
export function generateSlots(
  dayStart: string,
  dayEnd: string,
  intervalHours: number,
): SlotBoundary[] {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + (m || 0)
  }
  const fmt = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

  const startMin = toMin(dayStart)
  const endMin = toMin(dayEnd)
  const step = Math.max(30, Math.round(intervalHours * 60))
  const slots: SlotBoundary[] = []
  let index = 0
  for (let t = startMin; t < endMin; t += step) {
    slots.push({ index, label: `${fmt(t)}–${fmt(Math.min(t + step, endMin))}` })
    index++
  }
  return slots
}

/**
 * Build a slot label ("HH:MM–HH:MM") for a flexible slot that starts at
 * `startTime` and runs for `intervalHours` hours (clamps to end of day).
 */
export function slotLabelFromStart(startTime: string, intervalHours: number): string {
  const [h, m] = startTime.split(':').map(Number)
  const startMin = h * 60 + (m || 0)
  const endMin = Math.min(startMin + Math.round(intervalHours * 60), 24 * 60)
  const fmt = (mins: number) =>
    `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  return `${fmt(startMin)}–${fmt(endMin)}`
}

export function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
