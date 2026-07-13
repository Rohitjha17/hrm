import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

export type WorkflowDefinition = Tables<'workflow_definitions'>
export type WorkflowStep = Tables<'workflow_steps'>

export function useDefinitions() {
  return useQuery({
    queryKey: ['wf-definitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_definitions')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useSteps(definitionId: string | null) {
  return useQuery({
    queryKey: ['wf-steps', definitionId],
    enabled: !!definitionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_steps')
        .select('*')
        .eq('definition_id', definitionId!)
        .order('step_order')
      if (error) throw error
      return data
    },
  })
}

export function useCreateDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; entityType: string }) => {
      const { data, error } = await supabase
        .from('workflow_definitions')
        .insert({ name: input.name, entity_type: input.entityType })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wf-definitions'] }),
  })
}

export function useAddStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { definitionId: string; stepOrder: number; name: string }) => {
      const { error } = await supabase.from('workflow_steps').insert({
        definition_id: input.definitionId,
        step_order: input.stepOrder,
        name: input.name,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wf-steps'] }),
  })
}

export function useDeleteStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (stepId: string) => {
      const { error } = await supabase.from('workflow_steps').delete().eq('id', stepId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wf-steps'] }),
  })
}

export function useDeleteDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (definitionId: string) => {
      const { error } = await supabase.from('workflow_definitions').delete().eq('id', definitionId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wf-definitions'] }),
  })
}
