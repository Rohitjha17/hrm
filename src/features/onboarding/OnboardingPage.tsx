import { useMemo, useState } from 'react'
import { FileText, Plus } from 'lucide-react'
import { useTemplates, type OnboardingTemplate } from './hooks'
import { TemplateModal } from './TemplateModal'
import { useUsers } from '@/features/admin/users/hooks'
import { useDepartments, useTeams } from '@/features/admin/hierarchy/hooks'
import { generateLetterPdf } from '@/lib/pdfLetter'
import { formatDate } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'

const DOC_TYPES = [
  'appointment',
  'confidentiality',
  'contract',
  'joining',
  'nda',
  'offer',
  'welcome',
]

/** All known template variables with a nice label and example. */
const VARIABLE_LABELS: Record<string, string> = {
  full_name: 'Full name',
  employee_code: 'Employee code',
  date: 'Letter date',
  designation: 'Designation',
  department: 'Department',
  team: 'Team',
  salary: 'Monthly salary (₹)',
  joining_date: 'Joining date',
  reporting_manager: 'Reporting manager',
  last_working_date: 'Last working date',
  address: 'Address',
  phone: 'Phone',
  email: 'Email',
}

function extractVariables(body: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  const re = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi
  let match
  while ((match = re.exec(body)) !== null) {
    const name = match[1].toLowerCase()
    if (!seen.has(name)) {
      seen.add(name)
      result.push(name)
    }
  }
  return result
}

export function OnboardingPage() {
  const { data: users = [] } = useUsers()
  const { data: templates = [] } = useTemplates(DOC_TYPES)
  const { data: departments = [] } = useDepartments()
  const { data: teams = [] } = useTeams()
  const [employeeId, setEmployeeId] = useState('')
  const effectiveUser = employeeId || users[0]?.id || ''
  const employee = users.find((u) => u.id === effectiveUser)
  const [tplOpen, setTplOpen] = useState(false)
  const [varsFor, setVarsFor] = useState<OnboardingTemplate | null>(null)

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) =>
        (a.full_name || a.email).localeCompare(b.full_name || b.email),
      ),
    [users],
  )

  /**
   * Seed what we can from the employee record; anything we can't fill the
   * admin will provide in the prompt dialog. Keys are lowercase variable
   * names matching the template placeholders.
   */
  function seededValuesFor(_tpl: OnboardingTemplate): Record<string, string> {
    if (!employee) return {}
    const dept = departments.find((d) => d.id === employee.department_id)?.name ?? ''
    const team = teams.find((t) => t.id === employee.team_id)?.name ?? ''
    const manager =
      users.find((u) => u.id === employee.reporting_manager_id)?.full_name ?? ''
    return {
      full_name: employee.full_name ?? '',
      employee_code: employee.employee_code ?? '',
      date: formatDate(new Date().toISOString().slice(0, 10)),
      designation: '',
      department: dept,
      team,
      salary: '',
      joining_date: '',
      reporting_manager: manager,
      last_working_date: '',
      address: '',
      phone: employee.phone ?? '',
      email: employee.email ?? '',
    }
  }

  return (
    <div data-testid="onboarding-page">
      <PageHeader
        title="Communication Templates"
        description="Reusable document templates — generate personalised letters for any employee. Variables in the body are filled in from the employee record and from a quick prompt for the rest."
        actions={
          <Button data-testid="new-template-button" onClick={() => setTplOpen(true)}>
            <Plus className="size-4" /> New template
          </Button>
        }
      />

      <div className="mb-4 w-64">
        <Label htmlFor="onb-emp">Generate for</Label>
        <Select
          id="onb-emp"
          data-testid="onboarding-employee-select"
          value={effectiveUser}
          onChange={(e) => setEmployeeId(e.target.value)}
        >
          {sortedUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name || u.email}
            </option>
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
              <li
                key={t.id}
                data-testid="template-row"
                className="flex items-center justify-between rounded-lg border border-slate-100 p-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Badge tone="slate">{t.doc_type}</Badge>
                  {t.title}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={`generate-doc-${t.doc_type}`}
                  disabled={!employee}
                  onClick={() => setVarsFor(t)}
                >
                  <FileText className="size-4" /> Generate
                </Button>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {tplOpen && <TemplateModal docTypes={DOC_TYPES} onClose={() => setTplOpen(false)} />}

      {varsFor && employee && (
        <VariablePromptModal
          template={varsFor}
          variables={extractVariables(varsFor.body)}
          seed={seededValuesFor(varsFor)}
          onClose={() => setVarsFor(null)}
          onGenerate={(values) => {
            let body = varsFor.body
            for (const [key, val] of Object.entries(values)) {
              body = body.replaceAll(`{{${key}}}`, val)
            }
            generateLetterPdf(
              `${varsFor.doc_type}-${(employee.full_name || 'doc').replace(/\s+/g, '-').toLowerCase()}`,
              varsFor.title,
              body.split('\n\n'),
            )
            setVarsFor(null)
          }}
        />
      )}
    </div>
  )
}

/**
 * Prompt for every template variable. Known ones are pre-filled from the
 * selected employee record; the admin fills in or overrides any value, then
 * generate downloads the personalised PDF.
 */
function VariablePromptModal({
  template,
  variables,
  seed,
  onClose,
  onGenerate,
}: {
  template: OnboardingTemplate
  variables: string[]
  seed: Record<string, string>
  onClose: () => void
  onGenerate: (values: Record<string, string>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const v of variables) init[v] = seed[v] ?? ''
    return init
  })

  // No variables in template: just generate immediately (no modal needed).
  if (variables.length === 0) {
    onGenerate({})
    return null
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Fill variables — ${template.title}`}
      testid="template-variables-modal"
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          onGenerate(values)
        }}
      >
        <p className="text-xs text-slate-500">
          Fields with pre-filled values come from the employee record. Leave a value as you want it
          to appear in the letter — or change it.
        </p>
        <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {variables.map((v) => (
            <div key={v}>
              <Label htmlFor={`tplvar-${v}`}>
                {VARIABLE_LABELS[v] ?? v} <span className="text-xs text-slate-400">{`{{${v}}}`}</span>
              </Label>
              <Input
                id={`tplvar-${v}`}
                data-testid={`tplvar-${v}`}
                value={values[v] ?? ''}
                onChange={(e) =>
                  setValues((current) => ({ ...current, [v]: e.target.value }))
                }
                type={
                  v.includes('date') ? 'date' : v === 'salary' ? 'number' : 'text'
                }
                placeholder={VARIABLE_LABELS[v] ?? v}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="generate-with-vars">
            Generate letter
          </Button>
        </div>
      </form>
    </Modal>
  )
}
