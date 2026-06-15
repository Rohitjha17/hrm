import { useState } from 'react'
import { AlertTriangle, ArrowUpCircle, Plus } from 'lucide-react'
import { isSlaBreached, useRaiseTicket, useTickets, useUpdateTicket, type Ticket } from './hooks'
import { useUsers } from '@/features/admin/users/hooks'
import { useProfile } from '@/features/rbac/profile-context'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'

const CATEGORIES = ['it', 'hr', 'salary', 'leave', 'asset']
const STATUSES: Ticket['status'][] = ['open', 'in_progress', 'resolved', 'closed']
const STATUS_TONE = { open: 'amber', in_progress: 'blue', resolved: 'green', closed: 'slate' } as const

export function HelpdeskPage() {
  const { hasPermission } = useProfile()
  const canManage = hasPermission('helpdesk.manage')
  const { data: tickets = [] } = useTickets()
  const { data: users = [] } = useUsers()
  const raise = useRaiseTicket()
  const update = useUpdateTicket()
  const toast = useToast()
  const nameById = new Map(users.map((u) => [u.id, u.full_name || u.email]))

  const [category, setCategory] = useState('it')
  const [subject, setSubject] = useState('')
  const [priority, setPriority] = useState('medium')

  return (
    <div data-testid="helpdesk-page">
      <PageHeader title="Helpdesk" description="Raise and track support tickets with SLA monitoring." />

      <Card className="mb-4">
        <CardBody>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              raise.mutate(
                { category, subject: subject.trim(), priority },
                { onSuccess: () => { toast.success('Ticket raised'); setSubject('') }, onError: (err) => toast.error('Failed', (err as Error).message) },
              )
            }}
          >
            <div>
              <Label className="text-xs">Category</Label>
              <Select data-testid="ticket-category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-32">
                {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
              </Select>
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Select data-testid="ticket-priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="w-28">
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs">Subject</Label>
              <Input data-testid="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>
            <Button type="submit" data-testid="raise-ticket" loading={raise.isPending}>
              <Plus className="size-4" /> Raise
            </Button>
          </form>
        </CardBody>
      </Card>

      <Table data-testid="tickets-table">
        <Thead>
          <tr>
            <Th>Subject</Th>
            <Th>Category</Th>
            <Th>Raised by</Th>
            <Th>Status</Th>
            <Th>SLA</Th>
            {canManage && <Th className="text-right">Actions</Th>}
          </tr>
        </Thead>
        <Tbody>
          {tickets.map((t) => (
            <tr key={t.id} data-testid="ticket-row">
              <Td className="font-medium text-slate-900">
                {t.subject}
                {t.escalated && <Badge tone="red" className="ml-2" data-testid="escalated-badge">escalated</Badge>}
              </Td>
              <Td>{t.category}</Td>
              <Td>{nameById.get(t.raised_by) ?? '—'}</Td>
              <Td>
                <Badge tone={STATUS_TONE[t.status as keyof typeof STATUS_TONE]} data-testid="ticket-status">{t.status}</Badge>
              </Td>
              <Td>
                {isSlaBreached(t) ? (
                  <Badge tone="red" data-testid="sla-badge"><AlertTriangle className="mr-1 inline size-3" />breached</Badge>
                ) : (
                  <span className="text-xs text-slate-400">on track</span>
                )}
              </Td>
              {canManage && (
                <Td>
                  <div className="flex items-center justify-end gap-2">
                    <Select
                      data-testid="ticket-status-select"
                      value={t.status}
                      onChange={(e) => update.mutate({ id: t.id, status: e.target.value as Ticket['status'] }, { onSuccess: () => toast.success('Updated') })}
                      className="h-8 w-32"
                    >
                      {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </Select>
                    {!t.escalated && (
                      <button
                        data-testid="escalate-ticket"
                        aria-label={`Escalate ${t.subject}`}
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => update.mutate({ id: t.id, escalated: true }, { onSuccess: () => toast.info('Escalated') })}
                      >
                        <ArrowUpCircle className="size-4" />
                      </button>
                    )}
                  </div>
                </Td>
              )}
            </tr>
          ))}
        </Tbody>
      </Table>
    </div>
  )
}
