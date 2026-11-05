import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { supabase } from '@/lib/supabase'
import { normalizeSidebarPreferences } from '@/components/layout/sidebar-preferences'

export interface DashboardPreferences {
  order: string[]
  hidden: string[]
}

function storageKey(userId: string, mode: 'admin' | 'employee') {
  return `hrms-dashboard:${userId}:${mode}`
}

function readLocal(
  userId: string,
  mode: 'admin' | 'employee',
): Partial<DashboardPreferences> | null {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId, mode)) ?? 'null')
  } catch {
    return null
  }
}

function normalize(
  ids: string[],
  value?: Partial<DashboardPreferences> | null,
): DashboardPreferences {
  const result = normalizeSidebarPreferences(ids, value)
  return { order: result.order, hidden: result.hidden }
}

export function useDashboardPreferences(mode: 'admin' | 'employee', ids: string[]) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const userId = user?.id ?? ''
  const key = ['dashboard-preferences', userId, mode]
  const query = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async () => {
      const local = readLocal(userId, mode)
      const { data, error } = await supabase
        .from('dashboard_preferences')
        .select('item_order,hidden_items')
        .eq('user_id', userId)
        .eq('view_mode', mode)
        .maybeSingle()
      if (error) return normalize(ids, local)
      const value = normalize(
        ids,
        data ? { order: data.item_order, hidden: data.hidden_items } : local,
      )
      localStorage.setItem(storageKey(userId, mode), JSON.stringify(value))
      return value
    },
    placeholderData: () => normalize(ids, readLocal(userId, mode)),
  })

  const save = useMutation({
    mutationFn: async (value: DashboardPreferences) => {
      const normalized = normalize(ids, value)
      localStorage.setItem(storageKey(userId, mode), JSON.stringify(normalized))
      const { error } = await supabase.from('dashboard_preferences').upsert(
        {
          user_id: userId,
          view_mode: mode,
          item_order: normalized.order,
          hidden_items: normalized.hidden,
        },
        { onConflict: 'user_id,view_mode' },
      )
      return { value: normalized, synced: !error, error: error?.message }
    },
    onSuccess: ({ value }) => qc.setQueryData(key, value),
  })

  return { preferences: normalize(ids, query.data), save }
}
