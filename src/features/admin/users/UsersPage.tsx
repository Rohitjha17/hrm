import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  useCreateEmployee,
  useDeleteEmployee,
  useSetUserRoles,
  useUpdateProfile,
  useUsers,
  type UserRow,
} from './hooks'
import { useRoles } from '@/features/admin/roles/hooks'
import { useDepartments, useTeams } from '@/features/admin/hierarchy/hooks'
import { useProfile } from '@/features/rbac/profile-context'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
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
  const deleteEmployee = useDeleteEmployee()
  const toast = useToast()
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<UserRow | null>(null)

  const nameById = new Map(users.map((u) => [u.id, u.full_name || u.email]))
  const deptById = new Map(departments.map((d) => [d.id, d.name]))
  const teamById = new Map(teams.map((t) => [t.id, t.name]))

  return (
    <div data-testid="users-page">
      <PageHeader
        title="Employees"
        description="View employees, assign roles, departments, teams and reporting managers."
        actions={
          canManage && (
            <Button data-testid="add-employee-button" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Add employee
            </Button>
          )
        }
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
                <Badge tone={u.status === 'active' ? 'green' : 'slate'} data-testid="user-status">
                  {u.status}
                </Badge>
              </Td>
              {canManage && (
                <Td>
                  <div className="flex justify-end gap-2">
                    <button
                      data-testid={`edit-user-${u.email}`}
                      aria-label={`Edit ${u.full_name || u.email}`}
                      className="text-slate-400 hover:text-brand-600"
                      onClick={() => setEditing(u)}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      data-testid={`delete-user-${u.email}`}
                      aria-label={`Delete ${u.full_name || u.email}`}
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => setDeleting(u)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </Td>
              )}
            </tr>
          ))}
        </Tbody>
      </Table>

      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} allUsers={users} />}
      {adding && <AddEmployeeModal onClose={() => setAdding(false)} allUsers={users} />}
      {deleting && (
        <Modal open onClose={() => setDeleting(null)} title="Delete employee" testid="delete-modal">
          <p className="text-sm text-slate-600">
            Permanently delete <strong>{deleting.full_name || deleting.email}</strong> and their
            login? This cannot be undone.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              data-testid="confirm-delete-user"
              loading={deleteEmployee.isPending}
              onClick={() =>
                deleteEmployee.mutate(deleting.id, {
                  onSuccess: () => {
                    toast.success('Employee deleted')
                    setDeleting(null)
                  },
                  onError: (e) => toast.error('Delete failed', (e as Error).message),
                })
              }
            >
              Delete
            </Button>
          </div>
        </Modal>
      )}
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

function AddEmployeeModal({ onClose, allUsers }: { onClose: () => void; allUsers: UserRow[] }) {
  const create = useCreateEmployee()
  const { data: roles = [] } = useRoles()
  const { data: departments = [] } = useDepartments()
  const { data: teams = [] } = useTeams()
  const toast = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [employeeCode, setEmployeeCode] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [managerId, setManagerId] = useState('')
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set())

  return (
    <Modal open onClose={onClose} title="Add employee" testid="add-employee-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            {
              email: email.trim(),
              password,
              fullName: fullName.trim(),
              employeeCode: employeeCode.trim() || undefined,
              departmentId: departmentId || null,
              teamId: teamId || null,
              managerId: managerId || null,
              roleIds: [...roleIds],
            },
            {
              onSuccess: () => {
                toast.success('Employee created', 'Share the temporary password out-of-band.')
                onClose()
              },
              onError: (err) => toast.error('Could not create employee', (err as Error).message),
            },
          )
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ne-email">Email</Label>
            <Input id="ne-email" data-testid="new-emp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="ne-password">Temporary password</Label>
            <Input id="ne-password" data-testid="new-emp-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="ne-name">Full name</Label>
            <Input id="ne-name" data-testid="new-emp-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="ne-code">Employee code</Label>
            <Input id="ne-code" data-testid="new-emp-code" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ne-dept">Department</Label>
            <Select id="ne-dept" data-testid="new-emp-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">— None —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ne-team">Team</Label>
            <Select id="ne-team" data-testid="new-emp-team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">— None —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="col-span-2">
            <Label htmlFor="ne-manager">Reporting manager</Label>
            <Select id="ne-manager" data-testid="new-emp-manager" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
              <option value="">— None —</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label>Roles</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {roles.map((r) => (
              <Checkbox
                key={r.id}
                id={`new-emp-role-${r.slug}`}
                data-testid={`new-emp-role-${r.slug}`}
                label={r.name}
                checked={roleIds.has(r.id)}
                onChange={(e) =>
                  setRoleIds((prev) => {
                    const next = new Set(prev)
                    if (e.target.checked) next.add(r.id)
                    else next.delete(r.id)
                    return next
                  })
                }
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="create-employee-submit" loading={create.isPending}>
            Create employee
          </Button>
        </div>
      </form>
    </Modal>
  )
}
