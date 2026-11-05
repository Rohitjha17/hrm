import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Link } from 'react-router-dom'
import {
  Award,
  BookText,
  CalendarRange,
  CheckCheck,
  ClipboardList,
  Fingerprint,
  GitBranch,
  GraduationCap,
  ListChecks,
  Megaphone,
  Package,
  Plane,
  Settings2,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/features/auth/auth-context'
import { useProfile } from '@/features/rbac/profile-context'
import { useMyAttendance, useAttendanceConfig } from '@/features/attendance/hooks'
import { todayInTz, formatMinutes } from '@/features/attendance/geo'
import { useTasks } from '@/features/tasks/hooks'
import { useMyBalances, useMyLeaveRequests } from '@/features/leave/hooks'
import { usePlanningSlots } from '@/features/planning/hooks'
import { useAnnouncements, useMeetings, useRecognitions } from '@/features/engagement/hooks'
import { useMyAssets } from '@/features/assets/hooks'
import { useMyTrainings } from '@/features/training/hooks'
import { useMyAcknowledgements, usePolicies } from '@/features/policy/hooks'
import { useMyAppraisals } from '@/features/appraisal/hooks'
import { useMySalaryRuns } from '@/features/salary/hooks'
import { getTaskDelay } from '@/features/tasks/delay'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/toast-context'
import { DashboardCustomizer } from './DashboardCustomizer'
import { useDashboardPreferences } from './dashboard-preferences'

import { EMPLOYEE_WIDGET_CATALOG, WIDE_WIDGET_IDS } from './widget-catalog'
const EMPLOYEE_WIDGETS = EMPLOYEE_WIDGET_CATALOG

const ATT_STATUS: Record<
  string,
  { label: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'slate' }
> = {
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

function useMyPendingPolicyCount(policyIds: string[], myAcks: Set<string> | undefined) {
  const { data = 0 } = useQuery({
    queryKey: ['my-pending-policies', policyIds.join('|'), myAcks?.size ?? 0],
    enabled: policyIds.length > 0 && !!myAcks,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('policy_versions')
        .select('id,policy_id,version')
        .in('policy_id', policyIds)
        .order('version', { ascending: false })
      if (error) return 0
      const latest = new Map<string, string>()
      for (const v of data ?? []) if (!latest.has(v.policy_id)) latest.set(v.policy_id, v.id)
      let pending = 0
      for (const id of latest.values()) if (!myAcks!.has(id)) pending++
      return pending
    },
  })
  return data
}

export function EmployeeDashboard() {
  const [customizing, setCustomizing] = useState(false)
  const toast = useToast()
  const { preferences, save } = useDashboardPreferences(
    'employee',
    EMPLOYEE_WIDGETS.map((widget) => widget.id),
  )
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
  const { data: meetings = [] } = useMeetings()
  const { data: recognitions = [] } = useRecognitions()
  const { data: myAssets = [] } = useMyAssets(user?.id ?? null)
  const { data: myTrainings = [] } = useMyTrainings()
  const { data: myAcks } = useMyAcknowledgements()
  const { data: policies = [] } = usePolicies()
  const { data: myAppraisals = [] } = useMyAppraisals()
  const { data: mySalary = [] } = useMySalaryRuns()

  const myTasks = tasks.filter((t) => t.created_by === user?.id || t.assignee_id === user?.id)
  const myOpenTasks = myTasks.filter((t) => !t.status?.is_terminal)
  const leaveRemaining = balances.reduce(
    (sum, b) => sum + (Number(b.allocated) - Number(b.used)),
    0,
  )
  const leaveAllocated = balances.reduce((sum, b) => sum + Number(b.allocated), 0)
  const pendingLeaveCount = leaveRequests.filter((l) => l.status === 'pending').length
  const plannedSlots = slots.filter((s) => s.task_name?.trim())
  const myAwaiting = myTasks.filter((t) => t.status?.slug === 'awaiting_approval').length
  const myRework = myTasks.filter((t) => t.status?.slug === 'rework').length
  const myOverdue = myTasks.filter(
    (t) => !t.status?.is_terminal && getTaskDelay(t.due_date, null).state === 'overdue',
  ).length
  const owedApprovals = tasks.filter(
    (t) =>
      t.status?.slug === 'awaiting_approval' &&
      t.assignee_id !== user?.id &&
      (t.created_by === user?.id || t.creator?.id === user?.id),
  ).length
  const trainingsPending = myTrainings.filter((t) => t.status !== 'completed').length
  const policiesPending = useMyPendingPolicyCount(policies.map((p) => p.id), myAcks)
  const todayStart = `${today}T00:00:00`
  const todayEnd = `${today}T23:59:59`
  const myMeetingsToday = meetings.filter(
    (m) => m.starts_at && m.starts_at >= todayStart && m.starts_at <= todayEnd,
  ).length
  const lastSalary = mySalary[0]
  const myCurrentAppraisal = myAppraisals[0]
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
  const content: Record<string, ReactNode> = {
    attendance: (
      <Stat
        label="Attendance today"
        value={attValue}
        sub={attSub}
        icon={Fingerprint}
        tone={attInfo?.tone === 'red' ? 'red' : att?.day ? 'green' : 'amber'}
        to="/attendance"
      />
    ),
    tasks: (
      <Stat
        label="Open tasks"
        value={myOpenTasks.length}
        sub={`${myTasks.length} total`}
        icon={ListChecks}
        tone="blue"
        to="/tasks"
      />
    ),
    leave: (
      <Stat
        label="Leave remaining"
        value={leaveRemaining}
        sub={`of ${leaveAllocated} allocated`}
        icon={Plane}
        tone="green"
        to="/leave"
      />
    ),
    planning: (
      <Stat
        label="Today's plan"
        value={plannedSlots.length ? `${avgProgress}%` : '—'}
        sub={`${plannedSlots.length} slot${plannedSlots.length === 1 ? '' : 's'} planned`}
        icon={CalendarRange}
        tone="brand"
        to="/planning"
      />
    ),
    'my-awaiting-approval': (
      <Stat
        label="Submitted (awaiting approval)"
        value={myAwaiting}
        icon={ClipboardList}
        tone="amber"
        to="/tasks"
      />
    ),
    'my-rework': (
      <Stat label="My tasks in rework" value={myRework} icon={ClipboardList} tone="amber" to="/tasks" />
    ),
    'my-overdue': (
      <Stat label="My overdue tasks" value={myOverdue} icon={CalendarRange} tone="red" to="/tasks" />
    ),
    'approvals-owed': (
      <Stat
        label="Awaiting my approval"
        value={owedApprovals}
        icon={CheckCheck}
        tone="amber"
        to="/tasks"
      />
    ),
    'my-training': (
      <Stat
        label="Pending trainings"
        value={trainingsPending}
        icon={GraduationCap}
        tone="brand"
        to="/training"
      />
    ),
    'my-policies': (
      <Stat
        label="Policies to acknowledge"
        value={policiesPending}
        icon={BookText}
        tone="amber"
        to="/policies"
      />
    ),
    'my-workflows': (
      <Stat
        label="My workflow steps"
        value={0}
        sub="See 'My Workflows' for pending actions"
        icon={GitBranch}
        tone="brand"
        to="/my-workflows"
      />
    ),
    'my-assets': (
      <Stat
        label="Assets assigned to me"
        value={myAssets.length}
        icon={Package}
        tone="brand"
        to="/my-assets"
      />
    ),
    'recognition-recent': (
      <Stat
        label="Recent recognition"
        value={recognitions.slice(0, 5).length}
        sub={recognitions[0]?.note?.slice(0, 48) ?? '—'}
        icon={Sparkles}
        tone="green"
        to="/recognition"
      />
    ),
    'meetings-today': (
      <Stat
        label="Meetings today"
        value={myMeetingsToday}
        icon={Users}
        tone="brand"
        to="/visitors"
      />
    ),
    'my-salary': (
      <Stat
        label="Latest salary slip"
        value={lastSalary ? `₹${Number(lastSalary.net ?? 0).toLocaleString('en-IN')}` : '—'}
        sub={lastSalary ? String(lastSalary.period_month).slice(0, 7) : 'Not yet available'}
        icon={Wallet}
        tone="green"
        to="/salary"
      />
    ),
    'my-appraisal': (
      <Stat
        label="My current appraisal"
        value={myCurrentAppraisal?.overall_score != null ? `${myCurrentAppraisal.overall_score}%` : '—'}
        sub={myCurrentAppraisal?.cycle?.name ?? 'No active cycle'}
        icon={Award}
        tone="brand"
        to="/appraisal"
      />
    ),

    'leave-balances': (
      <Card>
        <CardBody data-testid="dash-leave-balances">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Leave balances</h2>
            <Link to="/leave" className="text-brand-600 text-xs font-medium hover:underline">
              Apply
            </Link>
          </div>
          {balances.length === 0 ? (
            <p className="text-sm text-slate-400">No leave balances allocated yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {balances.map((b) => {
                const remaining = Number(b.allocated) - Number(b.used)
                const pct =
                  Number(b.allocated) > 0 ? (Number(b.used) / Number(b.allocated)) * 100 : 0
                return (
                  <li key={b.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{b.leave_type?.name ?? 'Leave'}</span>
                      <span className="font-medium text-slate-900">
                        {remaining}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          left of {b.allocated}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="bg-brand-500 h-full rounded-full"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
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
    ),
    announcements: (
      <Card>
        <CardBody data-testid="dash-announcements">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Latest announcements</h2>
            <Link
              to="/announcements"
              className="text-brand-600 text-xs font-medium hover:underline"
            >
              Notice board
            </Link>
          </div>
          {announcements.length === 0 ? (
            <p className="text-sm text-slate-400">No announcements posted.</p>
          ) : (
            <ul className="space-y-3">
              {announcements.slice(0, 4).map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <span className="bg-brand-50 text-brand-600 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md">
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
    ),
  }

  return (
    <div data-testid="employee-dashboard">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-1 text-sm text-slate-600">Your self-service home · {dateLabel}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCustomizing(true)}>
          <Settings2 className="size-4" /> Customize
        </Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {preferences.order
          .filter((id) => !preferences.hidden.includes(id))
          .map((id) => (
            <div
              key={id}
              className={
                WIDE_WIDGET_IDS.has(id) ? 'lg:col-span-2' : undefined
              }
            >
              {content[id]}
            </div>
          ))}
      </div>
      {customizing && (
        <DashboardCustomizer
          widgets={EMPLOYEE_WIDGETS}
          value={preferences}
          saving={save.isPending}
          onClose={() => setCustomizing(false)}
          onSave={(value) =>
            save.mutate(value, {
              onSuccess: ({ synced, error }) => {
                if (synced) toast.success('Dashboard saved')
                else toast.info('Saved on this device', error)
                setCustomizing(false)
              },
            })
          }
        />
      )}
    </div>
  )
}
