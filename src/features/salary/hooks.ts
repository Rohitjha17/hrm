import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import type { Tables } from '@/types/database.types'

export type SalaryRun = Tables<'salary_runs'>
export type SalaryAdjustment = Tables<'salary_adjustments'>

export function useSalaryProfile(userId: string | null) {
  return useQuery({
    queryKey: ['salary-profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_profiles')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpsertSalaryProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { userId: string; monthlyCtc: number }) => {
      const { error } = await supabase
        .from('salary_profiles')
        .upsert({ user_id: args.userId, monthly_ctc: args.monthlyCtc }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-profile'] }),
  })
}

export function useAdjustments(userId: string | null, periodMonth: string) {
  return useQuery({
    queryKey: ['salary-adjustments', userId, periodMonth],
    enabled: !!userId && !!periodMonth,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_adjustments')
        .select('*')
        .eq('user_id', userId!)
        .eq('period_month', periodMonth)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useAddAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      userId: string
      periodMonth: string
      kind: 'incentive' | 'penalty' | 'increment'
      amount: number
      note?: string
    }) => {
      const { error } = await supabase.from('salary_adjustments').insert({
        user_id: args.userId,
        period_month: args.periodMonth,
        kind: args.kind,
        amount: args.amount,
        note: args.note || null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-adjustments'] }),
  })
}

export function useComputeSalary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { userId: string; month: string }) => {
      const { data, error } = await supabase.functions.invoke('calculate-salary', { body: args })
      if (error) throw error
      return (data as { run: SalaryRun }).run
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-runs'] }),
  })
}

export function useMySalaryRuns() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['salary-runs', 'mine', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_runs')
        .select('*')
        .eq('user_id', user!.id)
        .order('period_month', { ascending: false })
      if (error) throw error
      return data
    },
  })
}
