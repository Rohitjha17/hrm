import { useState } from 'react'
import { Calculator, Plus } from 'lucide-react'
import {
  useAppraisals,
  useComputeAppraisal,
  useCreateAppraisal,
  useCreateCycle,
  useCycles,
} from './hooks'
import { useUsers } from '@/features/admin/users/hooks'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { cn } from '@/lib/cn'

export function AppraisalAdminPage() {
  const { data: cycles = [] } = useCycles()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = cycles.find((c) => c.id === selectedId) ?? cycles[0] ?? null
  const { data: appraisals = [] } = useAppraisals(selected?.id ?? null)
  const compute = useComputeAppraisal()
  const toast = useToast()
  const [cycleModal, setCycleModal] = useState(false)
  const [apprModal, setApprModal] = useState(false)

  return (
    <div data-testid="appraisal-admin-page">
      <PageHeader
        title="Appraisals"
        description="Score employees from real attendance, task & planning data."
        actions={
          <Button data-testid="new-cycle-button" onClick={() => setCycleModal(true)}>
            <Plus className="size-4" /> New cycle
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card>
          <CardBody className="space-y-1">
            {cycles.length === 0 && <p className="text-sm text-slate-500">No cycles yet.</p>}
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
                  {c.cycle_type} · {c.period_start} → {c.period_end}
                </span>
              </button>
            ))}
          </CardBody>
        </Card>

        {selected && (
          <div>
            <div className="mb-2 flex justify-end">
              <Button size="sm" data-testid="add-appraisal-button" onClick={() => setApprModal(true)}>
                <Plus className="size-4" /> Add appraisal
              </Button>
            </div>
            <Table data-testid="appraisals-table">
              <Thead>
                <tr>
                  <Th>Employee</Th>
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
                      <div className="flex justify-end">
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
    </div>
  )
}

function CycleModal({ onClose }: { onClose: () => void }) {
  const create = useCreateCycle()
  const toast = useToast()
  const [name, setName] = useState('')
  const [cycleType, setCycleType] = useState('monthly')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  return (
    <Modal open onClose={onClose} title="New appraisal cycle" testid="cycle-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            { name: name.trim(), cycleType, periodStart: start, periodEnd: end },
            {
              onSuccess: () => {
                toast.success('Cycle created')
                onClose()
              },
              onError: (err) => toast.error('Failed', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="cyc-name">Name</Label>
          <Input id="cyc-name" data-testid="cycle-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="cyc-type">Type</Label>
          <Select id="cyc-type" data-testid="cycle-type" value={cycleType} onChange={(e) => setCycleType(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="half_yearly">Half-Yearly</option>
            <option value="annual">Annual</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cyc-start">From</Label>
            <Input id="cyc-start" data-testid="cycle-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="cyc-end">To</Label>
            <Input id="cyc-end" data-testid="cycle-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
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
          <Select id="appr-user" data-testid="appraisal-user-select" value={userId || users[0]?.id || ''} onChange={(e) => setUserId(e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="appr-rating">Performance rating (1–5)</Label>
          <Select id="appr-rating" data-testid="appraisal-rating" value={rating} onChange={(e) => setRating(e.target.value)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="appr-fb">Manager feedback</Label>
          <Input id="appr-fb" value={managerFeedback} onChange={(e) => setManagerFeedback(e.target.value)} />
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
