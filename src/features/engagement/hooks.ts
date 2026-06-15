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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visitors'] }),
  })
}
