import { useState } from 'react'
import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  useAnnouncements,
  useDeleteAnnouncement,
  usePublishAnnouncement,
  type Announcement,
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
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { EmptyState } from '@/components/ui/EmptyState'

const CATEGORIES = ['holiday', 'meeting', 'policy', 'birthday', 'news', 'alert']

export function AnnouncementsPage() {
  const { hasPermission } = useProfile()
  const canManage = hasPermission('announcements.manage')
  const { data: items = [] } = useAnnouncements(canManage)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const remove = useDeleteAnnouncement()
  const toast = useToast()

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
                  <Megaphone className="text-brand-600 size-4" />
                  <h3 className="font-semibold text-slate-900">{a.title}</h3>
                  <Badge tone="brand">{a.category}</Badge>
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap text-slate-600">{a.body}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(a.created_at).toLocaleString()}
                </p>
                {a.expires_at && (
                  <p className="mt-1 text-xs text-slate-400">
                    Displays until {new Date(a.expires_at).toLocaleString()}
                  </p>
                )}
                {canManage && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                      <Pencil className="size-4" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={remove.isPending}
                      onClick={() =>
                        remove.mutate(a.id, { onSuccess: () => toast.success('Notice deleted') })
                      }
                    >
                      <Trash2 className="size-4" /> Delete
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {open && <PublishModal onClose={() => setOpen(false)} />}
      {editing && <PublishModal announcement={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function PublishModal({
  announcement,
  onClose,
}: {
  announcement?: Announcement
  onClose: () => void
}) {
  const publish = usePublishAnnouncement()
  const toast = useToast()
  const [title, setTitle] = useState(announcement?.title ?? '')
  const [body, setBody] = useState(announcement?.body ?? '')
  const [category, setCategory] = useState(announcement?.category ?? 'news')
  const [startsAt, setStartsAt] = useState(
    (announcement?.starts_at ?? new Date().toISOString()).slice(0, 16),
  )
  const [expiresAt, setExpiresAt] = useState(announcement?.expires_at?.slice(0, 16) ?? '')

  return (
    <Modal open onClose={onClose} title="Publish announcement" testid="announcement-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          publish.mutate(
            {
              id: announcement?.id,
              title: title.trim(),
              body: body.trim(),
              category,
              startsAt,
              expiresAt,
            },
            {
              onSuccess: () => {
                toast.success(announcement ? 'Notice updated' : 'Published')
                onClose()
              },
              onError: (err) => toast.error('Failed', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="an-start">Display from</Label>
          <Input
            id="an-start"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="an-end">Display until</Label>
          <Input
            id="an-end"
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="an-cat">Category</Label>
          <Select
            id="an-cat"
            data-testid="announcement-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="an-title">Title</Label>
          <Input
            id="an-title"
            data-testid="announcement-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="an-body">Body</Label>
          <Textarea
            id="an-body"
            data-testid="announcement-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="publish-announcement" loading={publish.isPending}>
            Publish
          </Button>
        </div>
      </form>
    </Modal>
  )
}
