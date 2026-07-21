import { useMemo, useState, type ReactNode } from 'react'
import { History, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  planningCoverage,
  useDeleteSlot,
  usePlanningConfig,
  usePlanningHistory,
  usePlanningSlots,
  useUpsertSlot,
  type PlanningSlot,
} from './hooks'
import { addHours, slotLabelFromRange } from './util'
import { useTasks } from '@/features/tasks/hooks'
import { todayInTz } from '@/features/attendance/geo'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'

const PRIORITY_TONE: Record<string, 'red' | 'amber' | 'slate'> = {
  high: 'red',
  medium: 'amber',
  low: 'slate',
}

export function PlanningPage() {
  const { data: config } = usePlanningConfig()
  const tz = 'Asia/Kolkata'
  const today = todayInTz(tz)
  const interval = config?.slot_interval_hours ?? 2
  const [planDate, setPlanDate] = useState(today)
  const { data: slots = [] } = usePlanningSlots(planDate, 'day')
  const [addOpen, setAddOpen] = useState(false)
  const [editSlot, setEditSlot] = useState<PlanningSlot | null>(null)

  const defaultStart = config?.day_start?.slice(0, 5) ?? '10:00'
  const windowStart = config?.day_start?.slice(0, 5) ?? '10:00'
  const windowEnd = config?.day_end?.slice(0, 5) ?? '18:30'

  const coverage = planningCoverage(slots, windowStart, windowEnd)

  // Slots ordered by their chosen start time (fallback to slot_index).
  const ordered = useMemo(
    () =>
      [...slots].sort(
        (a, b) =>
          (a.start_time ?? '').localeCompare(b.start_time ?? '') || a.slot_index - b.slot_index,
      ),
    [slots],
  )
  const nextIndex = slots.reduce((mx, s) => Math.max(mx, s.slot_index), -1) + 1

  return (
    <div data-testid="planning-page">
      <PageHeader
        title="Planning & Updates"
        description={`Plan your whole working day (${windowStart}–${windowEnd}) as slots, then open a slot to update it as work progresses.`}
        actions={
          <Badge
            tone={coverage.covered ? 'green' : 'amber'}
            data-testid="compliance-status"
            data-compliant={coverage.covered}
          >
            {coverage.covered ? 'All hours planned' : 'Planning pending'}
          </Badge>
        }
      />

      {!coverage.covered && (
        <div
          data-testid="coverage-hint"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          Plan every working hour from <span className="font-semibold">{windowStart}</span> to{' '}
          <span className="font-semibold">{windowEnd}</span> — your slots don't cover{' '}
          <span className="font-semibold">{coverage.gapStart ?? windowStart}</span> onwards yet.
          Punch-in stays locked after a worked day until it is fully planned.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section data-testid="day-plan-section">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="plan-date" className="mb-0">
                Plan for
              </Label>
              <Input
                id="plan-date"
                data-testid="plan-date"
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                className="w-44"
              />
              {planDate === today && <Badge tone="blue">Today</Badge>}
            </div>
            <Button data-testid="add-slot" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> Add slot
            </Button>
          </div>

          {ordered.length === 0 ? (
            <EmptyState
              title="No slots planned yet"
              description='Use "Add slot" to plan your first slot of the day.'
              testid="planning-empty"
            />
          ) : (
            <Card>
              <ul className="divide-y divide-slate-100" data-testid="slots-list">
                {ordered.map((s) => (
                  <SlotRow key={s.id} slot={s} onEdit={() => setEditSlot(s)} />
                ))}
              </ul>
            </Card>
          )}
        </section>

        <TaskBrief />
      </div>

      {addOpen && (
        <SlotFormModal
          planDate={planDate}
          slotIndex={nextIndex}
          defaultStart={defaultStart}
          intervalHours={interval}
          onClose={() => setAddOpen(false)}
        />
      )}
      {editSlot && (
        <SlotFormModal
          planDate={planDate}
          slot={editSlot}
          slotIndex={editSlot.slot_index}
          defaultStart={defaultStart}
          intervalHours={interval}
          onClose={() => setEditSlot(null)}
        />
      )}
    </div>
  )
}

/** Compact overview of the user's open tasks so planning slots is easier. */
function TaskBrief() {
  const { data: tasks = [] } = useTasks()
  const open = useMemo(() => tasks.filter((t) => !t.status?.is_terminal).slice(0, 10), [tasks])

  return (
    <aside data-testid="planning-task-brief">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">
        Your open tasks
      </h2>
      {open.length === 0 ? (
        <p className="text-sm text-slate-400" data-testid="task-brief-empty">
          No open tasks — you're all caught up.
        </p>
      ) : (
        <ul className="space-y-2">
          {open.map((t) => (
            <li
              key={t.id}
              data-testid="task-brief-item"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">{t.title}</span>
                <Badge tone={PRIORITY_TONE[t.priority] ?? 'slate'}>{t.priority}</Badge>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <span>{t.status?.name ?? '—'}</span>
                {t.due_date && <span>· due {t.due_date}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

/** One planned slot as a read-only row — open it to edit. */
function SlotRow({ slot, onEdit }: { slot: PlanningSlot; onEdit: () => void }) {
  const del = useDeleteSlot()
  const toast = useToast()
  const [historyOpen, setHistoryOpen] = useState(false)

  const tid = slot.slot_index
  const label =
    slot.start_time && slot.end_time
      ? slotLabelFromRange(slot.start_time, slot.end_time)
      : slot.slot_label

  return (
    <li data-testid={`slot-card-${tid}`} className="flex items-center gap-3 px-4 py-3">
      <span
        className="w-28 shrink-0 text-sm font-semibold text-slate-700"
        data-testid={`slot-label-${tid}`}
      >
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800" data-testid={`slot-planning-${tid}`}>
          {slot.task_name || <span className="font-normal text-slate-400">Nothing planned yet</span>}
        </p>
        {(slot.remarks || slot.challenges) && (
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {slot.remarks && (
              <span data-testid={`slot-working-${tid}`}>Working: {slot.remarks}</span>
            )}
            {slot.remarks && slot.challenges && <span> · </span>}
            {slot.challenges && (
              <span className="text-amber-700" data-testid={`slot-challenges-${tid}`}>
                Challenges: {slot.challenges}
              </span>
            )}
          </p>
        )}
      </div>
      <Badge tone={(slot.progress ?? 0) >= 100 ? 'green' : 'blue'} data-testid={`slot-progress-${tid}`}>
        {slot.progress ?? 0}%
      </Badge>
      <div className="flex shrink-0 items-center gap-1">
        <button
          data-testid={`slot-edit-${tid}`}
          aria-label={`Edit slot ${label}`}
          className="hover:text-brand-600 rounded p-1 text-slate-400 hover:bg-slate-100"
          onClick={onEdit}
        >
          <Pencil className="size-4" />
        </button>
        <button
          data-testid={`slot-history-${tid}`}
          aria-label={`History for ${label}`}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onClick={() => setHistoryOpen(true)}
        >
          <History className="size-4" />
        </button>
        <button
          data-testid={`slot-delete-${tid}`}
          aria-label={`Delete slot ${label}`}
          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
          onClick={() =>
            del.mutate(slot.id, {
              onSuccess: () => toast.success('Slot removed'),
              onError: (e) => toast.error('Delete failed', (e as Error).message),
            })
          }
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {historyOpen && (
        <SlotHistoryModal slotId={slot.id} label={label} onClose={() => setHistoryOpen(false)} />
      )}
    </li>
  )
}

/** Add/edit a slot: times first, then Planning · Working · Completion % · Challenges. */
function SlotFormModal({
  planDate,
  slot,
  slotIndex,
  defaultStart,
  intervalHours,
  onClose,
}: {
  planDate: string
  slot?: PlanningSlot
  slotIndex: number
  defaultStart: string
  intervalHours: number
  onClose: () => void
}) {
  const upsert = useUpsertSlot()
  const toast = useToast()
  const [start, setStart] = useState(slot?.start_time?.slice(0, 5) ?? defaultStart)
  const [end, setEnd] = useState(
    slot?.end_time?.slice(0, 5) ?? addHours(slot?.start_time?.slice(0, 5) ?? defaultStart, intervalHours),
  )
  const [planning, setPlanning] = useState(slot?.task_name ?? '')
  const [working, setWorking] = useState(slot?.remarks ?? '')
  const [progress, setProgress] = useState(slot?.progress ?? 0)
  const [challenges, setChallenges] = useState(slot?.challenges ?? '')

  return (
    <Modal
      open
      onClose={onClose}
      title={slot ? `Edit slot · ${slotLabelFromRange(start, end)}` : 'Add slot'}
      testid="slot-form-modal"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!start || !end || end <= start) {
            toast.error('Invalid slot', 'End time must be after the start time.')
            return
          }
          upsert.mutate(
            {
              planDate,
              kind: 'day',
              slotIndex,
              slotLabel: slotLabelFromRange(start, end),
              taskName: planning,
              progress,
              challenges,
              remarks: working,
              startTime: start,
              endTime: end,
            },
            {
              onSuccess: () => {
                toast.success(slot ? 'Slot saved' : 'Slot added')
                onClose()
              },
              onError: (err) => toast.error('Save failed', (err as Error).message),
            },
          )
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="slot-form-start">Start</Label>
            <Input
              id="slot-form-start"
              data-testid="slot-form-start"
              type="time"
              value={start}
              onChange={(e) => {
                setStart(e.target.value)
                if (e.target.value && end <= e.target.value)
                  setEnd(addHours(e.target.value, intervalHours))
              }}
              required
            />
          </div>
          <div>
            <Label htmlFor="slot-form-end">End</Label>
            <Input
              id="slot-form-end"
              data-testid="slot-form-end"
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="slot-form-planning">Planning</Label>
          <Input
            id="slot-form-planning"
            data-testid="slot-form-planning"
            placeholder="Planning"
            value={planning}
            onChange={(e) => setPlanning(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="slot-form-working">Working</Label>
          <Textarea
            id="slot-form-working"
            data-testid="slot-form-working"
            placeholder="Working"
            rows={2}
            value={working}
            onChange={(e) => setWorking(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="slot-form-progress">Completion %</Label>
          <Input
            id="slot-form-progress"
            data-testid="slot-form-progress"
            placeholder="Completion %"
            type="number"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="slot-form-challenges">Challenges</Label>
          <Textarea
            id="slot-form-challenges"
            data-testid="slot-form-challenges"
            placeholder="Challenges"
            rows={2}
            value={challenges}
            onChange={(e) => setChallenges(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="slot-form-save" loading={upsert.isPending}>
            {slot ? 'Save slot' : 'Add slot'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

const HISTORY_FIELDS = [
  { key: 'slot', label: 'Slot' },
  { key: 'planning', label: 'Planning' },
  { key: 'working', label: 'Working' },
  { key: 'progress', label: 'Completion %' },
  { key: 'challenges', label: 'Challenges' },
] as const

function SlotHistoryModal({
  slotId,
  label,
  onClose,
}: {
  slotId: string
  label: string
  onClose: () => void
}) {
  const { data: history = [] } = usePlanningHistory(slotId)
  return (
    <Modal open onClose={onClose} title={`History · ${label}`} testid="planning-history-modal">
      {history.length === 0 ? (
        <p className="text-sm text-slate-500">No edits recorded yet.</p>
      ) : (
        <ul className="space-y-4">
          {history.map((h) => {
            type SlotData = {
              task_name?: string
              slot_label?: string
              progress?: number
              challenges?: string | null
              remarks?: string | null
            }
            const before = h.before_data as SlotData | null
            const after = h.after_data as SlotData | null
            const values: Record<(typeof HISTORY_FIELDS)[number]['key'], ReactNode> = {
              slot: after?.slot_label || before?.slot_label || label,
              planning:
                before?.task_name !== after?.task_name && before?.task_name ? (
                  <>
                    <span className="text-slate-400 line-through">{before.task_name}</span> →{' '}
                    {after?.task_name || '—'}
                  </>
                ) : (
                  after?.task_name || '—'
                ),
              working: after?.remarks || '—',
              progress: `${after?.progress ?? 0}%`,
              challenges: after?.challenges || '—',
            }
            return (
              <li key={h.id} data-testid="planning-history-entry" className="border-l-2 border-brand-200 pl-3 text-sm">
                <dl className="grid grid-cols-[7rem_1fr] gap-y-0.5">
                  {HISTORY_FIELDS.map((f) => (
                    <div key={f.key} className="contents">
                      <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                        {f.label}
                      </dt>
                      <dd className="text-slate-700" data-testid={`history-${f.key}`}>
                        {values[f.key]}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-1 text-xs text-slate-400">{new Date(h.created_at).toLocaleString()}</p>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
