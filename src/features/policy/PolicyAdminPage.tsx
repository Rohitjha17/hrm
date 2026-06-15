import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useCreatePolicy, usePolicies, usePolicyVersions, usePublishVersion } from './hooks'
import { useToast } from '@/components/ui/toast-context'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/cn'

const CATEGORIES = ['attendance', 'leave', 'salary', 'planning', 'wfh', 'appraisal', 'general']

export function PolicyAdminPage() {
  const { data: policies = [] } = usePolicies()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = policies.find((p) => p.id === selectedId) ?? policies[0] ?? null
  const { data: versions = [] } = usePolicyVersions(selected?.id ?? null)
  const [newOpen, setNewOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)

  return (
    <div data-testid="policy-admin-page">
      <PageHeader
        title="Policy Management"
        description="Version-controlled policies with acknowledgement tracking."
        actions={
          <Button data-testid="new-policy-button" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" /> New policy
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardBody className="space-y-1">
            {policies.map((p) => (
              <button
                key={p.id}
                data-testid={`policy-item-${p.category}`}
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm',
                  selected?.id === p.id ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-100',
                )}
              >
                <span className="font-medium">{p.title}</span>
                <Badge tone="brand">v{p.current_version}</Badge>
              </button>
            ))}
          </CardBody>
        </Card>

        {selected && (
          <Card>
            <CardBody>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selected.title}</h2>
                  <Badge tone="slate">{selected.category}</Badge>
                </div>
                <Button size="sm" data-testid="publish-version-button" onClick={() => setPublishOpen(true)}>
                  Publish new version
                </Button>
              </div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Version history
              </h3>
              <ul className="space-y-2" data-testid="version-history">
                {versions.length === 0 && <li className="text-sm text-slate-500">No versions yet.</li>}
                {versions.map((v) => (
                  <li key={v.id} data-testid="version-row" className="rounded-lg border border-slate-100 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge tone="brand">v{v.version}</Badge>
                      <span className="text-xs text-slate-400">
                        {new Date(v.created_at).toLocaleString()}
                      </span>
                    </div>
                    {v.change_note && <p className="mt-1 text-xs text-slate-500">{v.change_note}</p>}
                    <p className="mt-1 whitespace-pre-wrap text-slate-700">{v.content}</p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>

      {newOpen && <NewPolicyModal onClose={() => setNewOpen(false)} />}
      {publishOpen && selected && (
        <PublishModal policyId={selected.id} onClose={() => setPublishOpen(false)} />
      )}
    </div>
  )
}

function NewPolicyModal({ onClose }: { onClose: () => void }) {
  const create = useCreatePolicy()
  const toast = useToast()
  const [category, setCategory] = useState('general')
  const [title, setTitle] = useState('')

  return (
    <Modal open onClose={onClose} title="New policy" testid="policy-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            { category, title: title.trim() },
            {
              onSuccess: () => {
                toast.success('Policy created')
                onClose()
              },
              onError: (err) => toast.error('Failed', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="pol-cat">Category</Label>
          <Select id="pol-cat" data-testid="policy-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pol-title">Title</Label>
          <Input id="pol-title" data-testid="policy-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="create-policy-submit" loading={create.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function PublishModal({ policyId, onClose }: { policyId: string; onClose: () => void }) {
  const publish = usePublishVersion()
  const toast = useToast()
  const [content, setContent] = useState('')
  const [changeNote, setChangeNote] = useState('')

  return (
    <Modal open onClose={onClose} title="Publish new version" testid="publish-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          publish.mutate(
            { policyId, content: content.trim(), changeNote: changeNote.trim() || undefined },
            {
              onSuccess: () => {
                toast.success('Version published')
                onClose()
              },
              onError: (err) => toast.error('Failed', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="pv-content">Content</Label>
          <Textarea id="pv-content" data-testid="version-content" rows={5} value={content} onChange={(e) => setContent(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="pv-note">Change note</Label>
          <Input id="pv-note" data-testid="version-note" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="publish-submit" loading={publish.isPending}>
            Publish
          </Button>
        </div>
      </form>
    </Modal>
  )
}
