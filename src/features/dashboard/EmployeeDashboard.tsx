import { useProfile } from '@/features/rbac/profile-context'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export function EmployeeDashboard() {
  const { profile, roles } = useProfile()

  return (
    <div data-testid="employee-dashboard">
      <h1 className="text-2xl font-bold text-slate-900">
        Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
      </h1>
      <p className="mt-1 text-sm text-slate-600">Your self-service home.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-slate-500">Your profile</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium text-slate-900">{profile?.full_name || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Employee code</dt>
                <dd className="font-medium text-slate-900">{profile?.employee_code || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <Badge tone={profile?.status === 'active' ? 'green' : 'slate'}>
                    {profile?.status ?? '—'}
                  </Badge>
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-sm font-medium text-slate-500">Your roles</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[...roles].map((r) => (
                <Badge key={r} tone="brand">
                  {r}
                </Badge>
              ))}
              {roles.size === 0 && <span className="text-sm text-slate-400">No roles assigned</span>}
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Attendance, tasks, planning and leave modules will appear here in the next phases.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
