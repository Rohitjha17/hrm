import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import type { Tables } from '@/types/database.types'

export type Policy = Tables<'policies'>
export type PolicyVersion = Tables<'policy_versions'>

export interface PolicyAttachment {
  path: string
  name: string
}

export function parseAttachments(raw: unknown): PolicyAttachment[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .map((a) => ({ path: String(a.path ?? ''), name: String(a.name ?? '') }))
    .filter((a) => a.path)
}

export async function getPolicyAttachmentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60)
  if (error) return null
  return data.signedUrl
}

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

export function useAddPolicyAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { policyId: string; file: File }) => {
      const path = `policies/${input.policyId}/${crypto.randomUUID()}-${input.file.name}`
      const up = await supabase.storage.from('documents').upload(path, input.file, { upsert: false })
      if (up.error) throw up.error
      // Read-modify-write the attachments array.
      const { data: current, error: readErr } = await supabase
        .from('policies')
        .select('attachments')
        .eq('id', input.policyId)
        .single()
      if (readErr) throw readErr
      const list = parseAttachments(current?.attachments)
      list.push({ path, name: input.file.name })
      const { error } = await supabase
        .from('policies')
        .update({ attachments: list as unknown as Tables<'policies'>['attachments'] })
        .eq('id', input.policyId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policies'] }),
  })
}

export function useRemovePolicyAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { policyId: string; path: string }) => {
      await supabase.storage.from('documents').remove([input.path])
      const { data: current, error: readErr } = await supabase
        .from('policies')
        .select('attachments')
        .eq('id', input.policyId)
        .single()
      if (readErr) throw readErr
      const list = parseAttachments(current?.attachments).filter((a) => a.path !== input.path)
      const { error } = await supabase
        .from('policies')
        .update({ attachments: list as unknown as Tables<'policies'>['attachments'] })
        .eq('id', input.policyId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policies'] }),
  })
}

export function useDeletePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (policy: { id: string; attachments?: unknown }) => {
      // Best-effort cleanup of attachment objects (versions cascade via FK).
      const paths = parseAttachments(policy.attachments).map((a) => a.path)
      if (paths.length) await supabase.storage.from('documents').remove(paths)
      const { error } = await supabase.from('policies').delete().eq('id', policy.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policies'] })
      qc.invalidateQueries({ queryKey: ['policy-versions-all'] })
    },
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
