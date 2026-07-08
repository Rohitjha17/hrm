import { useMemo, useState } from 'react'
import { CalendarPlus, Check, ExternalLink, Trash2, X } from 'lucide-react'
import {
  useCreateMeeting,
  useDeleteMeeting,
  useDirectory,
  useMeetings,
  useRespondToInvite,
  type MeetingRow,
} from './hooks'
import { useAuth } from '@/features/auth/auth-context'
import { useToast } from '@/components/ui/toast-context'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'

const INVITE_TONE: Record<string, 'slate' | 'green' | 'red'> = {
  invited: 'slate',
  accepted: 'green',
  declined: 'red',
}

/** Internal meeting management — host meetings, invite colleagues, respond to invites. */
export function MeetingsSection() {
  const { user } = useAuth()
  const { data: meetings = [] } = useMeetings()
  const { data: directory = [] } = useDirectory()
  const respond = useRespondToInvite()
  const del = useDeleteMeeting()
  const toast = useToast()
  const [hostModal, setHostModal] = useState(false)

  const nameById = useMemo(
    () => new Map(directory.map((d) => [d.id, d.full_name || d.email])),
    [directory],
  )

  const [now] = useState(() => Date.now())
  const upcoming = meetings.filter((m) => new Date(m.ends_at ?? m.starts_at).getTime() >= now)
  const past = meetings.filter((m) => new Date(m.ends_at ?? m.starts_at).getTime() < now)

  return (
    <section className="mt-8" data-testid="meetings-section">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Meetings</h2>
        <Button data-testid="host-meeting-button" onClick={() => setHostModal(true)}>
          <CalendarPlus className="size-4" /> Host a meeting
        </Button>
      </div>

      {meetings.length === 0 ? (
        <EmptyState
          title="No meetings yet"
          description="Host a meeting and invite your colleagues."
          testid="meetings-empty"
        />
      ) : (
        <div className="space-y-3">
          {upcoming.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2" data-testid="upcoming-meetings">
              {upcoming.map((m) => (
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  meId={user?.id}
                  nameById={nameById}
                  onRespond={(rowId, status) =>
                    respond.mutate(
                      { inviteeRowId: rowId, status },
                      {
                        onSuccess: () => toast.success(status === 'accepted' ? 'Invitation accepted' : 'Invitation declined'),
                        onError: (err) => toast.error('Failed', (err as Error).message),
                      },
                    )
                  }
                  onDelete={(id) =>
                    del.mutate(id, {
                      onSuccess: () => toast.success('Meeting cancelled'),
                      onError: (err) => toast.error('Failed', (err as Error).message),
                    })
                  }
                />
              ))}
            </div>
          )}
          {past.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm text-slate-500">
                Past meetings ({past.length})
              </summary>
              <div className="mt-3 grid gap-3 opacity-70 md:grid-cols-2">
                {past.map((m) => (
                  <MeetingCard key={m.id} meeting={m} meId={user?.id} nameById={nameById} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {hostModal && <HostMeetingModal onClose={() => setHostModal(false)} />}
    </section>
  )
}

function MeetingCard({
  meeting,
  meId,
  nameById,
  onRespond,
  onDelete,
}: {
  meeting: MeetingRow
  meId?: string
  nameById: Map<string, string>
  onRespond?: (inviteeRowId: string, status: 'accepted' | 'declined') => void
  onDelete?: (meetingId: string) => void
}) {
  const myInvite = meeting.meeting_invitees.find((i) => i.user_id === meId)
  const isHost = meeting.host_id === meId

  return (
    <Card data-testid="meeting-card">
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-900" data-testid="meeting-title">{meeting.title}</h3>
            <p className="text-xs text-slate-500">
              Hosted by {isHost ? 'you' : (nameById.get(meeting.host_id) ?? '—')}
            </p>
          </div>
          {isHost && onDelete && (
            <button
              data-testid="delete-meeting"
              aria-label={`Cancel meeting ${meeting.title}`}
              className="text-slate-300 hover:text-red-600"
              onClick={() => onDelete(meeting.id)}
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
        <p className="text-sm text-slate-600">
          {new Date(meeting.starts_at).toLocaleString()}
          {meeting.ends_at && ` → ${new Date(meeting.ends_at).toLocaleTimeString()}`}
        </p>
        {meeting.description && <p className="text-sm text-slate-600">{meeting.description}</p>}
        {meeting.meeting_link && (
          <a
            href={meeting.meeting_link}
            target="_blank"
            rel="noreferrer noopener"
            data-testid="meeting-link"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
          >
            <ExternalLink className="size-3.5" /> Join link
          </a>
        )}
        <div className="flex flex-wrap gap-1" data-testid="meeting-invitees">
          {meeting.meeting_invitees.map((i) => (
            <Badge key={i.id} tone={INVITE_TONE[i.status] ?? 'slate'}>
              {nameById.get(i.user_id) ?? '—'} · {i.status}
            </Badge>
          ))}
        </div>
        {myInvite && myInvite.status === 'invited' && onRespond && (
          <div className="flex gap-2 border-t border-slate-100 pt-2">
            <Button size="sm" data-testid="accept-invite" onClick={() => onRespond(myInvite.id, 'accepted')}>
              <Check className="size-4" /> Accept
            </Button>
            <Button size="sm" variant="outline" data-testid="decline-invite" onClick={() => onRespond(myInvite.id, 'declined')}>
              <X className="size-4" /> Decline
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function HostMeetingModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { data: directory = [] } = useDirectory()
  const create = useCreateMeeting()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [link, setLink] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [invitees, setInvitees] = useState<Set<string>>(new Set())

  const colleagues = directory.filter((d) => d.id !== user?.id)

  function toggle(id: string) {
    setInvitees((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Modal open onClose={onClose} title="Host a meeting" testid="host-meeting-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            {
              title: title.trim(),
              description: description.trim() || undefined,
              link: link.trim() || undefined,
              startsAt: new Date(startsAt).toISOString(),
              endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
              inviteeIds: [...invitees],
            },
            {
              onSuccess: () => {
                toast.success('Meeting created', 'Invitations are visible to invitees immediately.')
                onClose()
              },
              onError: (err) => toast.error('Failed', (err as Error).message),
            },
          )
        }}
      >
        <div>
          <Label htmlFor="mt-title">Title</Label>
          <Input id="mt-title" data-testid="meeting-title-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="mt-desc">Description</Label>
          <Textarea id="mt-desc" data-testid="meeting-desc-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="mt-link">Meeting link</Label>
          <Input id="mt-link" data-testid="meeting-link-input" type="url" placeholder="https://meet.example.com/…" value={link} onChange={(e) => setLink(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="mt-start">Starts</Label>
            <Input id="mt-start" data-testid="meeting-start-input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="mt-end">Ends (optional)</Label>
            <Input id="mt-end" data-testid="meeting-end-input" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Invite colleagues</Label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2" data-testid="invitee-picker">
            {colleagues.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  data-testid={`invite-${c.email}`}
                  checked={invitees.has(c.id)}
                  onChange={() => toggle(c.id)}
                />
                {c.full_name || c.email}
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" data-testid="create-meeting-submit" loading={create.isPending}>
            Create meeting
          </Button>
        </div>
      </form>
    </Modal>
  )
}
