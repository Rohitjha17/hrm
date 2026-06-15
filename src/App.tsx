import { Routes, Route } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { RequirePermission } from '@/features/rbac/RequirePermission'
import { DashboardPage } from '@/pages/DashboardPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { UsersPage } from '@/features/admin/users/UsersPage'
import { RolesPage } from '@/features/admin/roles/RolesPage'
import { HierarchyPage } from '@/features/admin/hierarchy/HierarchyPage'
import { AuditPage } from '@/features/admin/audit/AuditPage'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        <Route
          path="/admin/users"
          element={
            <RequirePermission perm="users.view">
              <UsersPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/roles"
          element={
            <RequirePermission perm={['roles.view', 'roles.manage']}>
              <RolesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/hierarchy"
          element={
            <RequirePermission perm={['hierarchy.view', 'hierarchy.manage']}>
              <HierarchyPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <RequirePermission perm="audit.view">
              <AuditPage />
            </RequirePermission>
          }
        />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
