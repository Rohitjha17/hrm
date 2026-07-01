import { Link } from 'react-router-dom'
import {
  AlarmClock,
  Building2,
  CalendarCheck,
  Inbox,
  LifeBuoy,
  ListChecks,
  Megaphone,
  Plane,
  Users,
} from 'lucide-react'
import { useUsers } from '@/features/admin/users/hooks'
import { useDepartments } from '@/features/admin/hierarchy/hooks'
import { useAdminAttendance, useAttendanceConfig } from '@/features/attendance/hooks'
import { todayInTz } from '@/features/attendance/geo'
import { usePendingApprovals } from '@/features/leave/hooks'
import { useTasks } from '@/features/tasks/hooks'
import { useTickets, isSlaBreached } from '@/features/helpdesk/hooks'
import { useInstances } from '@/features/workflow/hooks'
import { useAnnouncements } from '@/features/engagement/hooks'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

function Stat({
  label,
  value,
  icon: Icon,
  tone = 'brand',
  to,
}: {
  label: string
  value: number | string
  icon: typeof Users
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
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </CardBody>
  )
  return (
    <Card className={to ? 'transition-shadow hover:shadow-md' : undefined}>
      {to ? <Link to={to}>{body}</Link> : body}
    </Card>
  )
}

function SectionCard({
  title,
  to,
  linkLabel,
  children,
  testid,
}: {
  title: string
  to?: string
  linkLabel?: string
  children: React.ReactNode
  testid?: string
}) {
  return (
    <Card>
      <CardBody data-testid={testid}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {to && (
            <Link to={to} className="text-xs font-medium text-brand-600 hover:underline">
              {linkLabel ?? 'View all'}
            </Link>
          )}
        </div>
        {children}
      </CardBody>
    </Card>
  )
}

export function AdminDashboard() {
  const { data: config } = useAttendanceConfig()
  const tz = config?.timezone ?? 'Asia/Kolkata'
  const today = todayInTz(tz)

  const { data: users = [] } = useUsers()
  const { data: departments = [] } = useDepartments()
  const { data: attendance = [] } = useAdminAttendance(today)
  const { data: pendingLeaves = [] } = usePendingApprovals()
  const { data: tasks = [] } = useTasks()
  const { data: tickets = [] } = useTickets()
  const { data: instances = [] } = useInstances()
  const { data: announcements = [] } = useAnnouncements()

  const presentToday = attendance.filter((r) => r.status !== 'absent').length
  const lateToday = attendance.filter((r) => r.is_late).length
  const openTasks = tasks.filter((t) => !t.status?.is_terminal).length
  const openTickets = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length
  const breachedTickets = tickets.filter(isSlaBreached).length
  const pendingWorkflow = instances.filter((i) => i.status === 'pending').length
  const dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })

  return (
    <div data-testid="admin-dashboard">
      <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-slate-600">
        Organisation overview · {dateLabel}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Stat label="Employees" value={users.length} icon={Users} to="/admin/users" />
        <Stat
          label={`Present today (of ${users.length})`}
          value={presentToday}
          icon={CalendarCheck}
          tone="green"
          to="/admin/attendance"
        />
        <Stat label="Late arrivals today" value={lateToday} icon={AlarmClock} tone="amber" to="/admin/attendance" />
        <Stat label="Pending leave approvals" value={pendingLeaves.length} icon={Plane} tone="amber" to="/admin/leave" />
        <Stat label="Open tasks" value={openTasks} icon={ListChecks} tone="blue" to="/tasks" />
        <Stat label="Pending approvals" value={pendingWorkflow} icon={Inbox} tone="brand" to="/approvals" />
        <Stat
          label={breachedTickets > 0 ? `Open tickets (${breachedTickets} SLA breached)` : 'Open tickets'}
          value={openTickets}
          icon={LifeBuoy}
          tone={breachedTickets > 0 ? 'red' : 'blue'}
          to="/helpdesk"
        />
        <Stat label="Departments" value={departments.length} icon={Building2} to="/admin/hierarchy" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Pending leave approvals"
          to="/admin/leave"
          linkLabel="Review"
          testid="dash-pending-leaves"
        >
          {pendingLeaves.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing awaiting approval. 🎉</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingLeaves.slice(0, 5).map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">
                      {l.requester?.full_name || l.requester?.email || 'Employee'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {l.leave_type?.name} · {l.start_date} → {l.end_date}
                    </p>
                  </div>
                  <Badge tone="amber">{l.days}d</Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Latest announcements"
          to="/announcements"
          linkLabel="Notice board"
          testid="dash-announcements"
        >
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
        </SectionCard>
      </div>
    </div>
  )
}
