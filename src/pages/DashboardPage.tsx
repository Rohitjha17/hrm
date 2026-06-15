import { useViewMode } from '@/features/view-mode/view-mode-context'
import { AdminDashboard } from '@/features/dashboard/AdminDashboard'
import { EmployeeDashboard } from '@/features/dashboard/EmployeeDashboard'

export function DashboardPage() {
  const { mode } = useViewMode()
  return mode === 'admin' ? <AdminDashboard /> : <EmployeeDashboard />
}
