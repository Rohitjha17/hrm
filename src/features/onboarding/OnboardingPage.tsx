import { useState } from 'react'
import { FileText, Plus } from 'lucide-react'
import {
  useCreateTemplate,
  useOnboarding,
  useOnboardingItems,
  useStartOnboarding,
  useTemplates,
  useUpdateItem,
  type OnboardingItem,
  type OnboardingTemplate,
} from './hooks'
import { useUsers } from '@/features/admin/users/hooks'
import { useToast } from '@/components/ui/toast-context'
import { generateLetterPdf } from '@/lib/pdfLetter'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

const DOC_TYPES = ['offer', 'appointment', 'joining', 'nda', 'contract', 'confidentiality', 'welcome']
const ITEM_STATUS: OnboardingItem['status'][] = ['pending', 'submitted', 'verified']

export function OnboardingPage() {
  const { data: users = [] } = useUsers()
  const { data: templates = [] } = useTemplates()
  const [employeeId, setEmployeeId] = useState('')
  const effectiveUser = employeeId || users[0]?.id || ''
  const employee = users.find((u) => u.id === effectiveUser)
  const { data: onboarding } = useOnboarding(effectiveUser)
  const { data: items = [] } = useOnboardingItems(onboarding?.id ?? null)
  const start = useStartOnboarding()
  const updateItem = useUpdateItem()
  const toast = useToast()
  const [tplOpen, setTplOpen] = useState(false)

  function generate(tpl: OnboardingTemplate) {
    const body = tpl.body
      .replaceAll('{{full_name}}', employee?.full_name || '')
      .replaceAll('{{employee_code}}', employee?.employee_code || '')
      .replaceAll('{{date}}', new Date().toLocaleDateString())
    generateLetterPdf(`${tpl.doc_type}-${(employee?.full_name || 'doc').replace(/\s+/g, '-').toLowerCase()}`, tpl.title, body.split('\n\n'))
  }

  return (
    <div data-testid="onboarding-page">
      <PageHeader
        title="Onboarding"
        description="Document templates and the new-joiner checklist."
        actions={
          <Button data-testid="new-template-button" onClick={() => setTplOpen(true)}>
            <Plus className="size-4" /> New template
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Document templates
            </h2>
            <ul className="space-y-2">
              {templates.map((t) => (
                <li key={t.id} data-testid="template-row" className="flex items-center justify-between rounded-lg border border-slate-100 p-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Badge tone="slate">{t.doc_type}</Badge>
                    {t.title}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`generate-doc-${t.doc_type}`}
                    disabled={!employee}
                    onClick={() => generate(t)}
                  >
                    <FileText className="size-4" /> Generate
                  </Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Joining checklist
            </h2>
            <div>
              <Label htmlFor="onb-emp">Employee</Label>
              <Select id="onb-emp" data-testid="onboarding-employee-select" value={effectiveUser} onChange={(e) => setEmployeeId(e.target.value)}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                ))}
              </Select>
            </div>

            {!onboarding ? (
              <Button
                data-testid="start-onboarding"
                loading={start.isPending}
                onClick={() => start.mutate(effectiveUser, { onSuccess: () => toast.success('Onboarding started') })}
              >
                Start onboarding
              </Button>
            ) : (
              <ul className="space-y-2" data-testid="checklist">
                {items.map((it) => (
                  <li key={it.id} data-testid="checklist-item" className="flex items-center justify-between gap-2 text-sm">
                    <span>{it.label}</span>
                    <Select
                      data-testid={`item-status-${it.item_key}`}
                      value={it.status}
                      onChange={(e) => updateItem.mutate({ id: it.id, status: e.target.value as OnboardingItem['status'] })}
                      className="h-8 w-32"
                    >
                      {ITEM_STATUS.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </Select>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {tplOpen && <TemplateModal onClose={() => setTplOpen(false)} />}
    </div>
  )
}

function TemplateModal({ onClose }: { onClose: () => void }) {
  const create = useCreateTemplate()
  const toast = useToast()
  const [docType, setDocType] = useState('welcome')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  return (
    <Modal open onClose={onClose} title="New document template" testid="template-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            { docType, title: title.trim(), body },
            { onSuccess: () => { toast.success('Template created'); onClose() }, onError: (err) => toast.error('Failed', (err as Error).message) },
          )
        }}
      >
        <div>
          <Label htmlFor="tpl-type">Document type</Label>
          <Select id="tpl-type" data-testid="tpl-doctype" value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOC_TYPES.map((d) => (<option key={d} value={d}>{d}</option>))}
          </Select>
        </div>
        <div>
          <Label htmlFor="tpl-title">Title</Label>
          <Input id="tpl-title" data-testid="tpl-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="tpl-body">Body (use {'{{full_name}}'}, {'{{employee_code}}'}, {'{{date}}'})</Label>
          <Textarea id="tpl-body" data-testid="tpl-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" data-testid="create-template" loading={create.isPending}>Create</Button>
        </div>
      </form>
    </Modal>
  )
}
