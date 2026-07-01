import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  useApplyLeave,
  useCancelLeave,
  useLeaveRealtime,
  useLeaveTypes,
  useMyBalances,
  useMyLeaveRequests,
} from './hooks'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

const STATUS_TONE = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  cancelled: 'slate',
} as const

export function LeavePage() {
  useLeaveRealtime()
  const { data: balances = [] } = useMyBalances()
  const { data: requests = [], isLoading } = useMyLeaveRequests()
  const cancel = useCancelLeave()
  const toast = useToast()
  const [applyOpen, setApplyOpen] = useState(false)

  const totalAllocated = balances.reduce((s, b) => s + Number(b.allocated), 0)
  const totalUsed = balances.reduce((s, b) => s + Number(b.used), 0)
  const totalRemaining = totalAllocated - totalUsed
  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const approvedCount = requests.filter((r) => r.status === 'approved').length

  return (
    <div data-testid="leave-page">
      <PageHeader
        title="Leave"
        description="Apply for leave and track your balances and requests."
        actions={
          <Button data-testid="apply-leave-button" onClick={() => setApplyOpen(true)}>
            <Plus className="size-4" /> Apply for leave
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="leave-insights">
        {[
          { label: 'Total entitled', value: totalAllocated, tone: 'text-slate-900' },
          { label: 'Used', value: totalUsed, tone: 'text-amber-600' },
          { label: 'Remaining', value: totalRemaining, tone: 'text-emerald-600', testid: 'leave-remaining-total' },
          { label: 'Approved', value: approvedCount, tone: 'text-slate-900' },
          { label: 'Pending', value: pendingCount, tone: 'text-slate-900' },
        ].map((s) => (
          <Card key={s.label}>
            <CardBody>
              <p className="text-sm font-medium text-slate-500">{s.label}</p>
              <p className={`mt-1 text-2xl font-bold ${s.tone}`} data-testid={s.testid}>
                {s.value}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-semibold text-slate-700">Balance by leave type</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {balances.map((b) => (
          <Card key={b.id} data-testid={`balance-${b.leave_type?.name}`}>
            <CardBody>
              <p className="text-sm font-medium text-slate-500">{b.leave_type?.name}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {Number(b.allocated) - Number(b.used)}
                <span className="text-sm font-normal text-slate-400"> left</span>
              </p>
              <p className="text-xs text-slate-400">
                Used {b.used} of {b.allocated}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      {!isLoading && requests.length === 0 ? (
        <EmptyState title="No leave requests yet" testid="leave-empty" />
      ) : (
        <Table data-testid="my-leave-table">
          <Thead>
            <tr>
              <Th>Type</Th>
              <Th>From</Th>
              <Th>To</Th>
              <Th>Days</Th>
              <Th>Status</Th>
              <Th>Admin remark</Th>
              <Th className="w-px" />
            </tr>
          </Thead>
          <Tbody>
            {requests.map((r) => (
              <tr key={r.id} data-testid="leave-row">
                <Td className="font-medium text-slate-900">{r.leave_type?.name}</Td>
                <Td>{r.start_date}</Td>
                <Td>{r.end_date}</Td>
                <Td>{r.days}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE]} data-testid="leave-status">
                    {r.status}
                  </Badge>
                </Td>
                <Td className="max-w-xs text-xs text-slate-500" data-testid="leave-admin-remark">
                  {r.admin_remarks || r.decision_remarks || <span className="text-slate-300">—</span>}
                </Td>
                <Td>
                  {r.status === 'pending' && (
                    <button
                      data-testid="cancel-leave"
                      className="text-xs font-medium text-slate-500 hover:text-red-600"
                      onClick={() => cancel.mutate(r.id, { onSuccess: () => toast.info('Leave cancelled') })}
                    >
                      Cancel
                    </button>
                  )}
                </Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      )}

      {applyOpen && <ApplyModal onClose={() => setApplyOpen(false)} />}
    </div>
  )
}

function ApplyModal({ onClose }: { onClose: () => void }) {
  const { data: types = [] } = useLeaveTypes()
  const apply = useApplyLeave()
  const toast = useToast()
  const [leaveTypeId, setLeaveTypeId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  return (
    <Modal open onClose={onClose} title="Apply for leave" testid="leave-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          apply.mutate(
            { leaveTypeId: leaveTypeId || types[0]?.id, startDate, endDate, reason },
            {
              onSuccess: () => {
                toast.success('Leave applied')
                onClose()
              },
              onError: (err) => toast.error('Could not apply', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="leave-type">Type</Label>
          <Select id="leave-type" data-testid="leave-type-select" value={leaveTypeId || types[0]?.id || ''} onChange={(e) => setLeaveTypeId(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="leave-start">From</Label>
            <Input id="leave-start" data-testid="leave-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="leave-end">To</Label>
            <Input id="leave-end" data-testid="leave-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
        </div>
        <div>
          <Label htmlFor="leave-reason">Reason</Label>
          <Textarea id="leave-reason" data-testid="leave-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="submit-leave" loading={apply.isPending}>
            Submit
          </Button>
        </div>
      </form>
    </Modal>
  )
}
