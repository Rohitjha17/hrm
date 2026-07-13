import { useState } from 'react'
import { FileText, Plus } from 'lucide-react'
import { useTemplates, type OnboardingTemplate } from './hooks'
import { TemplateModal } from './TemplateModal'
import { useUsers } from '@/features/admin/users/hooks'
import { generateLetterPdf } from '@/lib/pdfLetter'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'

const DOC_TYPES = ['offer', 'appointment', 'joining', 'nda', 'contract', 'confidentiality', 'welcome']

export function OnboardingPage() {
  const { data: users = [] } = useUsers()
  const { data: templates = [] } = useTemplates(DOC_TYPES)
  const [employeeId, setEmployeeId] = useState('')
  const effectiveUser = employeeId || users[0]?.id || ''
  const employee = users.find((u) => u.id === effectiveUser)
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
        title="Communication Templates"
        description="Reusable document templates — generate personalised letters for any employee. The joining checklist lives in Doc Vault."
        actions={
          <Button data-testid="new-template-button" onClick={() => setTplOpen(true)}>
            <Plus className="size-4" /> New template
          </Button>
        }
      />

      <div className="mb-4 w-64">
        <Label htmlFor="onb-emp">Generate for</Label>
        <Select id="onb-emp" data-testid="onboarding-employee-select" value={effectiveUser} onChange={(e) => setEmployeeId(e.target.value)}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
          ))}
        </Select>
      </div>

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

      {tplOpen && <TemplateModal docTypes={DOC_TYPES} onClose={() => setTplOpen(false)} />}
    </div>
  )
}
