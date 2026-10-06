import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  useAttendanceCorrections,
  useResetAttendance,
  useSetAttendance,
  type AttendanceDay,
  type AttendanceEntry,
} from './hooks'
import { statusLabel } from './status'
import { useUsers } from '@/features/admin/users/hooks'
import { useToast } from '@/components/ui/toast-context'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { formatDateTime } from '@/lib/format'

/** HH:MM of a timestamp in the office timezone (what the time inputs expect). */
function timeInTz(iso: string | null, tz: string): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function useAttendanceDay(userId: string, date: string) {
  return useQuery({
    queryKey: ['admin-attendance', 'day', userId, date],
    enabled: !!userId && !!date,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_days')
        .select('*')
        .eq('user_id', userId)
        .eq('work_date', date)
        .maybeSingle()
      if (error) throw error
      return data as AttendanceDay | null
    },
  })
}

/**
 * Admin entry for historical attendance and corrections of a computed day.
 * Remarks are mandatory and every save lands in the correction audit trail.
 */
export function AttendanceCorrectionModal({
  initialUserId = '',
  initialDate,
  today,
  tz,
  onClose,
}: {
  initialUserId?: string
  initialDate: string
  today: string
  tz: string
  onClose: () => void
}) {
  const { data: users = [] } = useUsers()
  const [userId, setUserId] = useState(initialUserId)
  const [date, setDate] = useState(initialDate)
  const { data: day, isLoading } = useAttendanceDay(userId, date)
  const { data: corrections = [] } = useAttendanceCorrections(userId, date)

  return (
    <Modal open onClose={onClose} title="Add / correct attendance" testid="attendance-correction-modal">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="corr-employee">Employee</Label>
            <Select
              id="corr-employee"
              data-testid="corr-employee"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Select employee</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="corr-date">Date</Label>
            <Input
              id="corr-date"
              data-testid="corr-date"
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {!userId || !date ? (
          <p className="text-sm text-slate-500">Choose an employee and a date.</p>
        ) : isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <EntryForm
            // Re-seed the fields whenever the employee, date or stored day changes.
            key={`${userId}|${date}|${day?.updated_at ?? 'new'}`}
            userId={userId}
            date={date}
            day={day ?? null}
            tz={tz}
            onClose={onClose}
          />
        )}

        {corrections.length > 0 && (
          <div className="border-t border-slate-200 pt-3">
            <h4 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Correction history
            </h4>
            <ul className="max-h-40 space-y-2 overflow-y-auto" data-testid="corr-history">
              {corrections.map((c) => {
                const next = c.new_value as { status?: string } | null
                return (
                  <li key={c.id} className="border-l-2 border-slate-200 pl-3 text-sm">
                    <div className="text-xs text-slate-500">
                      {c.corrector?.full_name || c.corrector?.email || 'Unknown'} ·{' '}
                      {formatDateTime(c.created_at)} ·{' '}
                      {c.action === 'reset'
                        ? 'Reset to punches'
                        : `Set to ${statusLabel(next?.status ?? '')}`}
                    </div>
                    <div className="whitespace-pre-wrap text-slate-700">{c.remarks}</div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}

function EntryForm({
  userId,
  date,
  day,
  tz,
  onClose,
}: {
  userId: string
  date: string
  day: AttendanceDay | null
  tz: string
  onClose: () => void
}) {
  const save = useSetAttendance()
  const reset = useResetAttendance()
  const toast = useToast()
  const [timeIn, setTimeIn] = useState(timeInTz(day?.first_in_at ?? null, tz))
  const [timeOut, setTimeOut] = useState(timeInTz(day?.last_out_at ?? null, tz))
  const [status, setStatus] = useState<'' | NonNullable<AttendanceEntry['status']>>('')
  const [remarks, setRemarks] = useState('')

  const hasTimes = !!timeIn && !!timeOut
  const canSave = !!remarks.trim() && (hasTimes || !!status)

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!canSave) return
        save.mutate(
          {
            userId,
            date,
            timeIn: timeIn || null,
            timeOut: timeOut || null,
            status: status || null,
            remarks,
          },
          {
            onSuccess: () => {
              toast.success('Attendance saved')
              onClose()
            },
            onError: (err) => toast.error('Save failed', (err as Error).message),
          },
        )
      }}
    >
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600" data-testid="corr-current">
        {day
          ? `Currently: ${statusLabel(day.status)}${day.is_manual ? ' (manually corrected)' : ''}${
              day.missed_punch_out ? ' · missed punch-out' : ''
            }`
          : 'No attendance recorded for this day yet.'}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="corr-in">Punch in</Label>
          <Input id="corr-in" data-testid="corr-in" type="time" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="corr-out">Punch out</Label>
          <Input id="corr-out" data-testid="corr-out" type="time" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} />
        </div>
      </div>

      <div>
        <Label htmlFor="corr-status">Status</Label>
        <Select
          id="corr-status"
          data-testid="corr-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="">Auto — calculate from punch in/out</option>
          <option value="full_day">Full Day</option>
          <option value="half_day">Half Day</option>
          <option value="quarter_day">Quarter Day</option>
          <option value="absent">Absent</option>
        </Select>
        <p className="mt-1 text-xs text-slate-400">
          Auto applies the normal working-hour thresholds. Pick a status to override them.
        </p>
      </div>

      <div>
        <Label htmlFor="corr-remarks">Remarks (required)</Label>
        <Textarea
          id="corr-remarks"
          data-testid="corr-remarks"
          rows={2}
          placeholder="Why is this being entered or corrected?"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2">
        {day?.is_manual && (
          <Button
            type="button"
            variant="outline"
            data-testid="corr-reset"
            className="mr-auto"
            disabled={!remarks.trim()}
            loading={reset.isPending}
            onClick={() =>
              reset.mutate(
                { userId, date, remarks },
                {
                  onSuccess: () => {
                    toast.success('Correction removed')
                    onClose()
                  },
                  onError: (err) => toast.error('Reset failed', (err as Error).message),
                },
              )
            }
          >
            Reset to punches
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" data-testid="corr-save" disabled={!canSave} loading={save.isPending}>
          Save
        </Button>
      </div>
    </form>
  )
}
