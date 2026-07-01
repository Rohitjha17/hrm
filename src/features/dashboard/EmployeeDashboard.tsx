import { Link } from 'react-router-dom'
import {
  CalendarRange,
  Fingerprint,
  ListChecks,
  Megaphone,
  Plane,
} from 'lucide-react'
import { useAuth } from '@/features/auth/auth-context'
import { useProfile } from '@/features/rbac/profile-context'
import { useMyAttendance, useAttendanceConfig } from '@/features/attendance/hooks'
import { todayInTz, formatMinutes } from '@/features/attendance/geo'
import { useTasks } from '@/features/tasks/hooks'
import { useMyBalances, useMyLeaveRequests } from '@/features/leave/hooks'
import { usePlanningSlots } from '@/features/planning/hooks'
import { useAnnouncements } from '@/features/engagement/hooks'
import { Card, CardBody } from '@/components/ui/Card'

const ATT_STATUS: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'slate' }> = {
  full_day: { label: 'Full day', tone: 'green' },
  present: { label: 'Present', tone: 'blue' },
  half_day: { label: 'Half day', tone: 'amber' },
  quarter_day: { label: 'Quarter day', tone: 'amber' },
  absent: { label: 'Absent', tone: 'red' },
}

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'brand',
  to,
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof ListChecks
  tone?: 'brand' | 'green' | 'amber' | 'red' | 'blue'
  to?: string
}) {
  const toneCls: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
  }
  const body = (
    <CardBody className="flex items-center gap-4">
      <div className={`flex size-11 items-center justify-center rounded-lg ${toneCls[tone]}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="truncate text-sm text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </CardBody>
  )
  return (
    <Card className={to ? 'transition-shadow hover:shadow-md' : undefined}>
      {to ? <Link to={to}>{body}</Link> : body}
    </Card>
  )
}

export function EmployeeDashboard() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const { data: config } = useAttendanceConfig()
  const tz = config?.timezone ?? 'Asia/Kolkata'
  const today = todayInTz(tz)

  const { data: att } = useMyAttendance(today)
  const { data: tasks = [] } = useTasks()
  const { data: balances = [] } = useMyBalances()
  const { data: leaveRequests = [] } = useMyLeaveRequests()
  const { data: slots = [] } = usePlanningSlots(today, 'day')
  const { data: announcements = [] } = useAnnouncements()

  const myTasks = tasks.filter((t) => t.created_by === user?.id || t.assignee_id === user?.id)
  const myOpenTasks = myTasks.filter((t) => !t.status?.is_terminal)
  const leaveRemaining = balances.reduce((sum, b) => sum + (Number(b.allocated) - Number(b.used)), 0)
  const leaveAllocated = balances.reduce((sum, b) => sum + Number(b.allocated), 0)
  const pendingLeaveCount = leaveRequests.filter((l) => l.status === 'pending').length
  const plannedSlots = slots.filter((s) => s.task_name?.trim())
  const avgProgress = plannedSlots.length
    ? Math.round(plannedSlots.reduce((s, x) => s + (x.progress ?? 0), 0) / plannedSlots.length)
    : 0

  const attStatus = att?.day?.status
  const attInfo = attStatus ? ATT_STATUS[attStatus] : null
  const attValue = att?.day
    ? (attInfo?.label ?? attStatus ?? '—')
    : att?.open
      ? 'Punched in'
      : 'Not punched in'
  const attSub = att?.day ? `Worked ${formatMinutes(att.day.worked_minutes)}` : 'Tap to punch'

  const dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })

  return (
    <div data-testid="employee-dashboard">
      <h1 className="text-2xl font-bold text-slate-900">
        Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
      </h1>
      <p className="mt-1 text-sm text-slate-600">Your self-service home · {dateLabel}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Attendance today"
          value={attValue}
          sub={attSub}
          icon={Fingerprint}
          tone={attInfo?.tone === 'red' ? 'red' : att?.day ? 'green' : 'amber'}
          to="/attendance"
        />
        <Stat
          label="Open tasks"
          value={myOpenTasks.length}
          sub={`${myTasks.length} total`}
          icon={ListChecks}
          tone="blue"
          to="/tasks"
        />
        <Stat
          label="Leave remaining"
          value={leaveRemaining}
          sub={`of ${leaveAllocated} allocated`}
          icon={Plane}
          tone="green"
          to="/leave"
        />
        <Stat
          label="Today's plan"
          value={plannedSlots.length ? `${avgProgress}%` : '—'}
          sub={`${plannedSlots.length} slot${plannedSlots.length === 1 ? '' : 's'} planned`}
          icon={CalendarRange}
          tone="brand"
          to="/planning"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody data-testid="dash-leave-balances">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Leave balances</h2>
              <Link to="/leave" className="text-xs font-medium text-brand-600 hover:underline">
                Apply
              </Link>
            </div>
            {balances.length === 0 ? (
              <p className="text-sm text-slate-400">No leave balances allocated yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {balances.map((b) => {
                  const remaining = Number(b.allocated) - Number(b.used)
                  const pct = Number(b.allocated) > 0 ? (Number(b.used) / Number(b.allocated)) * 100 : 0
                  return (
                    <li key={b.id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{b.leave_type?.name ?? 'Leave'}</span>
                        <span className="font-medium text-slate-900">
                          {remaining} <span className="text-xs font-normal text-slate-400">left of {b.allocated}</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {pendingLeaveCount > 0 && (
              <p className="mt-3 text-xs text-amber-600">
                {pendingLeaveCount} request{pendingLeaveCount === 1 ? '' : 's'} pending approval
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody data-testid="dash-announcements">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Latest announcements</h2>
              <Link to="/announcements" className="text-xs font-medium text-brand-600 hover:underline">
                Notice board
              </Link>
            </div>
            {announcements.length === 0 ? (
              <p className="text-sm text-slate-400">No announcements posted.</p>
            ) : (
              <ul className="space-y-3">
                {announcements.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                      <Megaphone className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{a.title}</p>
                      <p className="line-clamp-1 text-xs text-slate-500">{a.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
