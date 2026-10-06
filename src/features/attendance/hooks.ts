import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import type { Tables } from '@/types/database.types'

export type AttendanceConfig = Tables<'attendance_config'>
export type AttendanceDay = Tables<'attendance_days'>
export type AttendancePunch = Tables<'attendance_punches'>

export interface PunchResult {
  ok: boolean
  reason?: string
  punch_type?: 'in' | 'out'
  distance_m?: number
  radius_m?: number
  status?: string
  worked_minutes?: number
  is_late?: boolean
  late_minutes?: number
  overtime_minutes?: number
}

export function useAttendanceConfig() {
  return useQuery({
    queryKey: ['attendance-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('attendance_config').select('*').single()
      if (error) throw error
      return data
    },
  })
}

export function useMyAttendance(workDate: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['attendance-today', user?.id, workDate],
    enabled: !!user && !!workDate,
    queryFn: async () => {
      const [dayRes, punchRes] = await Promise.all([
        supabase
          .from('attendance_days')
          .select('*')
          .eq('user_id', user!.id)
          .eq('work_date', workDate)
          .maybeSingle(),
        supabase
          .from('attendance_punches')
          .select('*')
          .eq('user_id', user!.id)
          .eq('work_date', workDate)
          .order('punched_at', { ascending: true }),
      ])
      const punches = punchRes.data ?? []
      const last = punches[punches.length - 1]
      return {
        day: (dayRes.data as AttendanceDay | null) ?? null,
        punches,
        open: last?.punch_type === 'in',
      }
    },
  })
}

export function usePunch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      type: 'in' | 'out'
      lat: number
      lng: number
      accuracy?: number
      selfiePath: string | null
    }) => {
      const { data, error } = await supabase.rpc('attendance_punch', {
        p_type: args.type,
        p_lat: args.lat,
        p_lng: args.lng,
        p_selfie_path: args.selfiePath ?? undefined,
        p_accuracy: args.accuracy,
      })
      if (error) throw error
      return data as unknown as PunchResult
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance-today'] }),
  })
}

export interface AdminAttendanceRow extends AttendanceDay {
  profiles: { full_name: string; email: string } | null
}

export function useAdminAttendance(from: string, to: string) {
  return useQuery({
    queryKey: ['admin-attendance', from, to],
    enabled: !!from && !!to,
    // Realtime drives instant updates; this poll is a resilience fallback so the
    // live monitor stays correct even if a websocket drops.
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_days')
        .select('*, profiles(full_name,email)')
        .gte('work_date', from)
        .lte('work_date', to)
        .order('work_date', { ascending: false })
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as AdminAttendanceRow[]
    },
  })
}

/** Subscribe to attendance changes and refetch (RLS-gated) — live admin sync. */
export function useAttendanceRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    void (async () => {
      // Ensure the realtime socket carries the user's JWT so RLS lets the
      // authorized admin receive attendance change events.
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) supabase.realtime.setAuth(data.session.access_token)

      channel = supabase
        .channel('attendance-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_days' }, () => {
          qc.invalidateQueries({ queryKey: ['admin-attendance'] })
          qc.invalidateQueries({ queryKey: ['attendance-today'] })
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_punches' }, () => {
          qc.invalidateQueries({ queryKey: ['admin-attendance'] })
        })
        .subscribe()
    })()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [qc])
}

export function useUpdateAttendanceConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<AttendanceConfig>) => {
      const { error } = await supabase
        .from('attendance_config')
        .update(patch)
        .eq('id', true)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance-config'] }),
  })
}

/**
 * Finalize past days an employee never punched out of, so the monitor, reports
 * and salary all read the same hours-based status. Runs once per mount.
 */
export function useCloseStaleAttendance() {
  const qc = useQueryClient()
  useEffect(() => {
    void supabase.rpc('close_stale_attendance').then(({ data }) => {
      if (data) qc.invalidateQueries({ queryKey: ['admin-attendance'] })
    })
  }, [qc])
}

export interface AttendanceEntry {
  userId: string
  date: string
  /** Office-local HH:MM, or null when only a status is being set. */
  timeIn: string | null
  timeOut: string | null
  /** null = derive the status from the in/out times. */
  status: 'full_day' | 'half_day' | 'quarter_day' | 'absent' | null
  remarks: string
}

/** Admin: enter historical attendance or correct a day (remarks mandatory). */
export function useSetAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (e: AttendanceEntry) => {
      const { error } = await supabase.rpc('admin_set_attendance', {
        p_user: e.userId,
        p_date: e.date,
        p_in: e.timeIn,
        p_out: e.timeOut,
        p_status: e.status,
        p_remarks: e.remarks,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-attendance'] })
      qc.invalidateQueries({ queryKey: ['attendance-today'] })
      qc.invalidateQueries({ queryKey: ['attendance-corrections'] })
    },
  })
}

/** Admin: discard a correction and return the day to what its punches say. */
export function useResetAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { userId: string; date: string; remarks: string }) => {
      const { error } = await supabase.rpc('admin_reset_attendance', {
        p_user: args.userId,
        p_date: args.date,
        p_remarks: args.remarks,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-attendance'] })
      qc.invalidateQueries({ queryKey: ['attendance-today'] })
      qc.invalidateQueries({ queryKey: ['attendance-corrections'] })
    },
  })
}

export interface AttendanceCorrectionRow extends Tables<'attendance_corrections'> {
  corrector: { full_name: string; email: string } | null
}

/** Audit trail of admin corrections for one employee-day (newest first). */
export function useAttendanceCorrections(userId: string, date: string) {
  return useQuery({
    queryKey: ['attendance-corrections', userId, date],
    enabled: !!userId && !!date,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_corrections')
        .select('*, corrector:profiles!attendance_corrections_corrected_by_fkey(full_name,email)')
        .eq('user_id', userId)
        .eq('work_date', date)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as AttendanceCorrectionRow[]
    },
  })
}
