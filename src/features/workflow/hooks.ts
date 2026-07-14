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

/** Rename a step without touching its position in the plan. */
export function useUpdateStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { stepId: string; name: string }) => {
      const { error } = await supabase
        .from('workflow_steps')
        .update({ name: input.name })
        .eq('id', input.stepId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wf-steps'] }),
  })
}

/**
 * Swap two adjacent steps. step_order is unique per definition, so one side
 * parks at a temporary order before the three-way swap.
 */
export function useMoveStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { step: WorkflowStep; neighbor: WorkflowStep }) => {
      const { step, neighbor } = input
      const park = await supabase
        .from('workflow_steps')
        .update({ step_order: -1 })
        .eq('id', step.id)
      if (park.error) throw park.error
      const shift = await supabase
        .from('workflow_steps')
        .update({ step_order: step.step_order })
        .eq('id', neighbor.id)
      if (shift.error) throw shift.error
      const land = await supabase
        .from('workflow_steps')
        .update({ step_order: neighbor.step_order })
        .eq('id', step.id)
      if (land.error) throw land.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wf-steps'] }),
  })
}

/** Delete a step, then close the gap so remaining steps stay numbered 1..n. */
export function useDeleteStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (step: WorkflowStep) => {
      const { error } = await supabase.from('workflow_steps').delete().eq('id', step.id)
      if (error) throw error
      const { data: rest, error: restErr } = await supabase
        .from('workflow_steps')
        .select('id, step_order')
        .eq('definition_id', step.definition_id)
        .gt('step_order', step.step_order)
        .order('step_order')
      if (restErr) throw restErr
      for (const s of rest ?? []) {
        const { error: shiftErr } = await supabase
          .from('workflow_steps')
          .update({ step_order: s.step_order - 1 })
          .eq('id', s.id)
        if (shiftErr) throw shiftErr
      }
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
