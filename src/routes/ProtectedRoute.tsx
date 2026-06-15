import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth-context'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { AppShell } from '@/components/layout/AppShell'

/**
 * Gate for all authenticated routes. Redirects unauthenticated users to the
 * login page (UI guard). Sensitive data is independently protected by RLS at
 * the database layer — this guard is for UX, not security.
 */
export function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
