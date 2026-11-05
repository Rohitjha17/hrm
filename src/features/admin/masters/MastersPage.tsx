import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, GripVertical, Pencil, Plus, RotateCcw, Trash2, Upload } from 'lucide-react'
import {
  useDeleteMasterItem,
  useMasterAudit,
  useMasterItems,
  useReorderMasterItems,
  useSaveMasterItem,
  type MasterItem,
  type MasterKind,
} from './hooks'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody } from '@/components/ui/Card'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { useToast } from '@/components/ui/toast-context'
import { formatDateTime } from '@/lib/format'

/**
 * Every master lives in exactly one module. The UI groups them by module so
 * admins can see which categories belong to which part of the product —
 * client ask: "Master group with all the category kon kisse related".
 *
 * `simple` masters are edited inline with the common CRUD widget below.
 * `linked` masters open their specialized admin page (cycles, holidays, etc.).
 */
type SimpleMaster = {
  value: MasterKind
  label: string
  module: string
  kind: 'simple'
}
type LinkedMaster = {
  label: string
  module: string
  kind: 'linked'
  href: string
  note?: string
}

const KINDS: Array<SimpleMaster | LinkedMaster> = [
  // People
  { kind: 'linked', module: 'People', label: 'Companies', href: '/admin/hierarchy' },
  { kind: 'linked', module: 'People', label: 'Departments', href: '/admin/hierarchy' },
  { kind: 'linked', module: 'People', label: 'Teams', href: '/admin/hierarchy' },
  { kind: 'linked', module: 'People', label: 'Roles & Access', href: '/admin/roles' },

  // Tasks
  { kind: 'simple', value: 'task_categories', label: 'Task Groups', module: 'Tasks' },
  { kind: 'linked', module: 'Tasks', label: 'Task Statuses', href: '/tasks', note: 'Open Tasks → Statuses dialog' },

  // Attendance
  { kind: 'linked', module: 'Attendance', label: 'Locations (geo-fence)', href: '/admin/attendance', note: 'Attendance Monitor → Locations' },
  { kind: 'linked', module: 'Attendance', label: 'Working-hours config', href: '/admin/attendance', note: 'Attendance Monitor → Settings' },

  // Leave
  { kind: 'simple', value: 'leave_types', label: 'Leave Types', module: 'Leave' },
  { kind: 'linked', module: 'Leave', label: 'Holidays', href: '/admin/leave' },

  // Performance / Growth
  { kind: 'simple', value: 'appraisal_types', label: 'Appraisal Types', module: 'Performance' },
  { kind: 'linked', module: 'Performance', label: 'Appraisal Cycles', href: '/admin/appraisal' },

  // Documents / Policies
  { kind: 'simple', value: 'document_types', label: 'Document Types', module: 'Documents' },
  { kind: 'simple', value: 'policy_categories', label: 'Policy Categories', module: 'Policies' },

  // Helpdesk
  { kind: 'simple', value: 'helpdesk_categories', label: 'Helpdesk Categories', module: 'Helpdesk' },

  // Compensation
  { kind: 'linked', module: 'Compensation', label: 'Payslip Templates', href: '/admin/salary' },
  { kind: 'linked', module: 'Compensation', label: 'Salary policy', href: '/admin/salary' },

  // Workflow / Processes
  { kind: 'linked', module: 'Workflow', label: 'Workflow Definitions', href: '/admin/workflows' },
  { kind: 'linked', module: 'Workflow', label: 'Communication Templates', href: '/admin/onboarding' },

  // Training
  { kind: 'linked', module: 'Training', label: 'Training Modules', href: '/admin/training' },

  // Recruitment
  { kind: 'linked', module: 'Recruitment', label: 'Job Openings', href: '/admin/recruitment' },
]

const SIMPLE_KINDS = KINDS.filter(
  (k): k is SimpleMaster => k.kind === 'simple',
)

// Preserve the module order in which they first appear above.
const MODULES: string[] = []
for (const k of KINDS) if (!MODULES.includes(k.module)) MODULES.push(k.module)

export function MastersPage() {
  const [kind, setKind] = useState<MasterKind>('task_categories')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<MasterItem | null>(null)
  const [name, setName] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const { data: items = [] } = useMasterItems(kind)
  const { data: audit = [] } = useMasterAudit()
  const save = useSaveMasterItem(kind)
  const remove = useDeleteMasterItem(kind)
  const reorder = useReorderMasterItems(kind)
  const toast = useToast()
  const filtered = useMemo(
    () => items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())),
    [items, search],
  )

  function downloadBackup() {
    const blob = new Blob(
      [JSON.stringify({ version: 1, kind, exportedAt: new Date().toISOString(), items }, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${kind}-backup.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function restore(file: File) {
    const parsed = JSON.parse(await file.text()) as {
      version?: number
      kind?: MasterKind
      items?: MasterItem[]
    }
    if (!Array.isArray(parsed.items)) throw new Error('Invalid backup file')
    if (parsed.kind && parsed.kind !== kind) {
      throw new Error(`This is a ${parsed.kind} backup. Select that master before restoring it.`)
    }
    const existingByName = new Map(items.map((item) => [item.name.trim().toLowerCase(), item]))
    for (const item of parsed.items) {
      if (!item.name?.trim()) throw new Error('Every restored item must have a name')
      const existing = existingByName.get(item.name.trim().toLowerCase())
      await save.mutateAsync({
        id: existing?.id,
        name: item.name,
        code: existing?.code ?? item.code,
        is_active: item.is_active,
        sort_order: item.sort_order,
      })
    }
  }

  return (
    <div data-testid="masters-page">
      <PageHeader
        title="Centralized Masters"
        description="Add, edit, delete, search, order, activate, import, export and audit master data from one place."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadBackup}>
              <Download className="size-4" /> Export / Backup
            </Button>
            <Button variant="outline" onClick={() => importRef.current?.click()}>
              <Upload className="size-4" /> Import / Restore
            </Button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (!file) return
                try {
                  await restore(file)
                  toast.success('Master data restored')
                } catch (error) {
                  toast.error('Restore failed', (error as Error).message)
                }
                event.target.value = ''
              }}
            />
          </div>
        }
      />

      <div
        data-testid="master-module-map"
        className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2 lg:grid-cols-3"
      >
        {MODULES.map((mod) => {
          const children = KINDS.filter((k) => k.module === mod)
          return (
            <div key={mod} data-testid={`master-module-${mod.toLowerCase()}`}>
              <div className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
                {mod}
              </div>
              <ul className="space-y-1">
                {children.map((child) =>
                  child.kind === 'simple' ? (
                    <li key={child.value}>
                      <button
                        type="button"
                        data-testid={`master-pill-${child.value}`}
                        onClick={() => {
                          setKind(child.value)
                          setEditing(null)
                          setName('')
                        }}
                        className={
                          'w-full rounded-md border px-2 py-1 text-left ' +
                          (kind === child.value
                            ? 'border-brand-400 bg-brand-100 text-brand-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700')
                        }
                      >
                        <span className="font-medium">{child.label}</span>
                        <span className="float-right text-slate-400">edit inline ↓</span>
                      </button>
                    </li>
                  ) : (
                    <li key={`${mod}-${child.label}`}>
                      <Link
                        to={child.href}
                        data-testid={`master-link-${child.label.toLowerCase().replace(/\s+/g, '-')}`}
                        className="block w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:border-brand-300 hover:text-brand-700"
                      >
                        <span className="font-medium">{child.label}</span>
                        <span className="float-right text-slate-400">open manager →</span>
                        {child.note && (
                          <div className="text-[10px] text-slate-400">{child.note}</div>
                        )}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-[240px_1fr]">
        <Select
          data-testid="master-kind-select"
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as MasterKind)
            setEditing(null)
            setName('')
          }}
        >
          {MODULES.filter((mod) => SIMPLE_KINDS.some((k) => k.module === mod)).map(
            (mod) => (
              <optgroup key={mod} label={mod}>
                {SIMPLE_KINDS.filter((k) => k.module === mod).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ),
          )}
        </Select>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search this master…"
        />
      </div>

      <Card className="mb-4">
        <CardBody>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              save.mutate(
                {
                  id: editing?.id,
                  code: editing?.code,
                  name,
                  is_active: editing?.is_active ?? true,
                  sort_order: editing?.sort_order ?? items.length + 1,
                },
                {
                  onSuccess: () => {
                    toast.success(editing ? 'Master updated' : 'Master added')
                    setEditing(null)
                    setName('')
                  },
                  onError: (error) => toast.error('Save failed', (error as Error).message),
                },
              )
            }}
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Required name"
              required
            />
            <Button type="submit" loading={save.isPending}>
              <Plus className="size-4" /> {editing ? 'Save' : 'Add'}
            </Button>
            {editing && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null)
                  setName('')
                }}
              >
                <RotateCcw className="size-4" /> Cancel
              </Button>
            )}
          </form>
        </CardBody>
      </Card>

      <Table>
        <Thead>
          <tr>
            <Th>Sequence</Th>
            <Th>Name</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </Thead>
        <Tbody>
          {filtered.map((item) => (
            <tr
              key={item.id}
              draggable
              onDragStart={() => setDraggedId(item.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (!draggedId || draggedId === item.id) return
                const next = [...items]
                const from = next.findIndex((entry) => entry.id === draggedId)
                const to = next.findIndex((entry) => entry.id === item.id)
                const [moved] = next.splice(from, 1)
                next.splice(to, 0, moved)
                reorder.mutate(next)
                setDraggedId(null)
              }}
            >
              <Td>
                <span className="flex items-center gap-2">
                  <GripVertical className="size-4 text-slate-400" />
                  <Input
                    key={`${item.id}-${item.sort_order}`}
                    aria-label={`Sequence for ${item.name}`}
                    type="number"
                    min={1}
                    defaultValue={item.sort_order}
                    className="h-8 w-20"
                    onClick={(event) => event.stopPropagation()}
                    onBlur={(event) => {
                      const next = Number(event.target.value)
                      if (!Number.isInteger(next) || next < 1 || next === item.sort_order) {
                        event.target.value = String(item.sort_order)
                        return
                      }
                      save.mutate(
                        { ...item, sort_order: next },
                        {
                          onError: (error) =>
                            toast.error('Sequence update failed', (error as Error).message),
                        },
                      )
                    }}
                  />
                </span>
              </Td>
              <Td className="font-medium">{item.name}</Td>
              <Td>
                <button onClick={() => save.mutate({ ...item, is_active: !item.is_active })}>
                  <Badge tone={item.is_active ? 'green' : 'slate'}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </button>
              </Td>
              <Td>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditing(item)
                      setName(item.name)
                    }}
                    aria-label={`Edit ${item.name}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() =>
                      remove.mutate(item.id, {
                        onError: (error) => toast.error('Delete failed', (error as Error).message),
                      })
                    }
                    aria-label={`Delete ${item.name}`}
                    className="text-red-500"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </Tbody>
      </Table>

      <Card className="mt-6">
        <CardBody>
          <h2 className="mb-3 font-semibold text-slate-900">Master Audit Trail</h2>
          <div className="max-h-72 overflow-auto">
            <Table>
              <Thead>
                <tr>
                  <Th>User</Th>
                  <Th>Date & Time</Th>
                  <Th>Master</Th>
                  <Th>Change</Th>
                </tr>
              </Thead>
              <Tbody>
                {audit.map((entry) => (
                  <tr key={entry.id}>
                    <Td>{entry.changer?.full_name || entry.changer?.email || 'System'}</Td>
                    <Td>{formatDateTime(entry.changed_at)}</Td>
                    <Td>{entry.master_type}</Td>
                    <Td>
                      {entry.action}:{' '}
                      {String(entry.new_value?.name ?? entry.old_value?.name ?? entry.record_id)}
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
