import { useMemo, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Award,
  BookText,
  Briefcase,
  ChevronDown,
  Building2,
  CalendarClock,
  ClipboardCheck,
  CalendarRange,
  FileBarChart,
  Files,
  Fingerprint,
  GitBranch,
  GraduationCap,
  IdCard,
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
  Settings2,
  Shield,
  Sparkles,
  Users,
  Wallet,
  X,
  SlidersHorizontal,
} from 'lucide-react'
import { useAuth } from '@/features/auth/auth-context'
import { useProfile } from '@/features/rbac/profile-context'
import { useViewMode } from '@/features/view-mode/view-mode-context'
import { HealthBadge } from '@/features/health/HealthBadge'
import { SidebarCustomizer } from './SidebarCustomizer'
import { useSidebarPreferences } from './sidebar-preferences'
import { groupForNav, sidebarGroupsFor } from './sidebar-groups'
import { useToast } from '@/components/ui/toast-context'
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
  {
    to: '/admin/leave',
    label: 'Leave',
    icon: Plane,
    testid: 'nav-leave-admin',
    perm: 'leave.approve',
  },
  {
    to: '/admin/salary',
    label: 'Salary',
    icon: Wallet,
    testid: 'nav-salary-admin',
    perm: 'salary.view',
  },
  {
    to: '/admin/appraisal',
    label: 'Appraisals',
    icon: Award,
    testid: 'nav-appraisal-admin',
    perm: 'appraisal.view',
  },
  {
    to: '/admin/reports',
    label: 'Reports',
    icon: FileBarChart,
    testid: 'nav-reports',
    perm: 'reports.view',
  },
  {
    to: '/admin/policies',
    label: 'Policies',
    icon: BookText,
    testid: 'nav-policies-admin',
    perm: 'policy.manage',
  },
  {
    to: '/admin/workflows',
    label: 'Workflows',
    icon: GitBranch,
    testid: 'nav-workflows',
    perm: 'workflow.manage',
  },
  {
    to: '/admin/recruitment',
    label: 'Recruitment',
    icon: Briefcase,
    testid: 'nav-recruitment',
    perm: 'recruitment.view',
  },
  {
    to: '/admin/onboarding',
    label: 'Communication Templates',
    icon: ClipboardCheck,
    testid: 'nav-onboarding',
    perm: 'onboarding.manage',
  },
  {
    to: '/admin/documents',
    label: 'Doc Vault',
    icon: Files,
    testid: 'nav-documents',
    perm: 'documents.view',
  },
  {
    to: '/admin/assets',
    label: 'Assets',
    icon: Package,
    testid: 'nav-assets',
    perm: 'assets.view',
  },
  {
    to: '/admin/lifecycle',
    label: 'Lifecycle',
    icon: Milestone,
    testid: 'nav-lifecycle',
    perm: 'lifecycle.manage',
  },
  {
    to: '/admin/training',
    label: 'Training',
    icon: GraduationCap,
    testid: 'nav-training',
    perm: 'training.manage',
  },
  {
    to: '/helpdesk',
    label: 'Helpdesk',
    icon: LifeBuoy,
    testid: 'nav-helpdesk-admin',
    perm: 'helpdesk.manage',
  },
  { to: '/recognition', label: 'Recognition', icon: Sparkles, testid: 'nav-recognition-admin' },
  {
    to: '/admin/visitors',
    label: 'Visitors & Meetings',
    icon: IdCard,
    testid: 'nav-visitors',
    perm: 'visitors.manage',
  },
  {
    to: '/admin/monitoring',
    label: 'Monitoring',
    icon: Monitor,
    testid: 'nav-monitoring',
    perm: 'monitoring.view',
  },
  { to: '/admin/users', label: 'Users', icon: Users, testid: 'nav-users', perm: 'users.view' },
  { to: '/admin/roles', label: 'Roles', icon: Shield, testid: 'nav-roles', perm: 'roles.view' },
  {
    to: '/admin/hierarchy',
    label: 'Departments & Teams',
    icon: Network,
    testid: 'nav-hierarchy',
    perm: 'hierarchy.view',
  },
  {
    to: '/admin/masters',
    label: 'Centralized Masters',
    icon: SlidersHorizontal,
    testid: 'nav-masters',
    perm: 'users.manage',
  },
  {
    to: '/admin/audit',
    label: 'Audit Log',
    icon: ScrollText,
    testid: 'nav-audit',
    perm: 'audit.view',
  },
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
  {
    to: '/appraisal',
    label: 'Appraisals',
    icon: Award,
    testid: 'nav-appraisal',
    perm: 'appraisal.view_own',
  },
  { to: '/policies', label: 'Policies', icon: BookText, testid: 'nav-policies' },
  { to: '/my-workflows', label: 'My Workflows', icon: GitBranch, testid: 'nav-my-workflows' },
  { to: '/helpdesk', label: 'Helpdesk', icon: LifeBuoy, testid: 'nav-helpdesk' },
  { to: '/announcements', label: 'Notice Board', icon: Megaphone, testid: 'nav-announcements' },
  { to: '/recognition', label: 'Recognition', icon: Sparkles, testid: 'nav-recognition' },
  { to: '/my-assets', label: 'My Assets', icon: Package, testid: 'nav-my-assets' },
  { to: '/visitors', label: 'Visitors & Meetings', icon: IdCard, testid: 'nav-visitors-self' },
  { to: '/training', label: 'My Training', icon: GraduationCap, testid: 'nav-training-self' },
  { to: '/monitoring', label: 'Monitoring', icon: Monitor, testid: 'nav-monitoring-self' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { hasPermission, profile } = useProfile()
  const { mode, canToggle, setMode } = useViewMode()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [customizerOpen, setCustomizerOpen] = useState(false)
  const toast = useToast()

  // Default order = alphabetical within each group (requirement: alphabetical
  // dropdowns). Dashboard always comes first because it is the "home" item.
  // Users who customize their sidebar still see their saved order — this only
  // controls the default for first-time use.
  const permittedItems = (mode === 'admin' ? adminNav : employeeNav)
    .filter((item) => !item.perm || hasPermission(item.perm))
    .sort((a, b) => {
      if (a.to === '/') return -1
      if (b.to === '/') return 1
      const ga = groupForNav(mode, a.testid)
      const gb = groupForNav(mode, b.testid)
      if (ga !== gb) return 0 // keep nav array's group ordering stable
      return a.label.localeCompare(b.label)
    })
  const itemIds = permittedItems.map((item) => item.testid)
  const { preferences, save } = useSidebarPreferences(mode, itemIds)
  const items = useMemo(() => {
    const byId = new Map(permittedItems.map((item) => [item.testid, item]))
    return preferences.order
      .map((id) => byId.get(id))
      .filter((item): item is NavItem => !!item && !preferences.hidden.includes(item.testid))
  }, [permittedItems, preferences])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-slate-200 bg-white transition-[transform,width] lg:static lg:translate-x-0',
          preferences.collapsed && 'lg:w-20',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        data-testid="sidebar"
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-4">
          <div className="bg-brand-600 flex size-9 items-center justify-center rounded-lg text-white">
            <Building2 className="size-5" />
          </div>
          <span
            className={cn('text-lg font-bold text-slate-900', preferences.collapsed && 'lg:hidden')}
          >
            HRMS
          </span>
        </div>
        <nav className="flex-1 space-y-2 overflow-y-auto p-3" data-testid={`nav-${mode}`}>
          {sidebarGroupsFor(mode)
            .concat({ id: 'other', label: 'Other' })
            .map((group) => {
              const groupItems = items.filter(
                (item) => groupForNav(mode, item.testid) === group.id,
              )
              if (groupItems.length === 0) return null
              const collapsed = preferences.collapsedGroups.includes(group.id)
              return (
                <div key={group.id} data-testid={`nav-group-${group.id}`}>
                  {!preferences.collapsed && (
                    <button
                      type="button"
                      aria-expanded={!collapsed}
                      data-testid={`nav-group-toggle-${group.id}`}
                      onClick={() =>
                        save.mutate({
                          ...preferences,
                          collapsedGroups: collapsed
                            ? preferences.collapsedGroups.filter((id) => id !== group.id)
                            : [...preferences.collapsedGroups, group.id],
                        })
                      }
                      className="flex w-full items-center justify-between px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                    >
                      <span>{group.label}</span>
                      <ChevronDown
                        className={cn(
                          'size-3.5 transition-transform',
                          collapsed && '-rotate-90',
                        )}
                      />
                    </button>
                  )}
                  {!collapsed &&
                    groupItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        data-testid={item.testid}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                            preferences.collapsed && 'lg:justify-center lg:px-2',
                            isActive
                              ? 'bg-brand-50 text-brand-700'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                          )
                        }
                      >
                        <item.icon className="size-5 shrink-0" />
                        <span className={cn(preferences.collapsed && 'lg:hidden')}>
                          {item.label}
                        </span>
                        {preferences.collapsed && <span className="sr-only">{item.label}</span>}
                      </NavLink>
                    ))}
                </div>
              )
            })}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            data-testid="customize-sidebar-button"
            onClick={() => setCustomizerOpen(true)}
            title="Customize sidebar"
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              preferences.collapsed && 'lg:justify-center lg:px-2',
            )}
          >
            <Settings2 className="size-5 shrink-0" />
            <span className={cn(preferences.collapsed && 'lg:hidden')}>Customize sidebar</span>
          </button>
        </div>
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
                  mode === 'admin' ? 'text-brand-700 bg-white shadow-sm' : 'text-slate-500',
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
                  mode === 'employee' ? 'text-brand-700 bg-white shadow-sm' : 'text-slate-500',
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
          {profile?.avatar_url && (
            <img
              src={profile.avatar_url}
              alt={`${profile.full_name || 'User'} profile`}
              className="size-8 rounded-full object-cover"
            />
          )}
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

      {customizerOpen && (
        <SidebarCustomizer
          open
          mode={mode}
          items={permittedItems.map((item) => ({
            id: item.testid,
            label: item.label,
            icon: item.icon,
            group: groupForNav(mode, item.testid),
          }))}
          value={preferences}
          saving={save.isPending}
          onClose={() => setCustomizerOpen(false)}
          onSave={(next) =>
            save.mutate(next, {
              onSuccess: ({ synced, error }) => {
                if (synced)
                  toast.success('Sidebar updated', 'Your layout is synced across devices.')
                else toast.info('Sidebar updated on this device', error)
                setCustomizerOpen(false)
              },
              onError: (error) => toast.error('Could not save sidebar', (error as Error).message),
            })
          }
        />
      )}
    </div>
  )
}
