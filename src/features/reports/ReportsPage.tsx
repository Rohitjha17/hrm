import { useState } from 'react'
import { FileSpreadsheet, FileText, X } from 'lucide-react'
import { REPORT_LABELS, useReport, type ReportType } from './hooks'
import { exportExcel, exportPdf, type CellFill } from './export'
import { ATTENDANCE_STATUS, LEGEND, SUNDAY_META } from '@/features/attendance/status'
import { Badge } from '@/components/ui/Badge'
import { useUsers } from '@/features/admin/users/hooks'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/cn'

const TYPES: ReportType[] = [
  'attendance',
  'leave',
  'salary',
  'task',
  'appraisal',
  'planning',
  'recruitment',
  'communication',
  'documents',
  'assets',
  'lifecycle',
  'helpdesk',
  'visitors',
  'meetings',
  'training',
  'policies',
  'workflows',
]

// Attendance rows carry _status/_sunday hints: the status cell takes the status
// colour and Sunday rows are shaded, on screen and in the PDF alike.
const attendanceFill: CellFill = (row, key) => {
  const meta = ATTENDANCE_STATUS[String(row._status ?? '')]
  if (key === 'status' && meta) return meta.rgb
  return row._sunday ? SUNDAY_META.rgb : undefined
}

export function ReportsPage() {
  const [type, setType] = useState<ReportType>('attendance')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [userId, setUserId] = useState('')
  const { data: users = [] } = useUsers()
  const { data, isLoading } = useReport(type, {
    from: from || undefined,
    to: to || undefined,
    userId: userId || undefined,
  })
  const hasFilters = !!(from || to || userId)

  return (
    <div data-testid="reports-page">
      <PageHeader
        title="Reports"
        description="Reports across every module — export any of them to Excel or PDF."
        actions={
          data && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                data-testid="export-excel"
                onClick={() => exportExcel(data.filename, data.columns, data.rows)}
              >
                <FileSpreadsheet className="size-4" /> Excel
              </Button>
              <Button
                variant="outline"
                data-testid="export-pdf"
                onClick={() =>
                  exportPdf(
                    data.title,
                    data.filename,
                    data.columns,
                    data.rows,
                    type === 'attendance' ? attendanceFill : undefined,
                  )
                }
              >
                <FileText className="size-4" /> PDF
              </Button>
            </div>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {TYPES.map((t) => (
          <button
            key={t}
            data-testid={`report-tab-${t}`}
            onClick={() => setType(t)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium',
              type === t ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {REPORT_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3" data-testid="report-filters">
        <div>
          <Label htmlFor="report-from" className="text-xs text-slate-500">
            From
          </Label>
          <Input id="report-from" data-testid="report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label htmlFor="report-to" className="text-xs text-slate-500">
            To
          </Label>
          <Input id="report-to" data-testid="report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label htmlFor="report-employee" className="text-xs text-slate-500">
            Employee
          </Label>
          <Select id="report-employee" data-testid="report-employee" value={userId} onChange={(e) => setUserId(e.target.value)} className="w-56">
            <option value="">All employees</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email}
              </option>
            ))}
          </Select>
        </div>
        {hasFilters && (
          <Button
            variant="outline"
            data-testid="clear-report-filters"
            onClick={() => {
              setFrom('')
              setTo('')
              setUserId('')
            }}
          >
            <X className="size-4" /> Clear
          </Button>
        )}
      </div>

      {type === 'attendance' && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5" data-testid="report-legend">
          {LEGEND.map((m) => (
            <span key={m.label} className={cn('rounded-full px-2 py-0.5 text-xs font-medium', m.className)}>
              {m.label}
            </span>
          ))}
        </div>
      )}

      {isLoading || !data ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState title={`No ${REPORT_LABELS[type].toLowerCase()} data`} testid="report-empty" />
      ) : (
        <Table data-testid="report-table">
          <Thead>
            <tr>
              {data.columns.map((c) => (
                <Th key={c.key}>{c.label}</Th>
              ))}
            </tr>
          </Thead>
          <Tbody>
            {data.rows.map((row, i) => (
              <tr
                key={i}
                data-testid="report-row"
                className={cn(type === 'attendance' && !!row._sunday && 'bg-slate-100/70')}
              >
                {data.columns.map((c) => {
                  const meta =
                    type === 'attendance' && c.key === 'status'
                      ? ATTENDANCE_STATUS[String(row._status ?? '')]
                      : undefined
                  return (
                    <Td key={c.key}>
                      {meta ? (
                        <Badge className={meta.className}>{String(row[c.key] ?? '')}</Badge>
                      ) : (
                        String(row[c.key] ?? '')
                      )}
                    </Td>
                  )
                })}
              </tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
