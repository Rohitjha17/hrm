import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

export type OnboardingTemplate = Tables<'onboarding_templates'>
export type OnboardingItem = Tables<'onboarding_items'>

export function useTemplates() {
  return useQuery({
    queryKey: ['onboarding-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_templates')
        .select('*')
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { docType: string; title: string; body: string }) => {
      const { error } = await supabase
        .from('onboarding_templates')
        .insert({ doc_type: input.docType, title: input.title, body: input.body })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding-templates'] }),
  })
}

export function useOnboarding(employeeId: string | null) {
  return useQuery({
    queryKey: ['onboarding', employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding')
        .select('*')
        .eq('employee_id', employeeId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useStartOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase.rpc('start_onboarding', { p_employee: employeeId })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onboarding'] })
      qc.invalidateQueries({ queryKey: ['onboarding-items'] })
    },
  })
}

export function useOnboardingItems(onboardingId: string | null) {
  return useQuery({
    queryKey: ['onboarding-items', onboardingId],
    enabled: !!onboardingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_items')
        .select('*')
        .eq('onboarding_id', onboardingId!)
        .order('label')
      if (error) throw error
      return data
    },
  })
}

export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; status: OnboardingItem['status'] }) => {
      const { error } = await supabase
        .from('onboarding_items')
        .update({ status: input.status })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding-items'] }),
  })
}
