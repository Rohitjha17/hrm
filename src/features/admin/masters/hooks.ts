import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type MasterKind =
  | 'task_categories'
  | 'appraisal_types'
  | 'document_types'
  | 'policy_categories'
  | 'helpdesk_categories'
  | 'leave_types'

export interface MasterItem {
  id: string
  name: string
  code?: string
  is_active: boolean
  sort_order: number
}

export function useMasterItems(kind: MasterKind) {
  return useQuery({
    queryKey: ['central-master', kind],
    queryFn: async () => {
      const columns =
        kind === 'document_types'
          ? 'id,name,code,is_active,sort_order'
          : 'id,name,is_active,sort_order'
      const { data, error } = await supabase
        .from(kind)
        .select(columns)
        .order('sort_order')
        .order('name')
      if (error) throw error
      return (data ?? []) as unknown as MasterItem[]
    },
  })
}

function codeFor(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function useSaveMasterItem(kind: MasterKind) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<MasterItem> & { name: string }) => {
      if (!input.name.trim()) throw new Error('Name is required')
      const values: Record<string, unknown> = {
        name: input.name.trim(),
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
      }
      if (kind === 'document_types') values.code = input.code || codeFor(input.name)
      // leave_types has a NOT NULL slug (unique) — generate from the name on
      // create so the simple CRUD widget doesn't need a dedicated input.
      if (kind === 'leave_types' && !input.id) values.slug = codeFor(input.name)
      const { error } = input.id
        ? await supabase
            .from(kind)
            .update(values as never)
            .eq('id', input.id)
        : await supabase.from(kind).insert(values as never)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['central-master', kind] }),
  })
}

export function useDeleteMasterItem(kind: MasterKind) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(kind).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['central-master', kind] }),
  })
}

export function useReorderMasterItems(kind: MasterKind) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: MasterItem[]) => {
      for (const [index, item] of items.entries()) {
        const { error } = await supabase
          .from(kind)
          .update({ sort_order: index + 1 })
          .eq('id', item.id)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['central-master', kind] }),
  })
}

export function useMasterAudit() {
  return useQuery({
    queryKey: ['master-audit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('master_audit_log')
        .select('*, changer:profiles!master_audit_log_changed_by_fkey(full_name,email)')
        .order('changed_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data as unknown as Array<{
        id: number
        record_id: string
        master_type: string
        action: string
        changed_at: string
        old_value: Record<string, unknown> | null
        new_value: Record<string, unknown> | null
        changer: { full_name: string | null; email: string } | null
      }>
    },
  })
}
