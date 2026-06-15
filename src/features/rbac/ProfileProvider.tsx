import { useCallback, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'
import { ProfileContext, type Profile, type ProfileContextValue } from './profile-context'

const EMPTY = new Set<string>()

/**
 * Loads the signed-in user's profile + effective permissions + roles (via the
 * SECURITY DEFINER RPCs). This is the source of truth for UI guards — the DB's
 * RLS independently enforces the same rules on every query.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session, user } = useAuth()
  const userId = user?.id ?? null

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['profile-context', userId],
    enabled: !!session && !!userId,
    queryFn: async () => {
      const [profileRes, permsRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId!).maybeSingle(),
        supabase.rpc('my_permissions'),
        supabase.rpc('my_roles'),
      ])
      return {
        profile: (profileRes.data as Profile | null) ?? null,
        permissions: new Set<string>(permsRes.data ?? []),
        roles: new Set<string>(rolesRes.data ?? []),
      }
    },
  })

  const permissions = data?.permissions ?? EMPTY
  const roles = data?.roles ?? EMPTY

  const hasPermission = useCallback(
    (perm: string) => permissions.has('*') || permissions.has(perm),
    [permissions],
  )

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile: data?.profile ?? null,
      permissions,
      roles,
      loading: !!session && isLoading,
      hasPermission,
      isAdmin: permissions.has('*') || permissions.has('admin.access'),
      refetch: () => void refetch(),
    }),
    [data?.profile, permissions, roles, session, isLoading, hasPermission, refetch],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}
