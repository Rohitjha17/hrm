import { createContext, useContext } from 'react'
import type { Tables } from '@/types/database.types'

export type Profile = Tables<'profiles'>

export interface ProfileContextValue {
  profile: Profile | null
  permissions: Set<string>
  roles: Set<string>
  loading: boolean
  /** True if the user holds `perm` or the '*' wildcard (Super Admin). */
  hasPermission: (perm: string) => boolean
  isAdmin: boolean
  refetch: () => void
}

export const ProfileContext = createContext<ProfileContextValue | undefined>(undefined)

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider')
  return ctx
}
