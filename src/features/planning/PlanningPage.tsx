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
import { slotLabelFromStart } from './util'
import { todayInTz } from '@/features/attendance/geo'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'

export function PlanningPage() {
  const { data: config } = usePlanningConfig()
  const tz = 'Asia/Kolkata'
  const today = todayInTz(tz)
  const interval = config?.slot_interval_hours ?? 2
  const { data: compliance } = useCompliance(today)
  const { data: slots = [] } = usePlanningSlots(today, 'day')
  const submit = useSubmitCompliance()
  const upsert = useUpsertSlot()
  const toast = useToast()

  const [newStart, setNewStart] = useState(config?.day_start?.slice(0, 5) ?? '10:00')

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
    if (!newStart) return
    upsert.mutate(
      {
        planDate: today,
        kind: 'day',
        slotIndex: nextIndex,
        slotLabel: slotLabelFromStart(newStart, interval),
        taskName: '',
        progress: 0,
        startTime: newStart,
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
        description={`Plan your day in flexible ${interval}-hour slots that can start at any time, then submit your day-end update.`}
        actions={
          <Badge tone={isCompliant ? 'green' : 'amber'} data-testid="compliance-status" data-compliant={isCompliant}>
            {isCompliant ? 'Planning complete' : 'Planning pending'}
          </Badge>
        }
      />

      <section data-testid="day-plan-section">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Today · {today}</h2>
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
                onChange={(e) => setNewStart(e.target.value)}
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
                  { date: today, part: 'day_end' },
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
            description="Pick a start time and add your first slot."
            testid="planning-empty"
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {ordered.map((s) => (
              <SlotCard key={s.id} planDate={today} slot={s} intervalHours={interval} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SlotCard({
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
  const [task, setTask] = useState(slot.task_name ?? '')
  const [progress, setProgress] = useState(slot.progress ?? 0)
  const [challenges, setChallenges] = useState(slot.challenges ?? '')
  const [remarks, setRemarks] = useState(slot.remarks ?? '')
  const [historyOpen, setHistoryOpen] = useState(false)

  const tid = slot.slot_index
  const label = slotLabelFromStart(start, intervalHours)

  return (
    <Card data-testid={`slot-card-${tid}`}>
      <CardBody className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700" data-testid={`slot-label-${tid}`}>
            {label}
          </span>
          <div className="flex items-center gap-1">
            <button
              data-testid={`slot-history-${tid}`}
              aria-label={`History for ${label}`}
              className="text-slate-400 hover:text-slate-700"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="size-4" />
            </button>
            <button
              data-testid={`slot-delete-${tid}`}
              aria-label={`Delete slot ${label}`}
              className="text-slate-400 hover:text-red-600"
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
        <div className="flex items-center gap-2">
          <Label className="mb-0 text-xs text-slate-500">Start</Label>
          <Input
            data-testid={`slot-start-${tid}`}
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="h-9 w-32"
          />
        </div>
        <Input
          data-testid={`slot-task-${tid}`}
          placeholder="Task name"
          value={task}
          onChange={(e) => setTask(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Label className="mb-0 text-xs">Progress</Label>
          <Input
            data-testid={`slot-progress-${tid}`}
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
        />
        <Textarea
          data-testid={`slot-remarks-${tid}`}
          placeholder="Remarks"
          rows={1}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
        <Button
          size="sm"
          data-testid={`slot-save-${tid}`}
          loading={upsert.isPending}
          onClick={() =>
            upsert.mutate(
              {
                planDate,
                kind: 'day',
                slotIndex: slot.slot_index,
                slotLabel: slotLabelFromStart(start, intervalHours),
                taskName: task,
                progress,
                challenges,
                remarks,
                startTime: start,
              },
              { onSuccess: () => toast.success('Slot saved'), onError: (e) => toast.error('Save failed', (e as Error).message) },
            )
          }
        >
          <Save className="size-4" /> Save
        </Button>
      </CardBody>
      {historyOpen && (
        <SlotHistoryModal slotId={slot.id} label={label} onClose={() => setHistoryOpen(false)} />
      )}
    </Card>
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
        <ul className="space-y-3">
          {history.map((h) => {
            const before = h.before_data as { task_name?: string } | null
            const after = h.after_data as { task_name?: string } | null
            return (
              <li key={h.id} data-testid="planning-history-entry" className="border-l-2 border-brand-200 pl-3 text-sm">
                <p className="text-slate-700">
                  “{before?.task_name || '—'}” → “{after?.task_name || '—'}”
                </p>
                <p className="text-xs text-slate-400">{new Date(h.created_at).toLocaleString()}</p>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
