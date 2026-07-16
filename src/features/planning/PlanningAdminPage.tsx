import { useState } from 'react'
import { Eye, Unlock } from 'lucide-react'
import {
  useComplianceForDate,
  usePlanningConfig,
  usePlanningRealtime,
  useUnlockPlanning,
  useUserDayPlan,
} from './hooks'
import { useUsers } from '@/features/admin/users/hooks'
import { todayInTz } from '@/features/attendance/geo'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'

export function PlanningAdminPage() {
  const { data: config } = usePlanningConfig()
  const [date, setDate] = useState(todayInTz('Asia/Kolkata'))
  const [employeeFilter, setEmployeeFilter] = useState('')
  const { data: users = [] } = useUsers()
  const { data: compliance = [] } = useComplianceForDate(date)
  const [viewUser, setViewUser] = useState<{ id: string; name: string } | null>(null)
  const [unlockUser, setUnlockUser] = useState<{ id: string; name: string; email: string } | null>(
    null,
  )

  usePlanningRealtime()

  const compByUser = new Map(compliance.map((c) => [c.user_id, c]))
  const required = { dayEnd: config?.require_day_end ?? true }
  const visibleUsers = employeeFilter ? users.filter((u) => u.id === employeeFilter) : users

  return (
    <div data-testid="planning-admin-page">
      <PageHeader
        title="Planning Monitor"
        description={`Policy: ${config?.policy ?? '—'}. Incomplete planning blocks punch-out and locks the next day's punch-in — unlock (with a remark) to override.`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="pa-date" className="mb-0">
            Date
          </Label>
          <Input id="pa-date" data-testid="planning-admin-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="pa-employee" className="mb-0">
            Employee
          </Label>
          <Select
            id="pa-employee"
            data-testid="planning-admin-employee"
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="w-56"
          >
            <option value="">All employees</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Table data-testid="planning-compliance-table">
        <Thead>
          <tr>
            <Th>Employee</Th>
            <Th>Day-End</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </Thead>
        <Tbody>
          {visibleUsers.map((u) => {
            const c = compByUser.get(u.id)
            const compliant = !!c && (c.unlocked || !required.dayEnd || c.day_end_submitted)
            return (
              <tr key={u.id} data-testid={`compliance-row-${u.email}`}>
                <Td className="font-medium text-slate-900">{u.full_name || u.email}</Td>
                <Td>{c?.day_end_submitted ? <Badge tone="green">✓</Badge> : <Badge tone="slate">—</Badge>}</Td>
                <Td>
                  <Badge tone={compliant ? 'green' : 'amber'} data-testid={`compliance-${u.email}`} data-compliant={compliant}>
                    {compliant ? (c?.unlocked ? 'unlocked' : 'complete') : 'pending'}
                  </Badge>
                  {c?.unlocked && c.unlock_remarks && (
                    <p
                      className="mt-1 max-w-64 truncate text-xs text-slate-400"
                      data-testid={`unlock-remark-${u.email}`}
                      title={c.unlock_remarks}
                    >
                      {c.unlock_remarks}
                    </p>
                  )}
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <button
                      data-testid={`view-plan-${u.email}`}
                      aria-label={`View plan for ${u.full_name}`}
                      className="rounded p-1 text-slate-400 hover:text-brand-600"
                      onClick={() => setViewUser({ id: u.id, name: u.full_name || u.email })}
                    >
                      <Eye className="size-4" />
                    </button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`unlock-${u.email}`}
                      disabled={compliant}
                      onClick={() =>
                        setUnlockUser({ id: u.id, name: u.full_name || u.email, email: u.email })
                      }
                    >
                      <Unlock className="size-3.5" /> Unlock
                    </Button>
                  </div>
                </Td>
              </tr>
            )
          })}
        </Tbody>
      </Table>

      {viewUser && <PlanView user={viewUser} date={date} onClose={() => setViewUser(null)} />}
      {unlockUser && (
        <UnlockModal user={unlockUser} date={date} onClose={() => setUnlockUser(null)} />
      )}
    </div>
  )
}

/** Unlocking overrides the punch gates, so it always needs a written reason. */
function UnlockModal({
  user,
  date,
  onClose,
}: {
  user: { id: string; name: string; email: string }
  date: string
  onClose: () => void
}) {
  const unlock = useUnlockPlanning()
  const toast = useToast()
  const [remarks, setRemarks] = useState('')

  return (
    <Modal open onClose={onClose} title={`Unlock planning: ${user.name}`} testid="unlock-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          unlock.mutate(
            { userId: user.id, date, remarks: remarks.trim() },
            {
              onSuccess: () => {
                toast.success('Planning unlocked')
                onClose()
              },
              onError: (err) => toast.error('Unlock failed', (err as Error).message),
            },
          )
        }}
      >
        <p className="text-sm text-slate-600">
          Unlocking {date} lifts the punch-out block and the next-day punch-in lock for{' '}
          {user.name}. A remark is required.
        </p>
        <div>
          <Label htmlFor="unlock-remark">Remark</Label>
          <Textarea
            id="unlock-remark"
            data-testid="unlock-remark"
            rows={2}
            placeholder="Why is this being unlocked? (required)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            data-testid="unlock-save"
            disabled={!remarks.trim()}
            loading={unlock.isPending}
          >
            <Unlock className="size-4" /> Unlock
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function PlanView({
  user,
  date,
  onClose,
}: {
  user: { id: string; name: string }
  date: string
  onClose: () => void
}) {
  const { data: slots = [] } = useUserDayPlan(user.id, date)
  const fields = [
    { key: 'slot', label: 'Slot' },
    { key: 'planning', label: 'Planning' },
    { key: 'working', label: 'Working' },
    { key: 'progress', label: 'Completion %' },
    { key: 'challenges', label: 'Challenges' },
  ] as const
  return (
    <Modal open onClose={onClose} title={`${user.name} · ${date}`} testid="plan-view-modal">
      {slots.length === 0 ? (
        <p className="text-sm text-slate-500">No planning recorded for this date.</p>
      ) : (
        <ul className="space-y-2">
          {slots.map((s) => {
            const values: Record<(typeof fields)[number]['key'], string> = {
              slot: s.slot_label,
              planning: s.task_name || '—',
              working: s.remarks || '—',
              progress: `${s.progress ?? 0}%`,
              challenges: s.challenges || '—',
            }
            return (
              <li
                key={s.id}
                data-testid="plan-view-slot"
                className="rounded-lg border border-slate-100 p-3 text-sm"
              >
                <dl className="grid grid-cols-[7rem_1fr] gap-y-0.5">
                  {fields.map((f) => (
                    <div key={f.key} className="contents">
                      <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                        {f.label}
                      </dt>
                      <dd
                        className={
                          f.key === 'challenges' && s.challenges
                            ? 'text-amber-700'
                            : 'text-slate-700'
                        }
                        data-testid={`plan-view-${f.key}`}
                      >
                        {values[f.key]}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
