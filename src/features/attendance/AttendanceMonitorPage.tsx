import { useState } from 'react'
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
  const [date, setDate] = useState(todayInTz(tz))
  const { data: rows = [], isLoading } = useAdminAttendance(date)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useAttendanceRealtime()

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

      <div className="mb-4 flex items-center gap-2">
        <Label htmlFor="monitor-date" className="mb-0">
          Date
        </Label>
        <Input
          id="monitor-date"
          data-testid="monitor-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-44"
        />
        <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-emerald-600">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" /> live
        </span>
      </div>

      {!isLoading && rows.length === 0 ? (
        <EmptyState title="No attendance recorded for this date" testid="monitor-empty" />
      ) : (
        <Table data-testid="monitor-table">
          <Thead>
            <tr>
              <Th>Employee</Th>
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
