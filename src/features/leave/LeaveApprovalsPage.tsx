import { useState } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import {
  useCreateHoliday,
  useDecideLeave,
  useDeleteHoliday,
  useHolidays,
  useLeaveRealtime,
  usePendingApprovals,
} from './hooks'
import { useProfile } from '@/features/rbac/profile-context'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

export function LeaveApprovalsPage() {
  useLeaveRealtime()
  const { hasPermission } = useProfile()
  const canManageHolidays = hasPermission('holidays.manage')
  const { data: pending = [], isLoading } = usePendingApprovals()
  const decide = useDecideLeave()
  const toast = useToast()

  return (
    <div data-testid="leave-approvals-page">
      <PageHeader title="Leave Approvals" description="Review and decide pending leave requests." />

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

      {canManageHolidays && <HolidaySection />}
    </div>
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
