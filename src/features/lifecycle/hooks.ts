import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

export type LifecycleEvent = Tables<'lifecycle_events'>
export type Resignation = Tables<'resignations'>
export type ExitClearance = Tables<'exit_clearances'>

export function useLifecycleEvents(employeeId: string | null) {
  return useQuery({
    queryKey: ['lifecycle', employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lifecycle_events')
        .select('*')
        .eq('employee_id', employeeId!)
        .order('event_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAddEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { employeeId: string; eventType: string; eventDate: string; note?: string }) => {
      const { error } = await supabase.from('lifecycle_events').insert({
        employee_id: input.employeeId,
        event_type: input.eventType,
        event_date: input.eventDate,
        note: input.note || null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lifecycle'] }),
  })
}

export function useResignation(employeeId: string | null) {
  return useQuery({
    queryKey: ['resignation', employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resignations')
        .select('*')
        .eq('employee_id', employeeId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useClearances(resignationId: string | null) {
  return useQuery({
    queryKey: ['clearances', resignationId],
    enabled: !!resignationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exit_clearances')
        .select('*')
        .eq('resignation_id', resignationId!)
        .order('clearance_type')
      if (error) throw error
      return data
    },
  })
}

export function useStartExit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { employeeId: string; lastWorkingDate: string; reason?: string }) => {
      const { error } = await supabase.rpc('start_exit', {
        p_employee: input.employeeId,
        p_last_working_date: input.lastWorkingDate,
        p_reason: input.reason ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resignation'] })
      qc.invalidateQueries({ queryKey: ['lifecycle'] })
      qc.invalidateQueries({ queryKey: ['clearances'] })
    },
  })
}

export function useClearItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (clearanceId: string) => {
      const { error } = await supabase.rpc('clear_exit_item', { p_clearance: clearanceId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clearances'] }),
  })
}
