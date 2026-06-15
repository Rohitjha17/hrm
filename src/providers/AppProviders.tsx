import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ProfileProvider } from '@/features/rbac/ProfileProvider'
import { ViewModeProvider } from '@/features/view-mode/ViewModeProvider'
import { ToastProvider } from '@/components/ui/Toast'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <ProfileProvider>
              <ViewModeProvider>{children}</ViewModeProvider>
            </ProfileProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
