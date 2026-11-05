import { useMemo, useRef, useState } from 'react'
import { Download, History, Pencil, Plus, Settings2, Trash2, Upload } from 'lucide-react'
import {
  getDocumentUrl,
  useDeleteDocument,
  useDeleteDocumentType,
  useDocumentTypes,
  useEmployeeDocuments,
  useSaveDocumentType,
  useUploadDocument,
  type DocumentType,
  type EmployeeDocument,
} from './hooks'
import {
  useOnboarding,
  useOnboardingItems,
  useStartOnboarding,
  useUpdateItem,
  type OnboardingItem,
} from '@/features/onboarding/hooks'
import { useUsers } from '@/features/admin/users/hooks'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

const ITEM_STATUS: OnboardingItem['status'][] = ['pending', 'submitted', 'verified']

export function DocumentsPage() {
  const { data: users = [] } = useUsers()
  const [employeeId, setEmployeeId] = useState('')
  const effectiveUser = employeeId || users[0]?.id || ''
  const { data: docs = [] } = useEmployeeDocuments(effectiveUser)
  const { data: documentTypes = [] } = useDocumentTypes()
  const upload = useUploadDocument()
  const del = useDeleteDocument()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [docType, setDocType] = useState('pan')
  const [title, setTitle] = useState('')
  const [deleting, setDeleting] = useState<EmployeeDocument | null>(null)
  const [historyType, setHistoryType] = useState<string | null>(null)
  const [manageTypes, setManageTypes] = useState(false)
  const latestDocuments = useMemo(() => {
    const latest = new Map<string, EmployeeDocument>()
    for (const document of docs) {
      if (!latest.has(document.doc_type)) latest.set(document.doc_type, document)
    }
    return [...latest.values()]
  }, [docs])
  const historyDocuments = docs.filter((document) => document.doc_type === historyType)

  return (
    <div data-testid="documents-page">
      <PageHeader
        title="Doc Vault"
        description="Versioned, access-controlled document repository and the joining checklist."
      />

      <Card className="mb-4">
        <CardBody>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              const file = fileRef.current?.files?.[0]
              if (!file) {
                toast.error('Choose a file first')
                return
              }
              upload.mutate(
                { employeeId: effectiveUser, docType, title: title.trim() || file.name, file },
                {
                  onSuccess: () => {
                    toast.success('Document uploaded')
                    setTitle('')
                    if (fileRef.current) fileRef.current.value = ''
                  },
                  onError: (err) => toast.error('Upload failed', (err as Error).message),
                },
              )
            }}
          >
            <div>
              <Label htmlFor="doc-emp">Employee</Label>
              <Select
                id="doc-emp"
                data-testid="doc-employee-select"
                value={effectiveUser}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-48"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="doc-type">Category</Label>
              <Select
                id="doc-type"
                data-testid="doc-type-select"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-44"
              >
                {documentTypes.map((type) => (
                  <option key={type.id} value={type.code}>
                    {type.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="doc-title">Title</Label>
              <Input
                id="doc-title"
                data-testid="doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-44"
              />
            </div>
            <div>
              <Label htmlFor="doc-file">File</Label>
              <input
                ref={fileRef}
                id="doc-file"
                data-testid="doc-file"
                type="file"
                className="block text-sm"
              />
            </div>
            <Button type="submit" data-testid="upload-document" loading={upload.isPending}>
              <Upload className="size-4" /> Upload
            </Button>
            <Button type="button" variant="outline" onClick={() => setManageTypes(true)}>
              <Settings2 className="size-4" /> Manage types
            </Button>
          </form>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div>
          {docs.length === 0 ? (
            <EmptyState title="No documents for this employee" testid="docs-empty" />
          ) : (
            <Table data-testid="documents-table">
              <Thead>
                <tr>
                  <Th>Category</Th>
                  <Th>Title</Th>
                  <Th>Version</Th>
                  <Th className="text-right">File</Th>
                </tr>
              </Thead>
              <Tbody>
                {latestDocuments.map((d) => (
                  <tr key={d.id} data-testid="document-row">
                    <Td>
                      <Badge tone="slate" data-testid="doc-category">
                        {d.doc_type}
                      </Badge>
                    </Td>
                    <Td className="font-medium text-slate-900">{d.title}</Td>
                    <Td data-testid="doc-version">v{d.version}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          data-testid="download-document"
                          className="text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 text-sm"
                          onClick={async () => {
                            const url = await getDocumentUrl(d.id, d.storage_path)
                            if (url) window.open(url, '_blank')
                            else toast.error('Could not open document')
                          }}
                        >
                          <Download className="size-4" /> Open
                        </button>
                        {docs.filter((document) => document.doc_type === d.doc_type).length > 1 && (
                          <button
                            className="hover:text-brand-700 inline-flex items-center gap-1 text-sm text-slate-600"
                            onClick={() => setHistoryType(d.doc_type)}
                          >
                            <History className="size-4" /> History
                          </button>
                        )}
                        <button
                          data-testid="delete-document"
                          aria-label={`Delete ${d.title}`}
                          className="rounded p-1 text-slate-400 hover:text-red-600"
                          onClick={() => setDeleting(d)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          )}
        </div>

        <JoiningChecklist employeeId={effectiveUser} />
      </div>

      {deleting && (
        <Modal
          open
          onClose={() => setDeleting(null)}
          title="Delete document"
          testid="doc-delete-modal"
        >
          <p className="text-sm text-slate-600">
            Permanently delete <strong>{deleting.title}</strong> (v{deleting.version}) and its file?
            This cannot be undone.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              data-testid="confirm-delete-document"
              loading={del.isPending}
              onClick={() =>
                del.mutate(
                  { id: deleting.id, storage_path: deleting.storage_path },
                  {
                    onSuccess: () => {
                      toast.success('Document deleted')
                      setDeleting(null)
                    },
                    onError: (e) => toast.error('Delete failed', (e as Error).message),
                  },
                )
              }
            >
              Delete
            </Button>
          </div>
        </Modal>
      )}
      {historyType && (
        <Modal
          open
          onClose={() => setHistoryType(null)}
          title="Version history"
          testid="document-version-history"
        >
          <div className="space-y-2">
            {historyDocuments.map((document) => (
              <div
                key={document.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm"
              >
                <span>
                  <strong>v{document.version}</strong> · {document.title}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const url = await getDocumentUrl(document.id, document.storage_path)
                    if (url) window.open(url, '_blank')
                    else toast.error('Could not open document')
                  }}
                >
                  <Download className="size-4" /> Open
                </Button>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {manageTypes && <DocumentTypesModal onClose={() => setManageTypes(false)} />}
    </div>
  )
}

function DocumentTypesModal({ onClose }: { onClose: () => void }) {
  const { data: types = [] } = useDocumentTypes(true)
  const save = useSaveDocumentType()
  const remove = useDeleteDocumentType()
  const toast = useToast()
  const [editing, setEditing] = useState<DocumentType | null>(null)
  const [name, setName] = useState('')

  function beginEdit(type?: DocumentType) {
    setEditing(type ?? null)
    setName(type?.name ?? '')
  }

  return (
    <Modal open onClose={onClose} title="Manage document types" testid="document-types-modal">
      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate(
            {
              id: editing?.id,
              name,
              code: editing?.code || name,
              isActive: editing?.is_active ?? true,
            },
            {
              onSuccess: () => {
                toast.success(editing ? 'Document type updated' : 'Document type created')
                beginEdit()
              },
              onError: (error) => toast.error('Save failed', (error as Error).message),
            },
          )
        }}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Document type name"
          required
        />
        <Button type="submit" loading={save.isPending}>
          <Plus className="size-4" /> {editing ? 'Save' : 'Add'}
        </Button>
      </form>
      <div className="max-h-80 space-y-2 overflow-auto">
        {types.map((type) => (
          <div
            key={type.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-sm"
          >
            <span>
              {type.name} <span className="text-slate-400">({type.code})</span>
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  save.mutate(
                    { id: type.id, name: type.name, code: type.code, isActive: !type.is_active },
                    { onError: (error) => toast.error('Update failed', (error as Error).message) },
                  )
                }
              >
                {type.is_active ? 'Active' : 'Inactive'}
              </Button>
              <button
                className="rounded p-1 text-slate-500"
                onClick={() => beginEdit(type)}
                aria-label={`Edit ${type.name}`}
              >
                <Pencil className="size-4" />
              </button>
              <button
                className="rounded p-1 text-red-500"
                onClick={() =>
                  remove.mutate(type.id, {
                    onError: (error) => toast.error('Delete failed', (error as Error).message),
                  })
                }
                aria-label={`Delete ${type.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

/** New-joiner document checklist for the selected employee (moved from Communication). */
function JoiningChecklist({ employeeId }: { employeeId: string }) {
  const { data: onboarding } = useOnboarding(employeeId)
  const { data: items = [] } = useOnboardingItems(onboarding?.id ?? null)
  const start = useStartOnboarding()
  const updateItem = useUpdateItem()
  const toast = useToast()

  return (
    <Card data-testid="joining-checklist-card">
      <CardBody className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Joining checklist
        </h2>
        {!onboarding ? (
          <Button
            data-testid="start-onboarding"
            loading={start.isPending}
            disabled={!employeeId}
            onClick={() =>
              start.mutate(employeeId, { onSuccess: () => toast.success('Onboarding started') })
            }
          >
            Start onboarding
          </Button>
        ) : (
          <ul className="space-y-2" data-testid="checklist">
            {items.map((it) => (
              <li
                key={it.id}
                data-testid="checklist-item"
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span>{it.label}</span>
                <Select
                  data-testid={`item-status-${it.item_key}`}
                  value={it.status}
                  onChange={(e) =>
                    updateItem.mutate({
                      id: it.id,
                      status: e.target.value as OnboardingItem['status'],
                    })
                  }
                  className="h-8 w-32"
                >
                  {ITEM_STATUS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
