import { useState } from 'react'
import { Megaphone, Plus } from 'lucide-react'
import { useAnnouncements, usePublishAnnouncement } from './hooks'
import { useProfile } from '@/features/rbac/profile-context'
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
import { EmptyState } from '@/components/ui/EmptyState'

const CATEGORIES = ['holiday', 'meeting', 'policy', 'birthday', 'news', 'alert']

export function AnnouncementsPage() {
  const { hasPermission } = useProfile()
  const canManage = hasPermission('announcements.manage')
  const { data: items = [] } = useAnnouncements()
  const [open, setOpen] = useState(false)

  return (
    <div data-testid="announcements-page">
      <PageHeader
        title="Notice Board"
        description="Company-wide announcements."
        actions={
          canManage && (
            <Button data-testid="new-announcement-button" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Publish
            </Button>
          )
        }
      />

      {items.length === 0 ? (
        <EmptyState title="No announcements yet" testid="announcements-empty" />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id} data-testid="announcement-card">
              <CardBody>
                <div className="flex items-center gap-2">
                  <Megaphone className="size-4 text-brand-600" />
                  <h3 className="font-semibold text-slate-900">{a.title}</h3>
                  <Badge tone="brand">{a.category}</Badge>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>
                <p className="mt-1 text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {open && <PublishModal onClose={() => setOpen(false)} />}
    </div>
  )
}

function PublishModal({ onClose }: { onClose: () => void }) {
  const publish = usePublishAnnouncement()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('news')

  return (
    <Modal open onClose={onClose} title="Publish announcement" testid="announcement-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          publish.mutate(
            { title: title.trim(), body: body.trim(), category },
            { onSuccess: () => { toast.success('Published'); onClose() }, onError: (err) => toast.error('Failed', (err as Error).message) },
          )
        }}
      >
        <div>
          <Label htmlFor="an-cat">Category</Label>
          <Select id="an-cat" data-testid="announcement-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
          </Select>
        </div>
        <div>
          <Label htmlFor="an-title">Title</Label>
          <Input id="an-title" data-testid="announcement-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="an-body">Body</Label>
          <Textarea id="an-body" data-testid="announcement-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" data-testid="publish-announcement" loading={publish.isPending}>Publish</Button>
        </div>
      </form>
    </Modal>
  )
}
