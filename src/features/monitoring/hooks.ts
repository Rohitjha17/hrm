import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import { captureScreenshot } from './capture'
import type { Tables } from '@/types/database.types'

export type Screenshot = Tables<'screenshots'>

export interface CaptureRow extends Screenshot {
  profiles: { full_name: string; email: string } | null
}

export function useMonitoringConfig() {
  return useQuery({
    queryKey: ['monitoring-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('monitoring_config').select('*').single()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateMonitoringConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (interval: number) => {
      const { error } = await supabase
        .from('monitoring_config')
        .update({ capture_interval_minutes: interval })
        .eq('id', true)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitoring-config'] }),
  })
}

export function useMyCaptures() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-captures', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('screenshots')
        .select('*')
        .eq('user_id', user!.id)
        .order('captured_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCaptureScreenshot() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async () => {
      const { blob, systemName, activity } = await captureScreenshot()
      const path = `${user!.id}/${crypto.randomUUID()}.jpg`
      const up = await supabase.storage.from('screenshots').upload(path, blob, { contentType: 'image/jpeg' })
      if (up.error) throw up.error
      const { error } = await supabase.from('screenshots').insert({
        user_id: user!.id,
        system_name: systemName,
        activity_status: activity,
        storage_path: path,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-captures'] }),
  })
}

export type ReportPeriod = 'daily' | 'weekly' | 'monthly'

function periodStart(period: ReportPeriod): string {
  const d = new Date()
  if (period === 'daily') d.setUTCHours(0, 0, 0, 0)
  else if (period === 'weekly') d.setUTCDate(d.getUTCDate() - 7)
  else d.setUTCMonth(d.getUTCMonth() - 1)
  return d.toISOString()
}

export function useCaptureReport(period: ReportPeriod, employeeId: string) {
  return useQuery({
    queryKey: ['capture-report', period, employeeId],
    refetchInterval: 5000,
    queryFn: async () => {
      let q = supabase
        .from('screenshots')
        .select('*, profiles(full_name,email)')
        .gte('captured_at', periodStart(period))
        .order('captured_at', { ascending: false })
      if (employeeId) q = q.eq('user_id', employeeId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as CaptureRow[]
    },
  })
}
