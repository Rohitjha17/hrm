import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import type { Tables } from '@/types/database.types'

export type AppraisalCycle = Tables<'appraisal_cycles'>

export interface AppraisalRow extends Tables<'appraisals'> {
  employee: { full_name: string; email: string } | null
}

export function useCycles() {
  return useQuery({
    queryKey: ['appraisal-cycles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appraisal_cycles')
        .select('*')
        .order('period_start', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateCycle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      cycleType: string
      periodStart: string
      periodEnd: string
    }) => {
      const { error } = await supabase.from('appraisal_cycles').insert({
        name: input.name,
        cycle_type: input.cycleType,
        period_start: input.periodStart,
        period_end: input.periodEnd,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appraisal-cycles'] }),
  })
}

export function useAppraisals(cycleId: string | null) {
  return useQuery({
    queryKey: ['appraisals', cycleId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appraisals')
        .select('*, employee:profiles!appraisals_user_id_fkey(full_name,email)')
        .eq('cycle_id', cycleId!)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as AppraisalRow[]
    },
  })
}

export function useCreateAppraisal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      cycleId: string
      userId: string
      performanceRating: number | null
      managerFeedback?: string
      hrFeedback?: string
    }) => {
      const { error } = await supabase.from('appraisals').insert({
        cycle_id: input.cycleId,
        user_id: input.userId,
        performance_rating: input.performanceRating,
        manager_feedback: input.managerFeedback || null,
        hr_feedback: input.hrFeedback || null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appraisals'] }),
  })
}

export function useComputeAppraisal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (appraisalId: string) => {
      const { error } = await supabase.rpc('compute_appraisal_scores', { p_appraisal: appraisalId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appraisals'] }),
  })
}

export function useMyAppraisals() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-appraisals', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appraisals')
        .select('*, cycle:appraisal_cycles(name,cycle_type,period_start,period_end)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}
