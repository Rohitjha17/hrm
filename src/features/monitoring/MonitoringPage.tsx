import { Camera, Info } from 'lucide-react'
import { useCaptureScreenshot, useMyCaptures } from './hooks'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

export function MonitoringPage() {
  const { data: captures = [] } = useMyCaptures()
  const capture = useCaptureScreenshot()
  const toast = useToast()

  return (
    <div data-testid="monitoring-page">
      <PageHeader
        title="Monitoring"
        description="Opt-in screen capture."
        actions={
          <Button
            data-testid="capture-screenshot"
            loading={capture.isPending}
            onClick={() =>
              capture.mutate(undefined, {
                onSuccess: () => toast.success('Screenshot captured'),
                onError: (e) => toast.error('Capture failed', (e as Error).message),
              })
            }
          >
            <Camera className="size-4" /> Capture screenshot
          </Button>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800" data-testid="monitoring-limitation-note">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          This is <strong>opt-in</strong>: your browser asks for consent each time. Web apps cannot
          capture the screen silently or on a background timer — true background monitoring requires
          a separate native desktop agent (out of scope here).
        </p>
      </div>

      {captures.length === 0 ? (
        <EmptyState title="No captures yet" testid="captures-empty" />
      ) : (
        <Card>
          <CardBody>
            <Table data-testid="captures-table">
              <Thead>
                <tr>
                  <Th>Captured at</Th>
                  <Th>System</Th>
                  <Th>Activity</Th>
                </tr>
              </Thead>
              <Tbody>
                {captures.map((c) => (
                  <tr key={c.id} data-testid="capture-row">
                    <Td className="text-sm">{new Date(c.captured_at).toLocaleString()}</Td>
                    <Td className="text-xs text-slate-500" data-testid="capture-system">{c.system_name}</Td>
                    <Td>
                      <Badge tone={c.activity_status === 'active' ? 'green' : 'slate'} data-testid="capture-activity">
                        {c.activity_status}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
