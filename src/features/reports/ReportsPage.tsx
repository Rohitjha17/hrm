import { useState } from 'react'
import { FileSpreadsheet, FileText, X } from 'lucide-react'
import { REPORT_LABELS, useReport, type ReportType } from './hooks'
import { exportExcel, exportPdf } from './export'
import { useUsers } from '@/features/admin/users/hooks'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/cn'

const TYPES: ReportType[] = ['attendance', 'leave', 'salary', 'task', 'appraisal']

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
        description="Attendance, leave, salary, task & performance reports. Export to Excel or PDF."
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
                onClick={() => exportPdf(data.title, data.filename, data.columns, data.rows)}
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
              <tr key={i} data-testid="report-row">
                {data.columns.map((c) => (
                  <Td key={c.key}>{String(row[c.key] ?? '')}</Td>
                ))}
              </tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
