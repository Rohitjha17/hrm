/**
 * Dashboard widget catalogs — the full menu the Customize dialog exposes.
 * Grouped so the dialog can section them (Attendance, Tasks, …). The id is
 * stable; label is shown in the Customize list; `group` is the section header;
 * `size` controls grid span (1 = tile, 2 = wide card).
 */

export type DashboardMode = 'admin' | 'employee'

export interface WidgetDef {
  id: string
  label: string
  group: string
  size?: 1 | 2
}

export const ADMIN_WIDGET_CATALOG: WidgetDef[] = [
  // People
  { id: 'employees',          label: 'Total employees',             group: 'People' },
  { id: 'departments',        label: 'Departments',                 group: 'People' },

  // Attendance
  { id: 'present',            label: 'Present today',               group: 'Attendance' },
  { id: 'absent-today',       label: 'Absent today',                group: 'Attendance' },
  { id: 'late',               label: 'Late arrivals today',         group: 'Attendance' },
  { id: 'overtime-today',     label: 'Overtime minutes (today)',    group: 'Attendance' },
  { id: 'missed-punchouts',   label: 'Missed punch-outs',           group: 'Attendance' },

  // Leave
  { id: 'leave-approvals',    label: 'Pending leave approvals',     group: 'Leave' },
  { id: 'leave-list',         label: 'Pending leave approvals (list)', group: 'Leave', size: 2 },

  // Tasks
  { id: 'open-tasks',         label: 'Open tasks',                  group: 'Tasks' },
  { id: 'awaiting-approvals', label: 'Tasks awaiting approval',     group: 'Tasks' },
  { id: 'rework-tasks',       label: 'Tasks in rework',             group: 'Tasks' },
  { id: 'overdue-tasks',      label: 'Overdue tasks',               group: 'Tasks' },

  // Helpdesk
  { id: 'open-tickets',       label: 'Open tickets',                group: 'Helpdesk' },
  { id: 'sla-breaches',       label: 'Helpdesk SLA breaches',       group: 'Helpdesk' },

  // Recruitment
  { id: 'candidates-pipeline',label: 'Active candidates',           group: 'Recruitment' },
  { id: 'interviews-today',   label: 'Interviews today',            group: 'Recruitment' },

  // Workplace
  { id: 'visitors-today',     label: 'Visitors today',              group: 'Workplace' },
  { id: 'meetings-today',     label: 'Meetings today',              group: 'Workplace' },

  // Performance & growth
  { id: 'appraisals-pending', label: 'Appraisals pending',          group: 'Performance' },
  { id: 'trainings-progress', label: 'Trainings in progress',       group: 'Performance' },
  { id: 'unack-policies',     label: 'Unacknowledged policies',     group: 'Performance' },
  { id: 'assets-assigned',    label: 'Assets assigned',             group: 'Workplace' },

  // Communication
  { id: 'announcements',      label: 'Latest announcements',        group: 'Communication', size: 2 },
]

export const EMPLOYEE_WIDGET_CATALOG: WidgetDef[] = [
  // My day
  { id: 'attendance',         label: 'Attendance today',            group: 'My Day' },
  { id: 'planning',           label: "Today's plan",                group: 'My Day' },
  { id: 'meetings-today',     label: 'Meetings today',              group: 'My Day' },

  // Tasks
  { id: 'tasks',              label: 'My open tasks',               group: 'Tasks' },
  { id: 'my-awaiting-approval', label: 'My tasks awaiting approval', group: 'Tasks' },
  { id: 'my-rework',          label: 'My tasks in rework',          group: 'Tasks' },
  { id: 'my-overdue',         label: 'My overdue tasks',            group: 'Tasks' },
  { id: 'approvals-owed',     label: 'Awaiting my approval',        group: 'Tasks' },

  // Leave + salary
  { id: 'leave',              label: 'Leave remaining',             group: 'Account' },
  { id: 'leave-balances',     label: 'Leave balances',              group: 'Account', size: 2 },
  { id: 'my-salary',          label: 'Latest salary slip',          group: 'Account' },

  // Growth
  { id: 'my-appraisal',       label: 'My appraisal',                group: 'Growth' },
  { id: 'my-training',        label: 'My pending trainings',        group: 'Growth' },
  { id: 'my-policies',        label: 'Policies to acknowledge',     group: 'Growth' },
  { id: 'my-workflows',       label: 'My workflow steps',           group: 'Growth' },

  // Resources
  { id: 'my-assets',          label: 'My assets',                   group: 'Resources' },
  { id: 'recognition-recent', label: 'Recent recognition',          group: 'Resources' },

  // Communication
  { id: 'announcements',      label: 'Latest announcements',        group: 'Communication', size: 2 },
]

export const WIDE_WIDGET_IDS: ReadonlySet<string> = new Set(
  [...ADMIN_WIDGET_CATALOG, ...EMPLOYEE_WIDGET_CATALOG]
    .filter((widget) => widget.size === 2)
    .map((widget) => widget.id),
)
