import { createContext, useContext } from 'react'

export type ViewMode = 'admin' | 'employee'

export interface ViewModeContextValue {
  mode: ViewMode
  /** Only Super Admin / admin-capable users may toggle between views. */
  canToggle: boolean
  setMode: (mode: ViewMode) => void
  toggle: () => void
}

export const ViewModeContext = createContext<ViewModeContextValue | undefined>(undefined)

export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext)
  if (!ctx) throw new Error('useViewMode must be used within a ViewModeProvider')
  return ctx
}
