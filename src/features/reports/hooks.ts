import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ReportColumn } from './export'
import { statusLabel } from '@/features/attendance/status'
import { formatDate, formatTime } from '@/lib/format'

export type ReportType =
  | 'attendance'
  | 'leave'
  | 'salary'
  | 'task'
  | 'appraisal'
  | 'planning'
  | 'recruitment'
  | 'communication'
  | 'documents'
  | 'assets'
  | 'lifecycle'
  | 'helpdesk'
  | 'visitors'
  | 'meetings'
  | 'training'
  | 'policies'
  | 'workflows'

export interface ReportFilters {
  from?: string
  to?: string
  userId?: string
}

export interface ReportData {
  title: string
  filename: string
  columns: ReportColumn[]
  rows: Record<string, unknown>[]
}

export const REPORT_LABELS: Record<ReportType, string> = {
  attendance: 'Attendance',
  leave: 'Leave',
  salary: 'Salary',
  task: 'Task',
  appraisal: 'Performance / Appraisal',
  planning: 'Planning',
  recruitment: 'Recruitment',
  communication: 'Communication',
  documents: 'Doc Vault',
  assets: 'Assets',
  lifecycle: 'Lifecycle',
  helpdesk: 'Helpdesk',
  visitors: 'Visitors',
  meetings: 'Meetings',
  training: 'Training',
  policies: 'Policies',
  workflows: 'Workflows',
}

type Person = { full_name: string | null; email: string } | null
const name = (p: Person) => p?.full_name || p?.email || '—'

interface AttRow {
  work_date: string
  status: string
  first_in_at: string | null
  last_out_at: string | null
  worked_minutes: number
  is_late: boolean
  late_minutes: number
  missed_punch_out: boolean
  is_manual: boolean
  remarks: string | null
  overtime_minutes: number
  profiles: Person
}

interface LeaveRow {
  start_date: string
  end_date: string
  days: number
  status: string
  leave_type: { name: string } | null
  requester: Person
}
interface SalaryRow {
  period_month: string
  present_days: number
  gross: number
  net: number
  employee: Person
}
interface TaskRow {
  title: string
  priority: string
  due_date: string | null
  created_at: string
  completed_at: string | null
  progress_percent: number
  status: { name: string } | null
  assignee: Person
  creator: Person
}
interface ApprRow {
  attendance_score: number
  task_score: number
  planning_score: number
  overall_score: number
  employee: Person
  cycle: { name: string } | null
}

const fetchers: Record<ReportType, (f: ReportFilters) => Promise<ReportData>> = {
  attendance: async (f) => {
    // Same finalization the monitor and salary run, so all three agree.
    await supabase.rpc('close_stale_attendance')
    let q = supabase
      .from('attendance_days')
      .select('work_date,status,first_in_at,last_out_at,worked_minutes,is_late,late_minutes,missed_punch_out,is_manual,remarks,overtime_minutes, profiles(full_name,email)')
    if (f.userId) q = q.eq('user_id', f.userId)
    if (f.from) q = q.gte('work_date', f.from)
    if (f.to) q = q.lte('work_date', f.to)
    const { data, error } = await q.order('work_date', { ascending: false }).limit(1000)
    if (error) throw error
    const list = (data ?? []) as unknown as AttRow[]
    return {
      title: 'Attendance Report',
      filename: 'attendance-report',
      columns: [
        { key: 'employee', label: 'Employee' },
        { key: 'date', label: 'Date' },
        { key: 'status', label: 'Status' },
        { key: 'punchIn', label: 'Punch In' },
        { key: 'punchOut', label: 'Punch Out' },
        { key: 'worked', label: 'Worked (min)' },
        { key: 'late', label: 'Late By (min)' },
        { key: 'overtime', label: 'Overtime (min)' },
        { key: 'remarks', label: 'Remarks' },
      ],
      rows: list.map((d) => ({
        employee: name(d.profiles),
        date: formatDate(d.work_date),
        status: statusLabel(d.status),
        punchIn: formatTime(d.first_in_at),
        punchOut: formatTime(d.last_out_at),
        worked: d.worked_minutes,
        late: d.is_late ? d.late_minutes : 0,
        overtime: d.overtime_minutes,
        remarks: [
          d.missed_punch_out ? 'Missed punch-out' : '',
          d.is_manual ? `Corrected: ${d.remarks ?? ''}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        // Not columns — drive the row colours on screen and in the PDF.
        _status: d.status,
        _sunday: new Date(`${d.work_date}T00:00:00`).getDay() === 0,
      })),
    }
  },
  leave: async (f) => {
    let q = supabase
      .from('leave_requests')
      .select(
        'start_date,end_date,days,status, leave_type:leave_types(name), requester:profiles!leave_requests_user_id_fkey(full_name,email)',
      )
    if (f.userId) q = q.eq('user_id', f.userId)
    if (f.from) q = q.gte('start_date', f.from)
    if (f.to) q = q.lte('start_date', f.to)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(1000)
    if (error) throw error
    const list = (data ?? []) as unknown as LeaveRow[]
    return {
      title: 'Leave Report',
      filename: 'leave-report',
      columns: [
        { key: 'employee', label: 'Employee' },
        { key: 'type', label: 'Type' },
        { key: 'from', label: 'From' },
        { key: 'to', label: 'To' },
        { key: 'days', label: 'Days' },
        { key: 'status', label: 'Status' },
      ],
      rows: list.map((r) => ({
        employee: name(r.requester),
        type: r.leave_type?.name,
        from: r.start_date,
        to: r.end_date,
        days: r.days,
        status: r.status,
      })),
    }
  },
  salary: async (f) => {
    let q = supabase
      .from('salary_runs')
      .select('period_month,present_days,gross,net, employee:profiles!salary_runs_user_id_fkey(full_name,email)')
    if (f.userId) q = q.eq('user_id', f.userId)
    if (f.from) q = q.gte('period_month', f.from)
    if (f.to) q = q.lte('period_month', f.to)
    const { data, error } = await q.order('period_month', { ascending: false }).limit(1000)
    if (error) throw error
    const list = (data ?? []) as unknown as SalaryRow[]
    return {
      title: 'Salary Report',
      filename: 'salary-report',
      columns: [
        { key: 'employee', label: 'Employee' },
        { key: 'month', label: 'Month' },
        { key: 'present', label: 'Present Days' },
        { key: 'gross', label: 'Gross' },
        { key: 'net', label: 'Net' },
      ],
      rows: list.map((r) => ({
        employee: name(r.employee),
        month: String(r.period_month).slice(0, 7),
        present: r.present_days,
        gross: r.gross,
        net: r.net,
      })),
    }
  },
  task: async (f) => {
    let q = supabase
      .from('tasks')
      .select(
        'title,priority,due_date,created_at,completed_at,progress_percent, status:task_statuses(name), assignee:profiles!tasks_assignee_id_fkey(full_name,email), creator:profiles!tasks_created_by_fkey(full_name,email)',
      )
    if (f.userId) q = q.eq('assignee_id', f.userId)
    if (f.from) q = q.gte('created_at', f.from)
    if (f.to) q = q.lte('created_at', `${f.to}T23:59:59`)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(1000)
    if (error) throw error
    const list = (data ?? []) as unknown as TaskRow[]
    return {
      title: 'Task Report',
      filename: 'task-report',
      columns: [
        { key: 'title', label: 'Task' },
        { key: 'assignee', label: 'Assignee' },
        { key: 'assignor', label: 'Assigned By' },
        { key: 'status', label: 'Status' },
        { key: 'priority', label: 'Priority' },
        { key: 'progress', label: 'Completion %' },
        { key: 'created', label: 'Created Date' },
        { key: 'due', label: 'Due Date' },
        { key: 'completed', label: 'Completed Date' },
      ],
      rows: list.map((t) => ({
        title: t.title,
        assignee: name(t.assignee),
        assignor: name(t.creator),
        status: t.status?.name,
        priority: t.priority,
        progress: t.progress_percent,
        created: formatDate(t.created_at),
        due: formatDate(t.due_date),
        completed: formatDate(t.completed_at),
      })),
    }
  },
  appraisal: async (f) => {
    let q = supabase
      .from('appraisals')
      .select(
        'attendance_score,task_score,planning_score,overall_score, employee:profiles!appraisals_user_id_fkey(full_name,email), cycle:appraisal_cycles(name)',
      )
    if (f.userId) q = q.eq('user_id', f.userId)
    if (f.from) q = q.gte('created_at', f.from)
    if (f.to) q = q.lte('created_at', `${f.to}T23:59:59`)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(1000)
    if (error) throw error
    const list = (data ?? []) as unknown as ApprRow[]
    return {
      title: 'Performance / Appraisal Report',
      filename: 'appraisal-report',
      columns: [
        { key: 'employee', label: 'Employee' },
        { key: 'cycle', label: 'Cycle' },
        { key: 'attendance', label: 'Attendance' },
        { key: 'task', label: 'Task' },
        { key: 'planning', label: 'Planning' },
        { key: 'overall', label: 'Overall' },
      ],
      rows: list.map((a) => ({
        employee: name(a.employee),
        cycle: a.cycle?.name,
        attendance: a.attendance_score,
        task: a.task_score,
        planning: a.planning_score,
        overall: a.overall_score,
      })),
    }
  },
  planning: async (f) => {
    let q = supabase
      .from('planning_slots')
      .select('plan_date,slot_label,task_name,progress,challenges,remarks, profiles(full_name,email)')
    if (f.userId) q = q.eq('user_id', f.userId)
    if (f.from) q = q.gte('plan_date', f.from)
    if (f.to) q = q.lte('plan_date', f.to)
    const { data, error } = await q.order('plan_date', { ascending: false }).limit(1000)
    if (error) throw error
    type Row = { plan_date: string; slot_label: string; task_name: string; progress: number; challenges: string | null; remarks: string | null; profiles: Person }
    const list = (data ?? []) as unknown as Row[]
    return {
      title: 'Planning Report',
      filename: 'planning-report',
      columns: [
        { key: 'employee', label: 'Employee' },
        { key: 'date', label: 'Date' },
        { key: 'slot', label: 'Slot' },
        { key: 'task', label: 'Task' },
        { key: 'progress', label: 'Progress %' },
        { key: 'challenges', label: 'Challenges' },
        { key: 'remarks', label: 'Remarks' },
      ],
      rows: list.map((r) => ({
        employee: name(r.profiles),
        date: r.plan_date,
        slot: r.slot_label,
        task: r.task_name,
        progress: r.progress,
        challenges: r.challenges ?? '',
        remarks: r.remarks ?? '',
      })),
    }
  },
  recruitment: async (f) => {
    let q = supabase
      .from('candidates')
      .select('full_name,email,phone,status,offer_status,created_at, opening:job_openings(title,designation)')
    if (f.from) q = q.gte('created_at', f.from)
    if (f.to) q = q.lte('created_at', `${f.to}T23:59:59`)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(1000)
    if (error) throw error
    type Row = { full_name: string; email: string; phone: string | null; status: string; offer_status: string; created_at: string; opening: { title: string; designation: string } | null }
    const list = (data ?? []) as unknown as Row[]
    return {
      title: 'Recruitment Report',
      filename: 'recruitment-report',
      columns: [
        { key: 'candidate', label: 'Candidate' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'opening', label: 'Opening' },
        { key: 'status', label: 'Status' },
        { key: 'offer', label: 'Offer' },
      ],
      rows: list.map((c) => ({
        candidate: c.full_name,
        email: c.email,
        phone: c.phone ?? '',
        opening: c.opening ? `${c.opening.designation}` : '—',
        status: c.status,
        offer: c.offer_status,
      })),
    }
  },
  communication: async (f) => {
    let q = supabase
      .from('onboarding')
      .select('status,started_at, employee:profiles(full_name,email), onboarding_items(status)')
    if (f.userId) q = q.eq('employee_id', f.userId)
    if (f.from) q = q.gte('started_at', f.from)
    if (f.to) q = q.lte('started_at', `${f.to}T23:59:59`)
    const { data, error } = await q.order('started_at', { ascending: false }).limit(1000)
    if (error) throw error
    type Row = { status: string; started_at: string; employee: Person; onboarding_items: { status: string }[] }
    const list = (data ?? []) as unknown as Row[]
    return {
      title: 'Communication (Onboarding) Report',
      filename: 'communication-report',
      columns: [
        { key: 'employee', label: 'Employee' },
        { key: 'started', label: 'Started' },
        { key: 'status', label: 'Status' },
        { key: 'items', label: 'Checklist items' },
        { key: 'verified', label: 'Verified' },
      ],
      rows: list.map((o) => ({
        employee: name(o.employee),
        started: String(o.started_at).slice(0, 10),
        status: o.status,
        items: o.onboarding_items.length,
        verified: o.onboarding_items.filter((i) => i.status === 'verified').length,
      })),
    }
  },
  documents: async (f) => {
    let q = supabase
      .from('employee_documents')
      .select('doc_type,title,version,created_at, employee:profiles!employee_documents_employee_id_fkey(full_name,email)')
    if (f.userId) q = q.eq('employee_id', f.userId)
    if (f.from) q = q.gte('created_at', f.from)
    if (f.to) q = q.lte('created_at', `${f.to}T23:59:59`)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(1000)
    if (error) throw error
    type Row = { doc_type: string; title: string; version: number; created_at: string; employee: Person }
    const list = (data ?? []) as unknown as Row[]
    return {
      title: 'Doc Vault Report',
      filename: 'doc-vault-report',
      columns: [
        { key: 'employee', label: 'Employee' },
        { key: 'type', label: 'Type' },
        { key: 'title', label: 'Title' },
        { key: 'version', label: 'Version' },
        { key: 'uploaded', label: 'Uploaded' },
      ],
      rows: list.map((d) => ({
        employee: name(d.employee),
        type: d.doc_type,
        title: d.title,
        version: d.version,
        uploaded: String(d.created_at).slice(0, 10),
      })),
    }
  },
  assets: async (f) => {
    let q = supabase
      .from('asset_assignments')
      .select('assigned_at,returned_at,note, asset:assets(name,asset_type,serial,status), assignee:profiles!asset_assignments_assignee_id_fkey(full_name,email)')
    if (f.userId) q = q.eq('assignee_id', f.userId)
    if (f.from) q = q.gte('assigned_at', f.from)
    if (f.to) q = q.lte('assigned_at', `${f.to}T23:59:59`)
    const { data, error } = await q.order('assigned_at', { ascending: false }).limit(1000)
    if (error) throw error
    type Row = { assigned_at: string; returned_at: string | null; note: string | null; asset: { name: string; asset_type: string; serial: string | null; status: string } | null; assignee: Person }
    const list = (data ?? []) as unknown as Row[]
    return {
      title: 'Asset Allotment Report',
      filename: 'assets-report',
      columns: [
        { key: 'asset', label: 'Asset' },
        { key: 'type', label: 'Type' },
        { key: 'serial', label: 'Serial' },
        { key: 'assignee', label: 'Assignee' },
        { key: 'assigned', label: 'Assigned' },
        { key: 'returned', label: 'Returned' },
      ],
      rows: list.map((a) => ({
        asset: a.asset?.name ?? '—',
        type: a.asset?.asset_type ?? '—',
        serial: a.asset?.serial ?? '',
        assignee: name(a.assignee),
        assigned: String(a.assigned_at).slice(0, 10),
        returned: a.returned_at ? String(a.returned_at).slice(0, 10) : '—',
      })),
    }
  },
  lifecycle: async (f) => {
    let q = supabase
      .from('lifecycle_events')
      .select('event_type,event_date,note, employee:profiles!lifecycle_events_employee_id_fkey(full_name,email)')
    if (f.userId) q = q.eq('employee_id', f.userId)
    if (f.from) q = q.gte('event_date', f.from)
    if (f.to) q = q.lte('event_date', f.to)
    const { data, error } = await q.order('event_date', { ascending: false }).limit(1000)
    if (error) throw error
    type Row = { event_type: string; event_date: string; note: string | null; employee: Person }
    const list = (data ?? []) as unknown as Row[]
    return {
      title: 'Lifecycle Report',
      filename: 'lifecycle-report',
      columns: [
        { key: 'employee', label: 'Employee' },
        { key: 'event', label: 'Event' },
        { key: 'date', label: 'Date' },
        { key: 'note', label: 'Note' },
      ],
      rows: list.map((e) => ({
        employee: name(e.employee),
        event: e.event_type,
        date: e.event_date,
        note: e.note ?? '',
      })),
    }
  },
  helpdesk: async (f) => {
    let q = supabase
      .from('tickets')
      .select('subject,category,priority,status,escalated,created_at, raiser:profiles!tickets_raised_by_fkey(full_name,email)')
    if (f.userId) q = q.eq('raised_by', f.userId)
    if (f.from) q = q.gte('created_at', f.from)
    if (f.to) q = q.lte('created_at', `${f.to}T23:59:59`)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(1000)
    if (error) throw error
    type Row = { subject: string; category: string; priority: string; status: string; escalated: boolean; created_at: string; raiser: Person }
    const list = (data ?? []) as unknown as Row[]
    return {
      title: 'Helpdesk Report',
      filename: 'helpdesk-report',
      columns: [
        { key: 'subject', label: 'Subject' },
        { key: 'raiser', label: 'Raised by' },
        { key: 'category', label: 'Category' },
        { key: 'priority', label: 'Priority' },
        { key: 'status', label: 'Status' },
        { key: 'escalated', label: 'Escalated' },
      ],
      rows: list.map((t) => ({
        subject: t.subject,
        raiser: name(t.raiser),
        category: t.category,
        priority: t.priority,
        status: t.status,
        escalated: t.escalated ? 'Yes' : 'No',
      })),
    }
  },
  visitors: async (f) => {
    let q = supabase
      .from('visitors')
      .select('name,company,purpose,visit_date,checked_in_at,checked_out_at, host:profiles!visitors_host_id_fkey(full_name,email)')
    if (f.userId) q = q.eq('host_id', f.userId)
    if (f.from) q = q.gte('visit_date', f.from)
    if (f.to) q = q.lte('visit_date', f.to)
    const { data, error } = await q.order('visit_date', { ascending: false }).limit(1000)
    if (error) throw error
    type Row = { name: string; company: string | null; purpose: string | null; visit_date: string; checked_in_at: string | null; checked_out_at: string | null; host: Person }
    const list = (data ?? []) as unknown as Row[]
    return {
      title: 'Visitors Report',
      filename: 'visitors-report',
      columns: [
        { key: 'visitor', label: 'Visitor' },
        { key: 'company', label: 'Company' },
        { key: 'host', label: 'Host' },
        { key: 'date', label: 'Date' },
        { key: 'checkin', label: 'Checked in' },
        { key: 'checkout', label: 'Checked out' },
      ],
      rows: list.map((v) => ({
        visitor: v.name,
        company: v.company ?? '',
        host: name(v.host),
        date: v.visit_date,
        checkin: v.checked_in_at ? new Date(v.checked_in_at).toLocaleTimeString() : '—',
        checkout: v.checked_out_at ? new Date(v.checked_out_at).toLocaleTimeString() : '—',
      })),
    }
  },
  meetings: async (f) => {
    let q = supabase
      .from('meetings')
      .select('title,starts_at,ends_at,meeting_link, host:profiles!meetings_host_id_fkey(full_name,email), meeting_invitees(status)')
    if (f.userId) q = q.eq('host_id', f.userId)
    if (f.from) q = q.gte('starts_at', f.from)
    if (f.to) q = q.lte('starts_at', `${f.to}T23:59:59`)
    const { data, error } = await q.order('starts_at', { ascending: false }).limit(1000)
    if (error) throw error
    type Row = { title: string; starts_at: string; ends_at: string | null; meeting_link: string | null; host: Person; meeting_invitees: { status: string }[] }
    const list = (data ?? []) as unknown as Row[]
    return {
      title: 'Meetings Report',
      filename: 'meetings-report',
      columns: [
        { key: 'title', label: 'Meeting' },
        { key: 'host', label: 'Host' },
        { key: 'starts', label: 'Starts' },
        { key: 'invitees', label: 'Invitees' },
        { key: 'accepted', label: 'Accepted' },
      ],
      rows: list.map((m) => ({
        title: m.title,
        host: name(m.host),
        starts: new Date(m.starts_at).toLocaleString(),
        invitees: m.meeting_invitees.length,
        accepted: m.meeting_invitees.filter((i) => i.status === 'accepted').length,
      })),
    }
  },
  training: async (f) => {
    let q = supabase
      .from('training_assignments')
      .select('status,assigned_at,completed_at,acknowledged_at, module:training_modules(title), assignee:profiles!training_assignments_user_id_fkey(full_name,email)')
    if (f.userId) q = q.eq('user_id', f.userId)
    if (f.from) q = q.gte('assigned_at', f.from)
    if (f.to) q = q.lte('assigned_at', `${f.to}T23:59:59`)
    const { data, error } = await q.order('assigned_at', { ascending: false }).limit(1000)
    if (error) throw error
    type Row = { status: string; assigned_at: string; completed_at: string | null; acknowledged_at: string | null; module: { title: string } | null; assignee: Person }
    const list = (data ?? []) as unknown as Row[]
    return {
      title: 'Training Report',
      filename: 'training-report',
      columns: [
        { key: 'module', label: 'Module' },
        { key: 'assignee', label: 'Assignee' },
        { key: 'status', label: 'Status' },
        { key: 'assigned', label: 'Assigned' },
        { key: 'completed', label: 'Completed' },
        { key: 'acknowledged', label: 'Acknowledged' },
      ],
      rows: list.map((t) => ({
        module: t.module?.title ?? '—',
        assignee: name(t.assignee),
        status: t.status,
        assigned: String(t.assigned_at).slice(0, 10),
        completed: t.completed_at ? String(t.completed_at).slice(0, 10) : '—',
        acknowledged: t.acknowledged_at ? String(t.acknowledged_at).slice(0, 10) : '—',
      })),
    }
  },
  policies: async (f) => {
    let q = supabase.from('policies').select('title,category,current_version,is_active,created_at')
    if (f.from) q = q.gte('created_at', f.from)
    if (f.to) q = q.lte('created_at', `${f.to}T23:59:59`)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(1000)
    if (error) throw error
    type Row = { title: string; category: string; current_version: number; is_active: boolean; created_at: string }
    const list = (data ?? []) as unknown as Row[]
    return {
      title: 'Policies Report',
      filename: 'policies-report',
      columns: [
        { key: 'title', label: 'Policy' },
        { key: 'category', label: 'Category' },
        { key: 'version', label: 'Version' },
        { key: 'active', label: 'Active' },
        { key: 'created', label: 'Created' },
      ],
      rows: list.map((p) => ({
        title: p.title,
        category: p.category,
        version: p.current_version,
        active: p.is_active ? 'Yes' : 'No',
        created: String(p.created_at).slice(0, 10),
      })),
    }
  },
  workflows: async (f) => {
    let q = supabase
      .from('workflow_definitions')
      .select(
        'name,entity_type,is_active,created_at, owner:profiles!workflow_definitions_owner_id_fkey(full_name,email), workflow_steps(step_order)',
      )
    if (f.userId) q = q.eq('owner_id', f.userId)
    if (f.from) q = q.gte('created_at', f.from)
    if (f.to) q = q.lte('created_at', `${f.to}T23:59:59`)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(1000)
    if (error) throw error
    type Row = { name: string; entity_type: string; is_active: boolean; created_at: string; owner: Person; workflow_steps: { step_order: number }[] }
    const list = (data ?? []) as unknown as Row[]
    return {
      title: 'Workflows (Rulebook) Report',
      filename: 'workflows-report',
      columns: [
        { key: 'name', label: 'Workflow' },
        { key: 'owner', label: 'Owner' },
        { key: 'entity', label: 'Applies to' },
        { key: 'steps', label: 'Steps' },
        { key: 'active', label: 'Active' },
        { key: 'created', label: 'Created' },
      ],
      rows: list.map((w) => ({
        name: w.name,
        owner: name(w.owner),
        entity: w.entity_type,
        steps: w.workflow_steps.length,
        active: w.is_active ? 'Yes' : 'No',
        created: String(w.created_at).slice(0, 10),
      })),
    }
  },
}

export function useReport(type: ReportType, filters: ReportFilters = {}) {
  return useQuery({
    queryKey: ['report', type, filters.from ?? '', filters.to ?? '', filters.userId ?? ''],
    queryFn: () => fetchers[type](filters),
  })
}
