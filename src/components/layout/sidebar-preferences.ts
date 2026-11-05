import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'

export type SidebarMode = 'admin' | 'employee'

export interface SidebarPreferences {
  order: string[]
  hidden: string[]
  collapsed: boolean
  /** Group ids the user has collapsed in the sidebar. */
  collapsedGroups: string[]
}

const defaults = (ids: string[]): SidebarPreferences => ({
  order: ids,
  hidden: [],
  collapsed: false,
  collapsedGroups: [],
})

export function normalizeSidebarPreferences(
  ids: string[],
  value?: Partial<SidebarPreferences> | null,
): SidebarPreferences {
  const valid = new Set(ids)
  const seen = new Set<string>()
  const savedOrder = Array.isArray(value?.order) ? value.order : []
  const order: string[] = []
  for (const id of savedOrder) {
    if (valid.has(id) && !seen.has(id)) {
      seen.add(id)
      order.push(id)
    }
  }
  for (const id of ids) if (!seen.has(id)) order.push(id)
  const hidden = [...new Set(Array.isArray(value?.hidden) ? value.hidden : [])].filter((id) =>
    valid.has(id),
  )
  const collapsedGroups = Array.isArray(value?.collapsedGroups) ? [...new Set(value!.collapsedGroups)] : []
  return { order, hidden, collapsed: value?.collapsed === true, collapsedGroups }
}

export function moveSidebarItem(order: string[], sourceId: string, targetId: string): string[] {
  if (sourceId === targetId) return order
  const from = order.indexOf(sourceId)
  const to = order.indexOf(targetId)
  if (from < 0 || to < 0) return order
  const next = [...order]
  next.splice(from, 1)
  next.splice(to, 0, sourceId)
  return next
}

export function moveSidebarItemBy(order: string[], id: string, offset: -1 | 1): string[] {
  const from = order.indexOf(id)
  const to = from + offset
  if (from < 0 || to < 0 || to >= order.length) return order
  const next = [...order]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

function storageKey(userId: string, mode: SidebarMode) {
  return `hrms-sidebar:${userId}:${mode}`
}

function readLocal(userId: string, mode: SidebarMode): Partial<SidebarPreferences> | null {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId, mode)) ?? 'null')
  } catch {
    return null
  }
}

function writeLocal(userId: string, mode: SidebarMode, value: SidebarPreferences) {
  try {
    localStorage.setItem(storageKey(userId, mode), JSON.stringify(value))
  } catch {
    // Browser storage may be unavailable; Supabase remains the source of truth.
  }
}

export function useSidebarPreferences(mode: SidebarMode, ids: string[]) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const userId = user?.id ?? ''
  const key = ['sidebar-preferences', userId, mode]

  const query = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async () => {
      const local = readLocal(userId, mode)
      const { data, error } = await supabase
        .from('sidebar_preferences')
        .select('item_order,hidden_items,collapsed,collapsed_groups')
        .eq('user_id', userId)
        .eq('view_mode', mode)
        .maybeSingle()

      if (error) {
        console.warn('Could not load cloud sidebar preferences; using this device.', error.message)
        return normalizeSidebarPreferences(ids, local)
      }
      const remote = data
        ? { order: data.item_order, hidden: data.hidden_items, collapsed: data.collapsed, collapsedGroups: data.collapsed_groups ?? [] }
        : local
      const normalized = normalizeSidebarPreferences(ids, remote)
      writeLocal(userId, mode, normalized)
      return normalized
    },
    placeholderData: () => normalizeSidebarPreferences(ids, readLocal(userId, mode)),
  })

  const save = useMutation({
    mutationFn: async (value: SidebarPreferences) => {
      const normalized = normalizeSidebarPreferences(ids, value)
      writeLocal(userId, mode, normalized)
      const { error } = await supabase.from('sidebar_preferences').upsert(
        {
          user_id: userId,
          view_mode: mode,
          item_order: normalized.order,
          hidden_items: normalized.hidden,
          collapsed: normalized.collapsed,
          collapsed_groups: normalized.collapsedGroups,
        },
        { onConflict: 'user_id,view_mode' },
      )
      return { value: normalized, synced: !error, error: error?.message }
    },
    onSuccess: ({ value }) => qc.setQueryData(key, value),
  })

  return {
    preferences: normalizeSidebarPreferences(ids, query.data ?? defaults(ids)),
    isLoading: query.isLoading,
    save,
  }
}
