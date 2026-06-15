import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { useSetUserRoles, useUpdateProfile, useUsers, type UserRow } from './hooks'
import { useRoles } from '@/features/admin/roles/hooks'
import { useDepartments, useTeams } from '@/features/admin/hierarchy/hooks'
import { useProfile } from '@/features/rbac/profile-context'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'

export function UsersPage() {
  const { hasPermission } = useProfile()
  const canManage = hasPermission('users.manage')
  const { data: users = [], isLoading } = useUsers()
  const { data: departments = [] } = useDepartments()
  const { data: teams = [] } = useTeams()
  const [editing, setEditing] = useState<UserRow | null>(null)

  const nameById = new Map(users.map((u) => [u.id, u.full_name || u.email]))
  const deptById = new Map(departments.map((d) => [d.id, d.name]))
  const teamById = new Map(teams.map((t) => [t.id, t.name]))

  return (
    <div data-testid="users-page">
      <PageHeader
        title="Employees"
        description="View employees, assign roles, departments, teams and reporting managers."
      />

      <Table data-testid="users-table">
        <Thead>
          <tr>
            <Th>Name</Th>
            <Th>Code</Th>
            <Th>Department</Th>
            <Th>Team</Th>
            <Th>Manager</Th>
            <Th>Roles</Th>
            <Th>Status</Th>
            {canManage && <Th className="w-10" />}
          </tr>
        </Thead>
        <Tbody>
          {isLoading && (
            <tr>
              <Td colSpan={8}>Loading…</Td>
            </tr>
          )}
          {users.map((u) => (
            <tr key={u.id} data-testid={`user-row-${u.email}`}>
              <Td className="font-medium text-slate-900">
                {u.full_name || '—'}
                <div className="text-xs font-normal text-slate-500">{u.email}</div>
              </Td>
              <Td>{u.employee_code ?? '—'}</Td>
              <Td>{u.department_id ? (deptById.get(u.department_id) ?? '—') : '—'}</Td>
              <Td>{u.team_id ? (teamById.get(u.team_id) ?? '—') : '—'}</Td>
              <Td>{u.reporting_manager_id ? (nameById.get(u.reporting_manager_id) ?? '—') : '—'}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {u.user_roles.map((ur) => (
                    <Badge key={ur.role_id} tone="brand">
                      {ur.roles?.name ?? ur.role_id}
                    </Badge>
                  ))}
                </div>
              </Td>
              <Td>
                <Badge tone={u.status === 'active' ? 'green' : 'slate'}>{u.status}</Badge>
              </Td>
              {canManage && (
                <Td>
                  <button
                    data-testid={`edit-user-${u.email}`}
                    aria-label={`Edit ${u.full_name || u.email}`}
                    className="text-slate-400 hover:text-brand-600"
                    onClick={() => setEditing(u)}
                  >
                    <Pencil className="size-4" />
                  </button>
                </Td>
              )}
            </tr>
          ))}
        </Tbody>
      </Table>

      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} allUsers={users} />}
    </div>
  )
}

function EditUserModal({
  user,
  onClose,
  allUsers,
}: {
  user: UserRow
  onClose: () => void
  allUsers: UserRow[]
}) {
  const { data: roles = [] } = useRoles()
  const { data: departments = [] } = useDepartments()
  const { data: teams = [] } = useTeams()
  const updateProfile = useUpdateProfile()
  const setUserRoles = useSetUserRoles()
  const toast = useToast()

  const [roleIds, setRoleIds] = useState<Set<string>>(
    new Set(user.user_roles.map((ur) => ur.role_id)),
  )
  const [departmentId, setDepartmentId] = useState(user.department_id ?? '')
  const [teamId, setTeamId] = useState(user.team_id ?? '')
  const [managerId, setManagerId] = useState(user.reporting_manager_id ?? '')
  const [status, setStatus] = useState<'active' | 'inactive'>(user.status as 'active' | 'inactive')

  const saving = updateProfile.isPending || setUserRoles.isPending

  async function save() {
    try {
      await updateProfile.mutateAsync({
        id: user.id,
        department_id: departmentId || null,
        team_id: teamId || null,
        reporting_manager_id: managerId || null,
        status,
      })
      await setUserRoles.mutateAsync({ userId: user.id, roleIds: [...roleIds] })
      toast.success('Employee updated')
      onClose()
    } catch (e) {
      toast.error('Update failed', (e as Error).message)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${user.full_name || user.email}`} testid="user-modal">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="user-dept">Department</Label>
            <Select
              id="user-dept"
              data-testid="user-department-select"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">— None —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="user-team">Team</Label>
            <Select
              id="user-team"
              data-testid="user-team-select"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">— None —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="user-manager">Reporting manager</Label>
            <Select
              id="user-manager"
              data-testid="user-manager-select"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            >
              <option value="">— None —</option>
              {allUsers
                .filter((u) => u.id !== user.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="user-status">Status</Label>
            <Select
              id="user-status"
              data-testid="user-status-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        </div>

        <div>
          <Label>Roles</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {roles.map((r) => (
              <Checkbox
                key={r.id}
                id={`user-role-${r.slug}`}
                data-testid={`user-role-${r.slug}`}
                label={r.name}
                checked={roleIds.has(r.id)}
                onChange={(e) => {
                  setRoleIds((prev) => {
                    const next = new Set(prev)
                    if (e.target.checked) next.add(r.id)
                    else next.delete(r.id)
                    return next
                  })
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button data-testid="save-user-submit" loading={saving} onClick={save}>
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}
