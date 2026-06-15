import { useState } from 'react'
import { Award, Plus } from 'lucide-react'
import { useAwardRecognition, useRecognitions } from './hooks'
import { useUsers } from '@/features/admin/users/hooks'
import { useProfile } from '@/features/rbac/profile-context'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'

const AWARDS = ['star_performer', 'employee_of_month', 'appreciation']

export function RecognitionPage() {
  const { hasPermission } = useProfile()
  const canManage = hasPermission('recognition.manage')
  const { data: items = [] } = useRecognitions()
  const { data: users = [] } = useUsers()
  const nameById = new Map(users.map((u) => [u.id, u.full_name || u.email]))
  const [open, setOpen] = useState(false)

  return (
    <div data-testid="recognition-page">
      <PageHeader
        title="Recognition & Rewards"
        description="Celebrate great work."
        actions={
          canManage && (
            <Button data-testid="award-button" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Award
            </Button>
          )
        }
      />

      {items.length === 0 ? (
        <EmptyState title="No recognitions yet" testid="recognition-empty" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((r) => (
            <Card key={r.id} data-testid="recognition-card">
              <CardBody>
                <div className="flex items-center gap-2">
                  <Award className="size-5 text-amber-500" />
                  <span className="font-semibold text-slate-900" data-testid="recognition-employee">
                    {nameById.get(r.employee_id) ?? '—'}
                  </span>
                  <Badge tone="amber">{r.award_type.replace(/_/g, ' ')}</Badge>
                  {r.points > 0 && <Badge tone="brand">{r.points} pts</Badge>}
                </div>
                {r.note && <p className="mt-2 text-sm text-slate-600">{r.note}</p>}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {open && <AwardModal users={users} onClose={() => setOpen(false)} />}
    </div>
  )
}

function AwardModal({
  users,
  onClose,
}: {
  users: { id: string; full_name: string; email: string }[]
  onClose: () => void
}) {
  const award = useAwardRecognition()
  const toast = useToast()
  const [employeeId, setEmployeeId] = useState('')
  const [awardType, setAwardType] = useState('star_performer')
  const [points, setPoints] = useState('50')
  const [note, setNote] = useState('')

  return (
    <Modal open onClose={onClose} title="Award recognition" testid="recognition-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          award.mutate(
            { employeeId: employeeId || users[0]?.id, awardType, points: Number(points), note },
            { onSuccess: () => { toast.success('Recognition awarded'); onClose() }, onError: (err) => toast.error('Failed', (err as Error).message) },
          )
        }}
      >
        <div>
          <Label htmlFor="rec-emp">Employee</Label>
          <Select id="rec-emp" data-testid="recognition-employee" value={employeeId || users[0]?.id || ''} onChange={(e) => setEmployeeId(e.target.value)}>
            {users.map((u) => (<option key={u.id} value={u.id}>{u.full_name || u.email}</option>))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="rec-type">Award</Label>
            <Select id="rec-type" data-testid="recognition-award-type" value={awardType} onChange={(e) => setAwardType(e.target.value)}>
              {AWARDS.map((a) => (<option key={a} value={a}>{a.replace(/_/g, ' ')}</option>))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rec-pts">Points</Label>
            <Input id="rec-pts" data-testid="recognition-points" type="number" value={points} onChange={(e) => setPoints(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="rec-note">Note</Label>
          <Input id="rec-note" data-testid="recognition-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" data-testid="award-recognition" loading={award.isPending}>Award</Button>
        </div>
      </form>
    </Modal>
  )
}
