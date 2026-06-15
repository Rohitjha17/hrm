import { useState } from 'react'
import { Plus, FileText } from 'lucide-react'
import {
  useAddCandidate,
  useCandidates,
  useCreateOpening,
  useInterviews,
  useOpenings,
  useSaveFeedback,
  useScheduleInterview,
  useSendOffer,
  useUpdateCandidate,
  type Candidate,
  type InterviewRow,
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
import { Table, Tbody, Td, Th, Thead } from '@/components/ui/Table'
import { cn } from '@/lib/cn'

const STATUSES = ['applied', 'shortlisted', 'interview_scheduled', 'selected', 'rejected', 'joined']

export function RecruitmentPage() {
  const { data: openings = [] } = useOpenings()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = openings.find((o) => o.id === selectedId) ?? openings[0] ?? null
  const { data: candidates = [] } = useCandidates(selected?.id ?? null)
  const [openingModal, setOpeningModal] = useState(false)
  const [candidateModal, setCandidateModal] = useState(false)
  const [manageId, setManageId] = useState<string | null>(null)
  const managed = candidates.find((c) => c.id === manageId) ?? null

  return (
    <div data-testid="recruitment-page">
      <PageHeader
        title="Recruitment"
        description="Openings, candidates, interviews and offer approvals."
        actions={
          <Button data-testid="new-opening-button" onClick={() => setOpeningModal(true)}>
            <Plus className="size-4" /> New opening
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardBody className="space-y-1">
            {openings.map((o) => (
              <button
                key={o.id}
                data-testid="opening-item"
                onClick={() => setSelectedId(o.id)}
                className={cn(
                  'flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm',
                  selected?.id === o.id ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-100',
                )}
              >
                <span className="font-medium">{o.title}</span>
                <span className="text-xs text-slate-400">{o.designation}</span>
              </button>
            ))}
          </CardBody>
        </Card>

        {selected && (
          <div>
            <div className="mb-2 flex justify-end">
              <Button size="sm" data-testid="add-candidate-button" onClick={() => setCandidateModal(true)}>
                <Plus className="size-4" /> Add candidate
              </Button>
            </div>
            <Table data-testid="candidates-table">
              <Thead>
                <tr>
                  <Th>Candidate</Th>
                  <Th>Status</Th>
                  <Th>Offer</Th>
                  <Th className="text-right">Manage</Th>
                </tr>
              </Thead>
              <Tbody>
                {candidates.map((c) => (
                  <tr key={c.id} data-testid="candidate-row">
                    <Td className="font-medium text-slate-900">
                      {c.full_name}
                      <div className="text-xs font-normal text-slate-500">{c.email}</div>
                    </Td>
                    <Td>
                      <Badge tone="slate" data-testid="candidate-status">
                        {c.status}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge tone={c.offer_status === 'approved' ? 'green' : 'slate'}>{c.offer_status}</Badge>
                    </Td>
                    <Td>
                      <div className="flex justify-end">
                        <button
                          data-testid="manage-candidate"
                          className="rounded px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                          onClick={() => setManageId(c.id)}
                        >
                          Manage
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </Tbody>
            </Table>
          </div>
        )}
      </div>

      {openingModal && <OpeningModal onClose={() => setOpeningModal(false)} />}
      {candidateModal && selected && (
        <CandidateModal openingId={selected.id} onClose={() => setCandidateModal(false)} />
      )}
      {managed && (
        <ManageCandidateModal candidate={managed} onClose={() => setManageId(null)} />
      )}
    </div>
  )
}

function OpeningModal({ onClose }: { onClose: () => void }) {
  const create = useCreateOpening()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [designation, setDesignation] = useState('')
  return (
    <Modal open onClose={onClose} title="New opening" testid="opening-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            { title: title.trim(), designation: designation.trim() },
            { onSuccess: () => { toast.success('Opening created'); onClose() }, onError: (err) => toast.error('Failed', (err as Error).message) },
          )
        }}
      >
        <div>
          <Label htmlFor="op-title">Title</Label>
          <Input id="op-title" data-testid="opening-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="op-desig">Designation</Label>
          <Input id="op-desig" data-testid="opening-designation" value={designation} onChange={(e) => setDesignation(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" data-testid="create-opening-submit" loading={create.isPending}>Create</Button>
        </div>
      </form>
    </Modal>
  )
}

function CandidateModal({ openingId, onClose }: { openingId: string; onClose: () => void }) {
  const add = useAddCandidate()
  const toast = useToast()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  return (
    <Modal open onClose={onClose} title="Add candidate" testid="add-candidate-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          add.mutate(
            { openingId, fullName: fullName.trim(), email: email.trim() },
            { onSuccess: () => { toast.success('Candidate added'); onClose() }, onError: (err) => toast.error('Failed', (err as Error).message) },
          )
        }}
      >
        <div>
          <Label htmlFor="cd-name">Full name</Label>
          <Input id="cd-name" data-testid="candidate-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="cd-email">Email</Label>
          <Input id="cd-email" data-testid="candidate-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" data-testid="create-candidate-submit" loading={add.isPending}>Add</Button>
        </div>
      </form>
    </Modal>
  )
}

function ManageCandidateModal({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const { data: users = [] } = useUsers()
  const { data: interviews = [] } = useInterviews(candidate.id)
  const update = useUpdateCandidate()
  const schedule = useScheduleInterview()
  const sendOffer = useSendOffer()
  const toast = useToast()
  const [date, setDate] = useState('')
  const [interviewerId, setInterviewerId] = useState('')

  function genLetter() {
    generateLetterPdf(`offer-${candidate.full_name.replace(/\s+/g, '-').toLowerCase()}`, 'Offer Letter', [
      `Dear ${candidate.full_name},`,
      `We are pleased to offer you a position at HRMS Demo Company. This letter confirms the details of your offer following a successful interview process.`,
      `Please review and confirm your acceptance. We look forward to welcoming you to the team.`,
      `Sincerely,\nHuman Resources`,
    ])
  }

  return (
    <Modal open onClose={onClose} title={candidate.full_name} testid="candidate-modal">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Label className="mb-0">Status</Label>
          <Select
            data-testid="candidate-status-select"
            value={candidate.status}
            onChange={(e) => update.mutate({ id: candidate.id, status: e.target.value as Candidate['status'] }, { onSuccess: () => toast.success('Status updated') })}
            className="w-52"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Badge tone={candidate.offer_status === 'approved' ? 'green' : 'slate'} data-testid="offer-status">
            offer: {candidate.offer_status}
          </Badge>
        </div>

        {/* Schedule interview */}
        <form
          className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3"
          onSubmit={(e) => {
            e.preventDefault()
            schedule.mutate(
              { candidateId: candidate.id, scheduledAt: new Date(date).toISOString(), interviewerId: interviewerId || null, mode: 'video' },
              { onSuccess: () => { toast.success('Interview scheduled'); setDate('') }, onError: (err) => toast.error('Failed', (err as Error).message) },
            )
          }}
        >
          <div>
            <Label className="text-xs">Interview date</Label>
            <Input data-testid="interview-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <Label className="text-xs">Interviewer</Label>
            <Select data-testid="interview-interviewer" value={interviewerId} onChange={(e) => setInterviewerId(e.target.value)} className="w-44">
              <option value="">— None —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
              ))}
            </Select>
          </div>
          <Button type="submit" size="sm" data-testid="schedule-interview" loading={schedule.isPending}>Schedule</Button>
        </form>

        {/* Interviews + feedback */}
        <ul className="space-y-2" data-testid="interviews-list">
          {interviews.map((iv) => (
            <InterviewItem key={iv.id} interview={iv} />
          ))}
        </ul>

        {/* Offer */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <Button
            size="sm"
            variant="outline"
            data-testid="send-offer"
            loading={sendOffer.isPending}
            onClick={() => sendOffer.mutate({ id: candidate.id, full_name: candidate.full_name }, { onSuccess: () => toast.success('Offer sent for approval') })}
          >
            Send offer for approval
          </Button>
          {candidate.offer_status === 'approved' && (
            <Button size="sm" data-testid="generate-offer-letter" onClick={genLetter}>
              <FileText className="size-4" /> Generate offer letter
            </Button>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" data-testid="close-candidate" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function InterviewItem({ interview }: { interview: InterviewRow }) {
  const save = useSaveFeedback()
  const toast = useToast()
  const [rating, setRating] = useState(String(interview.rating ?? 5))
  const [recommendation, setRecommendation] = useState(interview.recommendation ?? 'proceed')
  const [feedback, setFeedback] = useState(interview.feedback ?? '')

  return (
    <li data-testid="interview-row" className="rounded-lg border border-slate-100 p-3">
      <p className="text-sm font-medium text-slate-700">
        {new Date(interview.scheduled_at).toLocaleString()} · {interview.interviewer?.full_name ?? 'TBD'}
      </p>
      <form
        className="mt-2 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(
            { interviewId: interview.id, feedback, rating: Number(rating), recommendation },
            { onSuccess: () => toast.success('Feedback saved'), onError: (err) => toast.error('Failed', (err as Error).message) },
          )
        }}
      >
        <Select data-testid="feedback-rating" value={rating} onChange={(e) => setRating(e.target.value)} className="h-9 w-20">
          {[1, 2, 3, 4, 5].map((n) => (<option key={n} value={n}>{n}</option>))}
        </Select>
        <Select data-testid="feedback-recommendation" value={recommendation} onChange={(e) => setRecommendation(e.target.value)} className="h-9 w-32">
          <option value="proceed">Proceed</option>
          <option value="hold">Hold</option>
          <option value="reject">Reject</option>
        </Select>
        <Input data-testid="feedback-text" placeholder="Feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} className="h-9 w-48" />
        <Button type="submit" size="sm" data-testid="save-feedback" loading={save.isPending}>Save</Button>
      </form>
    </li>
  )
}
