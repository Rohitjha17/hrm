import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

export interface UserRow extends Tables<'profiles'> {
  user_roles: { role_id: string; roles: { slug: string; name: string } | null }[]
}

// NOTE: department/team are resolved client-side (not embedded) because there
// are two relationships between profiles and teams (team_id and a team's
// reporting_manager_id), which makes a direct embed ambiguous in PostgREST.
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, user_roles(role_id, roles(slug,name))')
        .order('full_name')
      if (error) throw error
      return (data ?? []) as unknown as UserRow[]
    },
  })
}

export interface ProfileUpdate {
  id: string
  full_name?: string
  department_id?: string | null
  team_id?: string | null
  reporting_manager_id?: string | null
  status?: 'active' | 'inactive'
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...fields }: ProfileUpdate) => {
      const { error } = await supabase.from('profiles').update(fields).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

/** Reconcile a user's role assignments to exactly `roleIds`. */
export function useSetUserRoles() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, roleIds }: { userId: string; roleIds: string[] }) => {
      const { data: current, error: e1 } = await supabase
        .from('user_roles')
        .select('id, role_id')
        .eq('user_id', userId)
      if (e1) throw e1

      const currentIds = new Set((current ?? []).map((r) => r.role_id))
      const desired = new Set(roleIds)
      const toAdd = roleIds.filter((id) => !currentIds.has(id))
      const toRemove = (current ?? []).filter((r) => !desired.has(r.role_id))

      if (toAdd.length) {
        const { error } = await supabase
          .from('user_roles')
          .insert(toAdd.map((role_id) => ({ user_id: userId, role_id })))
        if (error) throw error
      }
      for (const r of toRemove) {
        const { error } = await supabase.from('user_roles').delete().eq('id', r.id)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}
