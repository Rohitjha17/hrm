import { useMemo, useState, type ReactNode } from 'react'
import { useProfile } from '@/features/rbac/profile-context'
import { ViewModeContext, type ViewMode, type ViewModeContextValue } from './view-mode-context'

/**
 * Super Admin dual view: admin-capable users default into the Admin view and
 * can toggle to Employee. Everyone else is locked to Employee. The mode is
 * derived (override ?? default) so there is no setState-in-effect.
 */
export function ViewModeProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useProfile()
  const [override, setOverride] = useState<ViewMode | null>(null)

  const mode: ViewMode = !isAdmin ? 'employee' : (override ?? 'admin')

  const value = useMemo<ViewModeContextValue>(
    () => ({
      mode,
      canToggle: isAdmin,
      setMode: (m) => setOverride(m),
      toggle: () => setOverride(mode === 'admin' ? 'employee' : 'admin'),
    }),
    [mode, isAdmin],
  )

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>
}
