import { useAuth } from '@/features/auth/auth-context'

export function DashboardPage() {
  const { user } = useAuth()

  return (
    <div data-testid="dashboard-page">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-slate-500">
        Signed in as <span className="font-medium text-slate-700">{user?.email}</span>
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">Welcome</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            The HRMS foundation is live.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Attendance, tasks, planning, leave, salary and appraisal modules arrive in the
            following phases.
          </p>
        </div>
      </div>
    </div>
  )
}
