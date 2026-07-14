import { useState } from 'react'
import { Calculator, Eye, Plus, Trash2, Users } from 'lucide-react'
import {
  useAddAllEmployees,
  useAppraisals,
  useComputeAll,
  useComputeAppraisal,
  useCreateAppraisal,
  useCreateCycle,
  useCycles,
  useDeleteAppraisal,
  useDeleteCycle,
  useUpdateAppraisal,
  type AppraisalRow,
} from './hooks'
import { AppraisalHistoryList, RatingStars } from './components'
import { useUsers } from '@/features/admin/users/hooks'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { cn } from '@/lib/cn'

export function AppraisalAdminPage() {
  const { data: cycles = [] } = useCycles()
  const { data: users = [] } = useUsers()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = cycles.find((c) => c.id === selectedId) ?? cycles[0] ?? null
  const { data: appraisals = [] } = useAppraisals(selected?.id ?? null)
  const compute = useComputeAppraisal()
  const addAll = useAddAllEmployees()
  const computeAll = useComputeAll()
  const deleteAppraisal = useDeleteAppraisal()
  const deleteCycle = useDeleteCycle()
  const toast = useToast()
  const [cycleModal, setCycleModal] = useState(false)
  const [apprModal, setApprModal] = useState(false)
  const [detailRow, setDetailRow] = useState<AppraisalRow | null>(null)
  const [confirmRemoveRow, setConfirmRemoveRow] = useState<AppraisalRow | null>(null)
  const [confirmDeleteCycle, setConfirmDeleteCycle] = useState(false)

  return (
    <div data-testid="appraisal-admin-page">
      <PageHeader
        title="Appraisals"
        description="Define a review period, add employees, and score them from real attendance, task & planning data."
        actions={
          <Button data-testid="new-cycle-button" onClick={() => setCycleModal(true)}>
            <Plus className="size-4" /> New period
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card>
          <CardBody className="space-y-1">
            {cycles.length === 0 && (
              <p className="text-sm text-slate-500">No review periods yet.</p>
            )}
            {cycles.map((c) => (
              <button
                key={c.id}
                data-testid="cycle-item"
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  'flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm',
                  selected?.id === c.id ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-100',
                )}
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-slate-400">
                  {c.period_start} → {c.period_end}
                </span>
              </button>
            ))}
          </CardBody>
        </Card>

        {selected && (
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <h2 className="text-lg font-semibold text-slate-900">{selected.name}</h2>
                <button
                  data-testid="delete-cycle"
                  aria-label={`Delete review period ${selected.name}`}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  onClick={() => setConfirmDeleteCycle(true)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="add-all-employees"
                  loading={addAll.isPending}
                  onClick={() =>
                    addAll.mutate(
                      { cycleId: selected.id, userIds: users.map((u) => u.id) },
                      {
                        onSuccess: () => toast.success('All employees added'),
                        onError: (e) => toast.error('Failed', (e as Error).message),
                      },
                    )
                  }
                >
                  <Users className="size-4" /> Add all employees
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="compute-all"
                  loading={computeAll.isPending}
                  disabled={appraisals.length === 0}
                  onClick={() =>
                    computeAll.mutate(
                      appraisals.map((a) => a.id),
                      {
                        onSuccess: () => toast.success('All scores computed'),
                        onError: (e) => toast.error('Failed', (e as Error).message),
                      },
                    )
                  }
                >
                  <Calculator className="size-4" /> Compute all
                </Button>
                <Button
                  size="sm"
                  data-testid="add-appraisal-button"
                  onClick={() => setApprModal(true)}
                >
                  <Plus className="size-4" /> Add appraisal
                </Button>
              </div>
            </div>
            <Table data-testid="appraisals-table">
              <Thead>
                <tr>
                  <Th>Employee</Th>
                  <Th>Performance</Th>
                  <Th>Att</Th>
                  <Th>Task</Th>
                  <Th>Plan</Th>
                  <Th>Overall</Th>
                  <Th>Increment</Th>
                  <Th>Promotion</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </Thead>
              <Tbody>
                {appraisals.map((a) => (
                  <tr key={a.id} data-testid={`appraisal-row-${a.employee?.email}`}>
                    <Td className="font-medium text-slate-900">
                      {a.employee?.full_name || a.employee?.email}
                    </Td>
                    <Td>
                      <RatingStars value={a.performance_rating} />
                    </Td>
                    <Td>{a.attendance_score}</Td>
                    <Td>{a.task_score}</Td>
                    <Td>{a.planning_score}</Td>
                    <Td className="font-semibold" data-testid="appraisal-overall">
                      {a.overall_score}
                    </Td>
                    <Td data-testid="appraisal-increment">{a.increment_recommendation}%</Td>
                    <Td>
                      {a.promotion_recommended ? (
                        <Badge tone="green" data-testid="appraisal-promotion">
                          Recommended
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`appraisal-details-${a.employee?.email}`}
                          onClick={() => setDetailRow(a)}
                        >
                          <Eye className="size-4" /> Details
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid="compute-appraisal"
                          loading={compute.isPending}
                          onClick={() =>
                            compute.mutate(a.id, {
                              onSuccess: () => toast.success('Scores computed'),
                              onError: (e) => toast.error('Failed', (e as Error).message),
                            })
                          }
                        >
                          <Calculator className="size-4" /> Compute
                        </Button>
                        <button
                          data-testid={`remove-appraisal-${a.employee?.email}`}
                          aria-label={`Remove ${a.employee?.full_name || a.employee?.email} from this period`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          onClick={() => setConfirmRemoveRow(a)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          </div>
        )}
      </div>

      {cycleModal && <CycleModal onClose={() => setCycleModal(false)} />}
      {apprModal && selected && (
        <AppraisalModal cycleId={selected.id} onClose={() => setApprModal(false)} />
      )}
      {detailRow && <DetailsModal appraisal={detailRow} onClose={() => setDetailRow(null)} />}
      {confirmRemoveRow && selected && (
        <ConfirmDialog
          title="Remove from period"
          testid="remove-appraisal-dialog"
          confirmLabel="Remove employee"
          loading={deleteAppraisal.isPending}
          onClose={() => setConfirmRemoveRow(null)}
          message={
            <p>
              Remove{' '}
              <span className="font-semibold text-slate-900">
                {confirmRemoveRow.employee?.full_name || confirmRemoveRow.employee?.email}
              </span>{' '}
              from <span className="font-semibold text-slate-900">{selected.name}</span>? Their
              scores, feedback and change history for this period will be deleted. This action
              cannot be undone.
            </p>
          }
          onConfirm={() =>
            deleteAppraisal.mutate(confirmRemoveRow.id, {
              onSuccess: () => {
                toast.success('Employee removed from period')
                setConfirmRemoveRow(null)
              },
              onError: (err) => toast.error('Remove failed', (err as Error).message),
            })
          }
        />
      )}
      {confirmDeleteCycle && selected && (
        <ConfirmDialog
          title="Delete review period"
          testid="delete-cycle-dialog"
          confirmLabel="Delete period"
          loading={deleteCycle.isPending}
          onClose={() => setConfirmDeleteCycle(false)}
          message={
            <p>
              Delete <span className="font-semibold text-slate-900">{selected.name}</span> (
              {selected.period_start} → {selected.period_end})
              {appraisals.length > 0 && (
                <>
                  {' '}
                  including{' '}
                  <span className="font-semibold text-slate-900">{appraisals.length}</span> employee
                  appraisal{appraisals.length === 1 ? '' : 's'}
                </>
              )}
              ? All scores, feedback and change history in this period will be deleted. This action
              cannot be undone.
            </p>
          }
          onConfirm={() =>
            deleteCycle.mutate(selected.id, {
              onSuccess: () => {
                toast.success('Review period deleted')
                setSelectedId(null)
                setConfirmDeleteCycle(false)
              },
              onError: (err) => toast.error('Delete failed', (err as Error).message),
            })
          }
        />
      )}
    </div>
  )
}

function DetailsModal({ appraisal, onClose }: { appraisal: AppraisalRow; onClose: () => void }) {
  const update = useUpdateAppraisal()
  const toast = useToast()
  const [rating, setRating] = useState(
    appraisal.performance_rating ? String(appraisal.performance_rating) : '',
  )
  const [kra, setKra] = useState(appraisal.kra ?? '')
  const [kpi, setKpi] = useState(appraisal.kpi ?? '')
  const [managerFeedback, setManagerFeedback] = useState(appraisal.manager_feedback ?? '')
  const [hrFeedback, setHrFeedback] = useState(appraisal.hr_feedback ?? '')

  return (
    <Modal
      open
      onClose={onClose}
      title={`Appraisal · ${appraisal.employee?.full_name || appraisal.employee?.email}`}
      testid="appraisal-details-modal"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Attendance', value: appraisal.attendance_score },
            { label: 'Task', value: appraisal.task_score },
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
          <span className="text-slate-500">
            Increment{' '}
            <span className="font-semibold text-slate-800">
              {appraisal.increment_recommendation}%
            </span>
          </span>
          <span>
            {appraisal.promotion_recommended ? (
              <Badge tone="green">Promotion recommended</Badge>
            ) : (
              <Badge tone="slate">No promotion</Badge>
            )}
          </span>
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            update.mutate(
              {
                id: appraisal.id,
                performanceRating: rating ? Number(rating) : null,
                managerFeedback,
                hrFeedback,
                kra,
                kpi,
              },
              {
                onSuccess: () => {
                  toast.success('Appraisal updated')
                  onClose()
                },
                onError: (err) => toast.error('Save failed', (err as Error).message),
              },
            )
          }}
        >
          <div>
            <Label htmlFor="det-rating">Performance rating (1–5)</Label>
            <Select
              id="det-rating"
              data-testid="details-rating"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            >
              <option value="">Not rated</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="det-kra">KRA — Key Result Areas</Label>
            <Textarea
              id="det-kra"
              data-testid="details-kra"
              rows={2}
              value={kra}
              onChange={(e) => setKra(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="det-kpi">KPI — Key Performance Indicators</Label>
            <Textarea
              id="det-kpi"
              data-testid="details-kpi"
              rows={2}
              value={kpi}
              onChange={(e) => setKpi(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="det-mgr">Manager feedback</Label>
            <Textarea
              id="det-mgr"
              data-testid="details-manager-feedback"
              rows={2}
              value={managerFeedback}
              onChange={(e) => setManagerFeedback(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="det-hr">HR feedback</Label>
            <Textarea
              id="det-hr"
              data-testid="details-hr-feedback"
              rows={2}
              value={hrFeedback}
              onChange={(e) => setHrFeedback(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" data-testid="save-appraisal-details" loading={update.isPending}>
              Save
            </Button>
          </div>
        </form>

        <AppraisalHistoryList appraisalId={appraisal.id} />
      </div>
    </Modal>
  )
}

function CycleModal({ onClose }: { onClose: () => void }) {
  const create = useCreateCycle()
  const toast = useToast()
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  return (
    <Modal open onClose={onClose} title="New review period" testid="cycle-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            { name: name.trim(), periodStart: start, periodEnd: end },
            {
              onSuccess: () => {
                toast.success('Review period created')
                onClose()
              },
              onError: (err) => toast.error('Failed', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="cyc-name">Name</Label>
          <Input
            id="cyc-name"
            data-testid="cycle-name"
            placeholder="e.g. April 2026 Review"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cyc-start">From</Label>
            <Input
              id="cyc-start"
              data-testid="cycle-start"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="cyc-end">To</Label>
            <Input
              id="cyc-end"
              data-testid="cycle-end"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="create-cycle-submit" loading={create.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function AppraisalModal({ cycleId, onClose }: { cycleId: string; onClose: () => void }) {
  const create = useCreateAppraisal()
  const { data: users = [] } = useUsers()
  const toast = useToast()
  const [userId, setUserId] = useState('')
  const [rating, setRating] = useState('4')
  const [managerFeedback, setManagerFeedback] = useState('')
  const [hrFeedback, setHrFeedback] = useState('')
  const [kra, setKra] = useState('')
  const [kpi, setKpi] = useState('')

  return (
    <Modal open onClose={onClose} title="Add appraisal" testid="appraisal-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            {
              cycleId,
              userId: userId || users[0]?.id,
              performanceRating: Number(rating),
              managerFeedback,
              hrFeedback,
              kra,
              kpi,
            },
            {
              onSuccess: () => {
                toast.success('Appraisal added')
                onClose()
              },
              onError: (err) => toast.error('Failed', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="appr-user">Employee</Label>
          <Select
            id="appr-user"
            data-testid="appraisal-user-select"
            value={userId || users[0]?.id || ''}
            onChange={(e) => setUserId(e.target.value)}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="appr-rating">Performance rating (1–5)</Label>
          <Select
            id="appr-rating"
            data-testid="appraisal-rating"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="appr-kra">KRA — Key Result Areas</Label>
          <Textarea
            id="appr-kra"
            data-testid="appraisal-kra"
            rows={2}
            value={kra}
            onChange={(e) => setKra(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="appr-kpi">KPI — Key Performance Indicators</Label>
          <Textarea
            id="appr-kpi"
            data-testid="appraisal-kpi"
            rows={2}
            value={kpi}
            onChange={(e) => setKpi(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="appr-fb">Manager feedback</Label>
          <Textarea
            id="appr-fb"
            data-testid="appraisal-manager-feedback"
            rows={2}
            value={managerFeedback}
            onChange={(e) => setManagerFeedback(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="appr-hr">HR feedback</Label>
          <Textarea
            id="appr-hr"
            data-testid="appraisal-hr-feedback"
            rows={2}
            value={hrFeedback}
            onChange={(e) => setHrFeedback(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="create-appraisal-submit" loading={create.isPending}>
            Add
          </Button>
        </div>
      </form>
    </Modal>
  )
}
