import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { getDocumentUrl, useEmployeeDocuments, useUploadDocument } from './hooks'
import { useUsers } from '@/features/admin/users/hooks'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'

const DOC_TYPES = [
  'aadhaar', 'pan', 'passport', 'driving_license', 'resume', 'offer', 'appointment',
  'salary_revision', 'warning', 'promotion', 'experience', 'relieving',
]

export function DocumentsPage() {
  const { data: users = [] } = useUsers()
  const [employeeId, setEmployeeId] = useState('')
  const effectiveUser = employeeId || users[0]?.id || ''
  const { data: docs = [] } = useEmployeeDocuments(effectiveUser)
  const upload = useUploadDocument()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [docType, setDocType] = useState('pan')
  const [title, setTitle] = useState('')

  return (
    <div data-testid="documents-page">
      <PageHeader title="Employee Documents" description="Versioned, access-controlled document repository." />

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
              <Select id="doc-emp" data-testid="doc-employee-select" value={effectiveUser} onChange={(e) => setEmployeeId(e.target.value)} className="w-48">
                {users.map((u) => (<option key={u.id} value={u.id}>{u.full_name || u.email}</option>))}
              </Select>
            </div>
            <div>
              <Label htmlFor="doc-type">Category</Label>
              <Select id="doc-type" data-testid="doc-type-select" value={docType} onChange={(e) => setDocType(e.target.value)} className="w-44">
                {DOC_TYPES.map((d) => (<option key={d} value={d}>{d}</option>))}
              </Select>
            </div>
            <div>
              <Label htmlFor="doc-title">Title</Label>
              <Input id="doc-title" data-testid="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-44" />
            </div>
            <div>
              <Label htmlFor="doc-file">File</Label>
              <input ref={fileRef} id="doc-file" data-testid="doc-file" type="file" className="block text-sm" />
            </div>
            <Button type="submit" data-testid="upload-document" loading={upload.isPending}>
              <Upload className="size-4" /> Upload
            </Button>
          </form>
        </CardBody>
      </Card>

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
            {docs.map((d) => (
              <tr key={d.id} data-testid="document-row">
                <Td><Badge tone="slate" data-testid="doc-category">{d.doc_type}</Badge></Td>
                <Td className="font-medium text-slate-900">{d.title}</Td>
                <Td data-testid="doc-version">v{d.version}</Td>
                <Td>
                  <div className="flex justify-end">
                    <button
                      data-testid="download-document"
                      className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
                      onClick={async () => {
                        const url = await getDocumentUrl(d.storage_path)
                        if (url) window.open(url, '_blank')
                        else toast.error('Could not open document')
                      }}
                    >
                      <Download className="size-4" /> Open
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
