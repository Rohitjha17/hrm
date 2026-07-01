import { useState } from 'react'
import { Check, MessageSquarePlus, Plus, Trash2, X } from 'lucide-react'
import {
  useAllLeaveRequests,
  useCreateHoliday,
  useDecideLeave,
  useDeleteHoliday,
  useHolidays,
  useLeaveRealtime,
  usePendingApprovals,
  useSetLeaveRemark,
  type LeaveRequestRow,
} from './hooks'
import { todayInTz } from '@/features/attendance/geo'
import { useProfile } from '@/features/rbac/profile-context'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Modal } from '@/components/ui/Modal'
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

function Stat({ label, value, tone = 'text-slate-900' }: { label: string; value: number | string; tone?: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
      </CardBody>
    </Card>
  )
}

export function LeaveApprovalsPage() {
  useLeaveRealtime()
  const { hasPermission } = useProfile()
  const canManageHolidays = hasPermission('holidays.manage')
  const { data: pending = [], isLoading } = usePendingApprovals()
  const { data: all = [] } = useAllLeaveRequests()
  const decide = useDecideLeave()
  const toast = useToast()
  const [remarkReq, setRemarkReq] = useState<LeaveRequestRow | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'>('all')

  const today = todayInTz('Asia/Kolkata')
  const approved = all.filter((r) => r.status === 'approved')
  const rejected = all.filter((r) => r.status === 'rejected')
  const onLeaveToday = approved.filter((r) => r.start_date <= today && r.end_date >= today).length
  const approvedDays = approved.reduce((s, r) => s + Number(r.days), 0)
  const filteredAll = statusFilter === 'all' ? all : all.filter((r) => r.status === statusFilter)

  return (
    <div data-testid="leave-approvals-page">
      <PageHeader title="Leave Approvals" description="Review and decide pending leave requests." />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="leave-admin-insights">
        <Stat label="Pending" value={pending.length} tone="text-amber-600" />
        <Stat label="Approved" value={approved.length} tone="text-emerald-600" />
        <Stat label="Rejected" value={rejected.length} tone="text-red-600" />
        <Stat label="On leave today" value={onLeaveToday} tone="text-blue-600" />
        <Stat label="Approved days (total)" value={approvedDays} />
      </div>

      {!isLoading && pending.length === 0 ? (
        <EmptyState title="No pending requests" testid="approvals-empty" />
      ) : (
        <Table data-testid="approvals-table">
          <Thead>
            <tr>
              <Th>Employee</Th>
              <Th>Type</Th>
              <Th>From</Th>
              <Th>To</Th>
              <Th>Days</Th>
              <Th className="text-right">Decision</Th>
            </tr>
          </Thead>
          <Tbody>
            {pending.map((r) => (
              <tr key={r.id} data-testid={`approval-row-${r.requester?.email}`}>
                <Td className="font-medium text-slate-900">{r.requester?.full_name || r.requester?.email}</Td>
                <Td>{r.leave_type?.name}</Td>
                <Td>{r.start_date}</Td>
                <Td>{r.end_date}</Td>
                <Td>{r.days}</Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      data-testid="approve-leave"
                      loading={decide.isPending}
                      onClick={() =>
                        decide.mutate(
                          { id: r.id, decision: 'approved' },
                          { onSuccess: () => toast.success('Approved'), onError: (e) => toast.error('Failed', (e as Error).message) },
                        )
                      }
                    >
                      <Check className="size-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      data-testid="reject-leave"
                      onClick={() =>
                        decide.mutate(
                          { id: r.id, decision: 'rejected' },
                          { onSuccess: () => toast.info('Rejected') },
                        )
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      )}

      <section className="mt-10" data-testid="all-leave-section">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">All leave requests</h2>
          <div className="flex items-center gap-2">
            <Label htmlFor="leave-status-filter" className="mb-0 text-xs text-slate-500">
              Status
            </Label>
            <Select
              id="leave-status-filter"
              data-testid="leave-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="h-9 w-40"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
        </div>
        {filteredAll.length === 0 ? (
          <EmptyState title="No leave requests" testid="all-leave-empty" />
        ) : (
          <Table data-testid="all-leave-table">
            <Thead>
              <tr>
                <Th>Employee</Th>
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
              {filteredAll.map((r) => (
                <tr key={r.id} data-testid={`all-leave-row-${r.requester?.email}`}>
                  <Td className="font-medium text-slate-900">{r.requester?.full_name || r.requester?.email}</Td>
                  <Td>{r.leave_type?.name}</Td>
                  <Td>{r.start_date}</Td>
                  <Td>{r.end_date}</Td>
                  <Td>{r.days}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE]}>{r.status}</Badge>
                  </Td>
                  <Td className="max-w-xs text-xs text-slate-500" data-testid="all-leave-remark">
                    {r.admin_remarks || <span className="text-slate-300">—</span>}
                  </Td>
                  <Td>
                    <button
                      data-testid={`remark-leave-${r.requester?.email}`}
                      aria-label={`Add remark for ${r.requester?.full_name}`}
                      className="rounded-md p-1 text-slate-400 hover:text-brand-600"
                      onClick={() => setRemarkReq(r)}
                    >
                      <MessageSquarePlus className="size-4" />
                    </button>
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        )}
      </section>

      {remarkReq && <RemarkModal request={remarkReq} onClose={() => setRemarkReq(null)} />}
      {canManageHolidays && <HolidaySection />}
    </div>
  )
}

function RemarkModal({ request, onClose }: { request: LeaveRequestRow; onClose: () => void }) {
  const setRemark = useSetLeaveRemark()
  const toast = useToast()
  const [remark, setRemark_] = useState(request.admin_remarks ?? '')

  return (
    <Modal
      open
      onClose={onClose}
      title={`Remark · ${request.requester?.full_name || request.requester?.email}`}
      testid="leave-remark-modal"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setRemark.mutate(
            { id: request.id, remark },
            {
              onSuccess: () => {
                toast.success('Remark saved')
                onClose()
              },
              onError: (err) => toast.error('Save failed', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="leave-remark-text">Admin remark</Label>
          <Textarea
            id="leave-remark-text"
            data-testid="leave-remark-textarea"
            rows={4}
            placeholder="Note visible to the employee (e.g. reason, conditions, follow-up)"
            value={remark}
            onChange={(e) => setRemark_(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="save-leave-remark" loading={setRemark.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function HolidaySection() {
  const { data: holidays = [] } = useHolidays()
  const create = useCreateHoliday()
  const del = useDeleteHoliday()
  const toast = useToast()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')

  return (
    <section className="mt-10" data-testid="holidays-section">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Holiday calendar</h2>
      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            { name: name.trim(), date },
            {
              onSuccess: () => {
                toast.success('Holiday added')
                setName('')
                setDate('')
              },
              onError: (err) => toast.error('Could not add', (err as Error).message),
            },
          )
        }}
      >
        <Input data-testid="holiday-name" placeholder="Holiday name" value={name} onChange={(e) => setName(e.target.value)} required className="w-48" />
        <Input data-testid="holiday-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-44" />
        <Button type="submit" data-testid="add-holiday" loading={create.isPending}>
          <Plus className="size-4" /> Add
        </Button>
      </form>
      <Table data-testid="holidays-table">
        <Thead>
          <tr>
            <Th>Date</Th>
            <Th>Name</Th>
            <Th className="w-px" />
          </tr>
        </Thead>
        <Tbody>
          {holidays.map((h) => (
            <tr key={h.id} data-testid="holiday-row">
              <Td>{h.holiday_date}</Td>
              <Td className="font-medium text-slate-900">{h.name}</Td>
              <Td>
                <button
                  aria-label={`Delete ${h.name}`}
                  className="text-slate-400 hover:text-red-600"
                  onClick={() => del.mutate(h.id, { onError: (e) => toast.error('Delete failed', (e as Error).message) })}
                >
                  <Trash2 className="size-4" />
                </button>
              </Td>
            </tr>
          ))}
        </Tbody>
      </Table>
    </section>
  )
}
