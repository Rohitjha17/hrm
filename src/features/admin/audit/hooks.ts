import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useAuditLog(limit = 100) {
  return useQuery({
    queryKey: ['audit', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data
    },
  })
}

/** Map of profile id → display label, for resolving audit actor names. */
export function useActorMap() {
  return useQuery({
    queryKey: ['actor-map'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, email')
      if (error) throw error
      const map = new Map<string, string>()
      for (const p of data ?? []) map.set(p.id, p.full_name || p.email)
      return map
    },
  })
}
