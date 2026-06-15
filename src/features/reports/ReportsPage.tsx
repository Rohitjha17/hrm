import { useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { REPORT_LABELS, useReport, type ReportType } from './hooks'
import { exportExcel, exportPdf } from './export'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/cn'

const TYPES: ReportType[] = ['attendance', 'leave', 'salary', 'task', 'appraisal']

export function ReportsPage() {
  const [type, setType] = useState<ReportType>('attendance')
  const { data, isLoading } = useReport(type)

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
