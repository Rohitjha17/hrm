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

/** A "cycle" is simply a named review period (name + dates). */
export function useCreateCycle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; periodStart: string; periodEnd: string }) => {
      const { error } = await supabase.from('appraisal_cycles').insert({
        name: input.name,
        period_start: input.periodStart,
        period_end: input.periodEnd,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appraisal-cycles'] }),
  })
}

/** Delete a review period; its appraisals (and their history) cascade away. */
export function useDeleteCycle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cycleId: string) => {
      const { error } = await supabase.from('appraisal_cycles').delete().eq('id', cycleId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appraisal-cycles'] })
      qc.invalidateQueries({ queryKey: ['appraisals'] })
    },
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
      kra?: string
      kpi?: string
    }) => {
      const { error } = await supabase.from('appraisals').insert({
        cycle_id: input.cycleId,
        user_id: input.userId,
        performance_rating: input.performanceRating,
        manager_feedback: input.managerFeedback || null,
        hr_feedback: input.hrFeedback || null,
        kra: input.kra || null,
        kpi: input.kpi || null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appraisals'] }),
  })
}

/** Update the qualitative fields admins use to decide an appraisal. */
export function useUpdateAppraisal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      performanceRating: number | null
      managerFeedback: string
      hrFeedback: string
      kra: string
      kpi: string
    }) => {
      const { error } = await supabase
        .from('appraisals')
        .update({
          performance_rating: input.performanceRating,
          manager_feedback: input.managerFeedback || null,
          hr_feedback: input.hrFeedback || null,
          kra: input.kra || null,
          kpi: input.kpi || null,
        })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appraisals'] })
      qc.invalidateQueries({ queryKey: ['appraisal-history'] })
    },
  })
}

/** Remove one employee from a review period; their change history cascades away. */
export function useDeleteAppraisal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (appraisalId: string) => {
      const { error } = await supabase.from('appraisals').delete().eq('id', appraisalId)
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

/** Enroll every listed employee into the period; existing appraisals are kept. */
export function useAddAllEmployees() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { cycleId: string; userIds: string[] }) => {
      const { error } = await supabase.from('appraisals').upsert(
        input.userIds.map((uid) => ({ cycle_id: input.cycleId, user_id: uid })),
        { onConflict: 'cycle_id,user_id', ignoreDuplicates: true },
      )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appraisals'] }),
  })
}

/** Run the scoring engine for every appraisal in the period. */
export function useComputeAll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (appraisalIds: string[]) => {
      for (const id of appraisalIds) {
        const { error } = await supabase.rpc('compute_appraisal_scores', { p_appraisal: id })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appraisals'] }),
  })
}

export const HISTORY_FIELD_LABEL: Record<string, string> = {
  performance_rating: 'Rating',
  kra: 'KRA',
  kpi: 'KPI',
  manager_feedback: 'Manager feedback',
  hr_feedback: 'HR feedback',
}

export interface AppraisalHistoryRow extends Tables<'appraisal_history'> {
  changer: { full_name: string; email: string } | null
}

/** Append-only change log for an appraisal's qualitative fields (newest first). */
export function useAppraisalHistory(appraisalId: string | null) {
  return useQuery({
    queryKey: ['appraisal-history', appraisalId],
    enabled: !!appraisalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appraisal_history')
        .select('*, changer:profiles!appraisal_history_changed_by_fkey(full_name,email)')
        .eq('appraisal_id', appraisalId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as AppraisalHistoryRow[]
    },
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
