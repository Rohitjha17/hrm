import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Award,
  BookText,
  Briefcase,
  Building2,
  CalendarClock,
  ClipboardCheck,
  CalendarRange,
  FileBarChart,
  Files,
  Fingerprint,
  GitBranch,
  IdCard,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  Milestone,
  Monitor,
  Network,
  Package,
  Plane,
  ScrollText,
  Shield,
  Sparkles,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useAuth } from '@/features/auth/auth-context'
import { useProfile } from '@/features/rbac/profile-context'
import { useViewMode } from '@/features/view-mode/view-mode-context'
import { HealthBadge } from '@/features/health/HealthBadge'
import { cn } from '@/lib/cn'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  testid: string
  perm?: string
}

const adminNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, testid: 'nav-dashboard' },
  {
    to: '/admin/attendance',
    label: 'Attendance',
    icon: CalendarClock,
    testid: 'nav-attendance',
    perm: 'attendance.view_all',
  },
  { to: '/tasks', label: 'Tasks', icon: ListChecks, testid: 'nav-tasks', perm: 'tasks.view_all' },
  {
    to: '/admin/planning',
    label: 'Planning',
    icon: CalendarRange,
    testid: 'nav-planning-admin',
    perm: 'planning.view_all',
  },
  { to: '/admin/leave', label: 'Leave', icon: Plane, testid: 'nav-leave-admin', perm: 'leave.approve' },
  { to: '/admin/salary', label: 'Salary', icon: Wallet, testid: 'nav-salary-admin', perm: 'salary.view' },
  { to: '/admin/appraisal', label: 'Appraisals', icon: Award, testid: 'nav-appraisal-admin', perm: 'appraisal.view' },
  { to: '/admin/reports', label: 'Reports', icon: FileBarChart, testid: 'nav-reports', perm: 'reports.view' },
  { to: '/admin/policies', label: 'Policies', icon: BookText, testid: 'nav-policies-admin', perm: 'policy.manage' },
  { to: '/admin/workflows', label: 'Workflows', icon: GitBranch, testid: 'nav-workflows', perm: 'workflow.manage' },
  { to: '/admin/recruitment', label: 'Recruitment', icon: Briefcase, testid: 'nav-recruitment', perm: 'recruitment.view' },
  { to: '/admin/onboarding', label: 'Onboarding', icon: ClipboardCheck, testid: 'nav-onboarding', perm: 'onboarding.manage' },
  { to: '/admin/documents', label: 'Documents', icon: Files, testid: 'nav-documents', perm: 'documents.view' },
  { to: '/admin/assets', label: 'Assets', icon: Package, testid: 'nav-assets', perm: 'assets.view' },
  { to: '/admin/lifecycle', label: 'Lifecycle', icon: Milestone, testid: 'nav-lifecycle', perm: 'lifecycle.manage' },
  { to: '/helpdesk', label: 'Helpdesk', icon: LifeBuoy, testid: 'nav-helpdesk-admin', perm: 'helpdesk.manage' },
  { to: '/approvals', label: 'Approvals', icon: Inbox, testid: 'nav-approvals-admin' },
  { to: '/admin/visitors', label: 'Visitors', icon: IdCard, testid: 'nav-visitors', perm: 'visitors.manage' },
  { to: '/admin/monitoring', label: 'Monitoring', icon: Monitor, testid: 'nav-monitoring', perm: 'monitoring.view' },
  { to: '/admin/users', label: 'Employees', icon: Users, testid: 'nav-users', perm: 'users.view' },
  { to: '/admin/roles', label: 'Roles', icon: Shield, testid: 'nav-roles', perm: 'roles.view' },
  {
    to: '/admin/hierarchy',
    label: 'Departments & Teams',
    icon: Network,
    testid: 'nav-hierarchy',
    perm: 'hierarchy.view',
  },
  { to: '/admin/audit', label: 'Audit Log', icon: ScrollText, testid: 'nav-audit', perm: 'audit.view' },
]

const employeeNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, testid: 'nav-dashboard' },
  {
    to: '/attendance',
    label: 'My Attendance',
    icon: Fingerprint,
    testid: 'nav-my-attendance',
    perm: 'attendance.view_own',
  },
  { to: '/tasks', label: 'Tasks', icon: ListChecks, testid: 'nav-tasks', perm: 'tasks.view_own' },
  {
    to: '/planning',
    label: 'Planning',
    icon: CalendarRange,
    testid: 'nav-planning',
    perm: 'planning.view_own',
  },
  { to: '/leave', label: 'Leave', icon: Plane, testid: 'nav-leave', perm: 'leave.view_own' },
  { to: '/salary', label: 'Salary', icon: Wallet, testid: 'nav-salary', perm: 'salary.view_own' },
  { to: '/appraisal', label: 'Appraisals', icon: Award, testid: 'nav-appraisal', perm: 'appraisal.view_own' },
  { to: '/policies', label: 'Policies', icon: BookText, testid: 'nav-policies' },
  { to: '/approvals', label: 'Approvals', icon: Inbox, testid: 'nav-approvals' },
  { to: '/helpdesk', label: 'Helpdesk', icon: LifeBuoy, testid: 'nav-helpdesk' },
  { to: '/announcements', label: 'Notice Board', icon: Megaphone, testid: 'nav-announcements' },
  { to: '/recognition', label: 'Recognition', icon: Sparkles, testid: 'nav-recognition' },
  { to: '/monitoring', label: 'Monitoring', icon: Monitor, testid: 'nav-monitoring-self' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { hasPermission } = useProfile()
  const { mode, canToggle, setMode } = useViewMode()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const items = (mode === 'admin' ? adminNav : employeeNav).filter(
    (item) => !item.perm || hasPermission(item.perm),
  )

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        data-testid="sidebar"
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Building2 className="size-5" />
          </div>
          <span className="text-lg font-bold text-slate-900">HRMS</span>
        </div>
        <nav className="space-y-1 p-3" data-testid={`nav-${mode}`}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              data-testid={item.testid}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {mobileOpen && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            data-testid="menu-toggle"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          {canToggle && (
            <div
              className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
              data-testid="view-mode-toggle"
            >
              <button
                data-testid="view-mode-admin"
                onClick={() => setMode('admin')}
                aria-pressed={mode === 'admin'}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium',
                  mode === 'admin' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500',
                )}
              >
                Admin View
              </button>
              <button
                data-testid="view-mode-employee"
                onClick={() => setMode('employee')}
                aria-pressed={mode === 'employee'}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium',
                  mode === 'employee' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500',
                )}
              >
                Employee View
              </button>
            </div>
          )}

          <div className="flex-1" />
          <span className="sr-only" data-testid="active-view-mode">
            {mode}
          </span>
          <HealthBadge />
          <div className="hidden text-sm text-slate-600 sm:block" data-testid="current-user-email">
            {user?.email}
          </div>
          <button
            onClick={handleSignOut}
            data-testid="sign-out"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8" data-testid="app-main">
          {children}
        </main>
      </div>
    </div>
  )
}
