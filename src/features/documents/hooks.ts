import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import type { Tables } from '@/types/database.types'

export type EmployeeDocument = Tables<'employee_documents'>
export type DocumentType = Tables<'document_types'>

export function useDocumentTypes(includeInactive = false) {
  return useQuery({
    queryKey: ['document-types', includeInactive],
    queryFn: async () => {
      let query = supabase.from('document_types').select('*').order('name')
      if (!includeInactive) query = query.eq('is_active', true)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useSaveDocumentType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; code: string; isActive: boolean }) => {
      const values = {
        name: input.name.trim(),
        code: input.code
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, ''),
        is_active: input.isActive,
      }
      const { error } = input.id
        ? await supabase.from('document_types').update(values).eq('id', input.id)
        : await supabase.from('document_types').insert(values)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document-types'] }),
  })
}

export function useDeleteDocumentType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('document_types').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document-types'] }),
  })
}

export function useEmployeeDocuments(employeeId: string | null) {
  return useQuery({
    queryKey: ['emp-documents', employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('employee_id', employeeId!)
        .order('doc_type')
        .order('version', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useMyDocuments() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-documents', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('employee_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useUploadDocument() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: {
      employeeId: string
      docType: string
      title: string
      file: File
    }) => {
      const path = `${input.employeeId}/${input.docType}/${crypto.randomUUID()}-${input.file.name}`
      const up = await supabase.storage
        .from('documents')
        .upload(path, input.file, { upsert: false })
      if (up.error) throw up.error
      const { error } = await supabase.from('employee_documents').insert({
        employee_id: input.employeeId,
        doc_type: input.docType,
        title: input.title,
        storage_path: path,
        uploaded_by: user?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emp-documents'] }),
  })
}

/** Remove a document: DB row + stored file. Requires documents.manage. */
export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (doc: { id: string; storage_path: string }) => {
      const { error } = await supabase.from('employee_documents').delete().eq('id', doc.id)
      if (error) throw error
      // Best-effort file cleanup; the row is the source of truth.
      await supabase.storage.from('documents').remove([doc.storage_path])
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emp-documents'] }),
  })
}

export async function getDocumentUrl(id: string, path: string): Promise<string | null> {
  const logged = await supabase.rpc('log_document_download', { p_document: id })
  if (logged.error) return null
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60)
  if (error) return null
  return data.signedUrl
}
