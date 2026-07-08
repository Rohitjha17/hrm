import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  useAddStep,
  useCreateDefinition,
  useDefinitions,
  useDeleteDefinition,
  useDeleteStep,
  useSteps,
} from './hooks'
import { usePermissionsCatalog } from '@/features/admin/roles/hooks'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/cn'

export function WorkflowAdminPage() {
  const { data: definitions = [] } = useDefinitions()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = definitions.find((d) => d.id === selectedId) ?? definitions[0] ?? null
  const { data: steps = [] } = useSteps(selected?.id ?? null)
  const { data: permissions = [] } = usePermissionsCatalog()
  const addStep = useAddStep()
  const deleteStep = useDeleteStep()
  const deleteDefinition = useDeleteDefinition()
  const toast = useToast()
  const [defModal, setDefModal] = useState(false)
  const [stepName, setStepName] = useState('')
  const [stepPerm, setStepPerm] = useState('leave.approve')

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
                  className="text-slate-400 hover:text-red-600"
                  onClick={() =>
                    deleteDefinition.mutate(selected.id, {
                      onSuccess: () => {
                        toast.success('Workflow deleted')
                        setSelectedId(null)
                      },
                      onError: (err) => toast.error('Delete failed', (err as Error).message),
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <ol className="space-y-2" data-testid="steps-list">
                {steps.map((s) => (
                  <li key={s.id} data-testid="step-row" className="flex items-center gap-3 rounded-lg border border-slate-100 p-2 text-sm">
                    <Badge tone="brand">Step {s.step_order}</Badge>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-slate-400">owned by {s.approver_permission}</span>
                    <button
                      data-testid={`delete-step-${s.step_order}`}
                      aria-label={`Delete step ${s.name}`}
                      className="ml-auto text-slate-300 hover:text-red-600"
                      onClick={() =>
                        deleteStep.mutate(s.id, {
                          onSuccess: () => toast.success('Step removed'),
                          onError: (err) => toast.error('Delete failed', (err as Error).message),
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </button>
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
                      stepOrder: steps.length + 1,
                      name: stepName.trim(),
                      approverPermission: stepPerm,
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
                  <Input data-testid="step-name" value={stepName} onChange={(e) => setStepName(e.target.value)} required className="w-40" />
                </div>
                <div>
                  <Label className="text-xs">Responsible permission</Label>
                  <Select data-testid="step-permission" value={stepPerm} onChange={(e) => setStepPerm(e.target.value)} className="w-52">
                    {permissions
                      .filter((p) => p.key !== '*')
                      .map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.key}
                        </option>
                      ))}
                  </Select>
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
    </div>
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
          <Input id="def-name" data-testid="definition-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="def-entity">Entity type</Label>
          <Input id="def-entity" data-testid="definition-entity" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
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
