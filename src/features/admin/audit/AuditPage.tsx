import { useAuditLog, useActorMap } from './hooks'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

const actionTone = {
  insert: 'green',
  update: 'amber',
  delete: 'red',
} as const

export function AuditPage() {
  const { data: entries = [], isLoading } = useAuditLog()
  const { data: actors } = useActorMap()

  return (
    <div data-testid="audit-page">
      <PageHeader
        title="Audit Log"
        description="Append-only trail of sensitive changes: who, what, and when."
      />

      {!isLoading && entries.length === 0 ? (
        <EmptyState title="No audit entries yet" testid="audit-empty" />
      ) : (
        <Table data-testid="audit-table">
          <Thead>
            <tr>
              <Th>When</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Entity</Th>
            </tr>
          </Thead>
          <Tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap text-xs text-slate-500">
                  {new Date(e.created_at).toLocaleString()}
                </Td>
                <Td>{e.actor_id ? (actors?.get(e.actor_id) ?? 'Unknown') : 'System'}</Td>
                <Td>
                  <Badge tone={actionTone[e.action as keyof typeof actionTone] ?? 'slate'}>
                    {e.action}
                  </Badge>
                </Td>
                <Td className="font-medium text-slate-800">{e.entity_type}</Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
