import { useMemo, useState } from 'react'
import { History, Plus, Save, Trash2 } from 'lucide-react'
import {
  useCompliance,
  useDeleteSlot,
  usePlanningConfig,
  usePlanningHistory,
  usePlanningSlots,
  useSubmitCompliance,
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
  const { data: compliance } = useCompliance(planDate)
  const { data: slots = [] } = usePlanningSlots(planDate, 'day')
  const submit = useSubmitCompliance()
  const upsert = useUpsertSlot()
  const toast = useToast()

  const defaultStart = config?.day_start?.slice(0, 5) ?? '10:00'
  const [newStart, setNewStart] = useState(defaultStart)
  const [newEnd, setNewEnd] = useState(addHours(defaultStart, interval))

  const required = { dayEnd: config?.require_day_end ?? true }
  const isCompliant =
    !!compliance && (compliance.unlocked || !required.dayEnd || compliance.day_end_submitted)

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

  function addSlot() {
    if (!newStart || !newEnd) return
    if (newEnd <= newStart) {
      toast.error('Invalid slot', 'End time must be after the start time.')
      return
    }
    upsert.mutate(
      {
        planDate,
        kind: 'day',
        slotIndex: nextIndex,
        slotLabel: slotLabelFromRange(newStart, newEnd),
        taskName: '',
        progress: 0,
        startTime: newStart,
        endTime: newEnd,
      },
      {
        onSuccess: () => toast.success('Slot added'),
        onError: (e) => toast.error('Could not add slot', (e as Error).message),
      },
    )
  }

  return (
    <div data-testid="planning-page">
      <PageHeader
        title="Planning & Updates"
        description="Plan slots of any duration, for any date — pick a start and end time, then submit your day-end update."
        actions={
          <Badge tone={isCompliant ? 'green' : 'amber'} data-testid="compliance-status" data-compliant={isCompliant}>
            {isCompliant ? 'Planning complete' : 'Planning pending'}
          </Badge>
        }
      />

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
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1">
                <Label htmlFor="new-slot-start" className="mb-0 text-xs text-slate-500">
                  Start
                </Label>
                <Input
                  id="new-slot-start"
                  data-testid="new-slot-start"
                  type="time"
                  value={newStart}
                  onChange={(e) => {
                    setNewStart(e.target.value)
                    if (e.target.value && newEnd <= e.target.value)
                      setNewEnd(addHours(e.target.value, interval))
                  }}
                  className="h-8 w-28 border-0 p-0 focus:ring-0"
                />
                <Label htmlFor="new-slot-end" className="mb-0 text-xs text-slate-500">
                  End
                </Label>
                <Input
                  id="new-slot-end"
                  data-testid="new-slot-end"
                  type="time"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="h-8 w-28 border-0 p-0 focus:ring-0"
                />
                <Button size="sm" data-testid="add-slot" loading={upsert.isPending} onClick={addSlot}>
                  <Plus className="size-4" /> Add slot
                </Button>
              </div>
              <Button
                variant="outline"
                data-testid="submit-day-end"
                loading={submit.isPending}
                onClick={() =>
                  submit.mutate(
                    { date: planDate, part: 'day_end' },
                    { onSuccess: () => toast.success('Day-end update submitted') },
                  )
                }
              >
                Submit Day-End Update
              </Button>
            </div>
          </div>

          {ordered.length === 0 ? (
            <EmptyState
              title="No slots planned yet"
              description="Pick a start and end time, then add your first slot."
              testid="planning-empty"
            />
          ) : (
            <Card>
              <ul className="divide-y divide-slate-100" data-testid="slots-list">
                {ordered.map((s) => (
                  <SlotRow key={s.id} planDate={planDate} slot={s} intervalHours={interval} />
                ))}
              </ul>
            </Card>
          )}
        </section>

        <TaskBrief />
      </div>
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

/** One planned slot as a compact list row: times · task · outcome · actions. */
function SlotRow({
  planDate,
  slot,
  intervalHours,
}: {
  planDate: string
  slot: PlanningSlot
  intervalHours: number
}) {
  const upsert = useUpsertSlot()
  const del = useDeleteSlot()
  const toast = useToast()
  const [start, setStart] = useState(slot.start_time?.slice(0, 5) ?? '10:00')
  const [end, setEnd] = useState(
    slot.end_time?.slice(0, 5) ?? addHours(slot.start_time?.slice(0, 5) ?? '10:00', intervalHours),
  )
  const [task, setTask] = useState(slot.task_name ?? '')
  const [progress, setProgress] = useState(slot.progress ?? 0)
  const [challenges, setChallenges] = useState(slot.challenges ?? '')
  const [remarks, setRemarks] = useState(slot.remarks ?? '')
  const [historyOpen, setHistoryOpen] = useState(false)

  const tid = slot.slot_index
  const label = slotLabelFromRange(start, end)

  return (
    <li data-testid={`slot-card-${tid}`} className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className="w-24 shrink-0 text-sm font-semibold text-slate-700"
          data-testid={`slot-label-${tid}`}
        >
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <Input
            data-testid={`slot-start-${tid}`}
            aria-label={`Start time for ${label}`}
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="h-9 w-28"
          />
          <span className="text-xs text-slate-400">–</span>
          <Input
            data-testid={`slot-end-${tid}`}
            aria-label={`End time for ${label}`}
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="h-9 w-28"
          />
        </div>
        <Input
          data-testid={`slot-task-${tid}`}
          placeholder="Task name"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          className="min-w-48 flex-1"
        />
        <div className="flex items-center gap-1">
          <Input
            data-testid={`slot-progress-${tid}`}
            aria-label={`Progress for ${label}`}
            type="number"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-20"
          />
          <span className="text-xs text-slate-400">%</span>
        </div>
        <Textarea
          data-testid={`slot-challenges-${tid}`}
          placeholder="Challenges"
          rows={1}
          value={challenges}
          onChange={(e) => setChallenges(e.target.value)}
          className="max-h-9 min-w-40 flex-1"
        />
        <Textarea
          data-testid={`slot-remarks-${tid}`}
          placeholder="Remarks"
          rows={1}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="max-h-9 min-w-40 flex-1"
        />
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            data-testid={`slot-save-${tid}`}
            loading={upsert.isPending}
            onClick={() => {
              if (end <= start) {
                toast.error('Invalid slot', 'End time must be after the start time.')
                return
              }
              upsert.mutate(
                {
                  planDate,
                  kind: 'day',
                  slotIndex: slot.slot_index,
                  slotLabel: slotLabelFromRange(start, end),
                  taskName: task,
                  progress,
                  challenges,
                  remarks,
                  startTime: start,
                  endTime: end,
                },
                { onSuccess: () => toast.success('Slot saved'), onError: (e) => toast.error('Save failed', (e as Error).message) },
              )
            }}
          >
            <Save className="size-4" /> Save
          </Button>
          <button
            data-testid={`slot-history-${tid}`}
            aria-label={`History for ${label}`}
            className="rounded p-1 text-slate-400 hover:text-slate-700"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="size-4" />
          </button>
          <button
            data-testid={`slot-delete-${tid}`}
            aria-label={`Delete slot ${label}`}
            className="rounded p-1 text-slate-400 hover:text-red-600"
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
      </div>
      {historyOpen && (
        <SlotHistoryModal slotId={slot.id} label={label} onClose={() => setHistoryOpen(false)} />
      )}
    </li>
  )
}

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
            const outcome = [
              `${after?.progress ?? 0}% done`,
              after?.challenges && `challenges: ${after.challenges}`,
              after?.remarks && `remarks: ${after.remarks}`,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={h.id} data-testid="planning-history-entry" className="border-l-2 border-brand-200 pl-3 text-sm">
                <dl className="grid grid-cols-[5.5rem_1fr] gap-y-0.5">
                  <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Slot</dt>
                  <dd className="text-slate-700" data-testid="history-slot">
                    {after?.slot_label || before?.slot_label || label}
                  </dd>
                  <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Planning</dt>
                  <dd className="text-slate-700" data-testid="history-planning">
                    {before?.task_name !== after?.task_name && before?.task_name ? (
                      <>
                        <span className="text-slate-400 line-through">{before.task_name}</span>{' '}
                        → {after?.task_name || '—'}
                      </>
                    ) : (
                      after?.task_name || '—'
                    )}
                  </dd>
                  <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Outcome</dt>
                  <dd className="text-slate-700" data-testid="history-outcome">
                    {outcome}
                  </dd>
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
