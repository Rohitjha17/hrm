import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import type { Tables } from '@/types/database.types'

export type Announcement = Tables<'announcements'>
export type Recognition = Tables<'recognitions'>
export type Visitor = Tables<'visitors'>

export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements'],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function usePublishAnnouncement() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { title: string; body: string; category: string }) => {
      const { error } = await supabase
        .from('announcements')
        .insert({ title: input.title, body: input.body, category: input.category, published_by: user?.id ?? null })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })
}

export function useRecognitions() {
  return useQuery({
    queryKey: ['recognitions'],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase.from('recognitions').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAwardRecognition() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { employeeId: string; awardType: string; points: number; note?: string }) => {
      const { error } = await supabase.from('recognitions').insert({
        employee_id: input.employeeId,
        award_type: input.awardType,
        points: input.points,
        note: input.note || null,
        awarded_by: user?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recognitions'] }),
  })
}

export function useVisitors() {
  return useQuery({
    queryKey: ['visitors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('visitors').select('*').order('visit_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Visitors hosted by the current employee (self-service view). */
export function useMyVisitors() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-visitors', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('host_id', user!.id)
        .order('visit_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useRegisterVisitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; company?: string; purpose?: string; hostId: string | null; visitDate: string }) => {
      const { data, error } = await supabase
        .from('visitors')
        .insert({ name: input.name, company: input.company || null, purpose: input.purpose || null, host_id: input.hostId, visit_date: input.visitDate })
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitors'] })
      qc.invalidateQueries({ queryKey: ['my-visitors'] })
    },
  })
}

// ── Internal meetings ────────────────────────────────────────────────────────

export type Meeting = Tables<'meetings'>
export type MeetingInvitee = Tables<'meeting_invitees'>

export interface MeetingRow extends Meeting {
  meeting_invitees: MeetingInvitee[]
}

export interface DirectoryEntry {
  id: string
  full_name: string | null
  email: string
}

/** Minimal company directory (id/name/email) — visible to every employee. */
export function useDirectory() {
  return useQuery({
    queryKey: ['directory'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('directory')
      if (error) throw error
      return (data ?? []) as DirectoryEntry[]
    },
  })
}

/** Meetings I host, am invited to, or (admins) all — RLS decides. */
export function useMeetings() {
  return useQuery({
    queryKey: ['meetings'],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*, meeting_invitees(*)')
        .order('starts_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as MeetingRow[]
    },
  })
}

export function useCreateMeeting() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: {
      title: string
      description?: string
      link?: string
      startsAt: string
      endsAt?: string
      inviteeIds: string[]
    }) => {
      const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({
          title: input.title,
          description: input.description || null,
          meeting_link: input.link || null,
          starts_at: input.startsAt,
          ends_at: input.endsAt || null,
          host_id: user!.id,
        })
        .select('id')
        .single()
      if (error) throw error
      if (input.inviteeIds.length) {
        const { error: iErr } = await supabase.from('meeting_invitees').insert(
          input.inviteeIds.map((uid) => ({ meeting_id: meeting.id, user_id: uid })),
        )
        if (iErr) throw iErr
      }
      return meeting
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  })
}

/** Accept or decline my invitation. */
export function useRespondToInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { inviteeRowId: string; status: 'accepted' | 'declined' }) => {
      const { error } = await supabase
        .from('meeting_invitees')
        .update({ status: input.status, responded_at: new Date().toISOString() })
        .eq('id', input.inviteeRowId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  })
}

export function useDeleteMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const { error } = await supabase.from('meetings').delete().eq('id', meetingId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  })
}
