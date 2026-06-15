import type { ReactNode } from 'react'
import { useProfile } from './profile-context'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { ForbiddenPage } from '@/pages/ForbiddenPage'

/**
 * UI route guard. Renders children only if the user holds (any of) `perm`.
 * This is UX only — RLS independently blocks the data even if a guard is
 * bypassed.
 */
export function RequirePermission({
  perm,
  children,
}: {
  perm: string | string[]
  children: ReactNode
}) {
  const { hasPermission, loading } = useProfile()
  if (loading) return <FullPageSpinner />
  const list = Array.isArray(perm) ? perm : [perm]
  if (!list.some(hasPermission)) return <ForbiddenPage />
  return <>{children}</>
}
