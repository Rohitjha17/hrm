import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import type { Tables } from '@/types/database.types'

export type SalaryRun = Tables<'salary_runs'>
export type SalaryAdjustment = Tables<'salary_adjustments'>

export interface SalaryComponent {
  label: string
  kind: 'earning' | 'deduction'
  amount: number
}

/** Parse the stored jsonb components into a typed, defensive array. */
export function parseComponents(raw: unknown): SalaryComponent[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c) => ({
      label: String(c.label ?? ''),
      kind: c.kind === 'deduction' ? 'deduction' : 'earning',
      amount: Number(c.amount ?? 0),
    }))
}

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
    mutationFn: async (args: { userId: string; components: SalaryComponent[] }) => {
      // monthly_ctc (the figure the payroll engine prorates) = sum of earnings.
      const monthlyCtc = args.components
        .filter((c) => c.kind === 'earning')
        .reduce((s, c) => s + Number(c.amount || 0), 0)
      const { error } = await supabase.from('salary_profiles').upsert(
        {
          user_id: args.userId,
          monthly_ctc: monthlyCtc,
          components: args.components as unknown as Tables<'salary_profiles'>['components'],
        },
        { onConflict: 'user_id' },
      )
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

export interface FnfSettlement {
  final_salary: number
  leave_encashment: number
  dues: number
  net_payable: number
  last_working_date: string
}

export function useComputeFnf() {
  return useMutation({
    mutationFn: async (args: { userId: string; lastWorkingDate: string }) => {
      const { data, error } = await supabase.functions.invoke('full-final-settlement', { body: args })
      if (error) throw error
      return (data as { settlement: FnfSettlement }).settlement
    },
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
