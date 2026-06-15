import { Building2, Network, Shield, Users } from 'lucide-react'
import { useUsers } from '@/features/admin/users/hooks'
import { useDepartments, useTeams } from '@/features/admin/hierarchy/hooks'
import { useRoles } from '@/features/admin/roles/hooks'
import { Card, CardBody } from '@/components/ui/Card'

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number | string
  icon: typeof Users
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <div className="flex size-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </CardBody>
    </Card>
  )
}

export function AdminDashboard() {
  const { data: users = [] } = useUsers()
  const { data: departments = [] } = useDepartments()
  const { data: teams = [] } = useTeams()
  const { data: roles = [] } = useRoles()

  return (
    <div data-testid="admin-dashboard">
      <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-slate-600">Organisation overview.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Employees" value={users.length} icon={Users} />
        <Stat label="Departments" value={departments.length} icon={Building2} />
        <Stat label="Teams" value={teams.length} icon={Network} />
        <Stat label="Roles" value={roles.length} icon={Shield} />
      </div>
    </div>
  )
}
