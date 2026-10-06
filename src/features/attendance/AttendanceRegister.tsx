import { useMemo, useState } from 'react'
import { useAdminAttendance } from './hooks'
import { ATTENDANCE_STATUS, SUNDAY_META, isSunday } from './status'
import { useUsers } from '@/features/admin/users/hooks'
import { useHolidays } from '@/features/leave/hooks'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Month-at-a-glance register: one row per employee, one colour-coded cell per
 * day. Sundays and holidays are shaded; a past working day with no punch shows
 * as absent. Admins with edit rights can click a cell to add/correct that day.
 */
export function AttendanceRegister({
  today,
  onCellClick,
}: {
  today: string
  onCellClick?: (userId: string, date: string) => void
}) {
  const [month, setMonth] = useState(today.slice(0, 7))
  const [year, mon] = month.split('-').map(Number)
  const daysInMonth = new Date(year, mon, 0).getDate()
  const dates = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => `${month}-${pad(i + 1)}`),
    [month, daysInMonth],
  )

  const { data: rows = [], isLoading } = useAdminAttendance(dates[0], dates[dates.length - 1])
  const { data: users = [] } = useUsers()
  const { data: holidays = [] } = useHolidays()

  const byCell = useMemo(() => new Map(rows.map((r) => [`${r.user_id}|${r.work_date}`, r])), [rows])
  const holidayNames = useMemo(
    () => new Map(holidays.map((h) => [h.holiday_date, h.name])),
    [holidays],
  )
  const employees = useMemo(() => {
    const withRows = new Set(rows.map((r) => r.user_id))
    return users.filter((u) => u.status === 'active' || withRows.has(u.id))
  }, [users, rows])

  return (
    <div data-testid="attendance-register">
      <div className="mb-3 flex items-center gap-2">
        <Label htmlFor="register-month" className="mb-0">
          Month
        </Label>
        <Input
          id="register-month"
          data-testid="register-month"
          type="month"
          value={month}
          max={today.slice(0, 7)}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="w-44"
        />
        {isLoading && <span className="text-xs text-slate-400">Loading…</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold">Employee</th>
              {dates.map((d) => (
                <th
                  key={d}
                  title={holidayNames.get(d)}
                  className={cn(
                    'min-w-7 px-1 py-2 text-center font-semibold',
                    isSunday(d) && SUNDAY_META.className,
                    holidayNames.has(d) && 'bg-sky-100 text-sky-800',
                  )}
                >
                  {Number(d.slice(8))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((u) => (
              <tr key={u.id} data-testid={`register-row-${u.email}`}>
                <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium whitespace-nowrap text-slate-900">
                  {u.full_name || u.email}
                </td>
                {dates.map((d) => {
                  const r = byCell.get(`${u.id}|${d}`)
                  const sunday = isSunday(d)
                  const holiday = holidayNames.get(d)
                  let code = ''
                  let cls = ''
                  let title = formatDate(d)
                  if (r) {
                    const meta = ATTENDANCE_STATUS[r.status]
                    code = meta?.code ?? '?'
                    cls = meta?.className ?? ''
                    title += ` · ${meta?.label ?? r.status}${r.is_manual ? ' (corrected)' : ''}`
                  } else if (holiday) {
                    code = 'HO'
                    cls = 'bg-sky-100 text-sky-800'
                    title += ` · ${holiday}`
                  } else if (sunday) {
                    code = SUNDAY_META.code
                    cls = SUNDAY_META.className
                    title += ' · Sunday'
                  } else if (d < today) {
                    code = ATTENDANCE_STATUS.absent.code
                    cls = 'bg-red-50 text-red-400'
                    title += ' · Absent (no punch recorded)'
                  }
                  return (
                    <td key={d} className="p-0.5 text-center">
                      <button
                        type="button"
                        title={title}
                        data-status={r?.status}
                        disabled={!onCellClick || d > today}
                        onClick={() => onCellClick?.(u.id, d)}
                        className={cn(
                          'h-6 w-full min-w-6 rounded text-[10px] font-semibold',
                          cls,
                          r?.is_manual && 'ring-1 ring-slate-400',
                          onCellClick && d <= today && 'cursor-pointer hover:ring-2 hover:ring-brand-400',
                        )}
                      >
                        {code}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        HO = holiday · outlined cell = manually corrected · pale A = no punch recorded.
        {onCellClick && ' Click a cell to add or correct that day.'}
      </p>
    </div>
  )
}
