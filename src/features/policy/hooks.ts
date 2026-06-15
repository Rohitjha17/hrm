import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import type { Tables } from '@/types/database.types'

export type Policy = Tables<'policies'>
export type PolicyVersion = Tables<'policy_versions'>

export function usePolicies() {
  return useQuery({
    queryKey: ['policies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('policies')
        .select('*')
        .eq('is_active', true)
        .order('category')
      if (error) throw error
      return data
    },
  })
}

export function usePolicyVersions(policyId: string | null) {
  return useQuery({
    queryKey: ['policy-versions', policyId],
    enabled: !!policyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('policy_versions')
        .select('*')
        .eq('policy_id', policyId!)
        .order('version', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAllVersions() {
  return useQuery({
    queryKey: ['policy-versions-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('policy_versions').select('*')
      if (error) throw error
      return data
    },
  })
}

export function useMyAcknowledgements() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-acks', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('policy_acknowledgements')
        .select('policy_version_id')
        .eq('user_id', user!.id)
      if (error) throw error
      return new Set((data ?? []).map((a) => a.policy_version_id))
    },
  })
}

export function useCreatePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { category: string; title: string }) => {
      const { error } = await supabase.from('policies').insert(input)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policies'] }),
  })
}

export function usePublishVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { policyId: string; content: string; changeNote?: string }) => {
      const { error } = await supabase.rpc('publish_policy_version', {
        p_policy: input.policyId,
        p_content: input.content,
        p_change_note: input.changeNote ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies'] })
      qc.invalidateQueries({ queryKey: ['policy-versions'] })
      qc.invalidateQueries({ queryKey: ['policy-versions-all'] })
    },
  })
}

export function useAcknowledgePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (versionId: string) => {
      const { error } = await supabase.rpc('acknowledge_policy', { p_version: versionId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-acks'] }),
  })
}
