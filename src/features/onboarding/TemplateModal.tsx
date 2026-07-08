import { useState } from 'react'
import { useCreateTemplate } from './hooks'
import { useToast } from '@/components/ui/toast-context'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

/** Create a document template limited to the given doc types (onboarding or exit). */
export function TemplateModal({
  docTypes,
  title: modalTitle = 'New document template',
  onClose,
}: {
  docTypes: readonly string[]
  title?: string
  onClose: () => void
}) {
  const create = useCreateTemplate()
  const toast = useToast()
  const [docType, setDocType] = useState(docTypes[0])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  return (
    <Modal open onClose={onClose} title={modalTitle} testid="template-modal">
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
            {docTypes.map((d) => (<option key={d} value={d}>{d}</option>))}
          </Select>
        </div>
        <div>
          <Label htmlFor="tpl-title">Title</Label>
          <Input id="tpl-title" data-testid="tpl-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="tpl-body">Body (use {'{{full_name}}'}, {'{{employee_code}}'}, {'{{date}}'}, {'{{last_working_date}}'})</Label>
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
