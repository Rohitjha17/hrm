import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ReportColumn } from './export'

export type ReportType = 'attendance' | 'leave' | 'salary' | 'task' | 'appraisal'

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
}

type Person = { full_name: string | null; email: string } | null
const name = (p: Person) => p?.full_name || p?.email || '—'

interface AttRow {
  work_date: string
  status: string
  worked_minutes: number
  is_late: boolean
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
  status: { name: string } | null
  assignee: Person
}
interface ApprRow {
  attendance_score: number
  task_score: number
  planning_score: number
  overall_score: number
  increment_recommendation: number
  promotion_recommended: boolean
  employee: Person
  cycle: { name: string } | null
}

const fetchers: Record<ReportType, () => Promise<ReportData>> = {
  attendance: async () => {
    const { data, error } = await supabase
      .from('attendance_days')
      .select('work_date,status,worked_minutes,is_late,overtime_minutes, profiles(full_name,email)')
      .order('work_date', { ascending: false })
      .limit(1000)
    if (error) throw error
    const list = (data ?? []) as unknown as AttRow[]
    return {
      title: 'Attendance Report',
      filename: 'attendance-report',
      columns: [
        { key: 'employee', label: 'Employee' },
        { key: 'date', label: 'Date' },
        { key: 'status', label: 'Status' },
        { key: 'worked', label: 'Worked (min)' },
        { key: 'late', label: 'Late' },
        { key: 'overtime', label: 'Overtime (min)' },
      ],
      rows: list.map((d) => ({
        employee: name(d.profiles),
        date: d.work_date,
        status: d.status,
        worked: d.worked_minutes,
        late: d.is_late ? 'Yes' : 'No',
        overtime: d.overtime_minutes,
      })),
    }
  },
  leave: async () => {
    const { data, error } = await supabase
      .from('leave_requests')
      .select(
        'start_date,end_date,days,status, leave_type:leave_types(name), requester:profiles!leave_requests_user_id_fkey(full_name,email)',
      )
      .order('created_at', { ascending: false })
      .limit(1000)
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
  salary: async () => {
    const { data, error } = await supabase
      .from('salary_runs')
      .select('period_month,present_days,gross,net, employee:profiles!salary_runs_user_id_fkey(full_name,email)')
      .order('period_month', { ascending: false })
      .limit(1000)
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
  task: async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select(
        'title,priority,due_date, status:task_statuses(name), assignee:profiles!tasks_assignee_id_fkey(full_name,email)',
      )
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) throw error
    const list = (data ?? []) as unknown as TaskRow[]
    return {
      title: 'Task Report',
      filename: 'task-report',
      columns: [
        { key: 'title', label: 'Task' },
        { key: 'assignee', label: 'Assignee' },
        { key: 'status', label: 'Status' },
        { key: 'priority', label: 'Priority' },
        { key: 'due', label: 'Due' },
      ],
      rows: list.map((t) => ({
        title: t.title,
        assignee: name(t.assignee),
        status: t.status?.name,
        priority: t.priority,
        due: t.due_date ?? '',
      })),
    }
  },
  appraisal: async () => {
    const { data, error } = await supabase
      .from('appraisals')
      .select(
        'attendance_score,task_score,planning_score,overall_score,increment_recommendation,promotion_recommended, employee:profiles!appraisals_user_id_fkey(full_name,email), cycle:appraisal_cycles(name)',
      )
      .order('created_at', { ascending: false })
      .limit(1000)
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
        { key: 'increment', label: 'Increment %' },
        { key: 'promotion', label: 'Promotion' },
      ],
      rows: list.map((a) => ({
        employee: name(a.employee),
        cycle: a.cycle?.name,
        attendance: a.attendance_score,
        task: a.task_score,
        planning: a.planning_score,
        overall: a.overall_score,
        increment: a.increment_recommendation,
        promotion: a.promotion_recommended ? 'Yes' : 'No',
      })),
    }
  },
}

export function useReport(type: ReportType) {
  return useQuery({
    queryKey: ['report', type],
    queryFn: () => fetchers[type](),
  })
}
