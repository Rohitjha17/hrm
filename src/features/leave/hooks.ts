import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import type { Tables } from '@/types/database.types'

export type LeaveType = Tables<'leave_types'>
export type Holiday = Tables<'holidays'>
export type LeaveBalance = Tables<'leave_balances'>

export interface LeaveRequestRow extends Tables<'leave_requests'> {
  leave_type: { name: string; is_paid: boolean } | null
  requester: { full_name: string; email: string } | null
}

export interface BalanceRow extends LeaveBalance {
  leave_type: { name: string } | null
}

const YEAR = new Date().getFullYear()

export function useLeaveTypes() {
  return useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leave_types').select('*').order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function useHolidays() {
  return useQuery({
    queryKey: ['holidays'],
    queryFn: async () => {
      const { data, error } = await supabase.from('holidays').select('*').order('holiday_date')
      if (error) throw error
      return data
    },
  })
}

export function useMyLeaveRequests() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-leave', user?.id],
    enabled: !!user,
    refetchInterval: 5000, // resilience fallback alongside realtime
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*, leave_type:leave_types(name,is_paid)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as LeaveRequestRow[]
    },
  })
}

export function useMyBalances() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-balances', user?.id],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_balances')
        .select('*, leave_type:leave_types(name)')
        .eq('user_id', user!.id)
        .eq('year', YEAR)
      if (error) throw error
      return (data ?? []) as unknown as BalanceRow[]
    },
  })
}

export function useApplyLeave() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: {
      leaveTypeId: string
      startDate: string
      endDate: string
      reason: string
    }) => {
      const { error } = await supabase.from('leave_requests').insert({
        user_id: user!.id,
        leave_type_id: input.leaveTypeId,
        start_date: input.startDate,
        end_date: input.endDate,
        reason: input.reason || null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-leave'] }),
  })
}

export function useCancelLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'cancelled' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-leave'] }),
  })
}

export function usePendingApprovals() {
  return useQuery({
    queryKey: ['leave-approvals'],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(
          '*, leave_type:leave_types(name,is_paid), requester:profiles!leave_requests_user_id_fkey(full_name,email)',
        )
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as LeaveRequestRow[]
    },
  })
}

/** All leave requests across the org — for admin insights + remark management. */
export function useAllLeaveRequests() {
  return useQuery({
    queryKey: ['leave-all'],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(
          '*, leave_type:leave_types(name,is_paid), requester:profiles!leave_requests_user_id_fkey(full_name,email)',
        )
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as LeaveRequestRow[]
    },
  })
}

/** Set/clear the free-form admin remark on a leave request (any status). */
export function useSetLeaveRemark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { id: string; remark: string }) => {
      const { error } = await supabase
        .from('leave_requests')
        .update({ admin_remarks: args.remark.trim() || null })
        .eq('id', args.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-all'] })
      qc.invalidateQueries({ queryKey: ['leave-approvals'] })
      qc.invalidateQueries({ queryKey: ['my-leave'] })
    },
  })
}

export function useDecideLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { id: string; decision: 'approved' | 'rejected'; remarks?: string }) => {
      const { error } = await supabase.rpc('decide_leave', {
        p_request: args.id,
        p_decision: args.decision,
        p_remarks: args.remarks ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-approvals'] })
      qc.invalidateQueries({ queryKey: ['my-leave'] })
      qc.invalidateQueries({ queryKey: ['my-balances'] })
    },
  })
}

export function useCreateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; date: string }) => {
      const { error } = await supabase
        .from('holidays')
        .insert({ name: input.name, holiday_date: input.date })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  })
}

export function useDeleteHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('holidays').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  })
}

export function useLeaveRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) supabase.realtime.setAuth(data.session.access_token)
      channel = supabase
        .channel('leave-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
          qc.invalidateQueries({ queryKey: ['my-leave'] })
          qc.invalidateQueries({ queryKey: ['leave-approvals'] })
          qc.invalidateQueries({ queryKey: ['my-balances'] })
        })
        .subscribe()
    })()
    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [qc])
}
