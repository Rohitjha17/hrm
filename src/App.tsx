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
import { PunchPage } from '@/features/attendance/PunchPage'
import { AttendanceMonitorPage } from '@/features/attendance/AttendanceMonitorPage'
import { TasksPage } from '@/features/tasks/TasksPage'
import { PlanningPage } from '@/features/planning/PlanningPage'
import { PlanningAdminPage } from '@/features/planning/PlanningAdminPage'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        <Route
          path="/attendance"
          element={
            <RequirePermission perm="attendance.view_own">
              <PunchPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/attendance"
          element={
            <RequirePermission perm="attendance.view_all">
              <AttendanceMonitorPage />
            </RequirePermission>
          }
        />
        <Route
          path="/tasks"
          element={
            <RequirePermission perm={['tasks.view_own', 'tasks.view_all']}>
              <TasksPage />
            </RequirePermission>
          }
        />
        <Route
          path="/planning"
          element={
            <RequirePermission perm="planning.view_own">
              <PlanningPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/planning"
          element={
            <RequirePermission perm="planning.view_all">
              <PlanningAdminPage />
            </RequirePermission>
          }
        />
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
