import { Check, X } from 'lucide-react'
import { useActOnWorkflow, useInstances } from './hooks'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

const STATUS_TONE = { pending: 'amber', approved: 'green', rejected: 'red' } as const

export function ApprovalsPage() {
  const { data: instances = [], isLoading } = useInstances()
  const act = useActOnWorkflow()
  const toast = useToast()

  return (
    <div data-testid="approvals-page">
      <PageHeader title="Approvals" description="Items routed to you through approval workflows." />
      {!isLoading && instances.length === 0 ? (
        <EmptyState title="Nothing to approve" testid="approvals-empty" />
      ) : (
        <Table data-testid="approvals-table">
          <Thead>
            <tr>
              <Th>Request</Th>
              <Th>Workflow</Th>
              <Th>Step</Th>
              <Th>Status</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </Thead>
          <Tbody>
            {instances.map((i) => (
              <tr key={i.id} data-testid="instance-row">
                <Td className="font-medium text-slate-900">{i.title}</Td>
                <Td>{i.definition?.name}</Td>
                <Td data-testid="instance-step">{i.status === 'pending' ? `Step ${i.current_step}` : '—'}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[i.status as keyof typeof STATUS_TONE]} data-testid="instance-status">
                    {i.status}
                  </Badge>
                </Td>
                <Td>
                  {i.status === 'pending' && (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        data-testid="approve-instance"
                        loading={act.isPending}
                        onClick={() =>
                          act.mutate(
                            { instanceId: i.id, decision: 'approved' },
                            {
                              onSuccess: () => toast.success('Approved'),
                              onError: (e) => toast.error('Failed', (e as Error).message),
                            },
                          )
                        }
                      >
                        <Check className="size-4" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        data-testid="reject-instance"
                        onClick={() =>
                          act.mutate(
                            { instanceId: i.id, decision: 'rejected' },
                            { onSuccess: () => toast.info('Rejected') },
                          )
                        }
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
