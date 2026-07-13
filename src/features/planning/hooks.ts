import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import type { Tables } from '@/types/database.types'

export type PlanningConfig = Tables<'planning_config'>
export type PlanningSlot = Tables<'planning_slots'>
export type PlanningCompliance = Tables<'planning_compliance'>

export function usePlanningConfig() {
  return useQuery({
    queryKey: ['planning-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('planning_config').select('*').single()
      if (error) throw error
      return data
    },
  })
}

export function usePlanningSlots(planDate: string, kind: 'day' | 'next_day') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['planning-slots', user?.id, planDate, kind],
    enabled: !!user && !!planDate,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planning_slots')
        .select('*')
        .eq('user_id', user!.id)
        .eq('plan_date', planDate)
        .eq('kind', kind)
        .order('slot_index')
      if (error) throw error
      return data
    },
  })
}

export function useUpsertSlot() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (s: {
      planDate: string
      kind: 'day' | 'next_day'
      slotIndex: number
      slotLabel: string
      taskName: string
      progress: number
      challenges?: string
      remarks?: string
      startTime?: string | null
      endTime?: string | null
    }) => {
      const { error } = await supabase.from('planning_slots').upsert(
        {
          user_id: user!.id,
          plan_date: s.planDate,
          kind: s.kind,
          slot_index: s.slotIndex,
          slot_label: s.slotLabel,
          task_name: s.taskName,
          progress: s.progress,
          challenges: s.challenges || null,
          remarks: s.remarks || null,
          start_time: s.startTime || null,
          end_time: s.endTime || null,
        },
        { onConflict: 'user_id,plan_date,kind,slot_index' },
      )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-slots'] }),
  })
}

export function useDeleteSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase.from('planning_slots').delete().eq('id', slotId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-slots'] }),
  })
}

export function useCompliance(workDate: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['planning-compliance', user?.id, workDate],
    enabled: !!user && !!workDate,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planning_compliance')
        .select('*')
        .eq('user_id', user!.id)
        .eq('work_date', workDate)
        .maybeSingle()
      if (error) throw error
      return data as PlanningCompliance | null
    },
  })
}

export function useSubmitCompliance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { date: string; part: 'day_end' | 'next_day' }) => {
      const { error } = await supabase.rpc('submit_planning_compliance', {
        p_date: args.date,
        p_part: args.part,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['planning-compliance'] }),
  })
}

export function usePlanningHistory(slotId: string | null) {
  return useQuery({
    queryKey: ['planning-history', slotId],
    enabled: !!slotId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planning_history')
        .select('*')
        .eq('slot_id', slotId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

// NOTE: no profiles embed — planning_compliance has two FKs to profiles
// (user_id, unlocked_by), which makes a direct embed ambiguous. The admin page
// resolves names from useUsers and maps compliance by user_id.
export function useComplianceForDate(workDate: string) {
  return useQuery({
    queryKey: ['admin-compliance', workDate],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planning_compliance')
        .select('*')
        .eq('work_date', workDate)
      if (error) throw error
      return data as PlanningCompliance[]
    },
  })
}

export function useUserDayPlan(userId: string | null, date: string) {
  return useQuery({
    queryKey: ['user-day-plan', userId, date],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planning_slots')
        .select('*')
        .eq('user_id', userId!)
        .eq('plan_date', date)
        .eq('kind', 'day')
        .order('slot_index')
      if (error) throw error
      return data
    },
  })
}

export function useUnlockPlanning() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { userId: string; date: string; remarks: string }) => {
      const { error } = await supabase.rpc('unlock_planning', {
        p_user: args.userId,
        p_date: args.date,
        p_remarks: args.remarks,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-compliance'] })
      qc.invalidateQueries({ queryKey: ['planning-compliance'] })
    },
  })
}

/** Is today's punch-in locked because yesterday's planning is incomplete? */
export function usePunchInLock() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['punch-in-lock', user?.id],
    enabled: !!user,
    refetchInterval: 10_000, // picks up an admin unlock without a reload
    queryFn: async () => {
      const { data, error } = await supabase.rpc('punch_in_lock_status')
      if (error) throw error
      return data as { locked: boolean; prev_date?: string }
    },
  })
}

export function usePlanningRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) supabase.realtime.setAuth(data.session.access_token)
      channel = supabase
        .channel('planning-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_compliance' }, () => {
          qc.invalidateQueries({ queryKey: ['admin-compliance'] })
          qc.invalidateQueries({ queryKey: ['planning-compliance'] })
        })
        .subscribe()
    })()
    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [qc])
}
