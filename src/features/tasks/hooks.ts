import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

export type TaskStatus = Tables<'task_statuses'>

export interface TaskRow extends Tables<'tasks'> {
  creator: { id: string; full_name: string; email: string } | null
  assignee: { id: string; full_name: string; email: string } | null
  status: { id: string; name: string; slug: string; is_terminal: boolean } | null
}

const TASK_SELECT =
  '*, creator:profiles!tasks_created_by_fkey(id,full_name,email), assignee:profiles!tasks_assignee_id_fkey(id,full_name,email), status:task_statuses(id,name,slug,is_terminal)'

export function useTaskStatuses() {
  return useQuery({
    queryKey: ['task-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_statuses')
        .select('*')
        .order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    refetchInterval: 5000, // resilience fallback; Realtime drives instant updates
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_SELECT)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as TaskRow[]
    },
  })
}

export interface NewTask {
  title: string
  description?: string
  assigneeId: string | null
  statusId: string
  priority: 'low' | 'medium' | 'high'
  dueDate: string | null
  createdBy: string
  remarks?: string
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (t: NewTask) => {
      const assigned = t.assigneeId != null && t.assigneeId !== t.createdBy
      const { error } = await supabase.from('tasks').insert({
        title: t.title,
        description: t.description || null,
        assignee_id: t.assigneeId,
        status_id: t.statusId,
        priority: t.priority,
        due_date: t.dueDate,
        created_by: t.createdBy,
        task_type: assigned ? 'assigned' : 'self',
        remarks: t.remarks?.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export interface TaskRemarkRow extends Tables<'task_remarks'> {
  author: { full_name: string; email: string } | null
}

/** Append-only remark history for a task (newest first). */
export function useTaskRemarks(taskId: string | null) {
  return useQuery({
    queryKey: ['task-remarks', taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_remarks')
        .select('*, author:profiles!task_remarks_author_id_fkey(full_name,email)')
        .eq('task_id', taskId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as TaskRemarkRow[]
    },
  })
}

/** Add a remark to the task's history. RLS/RPC allows creator, assignee or task manager. */
export function useAddTaskRemark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { taskId: string; body: string }) => {
      const { error } = await supabase.rpc('add_task_remark', {
        p_task: args.taskId,
        p_body: args.body,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task-remarks'] })
    },
  })
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { taskId: string; statusId: string; remarks?: string }) => {
      const { error } = await supabase.rpc('update_task_status', {
        p_task: args.taskId,
        p_status: args.statusId,
        p_remarks: args.remarks ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task-history'] })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export interface HistoryRow extends Tables<'task_status_history'> {
  to_status: { name: string } | null
  from_status: { name: string } | null
  changer: { full_name: string; email: string } | null
}

export function useTaskHistory(taskId: string | null) {
  return useQuery({
    queryKey: ['task-history', taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_status_history')
        .select(
          '*, to_status:task_statuses!task_status_history_to_status_id_fkey(name), from_status:task_statuses!task_status_history_from_status_id_fkey(name), changer:profiles!task_status_history_changed_by_fkey(full_name,email)',
        )
        .eq('task_id', taskId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as HistoryRow[]
    },
  })
}

export function useCreateStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; slug: string; sortOrder: number }) => {
      const { error } = await supabase
        .from('task_statuses')
        .insert({ name: input.name, slug: input.slug, sort_order: input.sortOrder })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-statuses'] }),
  })
}

export function useDeleteStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('task_statuses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-statuses'] }),
  })
}

/** Live task updates for authorized viewers. */
export function useTasksRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) supabase.realtime.setAuth(data.session.access_token)
      channel = supabase
        .channel('tasks-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () =>
          qc.invalidateQueries({ queryKey: ['tasks'] }),
        )
        .subscribe()
    })()
    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [qc])
}
