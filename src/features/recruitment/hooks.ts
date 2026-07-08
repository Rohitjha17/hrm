import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

export type Opening = Tables<'job_openings'>
export type Candidate = Tables<'candidates'>
export type CandidateDocument = Tables<'candidate_documents'>
export type CandidateChecklistItem = Tables<'candidate_checklist_items'>

export interface OpeningRow extends Opening {
  department: { name: string } | null
}

export interface InterviewRow extends Tables<'interviews'> {
  interviewer: { full_name: string } | null
}

export function useOpenings() {
  return useQuery({
    queryKey: ['openings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_openings')
        .select('*, department:departments(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as OpeningRow[]
    },
  })
}

export function useCreateOpening() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { departmentId: string; designation: string; description?: string }) => {
      const { error } = await supabase.from('job_openings').insert({
        // Openings are identified by department + designation; title mirrors the
        // designation for backwards compatibility (column is NOT NULL).
        title: input.designation,
        designation: input.designation,
        department_id: input.departmentId,
        description: input.description || null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['openings'] }),
  })
}

export function useCandidates(openingId: string | null) {
  return useQuery({
    queryKey: ['candidates', openingId],
    enabled: !!openingId,
    refetchInterval: 5000, // reflect offer-approval (workflow trigger) promptly
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('opening_id', openingId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAddCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { openingId: string; fullName: string; email: string; phone?: string }) => {
      const { data, error } = await supabase
        .from('candidates')
        .insert({ opening_id: input.openingId, full_name: input.fullName, email: input.email, phone: input.phone || null })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['candidates'] }),
  })
}

export function useUpdateCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; status?: Candidate['status']; offer_status?: Candidate['offer_status'] }) => {
      const patch: { status?: Candidate['status']; offer_status?: Candidate['offer_status'] } = {}
      if (input.status) patch.status = input.status
      if (input.offer_status) patch.offer_status = input.offer_status
      const { error } = await supabase.from('candidates').update(patch).eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['candidates'] }),
  })
}

/** Route an offer through the Offer Approval workflow (Phase 10 engine). */
export function useSendOffer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (candidate: { id: string; full_name: string }) => {
      const { data: def, error: dErr } = await supabase
        .from('workflow_definitions')
        .select('id')
        .eq('entity_type', 'recruitment_offer')
        .eq('is_active', true)
        .limit(1)
        .single()
      if (dErr) throw dErr
      const { error: sErr } = await supabase.rpc('start_workflow', {
        p_definition: def.id,
        p_title: `Offer: ${candidate.full_name}`,
        p_entity_type: 'recruitment_offer',
        p_entity_id: candidate.id,
      })
      if (sErr) throw sErr
      const { error: uErr } = await supabase
        .from('candidates')
        .update({ offer_status: 'pending' })
        .eq('id', candidate.id)
      if (uErr) throw uErr
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['candidates'] }),
  })
}

export interface CandidateDocRow extends CandidateDocument {
  uploader: { full_name: string } | null
}

export function useCandidateDocuments(candidateId: string | null) {
  return useQuery({
    queryKey: ['candidate-documents', candidateId],
    enabled: !!candidateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_documents')
        .select('*, uploader:profiles(full_name)')
        .eq('candidate_id', candidateId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as CandidateDocRow[]
    },
  })
}

export function useUploadCandidateDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { candidateId: string; title: string; file: File }) => {
      const path = `candidates/${input.candidateId}/${crypto.randomUUID()}-${input.file.name}`
      const up = await supabase.storage.from('documents').upload(path, input.file, { upsert: false })
      if (up.error) throw up.error
      const { data: auth } = await supabase.auth.getUser()
      const { error } = await supabase.from('candidate_documents').insert({
        candidate_id: input.candidateId,
        title: input.title || input.file.name,
        storage_path: path,
        uploaded_by: auth.user?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['candidate-documents'] }),
  })
}

export async function getCandidateDocUrl(path: string) {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}

export function useCandidateChecklist(candidateId: string | null) {
  return useQuery({
    queryKey: ['candidate-checklist', candidateId],
    enabled: !!candidateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_checklist_items')
        .select('*')
        .eq('candidate_id', candidateId!)
        .order('item_key')
      if (error) throw error
      return data
    },
  })
}

export function useStartCandidateChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (candidateId: string) => {
      const { error } = await supabase.rpc('start_candidate_checklist', { p_candidate: candidateId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['candidate-checklist'] }),
  })
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; status: string; note?: string }) => {
      const patch: { status: string; note?: string | null } = { status: input.status }
      if (input.note !== undefined) patch.note = input.note || null
      const { error } = await supabase
        .from('candidate_checklist_items')
        .update(patch)
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['candidate-checklist'] }),
  })
}

export function useInterviews(candidateId: string | null) {
  return useQuery({
    queryKey: ['interviews', candidateId],
    enabled: !!candidateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interviews')
        .select('*, interviewer:profiles(full_name)')
        .eq('candidate_id', candidateId!)
        .order('scheduled_at')
      if (error) throw error
      return (data ?? []) as unknown as InterviewRow[]
    },
  })
}

export function useScheduleInterview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { candidateId: string; scheduledAt: string; interviewerId: string | null; mode: string }) => {
      const { error } = await supabase.from('interviews').insert({
        candidate_id: input.candidateId,
        scheduled_at: input.scheduledAt,
        interviewer_id: input.interviewerId,
        mode: input.mode,
      })
      if (error) throw error
      await supabase.from('candidates').update({ status: 'interview_scheduled' }).eq('id', input.candidateId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interviews'] })
      qc.invalidateQueries({ queryKey: ['candidates'] })
    },
  })
}

export function useSaveFeedback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { interviewId: string; feedback: string; rating: number; recommendation: string }) => {
      const { error } = await supabase
        .from('interviews')
        .update({ feedback: input.feedback, rating: input.rating, recommendation: input.recommendation })
        .eq('id', input.interviewId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interviews'] }),
  })
}
