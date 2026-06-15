import { useState } from 'react'
import { Clock, Fingerprint, MapPin } from 'lucide-react'
import { useAttendanceConfig, useMyAttendance, type PunchResult } from './hooks'
import { SelfiePunchModal } from './SelfiePunchModal'
import { todayInTz, formatMinutes } from './geo'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/toast-context'

const STATUS_LABEL: Record<string, string> = {
  present: 'Present (in progress)',
  full_day: 'Full Day',
  half_day: 'Half Day',
  quarter_day: 'Quarter Day',
  absent: 'Absent / Short',
}

export function PunchPage() {
  const { data: config } = useAttendanceConfig()
  const tz = config?.timezone ?? 'Asia/Kolkata'
  const workDate = todayInTz(tz)
  const { data, isLoading } = useMyAttendance(workDate)
  const toast = useToast()
  const [modalType, setModalType] = useState<'in' | 'out' | null>(null)

  const open = data?.open ?? false
  const day = data?.day
  const punches = data?.punches ?? []

  function handleSuccess(res: PunchResult) {
    setModalType(null)
    toast.success(
      res.punch_type === 'in' ? 'Punched in' : 'Punched out',
      res.status ? `Status: ${STATUS_LABEL[res.status] ?? res.status}` : undefined,
    )
  }

  return (
    <div data-testid="attendance-page">
      <PageHeader title="My Attendance" description={`Today · ${workDate}`} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardBody className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Today’s status</p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  data-testid="today-status"
                  data-status={day?.status ?? 'none'}
                  className="text-xl font-bold text-slate-900"
                >
                  {day ? (STATUS_LABEL[day.status] ?? day.status) : 'Not started'}
                </span>
                {day?.is_late && <Badge tone="amber">Late</Badge>}
                {(day?.overtime_minutes ?? 0) > 0 && <Badge tone="blue">OT</Badge>}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock className="size-4 text-slate-400" />
              Worked: <span data-testid="today-worked" className="font-semibold text-slate-900">
                {formatMinutes(day?.worked_minutes ?? 0)}
              </span>
            </div>

            <Button
              size="lg"
              className="w-full"
              data-testid="punch-button"
              variant={open ? 'danger' : 'primary'}
              onClick={() => setModalType(open ? 'out' : 'in')}
            >
              <Fingerprint className="size-5" />
              {open ? 'Punch Out' : 'Punch In'}
            </Button>

            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin className="size-3" />
              Requires location within {config?.radius_meters ?? 50} m of the office. A live selfie
              is captured.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="mb-3 text-sm font-medium text-slate-500">Today’s punches</p>
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : punches.length === 0 ? (
              <EmptyState title="No punches yet today" testid="punches-empty" />
            ) : (
              <ul className="space-y-2" data-testid="punches-list">
                {punches.map((p) => (
                  <li
                    key={p.id}
                    data-testid="punch-row"
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Badge tone={p.punch_type === 'in' ? 'green' : 'slate'}>
                        {p.punch_type === 'in' ? 'IN' : 'OUT'}
                      </Badge>
                      {new Date(p.punched_at).toLocaleTimeString()}
                    </span>
                    <span className="flex items-center gap-3 text-xs text-slate-500">
                      {p.distance_meters != null && <span>{Math.round(p.distance_meters)} m</span>}
                      {p.selfie_path && <span data-testid="punch-selfie">📷</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {modalType && (
        <SelfiePunchModal
          type={modalType}
          onClose={() => setModalType(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
