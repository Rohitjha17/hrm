import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import type { Tables } from '@/types/database.types'

export type EmployeeDocument = Tables<'employee_documents'>

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
    mutationFn: async (input: { employeeId: string; docType: string; title: string; file: File }) => {
      const path = `${input.employeeId}/${input.docType}/${crypto.randomUUID()}-${input.file.name}`
      const up = await supabase.storage.from('documents').upload(path, input.file, { upsert: false })
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

export async function getDocumentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60)
  if (error) return null
  return data.signedUrl
}
