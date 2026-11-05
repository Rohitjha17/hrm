/**
 * Sidebar grouping (requirement: dropdown-grouped nav for a cleaner panel).
 *
 * Groups are stable identifiers; the admin/employee tables below map each
 * nav testid to its group id. The group label is shown as the group header.
 * Items that aren't listed here fall into the 'other' group so no permitted
 * nav item is ever hidden purely because it lacked a mapping.
 */

export interface SidebarGroupDef {
  id: string
  label: string
}

export const ADMIN_SIDEBAR_GROUPS: SidebarGroupDef[] = [
  { id: 'home',          label: 'Home' },
  { id: 'time',          label: 'Time & Attendance' },
  { id: 'work',          label: 'Work' },
  { id: 'people',        label: 'People' },
  { id: 'compensation',  label: 'Compensation' },
  { id: 'workplace',     label: 'Workplace' },
  { id: 'support',       label: 'Support & Engagement' },
  { id: 'system',        label: 'System' },
]

export const EMPLOYEE_SIDEBAR_GROUPS: SidebarGroupDef[] = [
  { id: 'home',       label: 'Home' },
  { id: 'time',       label: 'My Time' },
  { id: 'work',       label: 'My Work' },
  { id: 'account',    label: 'My Account' },
  { id: 'resources',  label: 'Resources' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'support',    label: 'Help' },
]

export const SIDEBAR_GROUP_FOR: Record<string, Record<string, string>> = {
  admin: {
    'nav-dashboard':    'home',
    'nav-attendance':   'time',
    'nav-planning-admin': 'time',
    'nav-monitoring':   'time',
    'nav-tasks':        'work',
    'nav-reports':      'work',
    'nav-users':        'people',
    'nav-hierarchy':    'people',
    'nav-recruitment':  'people',
    'nav-onboarding':   'people',
    'nav-lifecycle':    'people',
    'nav-salary-admin': 'compensation',
    'nav-appraisal-admin': 'compensation',
    'nav-documents':    'workplace',
    'nav-assets':       'workplace',
    'nav-training':     'workplace',
    'nav-policies-admin': 'workplace',
    'nav-workflows':    'workplace',
    'nav-visitors':     'workplace',
    'nav-leave-admin':  'support',
    'nav-helpdesk-admin': 'support',
    'nav-recognition-admin': 'support',
    'nav-masters':      'system',
    'nav-roles':        'system',
    'nav-audit':        'system',
  },
  employee: {
    'nav-dashboard':      'home',
    'nav-my-attendance':  'time',
    'nav-planning':       'time',
    'nav-tasks':          'work',
    'nav-my-workflows':   'work',
    'nav-leave':          'account',
    'nav-salary':         'account',
    'nav-appraisal':      'account',
    'nav-policies':       'resources',
    'nav-my-assets':      'resources',
    'nav-training-self':  'resources',
    'nav-announcements':  'engagement',
    'nav-recognition':    'engagement',
    'nav-visitors-self':  'engagement',
    'nav-monitoring-self': 'engagement',
    'nav-helpdesk':       'support',
  },
}

/** Group id for a nav testid (falls back to 'other' for unmapped items). */
export function groupForNav(mode: 'admin' | 'employee', testid: string): string {
  return SIDEBAR_GROUP_FOR[mode]?.[testid] ?? 'other'
}

export function sidebarGroupsFor(mode: 'admin' | 'employee'): SidebarGroupDef[] {
  return mode === 'admin' ? ADMIN_SIDEBAR_GROUPS : EMPLOYEE_SIDEBAR_GROUPS
}
