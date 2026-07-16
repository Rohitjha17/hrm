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
import { LeavePage } from '@/features/leave/LeavePage'
import { LeaveApprovalsPage } from '@/features/leave/LeaveApprovalsPage'
import { SalaryPage } from '@/features/salary/SalaryPage'
import { SalaryAdminPage } from '@/features/salary/SalaryAdminPage'
import { AppraisalPage } from '@/features/appraisal/AppraisalPage'
import { AppraisalAdminPage } from '@/features/appraisal/AppraisalAdminPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { PolicyPage } from '@/features/policy/PolicyPage'
import { PolicyAdminPage } from '@/features/policy/PolicyAdminPage'
import { WorkflowAdminPage, MyWorkflowsPage } from '@/features/workflow/WorkflowAdminPage'
import { RecruitmentPage } from '@/features/recruitment/RecruitmentPage'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { DocumentsPage } from '@/features/documents/DocumentsPage'
import { AssetsPage } from '@/features/assets/AssetsPage'
import { LifecyclePage } from '@/features/lifecycle/LifecyclePage'
import { HelpdeskPage } from '@/features/helpdesk/HelpdeskPage'
import { MyAssetsPage } from '@/features/assets/MyAssetsPage'
import { AnnouncementsPage } from '@/features/engagement/AnnouncementsPage'
import { RecognitionPage } from '@/features/engagement/RecognitionPage'
import { VisitorsPage } from '@/features/engagement/VisitorsPage'
import { MyVisitorsPage } from '@/features/engagement/MyVisitorsPage'
import { MonitoringPage } from '@/features/monitoring/MonitoringPage'
import { MonitoringReportPage } from '@/features/monitoring/MonitoringReportPage'
import { TrainingPage } from '@/features/training/TrainingPage'
import { MyTrainingPage } from '@/features/training/MyTrainingPage'

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
          path="/leave"
          element={
            <RequirePermission perm="leave.view_own">
              <LeavePage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/leave"
          element={
            <RequirePermission perm={['leave.view_all', 'leave.approve']}>
              <LeaveApprovalsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/salary"
          element={
            <RequirePermission perm="salary.view_own">
              <SalaryPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/salary"
          element={
            <RequirePermission perm={['salary.view', 'salary.manage']}>
              <SalaryAdminPage />
            </RequirePermission>
          }
        />
        <Route
          path="/appraisal"
          element={
            <RequirePermission perm="appraisal.view_own">
              <AppraisalPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/appraisal"
          element={
            <RequirePermission perm={['appraisal.view', 'appraisal.manage']}>
              <AppraisalAdminPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <RequirePermission perm="reports.view">
              <ReportsPage />
            </RequirePermission>
          }
        />
        <Route path="/policies" element={<PolicyPage />} />
        <Route path="/helpdesk" element={<HelpdeskPage />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/visitors" element={<MyVisitorsPage />} />
        <Route path="/recognition" element={<RecognitionPage />} />
        <Route path="/my-assets" element={<MyAssetsPage />} />
        <Route
          path="/admin/visitors"
          element={
            <RequirePermission perm="visitors.manage">
              <VisitorsPage />
            </RequirePermission>
          }
        />
        <Route path="/monitoring" element={<MonitoringPage />} />
        <Route
          path="/admin/monitoring"
          element={
            <RequirePermission perm="monitoring.view">
              <MonitoringReportPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/policies"
          element={
            <RequirePermission perm="policy.manage">
              <PolicyAdminPage />
            </RequirePermission>
          }
        />
        <Route path="/my-workflows" element={<MyWorkflowsPage />} />
        <Route
          path="/admin/workflows"
          element={
            <RequirePermission perm="workflow.manage">
              <WorkflowAdminPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/recruitment"
          element={
            <RequirePermission perm={['recruitment.view', 'recruitment.manage']}>
              <RecruitmentPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/onboarding"
          element={
            <RequirePermission perm="onboarding.manage">
              <OnboardingPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/documents"
          element={
            <RequirePermission perm={['documents.view', 'documents.manage']}>
              <DocumentsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/assets"
          element={
            <RequirePermission perm={['assets.view', 'assets.manage']}>
              <AssetsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/lifecycle"
          element={
            <RequirePermission perm="lifecycle.manage">
              <LifecyclePage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/training"
          element={
            <RequirePermission perm="training.manage">
              <TrainingPage />
            </RequirePermission>
          }
        />
        <Route path="/training" element={<MyTrainingPage />} />
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
