import { useState } from 'react'
import { AlertTriangle, ArrowUpCircle, Plus, Trash2 } from 'lucide-react'
import {
  isSlaBreached,
  useDeleteTicket,
  useRaiseTicket,
  useTickets,
  useUpdateTicket,
  type Ticket,
} from './hooks'
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
import { Textarea } from '@/components/ui/Textarea'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatDateTime } from '@/lib/format'
import { useMasterItems } from '@/features/admin/masters/hooks'
const STATUSES: Ticket['status'][] = ['open', 'in_progress', 'resolved', 'closed']
const STATUS_TONE = {
  open: 'amber',
  in_progress: 'blue',
  resolved: 'green',
  closed: 'slate',
} as const

export function HelpdeskPage() {
  const { hasPermission } = useProfile()
  const canEdit = hasPermission('helpdesk.edit')
  const canDelete = hasPermission('helpdesk.delete')
  const hasActions = canEdit || canDelete
  const { data: tickets = [] } = useTickets()
  const { data: users = [] } = useUsers()
  const { data: categories = [] } = useMasterItems('helpdesk_categories')
  const raise = useRaiseTicket()
  const update = useUpdateTicket()
  const remove = useDeleteTicket()
  const toast = useToast()
  const nameById = new Map(users.map((u) => [u.id, u.full_name || u.email]))

  const [category, setCategory] = useState('it')
  const [subject, setSubject] = useState('')
  const [priority, setPriority] = useState('medium')
  const [description, setDescription] = useState('')
  const [deleting, setDeleting] = useState<Ticket | null>(null)

  return (
    <div data-testid="helpdesk-page">
      <PageHeader
        title="Helpdesk"
        description="Raise and track support tickets with SLA monitoring."
      />

      <Card className="mb-4">
        <CardBody>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              raise.mutate(
                { category, subject: subject.trim(), description: description.trim(), priority },
                {
                  onSuccess: () => {
                    toast.success('Ticket raised')
                    setSubject('')
                    setDescription('')
                  },
                  onError: (err) => toast.error('Failed', (err as Error).message),
                },
              )
            }}
          >
            <div>
              <Label className="text-xs">Category</Label>
              <Select
                data-testid="ticket-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-32"
              >
                {categories
                  .filter((item) => item.is_active)
                  .map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}
              </Select>
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Select
                data-testid="ticket-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-28"
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs">Subject</Label>
              <Input
                data-testid="ticket-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>
            <div className="min-w-64 flex-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                data-testid="ticket-description"
                rows={1}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
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
            <Th>Assigned to</Th>
            <Th>Created</Th>
            <Th>Closed</Th>
            <Th>Status</Th>
            <Th>SLA</Th>
            {hasActions && <Th className="text-right">Actions</Th>}
          </tr>
        </Thead>
        <Tbody>
          {tickets.map((t) => (
            <tr key={t.id} data-testid="ticket-row">
              <Td className="font-medium text-slate-900">
                {t.subject}
                {t.escalated && (
                  <Badge tone="red" className="ml-2" data-testid="escalated-badge">
                    escalated
                  </Badge>
                )}
              </Td>
              <Td>{t.category}</Td>
              <Td>{nameById.get(t.raised_by) ?? '—'}</Td>
              <Td>{nameById.get(t.assigned_to ?? '') ?? 'Unassigned'}</Td>
              <Td>{formatDateTime(t.created_at)}</Td>
              <Td>{formatDateTime(t.closed_at)}</Td>
              <Td>
                <Badge
                  tone={STATUS_TONE[t.status as keyof typeof STATUS_TONE]}
                  data-testid="ticket-status"
                >
                  {t.status}
                </Badge>
              </Td>
              <Td>
                {isSlaBreached(t) ? (
                  <Badge tone="red" data-testid="sla-badge">
                    <AlertTriangle className="mr-1 inline size-3" />
                    breached
                  </Badge>
                ) : (
                  <span className="text-xs text-slate-400">on track</span>
                )}
              </Td>
              {hasActions && (
                <Td>
                  <div className="flex items-center justify-end gap-2">
                    {canEdit && (
                      <>
                        <Select
                          aria-label={`Assign ${t.subject}`}
                          value={t.assigned_to ?? ''}
                          onChange={(e) =>
                            update.mutate(
                              { id: t.id, assignedTo: e.target.value || null },
                              { onSuccess: () => toast.success('Assignee updated') },
                            )
                          }
                          className="h-8 w-40"
                        >
                          <option value="">Unassigned</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.full_name || user.email}
                            </option>
                          ))}
                        </Select>
                        <Select
                          data-testid="ticket-status-select"
                          value={t.status}
                          onChange={(e) =>
                            update.mutate(
                              { id: t.id, status: e.target.value as Ticket['status'] },
                              { onSuccess: () => toast.success('Updated') },
                            )
                          }
                          className="h-8 w-32"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                      </>
                    )}
                    {canEdit && !t.escalated && (
                      <button
                        data-testid="escalate-ticket"
                        aria-label={`Escalate ${t.subject}`}
                        className="text-slate-400 hover:text-red-600"
                        onClick={() =>
                          update.mutate(
                            { id: t.id, escalated: true },
                            { onSuccess: () => toast.info('Escalated') },
                          )
                        }
                      >
                        <ArrowUpCircle className="size-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        aria-label={`Delete ${t.subject}`}
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => setDeleting(t)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </Td>
              )}
            </tr>
          ))}
        </Tbody>
      </Table>
      {deleting && (
        <ConfirmDialog
          title="Delete helpdesk ticket"
          message={
            <>
              Delete <strong>{deleting.subject}</strong>? Its update history will also be removed.
            </>
          }
          confirmLabel="Delete ticket"
          loading={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate(deleting.id, {
              onSuccess: () => {
                toast.success('Ticket deleted')
                setDeleting(null)
              },
              onError: (error) => toast.error('Delete failed', (error as Error).message),
            })
          }
        />
      )}
    </div>
  )
}
