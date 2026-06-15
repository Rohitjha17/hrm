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

export function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
