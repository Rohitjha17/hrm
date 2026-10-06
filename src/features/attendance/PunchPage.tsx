import { useState } from 'react'
import { Clock, Fingerprint, Lock, MapPin } from 'lucide-react'
import { useAttendanceConfig, useMyAttendance, type PunchResult } from './hooks'
import { usePlanningConfig, usePunchInLock } from '@/features/planning/hooks'
import { SelfiePunchModal } from './SelfiePunchModal'
import { todayInTz, formatMinutes } from './geo'
import { ATTENDANCE_STATUS, formatLateBy } from './status'
import { formatDate, formatTime } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/toast-context'

const STATUS_LABEL: Record<string, string> = {
  ...Object.fromEntries(Object.entries(ATTENDANCE_STATUS).map(([k, v]) => [k, v.label])),
  absent: 'Absent / Short',
}

const hrs = (h: number) => `${h} h`

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
  const { data: lock } = usePunchInLock()
  const { data: planConfig } = usePlanningConfig()
  const locked = !open && !!lock?.locked
  const windowStart = planConfig?.day_start?.slice(0, 5) ?? '10:00'
  const windowEnd = planConfig?.day_end?.slice(0, 5) ?? '18:30'

  function handleSuccess(res: PunchResult) {
    setModalType(null)
    toast.success(
      res.punch_type === 'in' ? 'Punched in' : 'Punched out',
      res.status ? `Status: ${STATUS_LABEL[res.status] ?? res.status}` : undefined,
    )
  }

  return (
    <div data-testid="attendance-page">
      <PageHeader title="My Attendance" description={`Today · ${formatDate(workDate)}`} />

      {locked && (
        <div
          data-testid="punch-lock-banner"
          className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">Punch-in locked.</span> Your planning for{' '}
            {lock?.prev_date ? formatDate(lock.prev_date) : 'your last worked day'} is incomplete — add slots on the Planning
            page covering the full working day ({windowStart}–{windowEnd}). Punch-in stays blocked
            every day until that day is fully planned or an admin unlocks it.
          </p>
        </div>
      )}

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
                {day?.is_late && (
                  <Badge tone="amber" data-testid="today-late">
                    Late by {formatLateBy(day.late_minutes)}
                  </Badge>
                )}
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

            {config && (
              <p className="text-xs text-slate-400" data-testid="attendance-thresholds">
                Full day {hrs(config.full_day_hours)} · Half day {hrs(config.half_day_hours)} ·
                Quarter day {hrs(config.quarter_day_hours)} (including a {config.break_minutes} min
                break). Below that the day counts as absent. Punching in up to{' '}
                {config.grace_minutes} min after {config.work_start.slice(0, 5)} is not marked late.
              </p>
            )}
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
                      {formatTime(p.punched_at)}
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
