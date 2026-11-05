import { useMemo, useState } from 'react'
import { Check, CheckCheck, Eye, EyeOff, FolderOpen, History, MessageSquarePlus, Plus, Send, Settings2, Trash2, Undo2, X } from 'lucide-react'
import {
  useCreateStatus,
  useCreateTask,
  useDeleteStatus,
  useDeleteTask,
  useTaskHistory,
  useTaskCategories,
  useTaskStatuses,
  useTasks,
  useTasksRealtime,
  useAddTaskRemark,
  useTaskRemarks,
  useUpdateTaskStatus,
  useUpdateTaskDueDate,
  useUpdateTaskProgress,
  useAcceptTask,
  useRejectTask,
  useStartTask,
  useSubmitTask,
  useApproveTask,
  useReworkTask,
  useOpenTaskCount,
  useEffectiveCapacity,
  useTaskPolicy,
  useUpdateTaskPolicy,
  type TaskRow,
} from './hooks'
import { availableActions, styleForStatus } from './status-ui'
import { useUsers } from '@/features/admin/users/hooks'
import { useAuth } from '@/features/auth/auth-context'
import { useProfile } from '@/features/rbac/profile-context'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime } from '@/lib/format'
import { getTaskDelay, type TaskDelayState } from './delay'

// Due-date text colour reflects the state so overdue tasks pop in the list.
const DUE_DATE_COLOUR: Record<TaskDelayState, string> = {
  no_due_date: 'text-slate-400',
  upcoming: 'text-emerald-600',
  due_today: 'text-amber-600 font-medium',
  overdue: 'text-red-600 font-semibold',
  completed_on_time: 'text-emerald-600',
  completed_late: 'text-red-600 font-medium',
}
const dueDateClass = (state: TaskDelayState) => DUE_DATE_COLOUR[state]

const PRIORITY_TONE = { low: 'slate', medium: 'blue', high: 'red' } as const

export function TasksPage() {
  const { user } = useAuth()
  const { hasPermission } = useProfile()
  const canAssign = hasPermission('tasks.assign')
  const canViewAll = hasPermission('tasks.view_all')
  const canManageStatuses = hasPermission('tasks.manage')

  useTasksRealtime()
  const { data: tasks = [], isLoading } = useTasks()
  const { data: statuses = [] } = useTaskStatuses()
  const [filter, setFilter] = useState<'mine' | 'all'>(canViewAll ? 'all' : 'mine')
  const [assignorFilter, setAssignorFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [statusTask, setStatusTask] = useState<TaskRow | null>(null)
  const [historyTask, setHistoryTask] = useState<TaskRow | null>(null)
  const [remarkTask, setRemarkTask] = useState<TaskRow | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [groupBy, setGroupBy] = useState<'none' | 'project'>('none')
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<TaskRow | null>(null)
  const deleteTask = useDeleteTask()
  const toast = useToast()

  const inView = useMemo(
    () =>
      filter === 'all' && canViewAll
        ? tasks
        : tasks.filter((t) => t.created_by === user?.id || t.assignee_id === user?.id),
    [tasks, filter, canViewAll, user?.id],
  )

  // Filter options come from the tasks themselves, so they work for employees
  // who cannot list every user.
  const { assignors, assignees } = useMemo(() => {
    const by = new Map<string, string>()
    const to = new Map<string, string>()
    for (const t of inView) {
      if (t.creator) by.set(t.creator.id, t.creator.full_name || t.creator.email)
      if (t.assignee) to.set(t.assignee.id, t.assignee.full_name || t.assignee.email)
    }
    const sorted = (m: Map<string, string>) =>
      [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
    return { assignors: sorted(by), assignees: sorted(to) }
  }, [inView])

  const scoped = useMemo(
    () =>
      inView.filter(
        (t) =>
          (!assignorFilter || t.created_by === assignorFilter) &&
          (!assigneeFilter || t.assignee_id === assigneeFilter),
      ),
    [inView, assignorFilter, assigneeFilter],
  )

  const completedCount = useMemo(() => scoped.filter((t) => t.status?.is_terminal).length, [scoped])
  // Picking a specific status shows exactly that status (completed included);
  // otherwise the "Show completed" toggle decides.
  const visible = useMemo(() => {
    if (statusFilter) return scoped.filter((t) => t.status_id === statusFilter)
    return showCompleted ? scoped : scoped.filter((t) => !t.status?.is_terminal)
  }, [scoped, showCompleted, statusFilter])
  const hasFilters = !!(assignorFilter || assigneeFilter || statusFilter)

  return (
    <div data-testid="tasks-page">
      <PageHeader
        title="Tasks"
        description="Create your own tasks or assign work. Status changes are tracked with history."
        actions={
          <div className="flex gap-2">
            {canManageStatuses && (
              <Button
                variant="outline"
                data-testid="manage-statuses-button"
                onClick={() => setManageOpen(true)}
              >
                <Settings2 className="size-4" /> Statuses
              </Button>
            )}
            <Button data-testid="new-task-button" onClick={() => setNewOpen(true)}>
              <Plus className="size-4" /> New task
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {canViewAll && (
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(['mine', 'all'] as const).map((f) => (
              <button
                key={f}
                data-testid={`task-filter-${f}`}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium capitalize',
                  filter === f ? 'text-brand-700 bg-white shadow-sm' : 'text-slate-500',
                )}
              >
                {f === 'mine' ? 'My tasks' : 'All tasks'}
              </button>
            ))}
          </div>
        )}
        <button
          data-testid="toggle-completed"
          onClick={() => setShowCompleted((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium',
            showCompleted
              ? 'border-brand-200 bg-brand-50 text-brand-700'
              : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700',
          )}
        >
          {showCompleted ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {showCompleted ? 'Hide completed' : `Show completed (${completedCount})`}
        </button>
        <button
          data-testid="toggle-group-project"
          onClick={() => setGroupBy((v) => (v === 'project' ? 'none' : 'project'))}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium',
            groupBy === 'project'
              ? 'border-brand-200 bg-brand-50 text-brand-700'
              : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700',
          )}
        >
          <FolderOpen className="size-3.5" />
          {groupBy === 'project' ? 'Ungroup' : 'Group by project'}
        </button>
        <ApprovalsSummary tasks={visible} userId={user?.id} />
        {user?.id && <CapacityCallout userId={user.id} />}
        <div className="flex items-center gap-2">
          <Label htmlFor="task-status-filter" className="mb-0 text-xs text-slate-500">
            Status
          </Label>
          <Select
            id="task-status-filter"
            data-testid="task-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 w-40"
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-assignor-filter" className="mb-0 text-xs text-slate-500">
            Assigned by
          </Label>
          <Select
            id="task-assignor-filter"
            data-testid="task-assignor-filter"
            value={assignorFilter}
            onChange={(e) => setAssignorFilter(e.target.value)}
            className="h-9 w-44"
          >
            <option value="">Anyone</option>
            {assignors.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="task-assignee-filter" className="mb-0 text-xs text-slate-500">
            Assigned to
          </Label>
          <Select
            id="task-assignee-filter"
            data-testid="task-assignee-filter"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="h-9 w-44"
          >
            <option value="">Anyone</option>
            {assignees.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        {hasFilters && (
          <button
            data-testid="clear-task-filters"
            className="text-brand-600 text-xs font-medium hover:underline"
            onClick={() => {
              setAssignorFilter('')
              setAssigneeFilter('')
              setStatusFilter('')
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {!isLoading && visible.length === 0 ? (
        <EmptyState
          title={
            hasFilters
              ? 'No tasks match these filters'
              : scoped.length > 0
                ? 'No open tasks'
                : 'No tasks yet'
          }
          description={
            hasFilters
              ? 'Change or clear the filters to see more tasks.'
              : scoped.length > 0
                ? 'All tasks here are completed. Use "Show completed" to see them.'
                : 'Create your first task.'
          }
          testid="tasks-empty"
        />
      ) : (
        <Table data-testid="tasks-table">
          <Thead>
            <tr>
              <Th>Task</Th>
              <Th>Assignee</Th>
              <Th>Created by</Th>
              <Th>Created</Th>
              <Th>Completed</Th>
              <Th>Priority</Th>
              <Th>Progress</Th>
              <Th>Status</Th>
              <Th className="w-px" />
            </tr>
          </Thead>
          <Tbody>
            {visible.map((t) => (
              <tr key={t.id} data-testid="task-row">
                <Td className="font-medium text-slate-900">
                  {t.title}
                  {t.due_date && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-normal">
                      <span
                        data-testid="task-due-date"
                        data-delay={getTaskDelay(t.due_date, t.completed_at).state}
                        className={dueDateClass(getTaskDelay(t.due_date, t.completed_at).state)}
                      >
                        due {formatDate(t.due_date)}
                      </span>
                      <TaskDelayBadge dueDate={t.due_date} completedAt={t.completed_at} />
                    </div>
                  )}
                  {t.remarks && (
                    <div
                      data-testid="task-remark"
                      className="mt-1 flex items-start gap-1 text-xs font-normal text-slate-500"
                    >
                      <MessageSquarePlus className="mt-0.5 size-3 shrink-0 text-slate-400" />
                      <span className="italic">{t.remarks}</span>
                    </div>
                  )}
                </Td>
                <Td data-testid="task-assignee">
                  {t.assignee?.full_name || t.assignee?.email || 'Unassigned'}
                </Td>
                <Td className="text-slate-500">{t.creator?.full_name || t.creator?.email}</Td>
                <Td data-testid="task-created-at" className="whitespace-nowrap text-slate-500">
                  {formatDate(t.created_at)}
                </Td>
                <Td data-testid="task-completed-at" className="whitespace-nowrap text-slate-500">
                  {formatDate(t.completed_at) || '—'}
                </Td>
                <Td>
                  <Badge tone={PRIORITY_TONE[t.priority as keyof typeof PRIORITY_TONE]}>
                    {t.priority}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex items-center gap-2" data-testid="task-progress">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="bg-brand-500 h-full rounded-full"
                        style={{ width: `${t.progress_percent}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{t.progress_percent}%</span>
                  </div>
                </Td>
                <Td>
                  <Badge
                    className={styleForStatus(t.status?.slug).className}
                    data-testid="task-status"
                    data-status={t.status?.slug ?? ''}
                  >
                    {styleForStatus(t.status?.slug).label}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <LifecycleActions task={t} userId={user!.id} canApproveAny={canManageStatuses} />
                    <button
                      data-testid="update-status-button"
                      aria-label={`Update status of ${t.title}`}
                      className="text-brand-600 hover:bg-brand-50 rounded-md px-2 py-1 text-xs font-medium"
                      onClick={() => setStatusTask(t)}
                    >
                      Update
                    </button>
                    <button
                      data-testid="task-remark-button"
                      aria-label={`Remarks for ${t.title}`}
                      className="hover:text-brand-600 rounded-md p-1 text-slate-400"
                      onClick={() => setRemarkTask(t)}
                    >
                      <MessageSquarePlus className="size-4" />
                    </button>
                    <button
                      data-testid="task-history-button"
                      aria-label={`History of ${t.title}`}
                      className="rounded-md p-1 text-slate-400 hover:text-slate-700"
                      onClick={() => setHistoryTask(t)}
                    >
                      <History className="size-4" />
                    </button>
                    {canManageStatuses && (
                      <button
                        data-testid="delete-task-button"
                        aria-label={`Delete task ${t.title}`}
                        className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setConfirmDeleteTask(t)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      )}

      {newOpen && (
        <NewTaskModal onClose={() => setNewOpen(false)} canAssign={canAssign} userId={user!.id} />
      )}
      {statusTask && <StatusModal task={statusTask} onClose={() => setStatusTask(null)} />}
      {remarkTask && <RemarkModal task={remarkTask} onClose={() => setRemarkTask(null)} />}
      {historyTask && <HistoryModal task={historyTask} onClose={() => setHistoryTask(null)} />}
      {manageOpen && <StatusMasterModal onClose={() => setManageOpen(false)} />}
      {confirmDeleteTask && (
        <ConfirmDialog
          title="Delete task"
          testid="delete-task-dialog"
          confirmLabel="Delete task"
          loading={deleteTask.isPending}
          onClose={() => setConfirmDeleteTask(null)}
          message={
            <p>
              Delete task{' '}
              <span className="font-semibold text-slate-900">{confirmDeleteTask.title}</span>? Its
              remarks and status history will be deleted too. This action cannot be undone.
            </p>
          }
          onConfirm={() =>
            deleteTask.mutate(confirmDeleteTask.id, {
              onSuccess: () => {
                toast.success('Task deleted')
                setConfirmDeleteTask(null)
              },
              onError: (err) => toast.error('Delete failed', (err as Error).message),
            })
          }
        />
      )}
    </div>
  )
}

function NewTaskModal({
  onClose,
  canAssign,
  userId,
}: {
  onClose: () => void
  canAssign: boolean
  userId: string
}) {
  const create = useCreateTask()
  const toast = useToast()
  const { data: statuses = [] } = useTaskStatuses()
  const { data: users = [] } = useUsers()
  const { data: categories = [] } = useTaskCategories()
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  // Managers must pick someone else — the self-assign shortcut is gone to
  // enforce the client rule: 'khud ko assign nh hoga'.
  const [assigneeId, setAssigneeId] = useState(canAssign ? '' : userId)
  const [dueDate, setDueDate] = useState('')
  const [remarks, setRemarks] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const { data: assigneeOpen = 0 } = useOpenTaskCount(assigneeId || null)
  const { data: assigneeCap = 25 } = useEffectiveCapacity(assigneeId || null)
  const overCap = !!assigneeId && assigneeId !== userId && assigneeOpen >= assigneeCap

  return (
    <Modal open onClose={onClose} title="New task" testid="task-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const firstStatus = statuses[0]?.id
          if (!firstStatus) return
          if (!categoryId) {
            toast.error('Pick a task group', 'Choose which group this task belongs to.')
            return
          }
          if (canAssign && !assigneeId) {
            toast.error('Pick an assignee', 'Choose the employee this task is for.')
            return
          }
          create.mutate(
            {
              title: title.trim(),
              assigneeId: canAssign ? assigneeId || null : userId,
              statusId: firstStatus,
              priority,
              dueDate: dueDate || null,
              createdBy: userId,
              remarks,
              categoryId: categoryId || null,
            },
            {
              onSuccess: () => {
                toast.success('Task created')
                onClose()
              },
              onError: (err) => toast.error('Could not create task', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="task-title">Task</Label>
          <Input
            id="task-title"
            data-testid="task-title-input"
            placeholder="What is the task?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="task-created">Date of creation</Label>
            <Input
              id="task-created"
              data-testid="task-created-input"
              type="date"
              value={new Date().toLocaleDateString('en-CA')}
              readOnly
              disabled
            />
          </div>
          <div>
            <Label htmlFor="task-priority">Priority</Label>
            <Select
              id="task-priority"
              data-testid="task-priority-select"
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              data-testid="task-due-input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            {dueDate && <p className="mt-1 text-xs text-slate-400">Due {formatDate(dueDate)}</p>}
          </div>
          <div>
            <Label htmlFor="task-category">Task Group *</Label>
            <Select
              id="task-category"
              data-testid="task-category-select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="">Select a group…</option>
              {categories
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </Select>
            {categories.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                No task groups yet — ask an admin to create one in Masters.
              </p>
            )}
          </div>
        </div>
        <div>
          <Label htmlFor="task-assignee">Assignee</Label>
          <Select
            id="task-assignee"
            data-testid="task-assignee-select"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            disabled={!canAssign}
          >
            {!canAssign && <option value={userId}>Myself</option>}
            {canAssign && <option value="">Select employee…</option>}
            {canAssign &&
              users
                .filter((u) => u.id !== userId)
                .sort((a, b) =>
                  (a.full_name || a.email).localeCompare(b.full_name || b.email),
                )
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </option>
                ))}
          </Select>
          {!canAssign && (
            <p className="mt-1 text-xs text-slate-400">Only managers can assign to others.</p>
          )}
          {assigneeId && assigneeId !== userId && (
            <p
              data-testid="assignee-capacity-hint"
              className={cn(
                'mt-1 text-xs',
                overCap ? 'font-medium text-red-600' : 'text-slate-500',
              )}
            >
              Open tasks: {assigneeOpen} / capacity {assigneeCap}
              {overCap && ' — they are already at or over capacity. Assign anyway?'}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="task-remarks">Remarks</Label>
          <Textarea
            id="task-remarks"
            data-testid="task-remarks-input"
            rows={2}
            placeholder="Optional notes about this task"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="create-task-submit" loading={create.isPending}>
            Create task
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function RemarkModal({ task, onClose }: { task: TaskRow; onClose: () => void }) {
  const addRemark = useAddTaskRemark()
  const { data: remarkHistory = [], isLoading } = useTaskRemarks(task.id)
  const toast = useToast()
  const [remarks, setRemarks] = useState('')

  return (
    <Modal open onClose={onClose} title={`Remarks: ${task.title}`} testid="remark-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!remarks.trim()) return
          addRemark.mutate(
            { taskId: task.id, body: remarks },
            {
              onSuccess: () => {
                toast.success('Remark added')
                setRemarks('')
              },
              onError: (err) => toast.error('Save failed', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="task-remark-text">Add a remark</Label>
          <Textarea
            id="task-remark-text"
            data-testid="task-remark-textarea"
            rows={3}
            placeholder="Add a remark visible to the task owner, assignee and managers"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            type="submit"
            data-testid="save-remark-submit"
            disabled={!remarks.trim()}
            loading={addRemark.isPending}
          >
            Add remark
          </Button>
        </div>
      </form>

      <div className="mt-4 border-t border-slate-200 pt-3">
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Remark history
        </h4>
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : remarkHistory.length === 0 ? (
          <p className="text-sm text-slate-400" data-testid="remark-history-empty">
            No remarks yet.
          </p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto" data-testid="remark-history">
            {remarkHistory.map((r) => (
              <li
                key={r.id}
                data-testid="remark-entry"
                className="border-l-2 border-slate-200 pl-3 text-sm"
              >
                <div className="text-xs text-slate-500">
                  {r.author?.full_name || r.author?.email || 'Unknown'} ·{' '}
                  {formatDateTime(r.created_at)}
                </div>
                <div className="whitespace-pre-wrap text-slate-700">{r.body}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

function TaskDelayBadge({
  dueDate,
  completedAt,
}: {
  dueDate: string | null
  completedAt: string | null
}) {
  const delay = getTaskDelay(dueDate, completedAt)
  if (!['overdue', 'due_today', 'completed_late'].includes(delay.state)) return null

  return (
    <Badge tone={delay.isDelayed ? 'red' : 'amber'} data-testid="task-delay-status">
      {delay.label}
    </Badge>
  )
}

function StatusModal({ task, onClose }: { task: TaskRow; onClose: () => void }) {
  const { data: statuses = [] } = useTaskStatuses()
  const update = useUpdateTaskStatus()
  const updateDueDate = useUpdateTaskDueDate()
  const updateProgress = useUpdateTaskProgress()
  const toast = useToast()
  const [statusId, setStatusId] = useState(task.status_id)
  const [progress, setProgress] = useState(task.progress_percent)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [remarks, setRemarks] = useState('')
  const completing = !!statuses.find((s) => s.id === statusId)?.is_terminal
  const completingLate =
    completing &&
    statusId !== task.status_id &&
    getTaskDelay(dueDate, new Date().toISOString()).isDelayed

  return (
    <Modal open onClose={onClose} title={`Update: ${task.title}`} testid="status-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void (async () => {
            try {
              const newDue = dueDate || null
              const dueChanged = newDue !== (task.due_date ?? null)
              const statusChanged = statusId !== task.status_id
              if (completingLate && !remarks.trim()) {
                toast.error('Delay comment required', 'Explain why this task was completed late.')
                return
              }
              if (dueChanged) {
                await updateDueDate.mutateAsync({ taskId: task.id, dueDate: newDue })
              }
              if (statusChanged || remarks.trim()) {
                await update.mutateAsync({
                  taskId: task.id,
                  statusId,
                  remarks: remarks.trim() || undefined,
                })
              }
              // A completed status sets 100% on the server; otherwise save the user's value.
              if (!completing && progress !== task.progress_percent) {
                await updateProgress.mutateAsync({ taskId: task.id, percent: progress })
              }
              toast.success('Task updated')
              onClose()
            } catch (err) {
              toast.error('Update failed', (err as Error).message)
            }
          })()
        }}
      >
        <div>
          <Label htmlFor="status-select">New status</Label>
          <Select
            id="status-select"
            data-testid="status-select"
            value={statusId}
            onChange={(e) => setStatusId(e.target.value)}
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="status-progress">Completion: {completing ? 100 : progress}%</Label>
          <input
            id="status-progress"
            data-testid="status-progress"
            type="range"
            min={0}
            max={100}
            step={5}
            value={completing ? 100 : progress}
            disabled={completing}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="accent-brand-600 w-full"
          />
          {completing && (
            <p className="mt-1 text-xs text-slate-400">A completed task is always 100%.</p>
          )}
        </div>
        <div>
          <Label htmlFor="status-due-date">Due date</Label>
          <Input
            id="status-due-date"
            data-testid="status-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">
            {dueDate ? `Due ${formatDate(dueDate)}. ` : ''}The assignee, creator or a task manager
            can change the due date.
          </p>
        </div>
        <div>
          <Label htmlFor="status-remarks">{completingLate ? 'Delay comment' : 'Remarks'}</Label>
          <Textarea
            id="status-remarks"
            data-testid="status-remarks"
            rows={2}
            required={completingLate}
            placeholder={completingLate ? 'Explain the reason for the delay' : undefined}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
          {completingLate && (
            <p className="mt-1 text-xs text-red-600">
              This task is past its due date. A delay comment is required before completion.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            data-testid="save-status-submit"
            loading={update.isPending || updateDueDate.isPending || updateProgress.isPending}
          >
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function HistoryModal({ task, onClose }: { task: TaskRow; onClose: () => void }) {
  const { data: history = [], isLoading } = useTaskHistory(task.id)
  return (
    <Modal open onClose={onClose} title={`History: ${task.title}`} testid="history-modal">
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {history.map((h) => (
            <li key={h.id} data-testid="history-entry" className="border-brand-200 border-l-2 pl-3">
              <p className="text-sm font-medium text-slate-800">
                {h.from_status?.name ? `${h.from_status.name} → ` : ''}
                {h.to_status?.name}
              </p>
              <p className="text-xs text-slate-500">
                {h.changer?.full_name || 'System'} · {formatDateTime(h.created_at)}
              </p>
              {h.remarks && <p className="mt-0.5 text-sm text-slate-600">{h.remarks}</p>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

function StatusMasterModal({ onClose }: { onClose: () => void }) {
  const { data: statuses = [] } = useTaskStatuses()
  const create = useCreateStatus()
  const del = useDeleteStatus()
  const { data: policy } = useTaskPolicy()
  const updatePolicy = useUpdateTaskPolicy()
  const toast = useToast()
  const [name, setName] = useState('')
  const [defaultCapDraft, setDefaultCapDraft] = useState<string | null>(null)
  const defaultCap =
    defaultCapDraft ?? (policy?.default_task_capacity != null ? String(policy.default_task_capacity) : '')

  return (
    <Modal open onClose={onClose} title="Task statuses & policy" testid="status-master-modal">
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <Label htmlFor="task-default-cap">Default task capacity (new users)</Label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              id="task-default-cap"
              data-testid="task-default-capacity"
              type="number"
              min="1"
              value={defaultCap}
              onChange={(e) => setDefaultCapDraft(e.target.value)}
              className="w-32"
            />
            <Button
              size="sm"
              variant="outline"
              data-testid="save-default-capacity"
              loading={updatePolicy.isPending}
              onClick={() => {
                const n = Math.max(1, Math.round(Number(defaultCap)))
                updatePolicy.mutate(
                  { default_task_capacity: n },
                  {
                    onSuccess: () => toast.success('Default capacity saved'),
                    onError: (err: unknown) => toast.error('Save failed', (err as Error).message),
                  },
                )
              }}
            >
              Save
            </Button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            A user with no per-user capacity set uses this value. Edit a user to override it.
          </p>
        </div>
        <ul className="space-y-1">
          {statuses.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
            >
              <span>{s.name}</span>
              {s.is_system ? (
                <Badge tone="slate">system</Badge>
              ) : (
                <button
                  aria-label={`Delete ${s.name}`}
                  className="text-slate-400 hover:text-red-600"
                  onClick={() =>
                    del.mutate(s.id, {
                      onError: (e) => toast.error('Delete failed', (e as Error).message),
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate(
              {
                name: name.trim(),
                slug: name
                  .trim()
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '_'),
                sortOrder: statuses.length + 1,
              },
              {
                onSuccess: () => {
                  toast.success('Status added')
                  setName('')
                },
                onError: (err) => toast.error('Could not add', (err as Error).message),
              },
            )
          }}
        >
          <Input
            data-testid="new-status-name"
            placeholder="New status name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Button type="submit" data-testid="create-status-submit" loading={create.isPending}>
            Add
          </Button>
        </form>
      </div>
    </Modal>
  )
}

/* -----------------------------------------------------------------------------
 * Lifecycle action cell
 * Accept/Reject (assignee, pending), Start, Submit for approval, Resubmit,
 * Approve / Send back (approver, awaiting_approval). Rendered inline so each
 * state has exactly the right call-to-action right next to the task.
 * -------------------------------------------------------------------------- */

function LifecycleActions({
  task,
  userId,
  canApproveAny,
}: {
  task: TaskRow
  userId: string
  canApproveAny: boolean
}) {
  const [reasonModal, setReasonModal] = useState<null | 'reject' | 'rework'>(null)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const toast = useToast()
  const accept = useAcceptTask()
  const reject = useRejectTask()
  const start = useStartTask()
  const submit = useSubmitTask()
  const approve = useApproveTask()
  const rework = useReworkTask()

  const actions = availableActions(task, {
    userId,
    canApproveAny,
    reportingManagerId: null,
  })

  function okWarn(res: { warning?: string | null }) {
    if (res.warning) toast.error('Capacity warning', res.warning)
    else toast.success('Done')
  }
  function fail(err: unknown) {
    toast.error('Could not update task', (err as Error).message)
  }

  const btn = (
    label: string,
    testid: string,
    icon: React.ReactNode,
    onClick: () => void,
    tone: 'brand' | 'red' | 'amber' | 'emerald' = 'brand',
  ) => {
    const tones: Record<string, string> = {
      brand: 'text-brand-600 hover:bg-brand-50',
      red: 'text-red-600 hover:bg-red-50',
      amber: 'text-amber-700 hover:bg-amber-50',
      emerald: 'text-emerald-700 hover:bg-emerald-50',
    }
    return (
      <button
        data-testid={testid}
        onClick={onClick}
        className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium', tones[tone])}
      >
        {icon}
        {label}
      </button>
    )
  }

  return (
    <>
      {actions.canAccept &&
        btn(
          'Accept',
          'task-accept',
          <Check className="size-3.5" />,
          () =>
            accept.mutate(
              { taskId: task.id },
              { onSuccess: (r) => okWarn(r), onError: fail },
            ),
          'emerald',
        )}
      {actions.canReject &&
        btn('Reject', 'task-reject', <X className="size-3.5" />, () => setReasonModal('reject'), 'red')}
      {actions.canStart &&
        btn(
          'Start',
          'task-start',
          <Send className="size-3.5" />,
          () => start.mutate(task.id, { onError: fail }),
        )}
      {(actions.canSubmit || actions.canResubmit) &&
        btn(
          actions.canResubmit ? 'Resubmit' : task.created_by === task.assignee_id ? 'Mark done' : 'Submit for approval',
          'task-submit',
          <CheckCheck className="size-3.5" />,
          () => setConfirmSubmit(true),
          'amber',
        )}
      {actions.canApprove &&
        btn(
          'Approve',
          'task-approve',
          <Check className="size-3.5" />,
          () =>
            approve.mutate(
              { taskId: task.id },
              {
                onSuccess: () => toast.success('Task approved'),
                onError: fail,
              },
            ),
          'emerald',
        )}
      {actions.canRework &&
        btn(
          'Send back',
          'task-rework',
          <Undo2 className="size-3.5" />,
          () => setReasonModal('rework'),
          'amber',
        )}

      {reasonModal && (
        <ReasonModal
          title={reasonModal === 'reject' ? 'Reject assignment' : 'Send task back for rework'}
          label={reasonModal === 'reject' ? 'Why are you declining this task?' : 'What needs changing?'}
          confirmLabel={reasonModal === 'reject' ? 'Reject' : 'Send back'}
          loading={reject.isPending || rework.isPending}
          onClose={() => setReasonModal(null)}
          onConfirm={(reason) => {
            const action = reasonModal === 'reject' ? reject : rework
            action.mutate(
              { taskId: task.id, reason },
              {
                onSuccess: () => {
                  toast.success(reasonModal === 'reject' ? 'Assignment rejected' : 'Sent back for rework')
                  setReasonModal(null)
                },
                onError: fail,
              },
            )
          }}
        />
      )}

      {confirmSubmit && (
        <ReasonModal
          title={task.created_by === task.assignee_id ? 'Mark task as done' : 'Submit for approval'}
          label="Add a note (optional)"
          confirmLabel={task.created_by === task.assignee_id ? 'Mark done' : 'Submit'}
          required={false}
          loading={submit.isPending}
          onClose={() => setConfirmSubmit(false)}
          onConfirm={(remarks) =>
            submit.mutate(
              { taskId: task.id, remarks },
              {
                onSuccess: (r) => {
                  toast.success(
                    r.status === 'completed' ? 'Task completed' : 'Submitted — awaiting approval',
                  )
                  setConfirmSubmit(false)
                },
                onError: fail,
              },
            )
          }
        />
      )}
    </>
  )
}

function ReasonModal({
  title,
  label,
  confirmLabel,
  loading = false,
  required = true,
  onClose,
  onConfirm,
}: {
  title: string
  label: string
  confirmLabel: string
  loading?: boolean
  required?: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  return (
    <Modal open onClose={onClose} title={title} testid="task-reason-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (required && !reason.trim()) return
          onConfirm(reason.trim())
        }}
      >
        <div>
          <Label htmlFor="task-reason">{label}</Label>
          <Textarea
            id="task-reason"
            data-testid="task-reason-input"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required={required}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="task-reason-submit" loading={loading} disabled={required && !reason.trim()}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* -----------------------------------------------------------------------------
 * Approvals summary chip (shows how many tasks need THIS user's approval)
 * -------------------------------------------------------------------------- */
function ApprovalsSummary({ tasks, userId }: { tasks: TaskRow[]; userId: string | undefined }) {
  if (!userId) return null
  const owed = tasks.filter(
    (t) =>
      t.status?.slug === 'awaiting_approval' &&
      t.assignee_id !== userId &&
      (t.created_by === userId /* approver fallback — reporting-manager link lives on profiles */),
  ).length
  if (!owed) return null
  return (
    <span
      data-testid="approvals-owed"
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"
    >
      <CheckCheck className="size-3.5" /> {owed} awaiting your approval
    </span>
  )
}

/* -----------------------------------------------------------------------------
 * Capacity callout — tells the user whether they're over cap and what to do.
 * -------------------------------------------------------------------------- */
function CapacityCallout({ userId }: { userId: string }) {
  const { data: open = 0 } = useOpenTaskCount(userId)
  const { data: cap = 25 } = useEffectiveCapacity(userId)
  if (open <= cap) return null
  return (
    <span
      data-testid="capacity-callout"
      className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"
    >
      {open} open · capacity {cap} — close some before planning
    </span>
  )
}
