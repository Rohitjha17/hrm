import { useState } from 'react'
import { Info } from 'lucide-react'
import {
  useCaptureReport,
  useMonitoringConfig,
  useUpdateMonitoringConfig,
  type ReportPeriod,
} from './hooks'
import { useUsers } from '@/features/admin/users/hooks'
import { useProfile } from '@/features/rbac/profile-context'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

export function MonitoringReportPage() {
  const { hasPermission } = useProfile()
  const canConfig = hasPermission('monitoring.config')
  const { data: config } = useMonitoringConfig()
  const updateConfig = useUpdateMonitoringConfig()
  const { data: users = [] } = useUsers()
  const toast = useToast()
  const [period, setPeriod] = useState<ReportPeriod>('daily')
  const [employeeId, setEmployeeId] = useState('')
  const { data: captures = [] } = useCaptureReport(period, employeeId)
  const nameById = new Map(users.map((u) => [u.id, u.full_name || u.email]))

  return (
    <div data-testid="monitoring-report-page">
      <PageHeader title="Monitoring Reports" description="Daily / weekly / monthly screenshot captures." />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" data-testid="report-limitation-note">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Captures here are <strong>opt-in</strong> (consent-based). The interval below is the
          setting a future <strong>native desktop agent</strong> would consume for true background
          monitoring — browsers cannot capture silently. Note storage cost: screenshots consume the
          Supabase Storage quota quickly; apply retention/compression.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Period</Label>
          <Select data-testid="monitoring-period" value={period} onChange={(e) => setPeriod(e.target.value as ReportPeriod)} className="w-36">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Employee</Label>
          <Select data-testid="monitoring-employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-48">
            <option value="">All employees</option>
            {users.map((u) => (<option key={u.id} value={u.id}>{u.full_name || u.email}</option>))}
          </Select>
        </div>
        {canConfig && config && (
          <div className="ml-auto flex items-end gap-2">
            <div>
              <Label className="text-xs">Capture interval (agent)</Label>
              <Select
                data-testid="monitoring-interval"
                value={String(config.capture_interval_minutes)}
                onChange={(e) => updateConfig.mutate(Number(e.target.value), { onSuccess: () => toast.success('Interval saved') })}
                className="w-28"
              >
                {[10, 15, 20, 30].map((m) => (<option key={m} value={m}>{m} min</option>))}
              </Select>
            </div>
          </div>
        )}
      </div>

      {captures.length === 0 ? (
        <EmptyState title="No captures for this period" testid="report-empty" />
      ) : (
        <Table data-testid="report-table">
          <Thead>
            <tr>
              <Th>Employee</Th>
              <Th>Captured at</Th>
              <Th>System</Th>
              <Th>Activity</Th>
            </tr>
          </Thead>
          <Tbody>
            {captures.map((c) => (
              <tr key={c.id} data-testid="report-capture-row">
                <Td className="font-medium text-slate-900">
                  {c.profiles?.full_name || nameById.get(c.user_id) || '—'}
                </Td>
                <Td className="text-sm">{new Date(c.captured_at).toLocaleString()}</Td>
                <Td className="text-xs text-slate-500">{c.system_name}</Td>
                <Td><Badge tone={c.activity_status === 'active' ? 'green' : 'slate'}>{c.activity_status}</Badge></Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
