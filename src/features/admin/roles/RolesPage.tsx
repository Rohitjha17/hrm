import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  useCreateRole,
  useDeleteRole,
  usePermissionsCatalog,
  useRolePermissionIds,
  useRoles,
  useToggleRolePermission,
  useRoleFieldAccess,
  useSetRoleFieldAccess,
  type Permission,
} from './hooks'
import { useProfile } from '@/features/rbac/profile-context'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Checkbox } from '@/components/ui/Checkbox'
import { cn } from '@/lib/cn'
import { Select } from '@/components/ui/Select'

const FIELD_CATALOG: Record<string, string[]> = {
  attendance: ['date', 'status', 'firstIn', 'lastOut', 'worked', 'late', 'overtime', 'remarks'],
  tasks: [
    'title',
    'assignee',
    'assignor',
    'status',
    'priority',
    'progress',
    'created',
    'due',
    'completed',
  ],
  leave: ['employee', 'type', 'from', 'to', 'days', 'status', 'reason', 'remainingBalance'],
  salary: ['month', 'employee', 'present', 'gross', 'net'],
  appraisal: ['employee', 'cycle', 'attendance', 'task', 'planning', 'overall', 'finalRating'],
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function RolesPage() {
  const { hasPermission } = useProfile()
  const canManage = hasPermission('roles.manage')
  const toast = useToast()

  const { data: roles = [], isLoading } = useRoles()
  const { data: permissions = [] } = usePermissionsCatalog()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = roles.find((r) => r.id === selectedId) ?? roles[0] ?? null
  const { data: enabledPerms } = useRolePermissionIds(selected?.id ?? null)
  const toggle = useToggleRolePermission()

  const [modalOpen, setModalOpen] = useState(false)
  const [fieldModule, setFieldModule] = useState('attendance')
  const { data: fieldAccess = new Map<string, boolean>() } = useRoleFieldAccess(
    selected?.id ?? null,
    fieldModule,
  )
  const setFieldAccess = useSetRoleFieldAccess()

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const p of permissions) {
      const arr = map.get(p.category) ?? []
      arr.push(p)
      map.set(p.category, arr)
    }
    return [...map.entries()]
  }, [permissions])

  return (
    <div data-testid="roles-page">
      <PageHeader
        title="Roles & Permissions"
        description="Create unlimited permission-based roles. Assign capabilities per role."
        actions={
          canManage && (
            <Button data-testid="new-role-button" onClick={() => setModalOpen(true)}>
              <Plus className="size-4" /> New role
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardBody className="space-y-1">
            {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
            {roles.map((r) => (
              <button
                key={r.id}
                data-testid={`role-item-${r.slug}`}
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm',
                  selected?.id === r.id ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-100',
                )}
              >
                <span className="font-medium">{r.name}</span>
                {r.is_system && <Badge tone="slate">system</Badge>}
              </button>
            ))}
          </CardBody>
        </Card>

        {selected && (
          <Card data-testid="role-permissions-panel">
            <CardBody>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selected.name}</h2>
                  <p className="text-sm text-slate-500">{selected.description || selected.slug}</p>
                </div>
                {canManage && !selected.is_system && (
                  <DeleteRoleButton
                    id={selected.id}
                    slug={selected.slug}
                    onDeleted={() => setSelectedId(null)}
                  />
                )}
              </div>

              <div className="space-y-5">
                {grouped.map(([category, perms]) => (
                  <div key={category}>
                    <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                      {category}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {perms.map((p) => {
                        const checked = enabledPerms?.has(p.id) ?? false
                        return (
                          <Checkbox
                            key={p.id}
                            id={`perm-${p.key}`}
                            data-testid={`perm-${p.key}`}
                            label={p.key}
                            description={p.description ?? undefined}
                            checked={checked}
                            disabled={!canManage || toggle.isPending}
                            onChange={(e) =>
                              toggle.mutate(
                                {
                                  roleId: selected.id,
                                  permissionId: p.id,
                                  enabled: e.target.checked,
                                },
                                {
                                  onError: (err) =>
                                    toast.error('Update failed', (err as Error).message),
                                },
                              )
                            }
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t border-slate-200 pt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">Field visibility</h3>
                    <p className="text-xs text-slate-500">
                      Role-wise fields shown inside each module and report.
                    </p>
                  </div>
                  <Select
                    value={fieldModule}
                    onChange={(event) => setFieldModule(event.target.value)}
                    className="w-44"
                  >
                    {Object.keys(FIELD_CATALOG).map((module) => (
                      <option key={module} value={module}>
                        {module}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {FIELD_CATALOG[fieldModule].map((field) => (
                    <Checkbox
                      key={field}
                      label={field}
                      checked={fieldAccess.get(field) ?? true}
                      disabled={!canManage || setFieldAccess.isPending}
                      onChange={(event) =>
                        setFieldAccess.mutate({
                          roleId: selected.id,
                          module: fieldModule,
                          fieldKey: field,
                          visible: event.target.checked,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      <NewRoleModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}

function DeleteRoleButton({
  id,
  slug,
  onDeleted,
}: {
  id: string
  slug: string
  onDeleted: () => void
}) {
  const del = useDeleteRole()
  const toast = useToast()
  return (
    <Button
      variant="danger"
      size="sm"
      data-testid={`delete-role-${slug}`}
      loading={del.isPending}
      onClick={() =>
        del.mutate(id, {
          onSuccess: () => {
            toast.success('Role deleted')
            onDeleted()
          },
          onError: (e) => toast.error('Delete failed', (e as Error).message),
        })
      }
    >
      <Trash2 className="size-4" /> Delete
    </Button>
  )
}

function NewRoleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateRole()
  const toast = useToast()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState('')

  function reset() {
    setName('')
    setSlug('')
    setSlugTouched(false)
    setDescription('')
  }

  return (
    <Modal open={open} onClose={onClose} title="New role" testid="role-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const finalSlug = slugTouched ? slug : slugify(name)
          create.mutate(
            { name: name.trim(), slug: finalSlug, description: description.trim() || undefined },
            {
              onSuccess: () => {
                toast.success('Role created')
                reset()
                onClose()
              },
              onError: (err) => toast.error('Could not create role', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="role-name">Name</Label>
          <Input
            id="role-name"
            data-testid="role-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="role-slug">Slug</Label>
          <Input
            id="role-slug"
            data-testid="role-slug-input"
            value={slugTouched ? slug : slugify(name)}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value)
            }}
            placeholder="auto-generated"
          />
        </div>
        <div>
          <Label htmlFor="role-desc">Description</Label>
          <Textarea
            id="role-desc"
            data-testid="role-description-input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="create-role-submit" loading={create.isPending}>
            Create role
          </Button>
        </div>
      </form>
    </Modal>
  )
}
