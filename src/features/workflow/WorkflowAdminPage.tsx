import { useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  useAddStep,
  useCreateDefinition,
  useDefinitions,
  useDeleteDefinition,
  useDeleteStep,
  useMoveStep,
  useSteps,
  useUpdateStep,
  type WorkflowStep,
} from './hooks'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/cn'

export function WorkflowAdminPage() {
  const { data: definitions = [] } = useDefinitions()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = definitions.find((d) => d.id === selectedId) ?? definitions[0] ?? null
  const { data: steps = [] } = useSteps(selected?.id ?? null)
  const addStep = useAddStep()
  const moveStep = useMoveStep()
  const deleteStep = useDeleteStep()
  const deleteDefinition = useDeleteDefinition()
  const toast = useToast()
  const [defModal, setDefModal] = useState(false)
  const [stepName, setStepName] = useState('')
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null)
  const [confirmDeleteStep, setConfirmDeleteStep] = useState<WorkflowStep | null>(null)
  const [confirmDeleteDef, setConfirmDeleteDef] = useState(false)

  function move(step: WorkflowStep, direction: -1 | 1) {
    const idx = steps.findIndex((s) => s.id === step.id)
    const neighbor = steps[idx + direction]
    if (!neighbor || moveStep.isPending) return
    moveStep.mutate(
      { step, neighbor },
      { onError: (err) => toast.error('Reorder failed', (err as Error).message) },
    )
  }

  return (
    <div data-testid="workflow-admin-page">
      <PageHeader
        title="Workflows"
        description="A rulebook of your processes — document each workflow as an ordered plan of steps. These are reference plans, not automations."
        actions={
          <Button data-testid="new-definition-button" onClick={() => setDefModal(true)}>
            <Plus className="size-4" /> New workflow
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardBody className="space-y-1">
            {definitions.map((d) => (
              <button
                key={d.id}
                data-testid="definition-item"
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  'flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm',
                  selected?.id === d.id ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-100',
                )}
              >
                <span className="font-medium">{d.name}</span>
                <span className="text-xs text-slate-400">{d.entity_type}</span>
              </button>
            ))}
          </CardBody>
        </Card>

        {selected && (
          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">{selected.name}</h2>
                <button
                  data-testid="delete-definition"
                  aria-label={`Delete workflow ${selected.name}`}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  onClick={() => setConfirmDeleteDef(true)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <ol className="space-y-2" data-testid="steps-list">
                {steps.map((s, i) => (
                  <li
                    key={s.id}
                    data-testid="step-row"
                    className="group flex items-center gap-3 rounded-lg border border-slate-100 p-2 text-sm"
                  >
                    <Badge tone="brand">Step {s.step_order}</Badge>
                    <span className="font-medium">{s.name}</span>
                    <span className="ml-auto flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                      <button
                        data-testid={`move-step-up-${s.step_order}`}
                        aria-label={`Move step ${s.name} up`}
                        disabled={i === 0 || moveStep.isPending}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:invisible"
                        onClick={() => move(s, -1)}
                      >
                        <ChevronUp className="size-4" />
                      </button>
                      <button
                        data-testid={`move-step-down-${s.step_order}`}
                        aria-label={`Move step ${s.name} down`}
                        disabled={i === steps.length - 1 || moveStep.isPending}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:invisible"
                        onClick={() => move(s, 1)}
                      >
                        <ChevronDown className="size-4" />
                      </button>
                      <button
                        data-testid={`edit-step-${s.step_order}`}
                        aria-label={`Edit step ${s.name}`}
                        className="hover:text-brand-600 rounded p-1 text-slate-400 hover:bg-slate-100"
                        onClick={() => setEditingStep(s)}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        data-testid={`delete-step-${s.step_order}`}
                        aria-label={`Delete step ${s.name}`}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setConfirmDeleteStep(s)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </span>
                  </li>
                ))}
              </ol>

              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  addStep.mutate(
                    {
                      definitionId: selected.id,
                      stepOrder: (steps.at(-1)?.step_order ?? 0) + 1,
                      name: stepName.trim(),
                    },
                    {
                      onSuccess: () => {
                        toast.success('Step added')
                        setStepName('')
                      },
                      onError: (err) => toast.error('Failed', (err as Error).message),
                    },
                  )
                }}
              >
                <div>
                  <Label className="text-xs">Step name</Label>
                  <Input
                    data-testid="step-name"
                    value={stepName}
                    onChange={(e) => setStepName(e.target.value)}
                    required
                    className="w-64"
                  />
                </div>
                <Button type="submit" size="sm" data-testid="add-step" loading={addStep.isPending}>
                  <Plus className="size-4" /> Add step
                </Button>
              </form>
            </CardBody>
          </Card>
        )}
      </div>

      {defModal && <DefinitionModal onClose={() => setDefModal(false)} />}
      {editingStep && <EditStepModal step={editingStep} onClose={() => setEditingStep(null)} />}
      {confirmDeleteStep && (
        <ConfirmDialog
          title="Delete step"
          testid="delete-step-dialog"
          confirmLabel="Delete step"
          loading={deleteStep.isPending}
          onClose={() => setConfirmDeleteStep(null)}
          message={
            <p>
              Remove step{' '}
              <span className="font-semibold text-slate-900">{confirmDeleteStep.name}</span> from{' '}
              <span className="font-semibold text-slate-900">{selected?.name}</span>? Remaining
              steps are renumbered automatically.
            </p>
          }
          onConfirm={() =>
            deleteStep.mutate(confirmDeleteStep, {
              onSuccess: () => {
                toast.success('Step removed')
                setConfirmDeleteStep(null)
              },
              onError: (err) => toast.error('Delete failed', (err as Error).message),
            })
          }
        />
      )}
      {confirmDeleteDef && selected && (
        <ConfirmDialog
          title="Delete workflow"
          testid="delete-definition-dialog"
          confirmLabel="Delete workflow"
          loading={deleteDefinition.isPending}
          onClose={() => setConfirmDeleteDef(false)}
          message={
            <p>
              Delete workflow <span className="font-semibold text-slate-900">{selected.name}</span>
              {steps.length > 0 && (
                <>
                  {' '}
                  and its{' '}
                  <span className="font-semibold text-slate-900">
                    {steps.length} step{steps.length === 1 ? '' : 's'}
                  </span>
                </>
              )}
              ? This action cannot be undone.
            </p>
          }
          onConfirm={() =>
            deleteDefinition.mutate(selected.id, {
              onSuccess: () => {
                toast.success('Workflow deleted')
                setSelectedId(null)
                setConfirmDeleteDef(false)
              },
              onError: (err) => toast.error('Delete failed', (err as Error).message),
            })
          }
        />
      )}
    </div>
  )
}

function EditStepModal({ step, onClose }: { step: WorkflowStep; onClose: () => void }) {
  const update = useUpdateStep()
  const toast = useToast()
  const [name, setName] = useState(step.name)

  return (
    <Modal open onClose={onClose} title={`Edit step ${step.step_order}`} testid="edit-step-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          update.mutate(
            { stepId: step.id, name: name.trim() },
            {
              onSuccess: () => {
                toast.success('Step updated')
                onClose()
              },
              onError: (err) => toast.error('Update failed', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="es-name">Step name</Label>
          <Input
            id="es-name"
            data-testid="edit-step-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="save-step" loading={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function DefinitionModal({ onClose }: { onClose: () => void }) {
  const create = useCreateDefinition()
  const toast = useToast()
  const [name, setName] = useState('')
  const [entityType, setEntityType] = useState('generic')

  return (
    <Modal open onClose={onClose} title="New workflow" testid="definition-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            { name: name.trim(), entityType: entityType.trim() || 'generic' },
            {
              onSuccess: () => {
                toast.success('Workflow created')
                onClose()
              },
              onError: (err) => toast.error('Failed', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="def-name">Name</Label>
          <Input
            id="def-name"
            data-testid="definition-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="def-entity">Entity type</Label>
          <Input
            id="def-entity"
            data-testid="definition-entity"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="create-definition-submit" loading={create.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  )
}
