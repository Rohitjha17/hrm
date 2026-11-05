import { useMemo, useState } from 'react'
import { Calculator, Eye, Pencil, Plus, Trash2, Users } from 'lucide-react'
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
  useUpdateCycle,
  type AppraisalCycle,
  type AppraisalRow,
} from './hooks'
import { AppraisalHistoryList, RatingStars } from './components'
import { APPRAISAL_FORMULA, appraisalMarks, appraisalRating } from './scoring'
import { useUsers } from '@/features/admin/users/hooks'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { cn } from '@/lib/cn'
import { useMasterItems } from '@/features/admin/masters/hooks'

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
  const [editingCycle, setEditingCycle] = useState<AppraisalCycle | null>(null)
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
          <Button
            data-testid="new-cycle-button"
            onClick={() => {
              setEditingCycle(null)
              setCycleModal(true)
            }}
          >
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
                  data-testid="edit-cycle"
                  aria-label={`Edit review period ${selected.name}`}
                  className="hover:bg-brand-50 hover:text-brand-600 rounded p-1 text-slate-400"
                  onClick={() => {
                    setEditingCycle(selected)
                    setCycleModal(true)
                  }}
                >
                  <Pencil className="size-4" />
                </button>
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
                  <Th>Final rating</Th>
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
                    <Td>
                      {appraisalRating(a.overall_score).code} ·{' '}
                      {appraisalRating(a.overall_score).label}
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

      {cycleModal && <CycleModal cycle={editingCycle} onClose={() => setCycleModal(false)} />}
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
  const marks = appraisalMarks(
    appraisal.attendance_score,
    appraisal.task_score,
    appraisal.planning_score,
  )
  const finalRating = appraisalRating(appraisal.overall_score)

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
          <Badge tone="green">
            Final rating: {finalRating.code} · {finalRating.label}
          </Badge>
          <span className="text-slate-600">
            Marks: <strong>{marks.obtained}</strong> / {marks.total}
          </span>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-semibold">Score formula and weightage</p>
          <p className="mt-1">{APPRAISAL_FORMULA}</p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Employee remarks
          </p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
            {appraisal.employee_feedback || <span className="text-slate-300">—</span>}
          </p>
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

function CycleModal({ cycle, onClose }: { cycle: AppraisalCycle | null; onClose: () => void }) {
  const create = useCreateCycle()
  const update = useUpdateCycle()
  const { data: appraisalTypes = [] } = useMasterItems('appraisal_types')
  const toast = useToast()
  const [name, setName] = useState(cycle?.name ?? '')
  const [start, setStart] = useState(cycle?.period_start ?? '')
  const [end, setEnd] = useState(cycle?.period_end ?? '')
  const [cycleType, setCycleType] = useState(cycle?.cycle_type ?? '')
  const isSaving = cycle ? update.isPending : create.isPending

  // Year + month + quick preset selectors drive the From/To date pickers so
  // admins don't have to type dates manually (client requirement: "sara
  // calender me year and date choose krne ka option aaye same like drop down").
  const years = useMemo(() => {
    const now = new Date().getFullYear()
    return Array.from({ length: 11 }, (_, i) => now - 5 + i)
  }, [])

  function pad(n: number) {
    return String(n).padStart(2, '0')
  }
  function lastDay(year: number, monthIdx: number) {
    return new Date(year, monthIdx + 1, 0).getDate()
  }
  function applyPreset(preset: 'month' | 'quarter' | 'half' | 'year', year: number, monthIdx: number) {
    const spans: Record<typeof preset, number> = { month: 1, quarter: 3, half: 6, year: 12 }
    const monthsForward = spans[preset] - 1
    const lastMonthIdx = monthIdx + monthsForward
    const endYear = year + Math.floor(lastMonthIdx / 12)
    const endMonth = lastMonthIdx % 12
    setStart(`${year}-${pad(monthIdx + 1)}-01`)
    setEnd(`${endYear}-${pad(endMonth + 1)}-${pad(lastDay(endYear, endMonth))}`)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={cycle ? 'Edit review period' : 'New review period'}
      testid="cycle-modal"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (end < start) {
            toast.error('Invalid period', 'End date must be on or after the start date')
            return
          }
          const values = {
            name: name.trim(),
            periodStart: start,
            periodEnd: end,
            cycleType: cycleType || appraisalTypes.find((type) => type.is_active)?.name,
          }
          const options = {
            onSuccess: () => {
              toast.success(cycle ? 'Review period updated' : 'Review period created')
              onClose()
            },
            onError: (err: Error) => toast.error('Failed', err.message),
          }
          if (cycle) update.mutate({ ...values, id: cycle.id }, options)
          else create.mutate(values, options)
        }}
      >
        <div>
          <Label htmlFor="cyc-type">Appraisal type</Label>
          <Select
            id="cyc-type"
            value={cycleType || appraisalTypes.find((type) => type.is_active)?.name || ''}
            onChange={(event) => setCycleType(event.target.value)}
            required
          >
            {appraisalTypes
              .filter((type) => type.is_active)
              .map((type) => (
                <option key={type.id} value={type.name}>
                  {type.name}
                </option>
              ))}
          </Select>
        </div>
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
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Quick period picker
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <Label htmlFor="cyc-year" className="text-xs">Year</Label>
              <Select
                id="cyc-year"
                data-testid="cycle-year"
                value={start ? Number(start.slice(0, 4)) : new Date().getFullYear()}
                onChange={(e) => {
                  const y = Number(e.target.value)
                  const m = start ? Number(start.slice(5, 7)) - 1 : 0
                  applyPreset('year', y, m)
                }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="cyc-month" className="text-xs">Starts in month</Label>
              <Select
                id="cyc-month"
                data-testid="cycle-month"
                value={start ? Number(start.slice(5, 7)) - 1 : 0}
                onChange={(e) => {
                  const m = Number(e.target.value)
                  const y = start
                    ? Number(start.slice(0, 4))
                    : new Date().getFullYear()
                  applyPreset('month', y, m)
                }}
              >
                {['January','February','March','April','May','June','July','August','September','October','November','December'].map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Fill period</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {(['month','quarter','half','year'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    data-testid={`cycle-preset-${preset}`}
                    onClick={() => {
                      const y = start ? Number(start.slice(0,4)) : new Date().getFullYear()
                      const m = start ? Number(start.slice(5,7)) - 1 : 0
                      applyPreset(preset, y, m)
                    }}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-brand-300 hover:text-brand-700"
                  >
                    {preset === 'month' ? 'Monthly' : preset === 'quarter' ? 'Quarterly' : preset === 'half' ? 'Half-yearly' : 'Yearly'}
                  </button>
                ))}
              </div>
            </div>
          </div>
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
          <Button type="submit" data-testid="create-cycle-submit" loading={isSaving}>
            {cycle ? 'Save changes' : 'Create'}
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
