/**
 * Status badge styles and lifecycle action resolver — one source of truth for
 * the whole Tasks UI (page, modals, My Approvals inbox, Planning picker).
 */

import type { TaskRow } from './hooks'

export interface StatusMeta {
  label: string
  /** Tailwind badge classes. */
  className: string
}

export const TASK_STATUS_STYLE: Record<string, StatusMeta> = {
  pending:            { label: 'Pending',            className: 'bg-slate-100 text-slate-700' },
  accepted:           { label: 'Accepted',           className: 'bg-sky-100 text-sky-800' },
  in_progress:        { label: 'In Progress',        className: 'bg-brand-100 text-brand-800' },
  on_hold:            { label: 'On Hold',            className: 'bg-slate-200 text-slate-700' },
  awaiting_approval:  { label: 'Awaiting Approval',  className: 'bg-amber-100 text-amber-800' },
  rework:             { label: 'Rework',             className: 'bg-orange-100 text-orange-800' },
  completed:          { label: 'Completed',          className: 'bg-emerald-100 text-emerald-800' },
  rejected:           { label: 'Rejected',           className: 'bg-red-100 text-red-800' },
}

export function styleForStatus(slug: string | null | undefined): StatusMeta {
  return (slug && TASK_STATUS_STYLE[slug]) || { label: slug ?? '—', className: 'bg-slate-100 text-slate-700' }
}

/**
 * What this user can do with this task right now, given its state and whether
 * they are the assignee or the approver (reporting manager / creator / admin).
 */
export interface AvailableActions {
  canAccept: boolean
  canReject: boolean
  canStart: boolean
  canSubmit: boolean
  canResubmit: boolean
  canApprove: boolean
  canRework: boolean
}

export function availableActions(
  task: TaskRow,
  context: {
    userId: string
    canApproveAny: boolean
    reportingManagerId?: string | null
  },
): AvailableActions {
  const slug = task.status?.slug ?? ''
  const isAssignee = task.assignee_id === context.userId
  const isSelfTask = task.created_by === task.assignee_id
  const isApproverForMe =
    task.created_by === context.userId ||
    context.canApproveAny ||
    context.reportingManagerId === context.userId

  return {
    canAccept: isAssignee && !isSelfTask && slug === 'pending',
    canReject: isAssignee && !isSelfTask && slug === 'pending',
    canStart: isAssignee && ['accepted', 'rework', 'on_hold'].includes(slug),
    // In the self-task path "Submit" is the universal complete button.
    canSubmit: isAssignee && (
      isSelfTask
        ? ['pending', 'accepted', 'in_progress', 'rework', 'on_hold'].includes(slug)
        : ['accepted', 'in_progress', 'on_hold'].includes(slug)
    ),
    canResubmit: isAssignee && !isSelfTask && slug === 'rework',
    canApprove: !isAssignee && isApproverForMe && slug === 'awaiting_approval',
    canRework: !isAssignee && isApproverForMe && slug === 'awaiting_approval',
  }
}
