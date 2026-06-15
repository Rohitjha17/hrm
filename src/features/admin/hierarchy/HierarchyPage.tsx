import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  useCompanies,
  useCreateDepartment,
  useCreateTeam,
  useDeleteDepartment,
  useDeleteTeam,
  useDepartments,
  useTeams,
  useUpdateTeamManager,
} from './hooks'
import { useUsers } from '@/features/admin/users/hooks'
import { useProfile } from '@/features/rbac/profile-context'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

export function HierarchyPage() {
  const { hasPermission } = useProfile()
  const canManage = hasPermission('hierarchy.manage')
  const toast = useToast()

  const { data: companies = [] } = useCompanies()
  const { data: departments = [] } = useDepartments()
  const { data: teams = [] } = useTeams()
  const { data: users = [] } = useUsers()
  const updateManager = useUpdateTeamManager()
  const delDept = useDeleteDepartment()
  const delTeam = useDeleteTeam()

  const [deptModal, setDeptModal] = useState(false)
  const [teamModal, setTeamModal] = useState(false)

  return (
    <div data-testid="hierarchy-page">
      <PageHeader
        title="Departments & Teams"
        description="Structure your organisation. Assign reporting managers to teams."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Departments */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Departments
            </h2>
            {canManage && (
              <Button size="sm" data-testid="new-department-button" onClick={() => setDeptModal(true)}>
                <Plus className="size-4" /> New
              </Button>
            )}
          </div>
          {departments.length === 0 ? (
            <EmptyState title="No departments yet" testid="departments-empty" />
          ) : (
            <Table data-testid="departments-table">
              <Thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Company</Th>
                  <Th className="w-10" />
                </tr>
              </Thead>
              <Tbody>
                {departments.map((d) => (
                  <tr key={d.id} data-testid="department-row">
                    <Td className="font-medium text-slate-900">{d.name}</Td>
                    <Td>{d.company?.name ?? '—'}</Td>
                    <Td>
                      {canManage && (
                        <button
                          aria-label={`Delete ${d.name}`}
                          className="text-slate-400 hover:text-red-600"
                          onClick={() =>
                            delDept.mutate(d.id, {
                              onError: (e) => toast.error('Delete failed', (e as Error).message),
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          )}
        </div>

        {/* Teams */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Teams</h2>
            {canManage && (
              <Button size="sm" data-testid="new-team-button" onClick={() => setTeamModal(true)}>
                <Plus className="size-4" /> New
              </Button>
            )}
          </div>
          {teams.length === 0 ? (
            <EmptyState title="No teams yet" testid="teams-empty" />
          ) : (
            <Table data-testid="teams-table">
              <Thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Department</Th>
                  <Th>Manager</Th>
                  <Th className="w-10" />
                </tr>
              </Thead>
              <Tbody>
                {teams.map((t) => (
                  <tr key={t.id} data-testid="team-row">
                    <Td className="font-medium text-slate-900">{t.name}</Td>
                    <Td>{t.department?.name ?? '—'}</Td>
                    <Td>
                      {canManage ? (
                        <Select
                          aria-label={`Manager for ${t.name}`}
                          value={t.reporting_manager_id ?? ''}
                          onChange={(e) =>
                            updateManager.mutate({
                              teamId: t.id,
                              managerId: e.target.value || null,
                            })
                          }
                          className="h-8 text-xs"
                        >
                          <option value="">— None —</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.full_name || u.email}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        (users.find((u) => u.id === t.reporting_manager_id)?.full_name ?? '—')
                      )}
                    </Td>
                    <Td>
                      {canManage && (
                        <button
                          aria-label={`Delete ${t.name}`}
                          className="text-slate-400 hover:text-red-600"
                          onClick={() =>
                            delTeam.mutate(t.id, {
                              onError: (e) => toast.error('Delete failed', (e as Error).message),
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          )}
        </div>
      </div>

      <DepartmentModal open={deptModal} onClose={() => setDeptModal(false)} companies={companies} />
      <TeamModal open={teamModal} onClose={() => setTeamModal(false)} departments={departments} />
    </div>
  )
}

function DepartmentModal({
  open,
  onClose,
  companies,
}: {
  open: boolean
  onClose: () => void
  companies: { id: string; name: string }[]
}) {
  const create = useCreateDepartment()
  const toast = useToast()
  const [name, setName] = useState('')
  const [companyId, setCompanyId] = useState('')

  return (
    <Modal open={open} onClose={onClose} title="New department" testid="department-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            { name: name.trim(), company_id: companyId || companies[0]?.id },
            {
              onSuccess: () => {
                toast.success('Department created')
                setName('')
                onClose()
              },
              onError: (err) => toast.error('Could not create', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="dept-company">Company</Label>
          <Select
            id="dept-company"
            data-testid="department-company-select"
            value={companyId || companies[0]?.id || ''}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="dept-name">Name</Label>
          <Input
            id="dept-name"
            data-testid="department-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="create-department-submit" loading={create.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function TeamModal({
  open,
  onClose,
  departments,
}: {
  open: boolean
  onClose: () => void
  departments: { id: string; name: string }[]
}) {
  const create = useCreateTeam()
  const toast = useToast()
  const [name, setName] = useState('')
  const [deptId, setDeptId] = useState('')

  return (
    <Modal open={open} onClose={onClose} title="New team" testid="team-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            { name: name.trim(), department_id: deptId || departments[0]?.id },
            {
              onSuccess: () => {
                toast.success('Team created')
                setName('')
                onClose()
              },
              onError: (err) => toast.error('Could not create', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="team-dept">Department</Label>
          <Select
            id="team-dept"
            data-testid="team-department-select"
            value={deptId || departments[0]?.id || ''}
            onChange={(e) => setDeptId(e.target.value)}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="team-name">Name</Label>
          <Input
            id="team-name"
            data-testid="team-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="create-team-submit" loading={create.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  )
}
