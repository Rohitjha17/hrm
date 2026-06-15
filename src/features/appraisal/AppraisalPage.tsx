import { useMyAppraisals } from './hooks'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

interface CycleInfo {
  name: string
  cycle_type: string
  period_start: string
  period_end: string
}

export function AppraisalPage() {
  const { data: appraisals = [], isLoading } = useMyAppraisals()

  return (
    <div data-testid="appraisal-page">
      <PageHeader title="My Appraisals" description="Your performance reviews and recommendations." />
      {!isLoading && appraisals.length === 0 ? (
        <EmptyState title="No appraisals yet" testid="appraisal-empty" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {appraisals.map((a) => {
            const cycle = a.cycle as CycleInfo | null
            return (
              <Card key={a.id} data-testid="appraisal-card">
                <CardBody className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{cycle?.name}</p>
                    <Badge tone="brand">{a.overall_score}</Badge>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    <Score label="Attendance" value={a.attendance_score} />
                    <Score label="Tasks" value={a.task_score} />
                    <Score label="Planning" value={a.planning_score} />
                  </dl>
                  <div className="flex items-center gap-2 pt-1 text-sm">
                    <span className="text-slate-500">Increment:</span>
                    <span className="font-medium">{a.increment_recommendation}%</span>
                    {a.promotion_recommended && <Badge tone="green">Promotion recommended</Badge>}
                  </div>
                  {a.manager_feedback && (
                    <p className="text-sm text-slate-600">“{a.manager_feedback}”</p>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold text-slate-800">{value}</p>
    </div>
  )
}
