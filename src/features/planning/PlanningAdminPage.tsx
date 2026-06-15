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
import { Modal } from '@/components/ui/Modal'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'

export function PlanningAdminPage() {
  const { data: config } = usePlanningConfig()
  const [date, setDate] = useState(todayInTz('Asia/Kolkata'))
  const { data: users = [] } = useUsers()
  const { data: compliance = [] } = useComplianceForDate(date)
  const unlock = useUnlockPlanning()
  const toast = useToast()
  const [viewUser, setViewUser] = useState<{ id: string; name: string } | null>(null)

  usePlanningRealtime()

  const compByUser = new Map(compliance.map((c) => [c.user_id, c]))
  const required = { dayEnd: config?.require_day_end ?? true, nextDay: config?.require_next_day ?? true }

  return (
    <div data-testid="planning-admin-page">
      <PageHeader title="Planning Monitor" description={`Policy: ${config?.policy ?? '—'}. Unlock to override the punch-out block.`} />

      <div className="mb-4 flex items-center gap-2">
        <Label htmlFor="pa-date" className="mb-0">
          Date
        </Label>
        <Input id="pa-date" data-testid="planning-admin-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
      </div>

      <Table data-testid="planning-compliance-table">
        <Thead>
          <tr>
            <Th>Employee</Th>
            <Th>Day-End</Th>
            <Th>Next-Day</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </Thead>
        <Tbody>
          {users.map((u) => {
            const c = compByUser.get(u.id)
            const compliant =
              !!c &&
              (c.unlocked ||
                ((!required.dayEnd || c.day_end_submitted) && (!required.nextDay || c.next_day_submitted)))
            return (
              <tr key={u.id} data-testid={`compliance-row-${u.email}`}>
                <Td className="font-medium text-slate-900">{u.full_name || u.email}</Td>
                <Td>{c?.day_end_submitted ? <Badge tone="green">✓</Badge> : <Badge tone="slate">—</Badge>}</Td>
                <Td>{c?.next_day_submitted ? <Badge tone="green">✓</Badge> : <Badge tone="slate">—</Badge>}</Td>
                <Td>
                  <Badge tone={compliant ? 'green' : 'amber'} data-testid={`compliance-${u.email}`} data-compliant={compliant}>
                    {compliant ? (c?.unlocked ? 'unlocked' : 'complete') : 'pending'}
                  </Badge>
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
                      loading={unlock.isPending}
                      onClick={() =>
                        unlock.mutate(
                          { userId: u.id, date },
                          {
                            onSuccess: () => toast.success('Planning unlocked'),
                            onError: (e) => toast.error('Unlock failed', (e as Error).message),
                          },
                        )
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
    </div>
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
  return (
    <Modal open onClose={onClose} title={`${user.name} · ${date}`} testid="plan-view-modal">
      {slots.length === 0 ? (
        <p className="text-sm text-slate-500">No planning recorded for this date.</p>
      ) : (
        <ul className="space-y-2">
          {slots.map((s) => (
            <li key={s.id} className="rounded-lg border border-slate-100 p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-slate-800">{s.slot_label}</span>
                <Badge tone="blue">{s.progress}%</Badge>
              </div>
              <p className="mt-1 text-slate-700">{s.task_name || '—'}</p>
              {s.challenges && <p className="mt-1 text-xs text-amber-700">⚠ {s.challenges}</p>}
              {s.remarks && <p className="mt-0.5 text-xs text-slate-500">{s.remarks}</p>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
