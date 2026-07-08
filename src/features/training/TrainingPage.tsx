import { useState } from 'react'
import { ExternalLink, Paperclip, Plus, Trash2, UserPlus } from 'lucide-react'
import {
  getTrainingAttachmentUrl,
  useAssignTraining,
  useCreateModule,
  useDeleteModule,
  useModuleAssignments,
  useTrainingAttachments,
  useTrainingModules,
  useUploadTrainingAttachment,
} from './hooks'
import { useDirectory } from '@/features/engagement/hooks'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/cn'

const STATUS_TONE: Record<string, 'slate' | 'blue' | 'green'> = {
  assigned: 'slate',
  completed: 'blue',
  acknowledged: 'green',
}

export function TrainingPage() {
  const { data: modules = [] } = useTrainingModules()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = modules.find((m) => m.id === selectedId) ?? modules[0] ?? null
  const [moduleModal, setModuleModal] = useState(false)
  const [assignModal, setAssignModal] = useState(false)
  const deleteModule = useDeleteModule()
  const toast = useToast()

  return (
    <div data-testid="training-page">
      <PageHeader
        title="Training"
        description="Create training modules, assign them to users, and track completion & acknowledgement."
        actions={
          <Button data-testid="new-module-button" onClick={() => setModuleModal(true)}>
            <Plus className="size-4" /> New module
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardBody className="space-y-1">
            {modules.length === 0 && (
              <p className="p-2 text-sm text-slate-400" data-testid="modules-empty">
                No modules yet.
              </p>
            )}
            {modules.map((m) => (
              <button
                key={m.id}
                data-testid="module-item"
                onClick={() => setSelectedId(m.id)}
                className={cn(
                  'flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm',
                  selected?.id === m.id ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-100',
                )}
              >
                <span className="font-medium">{m.title}</span>
                <span className="text-xs text-slate-400">
                  {new Date(m.created_at).toLocaleDateString()}
                </span>
              </button>
            ))}
          </CardBody>
        </Card>

        {selected && (
          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900" data-testid="module-title">
                  {selected.title}
                </h2>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" data-testid="assign-module" onClick={() => setAssignModal(true)}>
                    <UserPlus className="size-4" /> Assign
                  </Button>
                  <button
                    data-testid="delete-module"
                    aria-label={`Delete module ${selected.title}`}
                    className="text-slate-300 hover:text-red-600"
                    onClick={() =>
                      deleteModule.mutate(selected.id, {
                        onSuccess: () => {
                          toast.success('Module deleted')
                          setSelectedId(null)
                        },
                        onError: (err) => toast.error('Delete failed', (err as Error).message),
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              <p className="text-sm whitespace-pre-wrap text-slate-700" data-testid="module-body">
                {selected.body || 'No content yet.'}
              </p>

              <AttachmentsBlock moduleId={selected.id} />
              <AssignmentsBlock moduleId={selected.id} />
            </CardBody>
          </Card>
        )}
      </div>

      {moduleModal && <ModuleModal onClose={() => setModuleModal(false)} />}
      {assignModal && selected && (
        <AssignModal moduleId={selected.id} onClose={() => setAssignModal(false)} />
      )}
    </div>
  )
}

function AttachmentsBlock({ moduleId }: { moduleId: string }) {
  const { data: attachments = [] } = useTrainingAttachments(moduleId)
  const upload = useUploadTrainingAttachment()
  const toast = useToast()

  return (
    <div className="border-t border-slate-100 pt-3" data-testid="module-attachments">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Attachments</h3>
        <label className="cursor-pointer rounded px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50">
          <Paperclip className="mr-1 inline size-3.5" />
          Upload
          <input
            type="file"
            data-testid="module-attachment-upload"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              upload.mutate(
                { moduleId, file },
                {
                  onSuccess: () => toast.success('Attachment uploaded'),
                  onError: (err) => toast.error('Upload failed', (err as Error).message),
                },
              )
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-slate-400">No attachments.</p>
      ) : (
        <ul className="space-y-1">
          {attachments.map((a) => (
            <li key={a.id} data-testid="attachment-row" className="flex items-center justify-between rounded border border-slate-100 px-2 py-1.5 text-sm">
              <span className="truncate text-slate-700">{a.title}</span>
              <button
                data-testid="attachment-view"
                className="ml-2 flex shrink-0 items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                onClick={async () => {
                  try {
                    const url = await getTrainingAttachmentUrl(a.storage_path)
                    window.open(url, '_blank', 'noopener')
                  } catch (err) {
                    toast.error('Could not open attachment', (err as Error).message)
                  }
                }}
              >
                <ExternalLink className="size-3" /> View
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AssignmentsBlock({ moduleId }: { moduleId: string }) {
  const { data: assignments = [] } = useModuleAssignments(moduleId)

  return (
    <div className="border-t border-slate-100 pt-3" data-testid="module-assignments">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Assignments</h3>
      {assignments.length === 0 ? (
        <p className="text-xs text-slate-400" data-testid="assignments-empty">
          Not assigned to anyone yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {assignments.map((a) => (
            <li
              key={a.id}
              data-testid={`assignment-row-${a.assignee?.email ?? a.user_id}`}
              className="flex items-center justify-between rounded border border-slate-100 px-2 py-1.5 text-sm"
            >
              <span className="text-slate-700">{a.assignee?.full_name || a.assignee?.email || '—'}</span>
              <Badge tone={STATUS_TONE[a.status] ?? 'slate'} data-testid="assignment-status">
                {a.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ModuleModal({ onClose }: { onClose: () => void }) {
  const create = useCreateModule()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  return (
    <Modal open onClose={onClose} title="New training module" testid="module-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            { title: title.trim(), body },
            {
              onSuccess: () => {
                toast.success('Module created')
                onClose()
              },
              onError: (err) => toast.error('Failed', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="tm-title">Title</Label>
          <Input id="tm-title" data-testid="module-title-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="tm-body">Content</Label>
          <Textarea id="tm-body" data-testid="module-body-input" rows={6} placeholder="Training content, instructions, links…" value={body} onChange={(e) => setBody(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" data-testid="create-module-submit" loading={create.isPending}>Create</Button>
        </div>
      </form>
    </Modal>
  )
}

function AssignModal({ moduleId, onClose }: { moduleId: string; onClose: () => void }) {
  const { data: directory = [] } = useDirectory()
  const { data: assignments = [] } = useModuleAssignments(moduleId)
  const assign = useAssignTraining()
  const toast = useToast()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const alreadyAssigned = new Set(assignments.map((a) => a.user_id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Modal open onClose={onClose} title="Assign training" testid="assign-modal">
      <div className="space-y-4">
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2" data-testid="assign-picker">
          {directory.map((d) => (
            <label
              key={d.id}
              className={cn(
                'flex items-center gap-2 rounded px-1 py-0.5 text-sm',
                alreadyAssigned.has(d.id) ? 'cursor-default text-slate-400' : 'cursor-pointer hover:bg-slate-50',
              )}
            >
              <input
                type="checkbox"
                data-testid={`assign-${d.email}`}
                disabled={alreadyAssigned.has(d.id)}
                checked={alreadyAssigned.has(d.id) || selected.has(d.id)}
                onChange={() => toggle(d.id)}
              />
              {d.full_name || d.email}
              {alreadyAssigned.has(d.id) && <span className="text-xs">(assigned)</span>}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            data-testid="assign-submit"
            disabled={selected.size === 0}
            loading={assign.isPending}
            onClick={() =>
              assign.mutate(
                { moduleId, userIds: [...selected] },
                {
                  onSuccess: () => {
                    toast.success('Training assigned')
                    onClose()
                  },
                  onError: (err) => toast.error('Failed', (err as Error).message),
                },
              )
            }
          >
            Assign
          </Button>
        </div>
      </div>
    </Modal>
  )
}
