import { useState } from 'react'
import { History, Save } from 'lucide-react'
import {
  useCompliance,
  usePlanningConfig,
  usePlanningHistory,
  usePlanningSlots,
  useSubmitCompliance,
  useUpsertSlot,
  type PlanningSlot,
} from './hooks'
import { generateSlots, nextDay, type SlotBoundary } from './util'
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

export function PlanningPage() {
  const { data: config } = usePlanningConfig()
  const tz = 'Asia/Kolkata'
  const today = todayInTz(tz)
  const tomorrow = nextDay(today)
  const { data: compliance } = useCompliance(today)
  const submit = useSubmitCompliance()
  const toast = useToast()

  const boundaries = config
    ? generateSlots(config.day_start, config.day_end, config.slot_interval_hours)
    : []

  const required = {
    dayEnd: config?.require_day_end ?? true,
    nextDay: config?.require_next_day ?? true,
  }
  const isCompliant =
    !!compliance &&
    (compliance.unlocked ||
      ((!required.dayEnd || compliance.day_end_submitted) &&
        (!required.nextDay || compliance.next_day_submitted)))

  return (
    <div data-testid="planning-page">
      <PageHeader
        title="Planning & Updates"
        description={`Plan your day in ${config?.slot_interval_hours ?? 2}-hour slots, then submit a day-end update and tomorrow's plan.`}
        actions={
          <Badge tone={isCompliant ? 'green' : 'amber'} data-testid="compliance-status" data-compliant={isCompliant}>
            {isCompliant ? 'Planning complete' : 'Planning pending'}
          </Badge>
        }
      />

      <div className="space-y-8">
        <section data-testid="day-plan-section">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Today · {today}</h2>
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
          <SlotList kind="day" planDate={today} boundaries={boundaries} />
        </section>

        <section data-testid="next-day-section">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Next day · {tomorrow}</h2>
            <Button
              variant="outline"
              data-testid="submit-next-day"
              loading={submit.isPending}
              onClick={() =>
                submit.mutate(
                  { date: today, part: 'next_day' },
                  { onSuccess: () => toast.success('Next-day plan submitted') },
                )
              }
            >
              Submit Next-Day Plan
            </Button>
          </div>
          <SlotList kind="next_day" planDate={tomorrow} boundaries={boundaries} />
        </section>
      </div>
    </div>
  )
}

function SlotList({
  kind,
  planDate,
  boundaries,
}: {
  kind: 'day' | 'next_day'
  planDate: string
  boundaries: SlotBoundary[]
}) {
  const { data: slots = [] } = usePlanningSlots(planDate, kind)
  const byIndex = new Map(slots.map((s) => [s.slot_index, s]))
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {boundaries.map((b) => (
        <SlotCard key={b.index} kind={kind} planDate={planDate} boundary={b} existing={byIndex.get(b.index) ?? null} />
      ))}
    </div>
  )
}

function SlotCard({
  kind,
  planDate,
  boundary,
  existing,
}: {
  kind: 'day' | 'next_day'
  planDate: string
  boundary: SlotBoundary
  existing: PlanningSlot | null
}) {
  const upsert = useUpsertSlot()
  const toast = useToast()
  const [task, setTask] = useState(existing?.task_name ?? '')
  const [progress, setProgress] = useState(existing?.progress ?? 0)
  const [challenges, setChallenges] = useState(existing?.challenges ?? '')
  const [remarks, setRemarks] = useState(existing?.remarks ?? '')
  const [historyOpen, setHistoryOpen] = useState(false)

  const tid = `${kind}-${boundary.index}`

  return (
    <Card data-testid={`slot-card-${tid}`}>
      <CardBody className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">{boundary.label}</span>
          {existing?.id && (
            <button
              data-testid={`slot-history-${tid}`}
              aria-label={`History for ${boundary.label}`}
              className="text-slate-400 hover:text-slate-700"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="size-4" />
            </button>
          )}
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
                kind,
                slotIndex: boundary.index,
                slotLabel: boundary.label,
                taskName: task,
                progress,
                challenges,
                remarks,
              },
              { onSuccess: () => toast.success('Slot saved'), onError: (e) => toast.error('Save failed', (e as Error).message) },
            )
          }
        >
          <Save className="size-4" /> Save
        </Button>
      </CardBody>
      {historyOpen && existing?.id && (
        <SlotHistoryModal slotId={existing.id} label={boundary.label} onClose={() => setHistoryOpen(false)} />
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
