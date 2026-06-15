import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

export type Role = Tables<'roles'>
export type Permission = Tables<'permissions'>

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('roles').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

export function usePermissionsCatalog() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('category')
        .order('key')
      if (error) throw error
      return data
    },
  })
}

export function useRolePermissionIds(roleId: string | null) {
  return useQuery({
    queryKey: ['role-permissions', roleId],
    enabled: !!roleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', roleId!)
      if (error) throw error
      return new Set(data.map((d) => d.permission_id))
    },
  })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; slug: string; description?: string }) => {
      const { error } = await supabase.from('roles').insert({ ...input, is_system: false })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('roles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })
}

export function useToggleRolePermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      roleId,
      permissionId,
      enabled,
    }: {
      roleId: string
      permissionId: string
      enabled: boolean
    }) => {
      if (enabled) {
        const { error } = await supabase
          .from('role_permissions')
          .insert({ role_id: roleId, permission_id: permissionId })
        if (error && error.code !== '23505') throw error
      } else {
        const { error } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', roleId)
          .eq('permission_id', permissionId)
        if (error) throw error
      }
    },
    // Optimistically flip the checkbox so the UI is instant and deterministic.
    onMutate: async ({ roleId, permissionId, enabled }) => {
      const key = ['role-permissions', roleId]
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Set<string>>(key)
      const next = new Set(prev ?? [])
      if (enabled) next.add(permissionId)
      else next.delete(permissionId)
      qc.setQueryData(key, next)
      return { prev, key }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev)
    },
    onSettled: (_d, _e, vars) =>
      qc.invalidateQueries({ queryKey: ['role-permissions', vars.roleId] }),
  })
}
