import { useMemo, useState } from 'react'
import { Settings } from 'lucide-react'
import {
  useAdminAttendance,
  useAttendanceConfig,
  useAttendanceRealtime,
  useUpdateAttendanceConfig,
} from './hooks'
import { todayInTz, formatMinutes } from './geo'
import { useProfile } from '@/features/rbac/profile-context'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Modal } from '@/components/ui/Modal'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'slate' | 'blue'> = {
  full_day: 'green',
  present: 'blue',
  half_day: 'amber',
  quarter_day: 'amber',
  absent: 'red',
}

export function AttendanceMonitorPage() {
  const { hasPermission } = useProfile()
  const canManage = hasPermission('attendance.manage')
  const { data: config } = useAttendanceConfig()
  const tz = config?.timezone ?? 'Asia/Kolkata'
  const today = todayInTz(tz)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const { data: rows = [], isLoading } = useAdminAttendance(from, to)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const multiDay = from !== to

  useAttendanceRealtime()

  const summary = useMemo(() => {
    const s = {
      records: rows.length,
      employees: new Set(rows.map((r) => r.user_id)).size,
      fullDays: 0,
      halfDays: 0,
      absents: 0,
      lates: 0,
      workedMinutes: 0,
      overtimeMinutes: 0,
    }
    for (const r of rows) {
      if (r.status === 'full_day' || r.status === 'present') s.fullDays++
      else if (r.status === 'half_day' || r.status === 'quarter_day') s.halfDays++
      else if (r.status === 'absent') s.absents++
      if (r.is_late) s.lates++
      s.workedMinutes += r.worked_minutes ?? 0
      s.overtimeMinutes += r.overtime_minutes ?? 0
    }
    return s
  }, [rows])

  const perEmployee = useMemo(() => {
    if (!multiDay) return []
    const map = new Map<
      string,
      { name: string; email: string; days: number; worked: number; lates: number; overtime: number }
    >()
    for (const r of rows) {
      const key = r.user_id
      const cur = map.get(key) ?? {
        name: r.profiles?.full_name || r.profiles?.email || r.user_id,
        email: r.profiles?.email ?? r.user_id,
        days: 0,
        worked: 0,
        lates: 0,
        overtime: 0,
      }
      if (r.status !== 'absent') cur.days++
      cur.worked += r.worked_minutes ?? 0
      if (r.is_late) cur.lates++
      cur.overtime += r.overtime_minutes ?? 0
      map.set(key, cur)
    }
    return [...map.values()].sort((a, b) => b.worked - a.worked)
  }, [rows, multiDay])

  return (
    <div data-testid="attendance-monitor-page">
      <PageHeader
        title="Attendance Monitor"
        description="Live view — punches sync here in real time."
        actions={
          canManage && (
            <Button variant="outline" data-testid="monitor-settings-button" onClick={() => setSettingsOpen(true)}>
              <Settings className="size-4" /> Settings
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Label htmlFor="monitor-from" className="mb-0">
          From
        </Label>
        <Input
          id="monitor-from"
          data-testid="monitor-from"
          type="date"
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
          className="w-44"
        />
        <Label htmlFor="monitor-to" className="mb-0">
          To
        </Label>
        <Input
          id="monitor-to"
          data-testid="monitor-to"
          type="date"
          value={to}
          min={from}
          onChange={(e) => setTo(e.target.value)}
          className="w-44"
        />
        <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-emerald-600">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" /> live
        </span>
      </div>

      <div data-testid="monitor-summary" className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <SummaryTile label="Employees" value={String(summary.employees)} testid="summary-employees" />
        <SummaryTile label="Records" value={String(summary.records)} testid="summary-records" />
        <SummaryTile label="Full / Present" value={String(summary.fullDays)} testid="summary-full" tone="text-emerald-600" />
        <SummaryTile label="Half / Quarter" value={String(summary.halfDays)} testid="summary-half" tone="text-amber-600" />
        <SummaryTile label="Absent" value={String(summary.absents)} testid="summary-absent" tone="text-red-600" />
        <SummaryTile label="Late arrivals" value={String(summary.lates)} testid="summary-late" tone="text-amber-600" />
        <SummaryTile label="Total worked" value={formatMinutes(summary.workedMinutes)} testid="summary-worked" />
      </div>

      {multiDay && perEmployee.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Per-employee summary ({from} → {to})</h3>
          <Table data-testid="monitor-emp-summary">
            <Thead>
              <tr>
                <Th>Employee</Th>
                <Th>Days present</Th>
                <Th>Total worked</Th>
                <Th>Late</Th>
                <Th>Overtime</Th>
              </tr>
            </Thead>
            <Tbody>
              {perEmployee.map((e) => (
                <tr key={e.email} data-testid={`emp-summary-${e.email}`}>
                  <Td className="font-medium text-slate-900">{e.name}</Td>
                  <Td>{e.days}</Td>
                  <Td>{formatMinutes(e.worked)}</Td>
                  <Td>{e.lates > 0 ? <Badge tone="amber">{e.lates}</Badge> : '—'}</Td>
                  <Td>{e.overtime > 0 ? formatMinutes(e.overtime) : '—'}</Td>
                </tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}

      {!isLoading && rows.length === 0 ? (
        <EmptyState title="No attendance recorded for this range" testid="monitor-empty" />
      ) : (
        <Table data-testid="monitor-table">
          <Thead>
            <tr>
              <Th>Employee</Th>
              {multiDay && <Th>Date</Th>}
              <Th>Status</Th>
              <Th>Worked</Th>
              <Th>First In</Th>
              <Th>Last Out</Th>
              <Th>Flags</Th>
            </tr>
          </Thead>
          <Tbody>
            {rows.map((r) => (
              <tr key={r.id} data-testid={`monitor-row-${r.profiles?.email ?? r.user_id}`}>
                <Td className="font-medium text-slate-900">
                  {r.profiles?.full_name || r.profiles?.email || r.user_id}
                </Td>
                {multiDay && <Td className="text-xs text-slate-500">{r.work_date}</Td>}
                <Td>
                  <span data-status={r.status}>
                    <Badge tone={STATUS_TONE[r.status] ?? 'slate'}>{r.status}</Badge>
                  </span>
                </Td>
                <Td>{formatMinutes(r.worked_minutes)}</Td>
                <Td className="text-xs text-slate-500">
                  {r.first_in_at ? new Date(r.first_in_at).toLocaleTimeString() : '—'}
                </Td>
                <Td className="text-xs text-slate-500">
                  {r.last_out_at ? new Date(r.last_out_at).toLocaleTimeString() : '—'}
                </Td>
                <Td>
                  <div className="flex gap-1">
                    {r.is_late && <Badge tone="amber">Late</Badge>}
                    {r.overtime_minutes > 0 && <Badge tone="blue">OT {r.overtime_minutes}m</Badge>}
                  </div>
                </Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      )}

      {settingsOpen && <ConfigModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

function SummaryTile({
  label,
  value,
  testid,
  tone = 'text-slate-900',
}: {
  label: string
  value: string
  testid: string
  tone?: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2" data-testid={testid}>
      <div className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{label}</div>
      <div className={`text-lg font-semibold ${tone}`}>{value}</div>
    </div>
  )
}

function ConfigModal({ onClose }: { onClose: () => void }) {
  const { data: config } = useAttendanceConfig()
  const update = useUpdateAttendanceConfig()
  const toast = useToast()
  const [radius, setRadius] = useState(String(config?.radius_meters ?? 50))
  const [fullDay, setFullDay] = useState(String(config?.full_day_hours ?? 8))
  const [halfDay, setHalfDay] = useState(String(config?.half_day_hours ?? 4))
  const [quarterDay, setQuarterDay] = useState(String(config?.quarter_day_hours ?? 2))
  const [grace, setGrace] = useState(String(config?.grace_minutes ?? 10))

  return (
    <Modal open onClose={onClose} title="Attendance settings" testid="config-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          update.mutate(
            {
              radius_meters: Number(radius),
              full_day_hours: Number(fullDay),
              half_day_hours: Number(halfDay),
              quarter_day_hours: Number(quarterDay),
              grace_minutes: Number(grace),
            },
            {
              onSuccess: () => {
                toast.success('Settings saved')
                onClose()
              },
              onError: (err) => toast.error('Save failed', (err as Error).message),
            },
          )
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cfg-radius">Radius (m)</Label>
            <Input id="cfg-radius" data-testid="cfg-radius" type="number" value={radius} onChange={(e) => setRadius(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cfg-grace">Late grace (min)</Label>
            <Input id="cfg-grace" type="number" value={grace} onChange={(e) => setGrace(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cfg-full">Full day (hrs)</Label>
            <Input id="cfg-full" data-testid="cfg-full-day" type="number" step="0.5" value={fullDay} onChange={(e) => setFullDay(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cfg-half">Half day (hrs)</Label>
            <Input id="cfg-half" data-testid="cfg-half-day" type="number" step="0.5" value={halfDay} onChange={(e) => setHalfDay(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cfg-quarter">Quarter day (hrs)</Label>
            <Input id="cfg-quarter" data-testid="cfg-quarter-day" type="number" step="0.5" value={quarterDay} onChange={(e) => setQuarterDay(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="save-config" loading={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}
