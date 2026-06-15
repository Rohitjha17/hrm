import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import type { Tables } from '@/types/database.types'

export type Ticket = Tables<'tickets'>

export function useTickets() {
  return useQuery({
    queryKey: ['tickets'],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useRaiseTicket() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { category: string; subject: string; description?: string; priority: string }) => {
      const { error } = await supabase.from('tickets').insert({
        raised_by: user!.id,
        category: input.category,
        subject: input.subject,
        description: input.description || null,
        priority: input.priority,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useUpdateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; status?: Ticket['status']; escalated?: boolean }) => {
      const patch: { status?: Ticket['status']; escalated?: boolean } = {}
      if (input.status) patch.status = input.status
      if (input.escalated != null) patch.escalated = input.escalated
      const { error } = await supabase.from('tickets').update(patch).eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function isSlaBreached(t: Ticket): boolean {
  if (t.status === 'resolved' || t.status === 'closed') return false
  return !!t.sla_due_at && new Date(t.sla_due_at).getTime() < Date.now()
}
