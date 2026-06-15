import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

export type WorkflowDefinition = Tables<'workflow_definitions'>
export type WorkflowStep = Tables<'workflow_steps'>

export interface InstanceRow extends Tables<'workflow_instances'> {
  definition: { name: string } | null
}

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
    mutationFn: async (input: {
      definitionId: string
      stepOrder: number
      name: string
      approverPermission: string
    }) => {
      const { error } = await supabase.from('workflow_steps').insert({
        definition_id: input.definitionId,
        step_order: input.stepOrder,
        name: input.name,
        approver_permission: input.approverPermission,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wf-steps'] }),
  })
}

export function useStartInstance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { definitionId: string; title: string }) => {
      const { error } = await supabase.rpc('start_workflow', {
        p_definition: input.definitionId,
        p_title: input.title,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wf-instances'] }),
  })
}

export function useInstances() {
  return useQuery({
    queryKey: ['wf-instances'],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_instances')
        .select('*, definition:workflow_definitions(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as InstanceRow[]
    },
  })
}

export function useActOnWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { instanceId: string; decision: 'approved' | 'rejected'; remarks?: string }) => {
      const { error } = await supabase.rpc('act_on_workflow', {
        p_instance: input.instanceId,
        p_decision: input.decision,
        p_remarks: input.remarks ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wf-instances'] }),
  })
}
