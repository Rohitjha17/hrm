import { useState } from 'react'
import { CheckCircle2, FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  useAddEvent,
  useClearItem,
  useClearances,
  useDeleteAllEvents,
  useDeleteEvent,
  useLifecycleEvents,
  useResignation,
  useStartExit,
  useUpdateEvent,
  type LifecycleEvent,
} from './hooks'
import { useTemplates, type OnboardingTemplate } from '@/features/onboarding/hooks'
import { TemplateModal } from '@/features/onboarding/TemplateModal'
import { useUsers } from '@/features/admin/users/hooks'
import { useToast } from '@/components/ui/toast-context'
import { generateLetterPdf } from '@/lib/pdfLetter'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Select } from '@/components/ui/Select'

const EVENT_TYPES = [
  'joining',
  'confirmation',
  'promotion',
  'transfer',
  'department_change',
  'salary_revision',
  'exit',
]
const EXIT_DOC_TYPES = ['experience', 'relieving', 'no_due', 'exit_other']

export function LifecyclePage() {
  const { data: users = [] } = useUsers()
  const [employeeId, setEmployeeId] = useState('')
  const effectiveUser = employeeId || users[0]?.id || ''
  const employee = users.find((u) => u.id === effectiveUser)
  const { data: events = [] } = useLifecycleEvents(effectiveUser)
  const { data: resignation } = useResignation(effectiveUser)
  const { data: clearances = [] } = useClearances(resignation?.id ?? null)
  const addEvent = useAddEvent()
  const startExit = useStartExit()
  const clearItem = useClearItem()
  const deleteEvent = useDeleteEvent()
  const deleteAllEvents = useDeleteAllEvents()
  const toast = useToast()

  const [eventType, setEventType] = useState('promotion')
  const [eventDate, setEventDate] = useState('')
  const [exitDate, setExitDate] = useState('')
  const [tplOpen, setTplOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<LifecycleEvent | null>(null)
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<LifecycleEvent | null>(null)
  const [confirmClearTimeline, setConfirmClearTimeline] = useState(false)
  const { data: exitTemplates = [] } = useTemplates(EXIT_DOC_TYPES)

  function genFromTemplate(tpl: OnboardingTemplate) {
    const body = tpl.body
      .replaceAll('{{full_name}}', employee?.full_name || '')
      .replaceAll('{{employee_code}}', employee?.employee_code || '')
      .replaceAll('{{date}}', new Date().toLocaleDateString())
      .replaceAll('{{last_working_date}}', resignation?.last_working_date ?? '—')
    generateLetterPdf(
      `${tpl.doc_type}-${(employee?.full_name || 'doc').replace(/\s+/g, '-').toLowerCase()}`,
      tpl.title,
      body.split('\n\n'),
    )
  }

  function genDoc(kind: 'Experience Letter' | 'Relieving Letter' | 'No-Due Certificate') {
    generateLetterPdf(
      `${kind.replace(/\s+/g, '-').toLowerCase()}-${employee?.full_name?.replace(/\s+/g, '-').toLowerCase()}`,
      kind,
      [
        `This is to certify ${employee?.full_name}'s association with HRMS Demo Company.`,
        `Last working day: ${resignation?.last_working_date ?? '—'}.`,
        `We wish them the very best in their future endeavours.`,
        `Human Resources`,
      ],
    )
  }

  return (
    <div data-testid="lifecycle-page">
      <PageHeader
        title="Employee Lifecycle"
        description="Timeline of events and exit management."
      />

      <div className="mb-4">
        <Label htmlFor="lc-emp">Employee</Label>
        <Select
          id="lc-emp"
          data-testid="lifecycle-employee-select"
          value={effectiveUser}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="w-64"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name || u.email}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
                Timeline
              </h2>
              {events.length > 0 && (
                <button
                  data-testid="clear-timeline"
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600"
                  onClick={() => setConfirmClearTimeline(true)}
                >
                  <Trash2 className="size-3.5" /> Clear all
                </button>
              )}
            </div>
            <form
              className="mb-4 flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                addEvent.mutate(
                  { employeeId: effectiveUser, eventType, eventDate },
                  {
                    onSuccess: () => {
                      toast.success('Event added')
                      setEventDate('')
                    },
                    onError: (err) => toast.error('Failed', (err as Error).message),
                  },
                )
              }}
            >
              <Select
                data-testid="event-type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="h-9 w-40"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Input
                data-testid="event-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
                className="h-9 w-40"
              />
              <Button type="submit" size="sm" data-testid="add-event" loading={addEvent.isPending}>
                <Plus className="size-4" /> Add
              </Button>
            </form>
            <ol className="space-y-2" data-testid="timeline">
              {events.length === 0 && <li className="text-sm text-slate-500">No events yet.</li>}
              {events.map((ev) => (
                <li
                  key={ev.id}
                  data-testid="timeline-event"
                  className="border-brand-200 border-l-2 pl-3"
                >
                  <p className="flex items-center gap-1 text-sm font-medium text-slate-800">
                    <Badge tone="brand">{ev.event_type}</Badge>{' '}
                    <span className="ml-1">{ev.event_date}</span>
                    <span className="ml-auto flex items-center">
                      <button
                        data-testid="edit-event"
                        aria-label={`Edit ${ev.event_type} event`}
                        className="hover:text-brand-600 rounded p-1 text-slate-300"
                        onClick={() => setEditingEvent(ev)}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        data-testid="delete-event"
                        aria-label={`Delete ${ev.event_type} event`}
                        className="rounded p-1 text-slate-300 hover:text-red-600"
                        onClick={() => setConfirmDeleteEvent(ev)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  </p>
                  {ev.note && <p className="text-xs text-slate-500">{ev.note}</p>}
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
              Exit management
            </h2>
            {!resignation ? (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  startExit.mutate(
                    { employeeId: effectiveUser, lastWorkingDate: exitDate },
                    {
                      onSuccess: () => toast.success('Exit initiated'),
                      onError: (err) => toast.error('Failed', (err as Error).message),
                    },
                  )
                }}
              >
                <div>
                  <Label className="text-xs">Last working day</Label>
                  <Input
                    data-testid="exit-date"
                    type="date"
                    value={exitDate}
                    onChange={(e) => setExitDate(e.target.value)}
                    required
                    className="w-44"
                  />
                </div>
                <Button type="submit" data-testid="start-exit" loading={startExit.isPending}>
                  Start exit
                </Button>
              </form>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Last working day: <strong>{resignation.last_working_date}</strong> ·{' '}
                  <Badge tone="amber">{resignation.status}</Badge>
                </p>
                <ul className="space-y-1" data-testid="clearances">
                  {clearances.map((c) => (
                    <li
                      key={c.id}
                      data-testid="clearance-row"
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                    >
                      <span className="capitalize">{c.clearance_type}</span>
                      {c.status === 'cleared' ? (
                        <Badge tone="green">
                          <CheckCircle2 className="mr-1 inline size-3" />
                          cleared
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid="clear-button"
                          loading={clearItem.isPending}
                          onClick={() =>
                            clearItem.mutate(c.id, { onSuccess: () => toast.success('Cleared') })
                          }
                        >
                          Mark cleared
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="generate-experience"
                    onClick={() => genDoc('Experience Letter')}
                  >
                    <FileText className="size-4" /> Experience
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="generate-relieving"
                    onClick={() => genDoc('Relieving Letter')}
                  >
                    <FileText className="size-4" /> Relieving
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="generate-nodue"
                    onClick={() => genDoc('No-Due Certificate')}
                  >
                    <FileText className="size-4" /> No-Due
                  </Button>
                </div>
              </>
            )}

            <div className="border-t border-slate-100 pt-3" data-testid="exit-templates">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Exit document templates</h3>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="new-exit-template"
                  onClick={() => setTplOpen(true)}
                >
                  <Plus className="size-4" /> New template
                </Button>
              </div>
              {exitTemplates.length === 0 ? (
                <p className="text-xs text-slate-400" data-testid="exit-templates-empty">
                  No exit templates yet — create experience, relieving or no-due letter templates.
                </p>
              ) : (
                <ul className="space-y-2">
                  {exitTemplates.map((t) => (
                    <li
                      key={t.id}
                      data-testid="exit-template-row"
                      className="flex items-center justify-between rounded-lg border border-slate-100 p-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <Badge tone="slate">{t.doc_type}</Badge>
                        {t.title}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`generate-exit-${t.doc_type}`}
                        disabled={!employee}
                        onClick={() => genFromTemplate(t)}
                      >
                        <FileText className="size-4" /> Generate
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {tplOpen && (
        <TemplateModal
          docTypes={EXIT_DOC_TYPES}
          title="New exit document template"
          onClose={() => setTplOpen(false)}
        />
      )}
      {editingEvent && (
        <EditEventModal event={editingEvent} onClose={() => setEditingEvent(null)} />
      )}
      {confirmDeleteEvent && (
        <ConfirmDialog
          title="Delete event"
          testid="delete-event-dialog"
          confirmLabel="Delete event"
          loading={deleteEvent.isPending}
          onClose={() => setConfirmDeleteEvent(null)}
          message={
            <p>
              Delete the{' '}
              <span className="font-semibold text-slate-900">{confirmDeleteEvent.event_type}</span>{' '}
              event dated{' '}
              <span className="font-semibold text-slate-900">{confirmDeleteEvent.event_date}</span>{' '}
              from{' '}
              <span className="font-semibold text-slate-900">
                {employee?.full_name || 'this employee'}
              </span>
              &rsquo;s timeline? This action cannot be undone.
            </p>
          }
          onConfirm={() =>
            deleteEvent.mutate(confirmDeleteEvent.id, {
              onSuccess: () => {
                toast.success('Event deleted')
                setConfirmDeleteEvent(null)
              },
              onError: (err) => toast.error('Delete failed', (err as Error).message),
            })
          }
        />
      )}
      {confirmClearTimeline && (
        <ConfirmDialog
          title="Clear timeline"
          testid="clear-timeline-dialog"
          confirmLabel="Delete all events"
          loading={deleteAllEvents.isPending}
          onClose={() => setConfirmClearTimeline(false)}
          message={
            <p>
              Delete all <span className="font-semibold text-slate-900">{events.length}</span>{' '}
              timeline event
              {events.length === 1 ? '' : 's'} for{' '}
              <span className="font-semibold text-slate-900">
                {employee?.full_name || 'this employee'}
              </span>
              ? Exit management records are not affected. This action cannot be undone.
            </p>
          }
          onConfirm={() =>
            deleteAllEvents.mutate(effectiveUser, {
              onSuccess: () => {
                toast.success('Timeline cleared')
                setConfirmClearTimeline(false)
              },
              onError: (err) => toast.error('Delete failed', (err as Error).message),
            })
          }
        />
      )}
    </div>
  )
}

function EditEventModal({ event, onClose }: { event: LifecycleEvent; onClose: () => void }) {
  const update = useUpdateEvent()
  const toast = useToast()
  const [eventType, setEventType] = useState(event.event_type)
  const [eventDate, setEventDate] = useState(event.event_date)
  const [note, setNote] = useState(event.note ?? '')

  return (
    <Modal open onClose={onClose} title="Edit lifecycle event" testid="edit-event-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          update.mutate(
            { id: event.id, eventType, eventDate, note },
            {
              onSuccess: () => {
                toast.success('Event updated')
                onClose()
              },
              onError: (err) => toast.error('Update failed', (err as Error).message),
            },
          )
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ee-type">Event type</Label>
            <Select
              id="ee-type"
              data-testid="edit-event-type"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ee-date">Date</Label>
            <Input
              id="ee-date"
              data-testid="edit-event-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="ee-note">Note</Label>
          <Input
            id="ee-note"
            data-testid="edit-event-note"
            placeholder="Optional note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="save-event" loading={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}
