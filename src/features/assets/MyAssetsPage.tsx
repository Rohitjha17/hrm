import { useMyAssets } from './hooks'
import { useAuth } from '@/features/auth/auth-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

/** Employee view: every asset the company has assigned to you. */
export function MyAssetsPage() {
  const { user } = useAuth()
  const { data: rows = [], isLoading } = useMyAssets(user?.id ?? null)

  return (
    <div data-testid="my-assets-page">
      <PageHeader title="My Assets" description="Company assets assigned to you, past and present." />
      {!isLoading && rows.length === 0 ? (
        <EmptyState title="No assets assigned to you" testid="my-assets-empty" />
      ) : (
        <Table data-testid="my-assets-table">
          <Thead>
            <tr>
              <Th>Asset</Th>
              <Th>Type</Th>
              <Th>Serial no</Th>
              <Th>Batch no</Th>
              <Th>Assigned on</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {rows.map((r) => (
              <tr key={r.id} data-testid="my-asset-row">
                <Td className="font-medium text-slate-900">{r.asset?.name ?? '—'}</Td>
                <Td>{r.asset?.asset_type ?? '—'}</Td>
                <Td className="font-mono text-xs">{r.asset?.serial || '—'}</Td>
                <Td className="font-mono text-xs">{r.asset?.batch_no || '—'}</Td>
                <Td>{new Date(r.assigned_at).toLocaleDateString()}</Td>
                <Td>
                  {r.returned_at ? (
                    <Badge tone="slate" data-testid="my-asset-status">
                      returned {new Date(r.returned_at).toLocaleDateString()}
                    </Badge>
                  ) : (
                    <Badge tone="green" data-testid="my-asset-status">
                      with you
                    </Badge>
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
