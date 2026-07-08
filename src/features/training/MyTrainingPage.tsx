import { CheckCircle2, ExternalLink } from 'lucide-react'
import {
  getTrainingAttachmentUrl,
  useMyTrainings,
  useProgressAssignment,
  useTrainingAttachments,
  type MyAssignmentRow,
} from './hooks'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

const STATUS_TONE: Record<string, 'slate' | 'blue' | 'green'> = {
  assigned: 'slate',
  completed: 'blue',
  acknowledged: 'green',
}

export function MyTrainingPage() {
  const { data: trainings = [], isLoading } = useMyTrainings()

  return (
    <div data-testid="my-training-page">
      <PageHeader
        title="My Training"
        description="Trainings assigned to you — read the material, mark it complete, then acknowledge."
      />

      {!isLoading && trainings.length === 0 ? (
        <EmptyState title="No trainings assigned yet" testid="my-training-empty" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {trainings.map((t) => (
            <TrainingCard key={t.id} assignment={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function TrainingCard({ assignment }: { assignment: MyAssignmentRow }) {
  const { data: attachments = [] } = useTrainingAttachments(assignment.module_id)
  const progress = useProgressAssignment()
  const toast = useToast()

  return (
    <Card data-testid={`my-training-${assignment.module?.title ?? assignment.module_id}`}>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900">{assignment.module?.title ?? '—'}</h3>
          <Badge tone={STATUS_TONE[assignment.status] ?? 'slate'} data-testid="my-training-status">
            {assignment.status}
          </Badge>
        </div>
        <p className="text-sm whitespace-pre-wrap text-slate-600">{assignment.module?.body}</p>

        {attachments.length > 0 && (
          <ul className="space-y-1">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded border border-slate-100 px-2 py-1.5 text-sm">
                <span className="truncate text-slate-700">{a.title}</span>
                <button
                  data-testid="my-attachment-view"
                  className="ml-2 flex shrink-0 items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                  onClick={async () => {
                    try {
                      const url = await getTrainingAttachmentUrl(a.storage_path)
                      window.open(url, '_blank', 'noopener')
                    } catch (err) {
                      toast.error('Could not open attachment', (err as Error).message)
                    }
                  }}
                >
                  <ExternalLink className="size-3" /> View
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 border-t border-slate-100 pt-2">
          {assignment.status === 'assigned' && (
            <Button
              size="sm"
              data-testid="mark-complete"
              loading={progress.isPending}
              onClick={() =>
                progress.mutate(
                  { id: assignment.id, status: 'completed' },
                  {
                    onSuccess: () => toast.success('Marked complete'),
                    onError: (err) => toast.error('Failed', (err as Error).message),
                  },
                )
              }
            >
              <CheckCircle2 className="size-4" /> Mark complete
            </Button>
          )}
          {assignment.status === 'completed' && (
            <Button
              size="sm"
              data-testid="acknowledge-training"
              loading={progress.isPending}
              onClick={() =>
                progress.mutate(
                  { id: assignment.id, status: 'acknowledged' },
                  {
                    onSuccess: () => toast.success('Training acknowledged'),
                    onError: (err) => toast.error('Failed', (err as Error).message),
                  },
                )
              }
            >
              <CheckCircle2 className="size-4" /> Acknowledge
            </Button>
          )}
          {assignment.status === 'acknowledged' && (
            <p className="text-xs text-slate-500">
              Acknowledged on {assignment.acknowledged_at ? new Date(assignment.acknowledged_at).toLocaleDateString() : '—'}
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
