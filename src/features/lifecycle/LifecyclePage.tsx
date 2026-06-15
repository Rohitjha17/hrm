import { useState } from 'react'
import { CheckCircle2, FileText, Plus } from 'lucide-react'
import {
  useAddEvent,
  useClearItem,
  useClearances,
  useLifecycleEvents,
  useResignation,
  useStartExit,
} from './hooks'
import { useUsers } from '@/features/admin/users/hooks'
import { useToast } from '@/components/ui/toast-context'
import { generateLetterPdf } from '@/lib/pdfLetter'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'

const EVENT_TYPES = ['joining', 'confirmation', 'promotion', 'transfer', 'department_change', 'salary_revision', 'exit']

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
  const toast = useToast()

  const [eventType, setEventType] = useState('promotion')
  const [eventDate, setEventDate] = useState('')
  const [exitDate, setExitDate] = useState('')

  function genDoc(kind: 'Experience Letter' | 'Relieving Letter' | 'No-Due Certificate') {
    generateLetterPdf(`${kind.replace(/\s+/g, '-').toLowerCase()}-${employee?.full_name?.replace(/\s+/g, '-').toLowerCase()}`, kind, [
      `This is to certify ${employee?.full_name}'s association with HRMS Demo Company.`,
      `Last working day: ${resignation?.last_working_date ?? '—'}.`,
      `We wish them the very best in their future endeavours.`,
      `Human Resources`,
    ])
  }

  return (
    <div data-testid="lifecycle-page">
      <PageHeader title="Employee Lifecycle" description="Timeline of events and exit management." />

      <div className="mb-4">
        <Label htmlFor="lc-emp">Employee</Label>
        <Select id="lc-emp" data-testid="lifecycle-employee-select" value={effectiveUser} onChange={(e) => setEmployeeId(e.target.value)} className="w-64">
          {users.map((u) => (<option key={u.id} value={u.id}>{u.full_name || u.email}</option>))}
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Timeline</h2>
            <form
              className="mb-4 flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                addEvent.mutate(
                  { employeeId: effectiveUser, eventType, eventDate },
                  { onSuccess: () => { toast.success('Event added'); setEventDate('') }, onError: (err) => toast.error('Failed', (err as Error).message) },
                )
              }}
            >
              <Select data-testid="event-type" value={eventType} onChange={(e) => setEventType(e.target.value)} className="h-9 w-40">
                {EVENT_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </Select>
              <Input data-testid="event-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required className="h-9 w-40" />
              <Button type="submit" size="sm" data-testid="add-event" loading={addEvent.isPending}>
                <Plus className="size-4" /> Add
              </Button>
            </form>
            <ol className="space-y-2" data-testid="timeline">
              {events.length === 0 && <li className="text-sm text-slate-500">No events yet.</li>}
              {events.map((ev) => (
                <li key={ev.id} data-testid="timeline-event" className="border-l-2 border-brand-200 pl-3">
                  <p className="text-sm font-medium text-slate-800">
                    <Badge tone="brand">{ev.event_type}</Badge> <span className="ml-1">{ev.event_date}</span>
                  </p>
                  {ev.note && <p className="text-xs text-slate-500">{ev.note}</p>}
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Exit management</h2>
            {!resignation ? (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  startExit.mutate(
                    { employeeId: effectiveUser, lastWorkingDate: exitDate },
                    { onSuccess: () => toast.success('Exit initiated'), onError: (err) => toast.error('Failed', (err as Error).message) },
                  )
                }}
              >
                <div>
                  <Label className="text-xs">Last working day</Label>
                  <Input data-testid="exit-date" type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)} required className="w-44" />
                </div>
                <Button type="submit" data-testid="start-exit" loading={startExit.isPending}>Start exit</Button>
              </form>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Last working day: <strong>{resignation.last_working_date}</strong> ·{' '}
                  <Badge tone="amber">{resignation.status}</Badge>
                </p>
                <ul className="space-y-1" data-testid="clearances">
                  {clearances.map((c) => (
                    <li key={c.id} data-testid="clearance-row" className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                      <span className="capitalize">{c.clearance_type}</span>
                      {c.status === 'cleared' ? (
                        <Badge tone="green"><CheckCircle2 className="mr-1 inline size-3" />cleared</Badge>
                      ) : (
                        <Button size="sm" variant="outline" data-testid="clear-button" loading={clearItem.isPending}
                          onClick={() => clearItem.mutate(c.id, { onSuccess: () => toast.success('Cleared') })}>
                          Mark cleared
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Button size="sm" variant="outline" data-testid="generate-experience" onClick={() => genDoc('Experience Letter')}>
                    <FileText className="size-4" /> Experience
                  </Button>
                  <Button size="sm" variant="outline" data-testid="generate-relieving" onClick={() => genDoc('Relieving Letter')}>
                    <FileText className="size-4" /> Relieving
                  </Button>
                  <Button size="sm" variant="outline" data-testid="generate-nodue" onClick={() => genDoc('No-Due Certificate')}>
                    <FileText className="size-4" /> No-Due
                  </Button>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
