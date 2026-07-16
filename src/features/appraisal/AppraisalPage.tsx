import { useState } from 'react'
import { Eye } from 'lucide-react'
import { useMyAppraisals } from './hooks'
import { AppraisalHistoryList, RatingStars } from './components'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'

interface CycleInfo {
  name: string
  cycle_type: string | null
  period_start: string
  period_end: string
}

type MyAppraisal = NonNullable<ReturnType<typeof useMyAppraisals>['data']>[number]

export function AppraisalPage() {
  const { data: appraisals = [], isLoading } = useMyAppraisals()
  const [detail, setDetail] = useState<MyAppraisal | null>(null)

  return (
    <div data-testid="appraisal-page">
      <PageHeader
        title="My Appraisals"
        description="Your performance reviews, feedback and recommendations."
      />
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
                    <div>
                      <p className="font-semibold text-slate-900">{cycle?.name}</p>
                      <p className="text-xs text-slate-400">
                        {cycle?.period_start} → {cycle?.period_end}
                      </p>
                    </div>
                    <Badge tone="brand">{a.overall_score}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">Performance</span>
                    <RatingStars value={a.performance_rating} />
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    <Score label="Attendance" value={a.attendance_score} />
                    <Score label="Tasks" value={a.task_score} />
                    <Score label="Planning" value={a.planning_score} />
                  </dl>
                  {a.manager_feedback && (
                    <p className="text-sm text-slate-600">“{a.manager_feedback}”</p>
                  )}
                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="my-appraisal-details"
                      onClick={() => setDetail(a)}
                    >
                      <Eye className="size-4" /> Full details
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      {detail && <MyAppraisalModal appraisal={detail} onClose={() => setDetail(null)} />}
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

/** Everything the employee is allowed to see about one review, incl. history. */
function MyAppraisalModal({ appraisal, onClose }: { appraisal: MyAppraisal; onClose: () => void }) {
  const cycle = appraisal.cycle as CycleInfo | null

  return (
    <Modal open onClose={onClose} title={`Appraisal · ${cycle?.name ?? ''}`} testid="my-appraisal-modal">
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Review period {cycle?.period_start} → {cycle?.period_end}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Attendance', value: appraisal.attendance_score },
            { label: 'Tasks', value: appraisal.task_score },
            { label: 'Planning', value: appraisal.planning_score },
            { label: 'Overall', value: appraisal.overall_score },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-lg font-bold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span className="text-slate-500">Performance</span>
            <RatingStars value={appraisal.performance_rating} />
          </span>
        </div>

        <dl className="space-y-3 text-sm">
          {[
            { label: 'KRA — Key Result Areas', value: appraisal.kra, testid: 'my-appraisal-kra' },
            { label: 'KPI — Key Performance Indicators', value: appraisal.kpi, testid: 'my-appraisal-kpi' },
            { label: 'Manager feedback', value: appraisal.manager_feedback, testid: 'my-appraisal-manager-feedback' },
            { label: 'HR feedback', value: appraisal.hr_feedback, testid: 'my-appraisal-hr-feedback' },
          ].map((f) => (
            <div key={f.label}>
              <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                {f.label}
              </dt>
              <dd className="whitespace-pre-wrap text-slate-700" data-testid={f.testid}>
                {f.value || <span className="text-slate-300">—</span>}
              </dd>
            </div>
          ))}
        </dl>

        <AppraisalHistoryList appraisalId={appraisal.id} />
      </div>
    </Modal>
  )
}
