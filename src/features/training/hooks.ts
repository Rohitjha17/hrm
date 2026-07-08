import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import type { Tables } from '@/types/database.types'

export type TrainingModule = Tables<'training_modules'>
export type TrainingAttachment = Tables<'training_attachments'>
export type TrainingAssignment = Tables<'training_assignments'>

export interface AssignmentRow extends TrainingAssignment {
  assignee: { full_name: string; email: string } | null
}

export interface MyAssignmentRow extends TrainingAssignment {
  module: TrainingModule | null
}

export function useTrainingModules() {
  return useQuery({
    queryKey: ['training-modules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_modules')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateModule() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { title: string; body: string }) => {
      const { data, error } = await supabase
        .from('training_modules')
        .insert({ title: input.title, body: input.body, created_by: user?.id ?? null })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-modules'] }),
  })
}

export function useDeleteModule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (moduleId: string) => {
      const { error } = await supabase.from('training_modules').delete().eq('id', moduleId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-modules'] }),
  })
}

export function useTrainingAttachments(moduleId: string | null) {
  return useQuery({
    queryKey: ['training-attachments', moduleId],
    enabled: !!moduleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_attachments')
        .select('*')
        .eq('module_id', moduleId!)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useUploadTrainingAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { moduleId: string; file: File }) => {
      const path = `training/${input.moduleId}/${crypto.randomUUID()}-${input.file.name}`
      const up = await supabase.storage.from('documents').upload(path, input.file, { upsert: false })
      if (up.error) throw up.error
      const { error } = await supabase.from('training_attachments').insert({
        module_id: input.moduleId,
        title: input.file.name,
        storage_path: path,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-attachments'] }),
  })
}

export async function getTrainingAttachmentUrl(path: string) {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}

/** All assignments for a module (manager view). */
export function useModuleAssignments(moduleId: string | null) {
  return useQuery({
    queryKey: ['training-assignments', moduleId],
    enabled: !!moduleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_assignments')
        .select('*, assignee:profiles!training_assignments_user_id_fkey(full_name,email)')
        .eq('module_id', moduleId!)
        .order('assigned_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as AssignmentRow[]
    },
  })
}

export function useAssignTraining() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { moduleId: string; userIds: string[] }) => {
      const { error } = await supabase.from('training_assignments').upsert(
        input.userIds.map((uid) => ({
          module_id: input.moduleId,
          user_id: uid,
          assigned_by: user?.id ?? null,
        })),
        { onConflict: 'module_id,user_id', ignoreDuplicates: true },
      )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-assignments'] }),
  })
}

/** My trainings with the module body/attachments (employee view). */
export function useMyTrainings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-trainings', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_assignments')
        .select('*, module:training_modules(*)')
        .eq('user_id', user!.id)
        .order('assigned_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as MyAssignmentRow[]
    },
  })
}

/** Progress my own assignment: assigned → completed → acknowledged. */
export function useProgressAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; status: 'completed' | 'acknowledged' }) => {
      const patch: { status: string; completed_at?: string; acknowledged_at?: string } = {
        status: input.status,
      }
      if (input.status === 'completed') patch.completed_at = new Date().toISOString()
      if (input.status === 'acknowledged') patch.acknowledged_at = new Date().toISOString()
      const { error } = await supabase.from('training_assignments').update(patch).eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-trainings'] })
      qc.invalidateQueries({ queryKey: ['training-assignments'] })
    },
  })
}
