import { useState } from 'react'
import { Check, Plus, FileText, ExternalLink, ListChecks, X } from 'lucide-react'
import {
  getCandidateDocUrl,
  useAddCandidate,
  useCandidateChecklist,
  useCandidateDocuments,
  useCandidates,
  useCreateOpening,
  useInterviews,
  useOpenings,
  useSaveFeedback,
  useScheduleInterview,
  useSendOffer,
  useDecideOffer,
  useStartCandidateChecklist,
  useUpdateCandidate,
  useUpdateChecklistItem,
  useUploadCandidateDocument,
  type Candidate,
  type InterviewRow,
} from './hooks'
import { useDepartments } from '@/features/admin/hierarchy/hooks'
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
                <span className="font-medium">{o.designation}</span>
                <span className="text-xs text-slate-400">{o.department?.name ?? 'No department'}</span>
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
                      <div className="text-xs font-normal text-slate-500">
                        {c.email}
                        {c.phone ? ` · ${c.phone}` : ''}
                      </div>
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
  const { data: departments = [] } = useDepartments()
  const toast = useToast()
  const [departmentId, setDepartmentId] = useState('')
  const [designation, setDesignation] = useState('')
  return (
    <Modal open onClose={onClose} title="New opening" testid="opening-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate(
            { departmentId, designation: designation.trim() },
            { onSuccess: () => { toast.success('Opening created'); onClose() }, onError: (err) => toast.error('Failed', (err as Error).message) },
          )
        }}
      >
        <div>
          <Label htmlFor="op-dept">Department</Label>
          <Select id="op-dept" data-testid="opening-department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
            <option value="">— Select department —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="op-desig">Designation</Label>
          <Input id="op-desig" data-testid="opening-designation" placeholder="e.g. Senior Frontend Engineer" value={designation} onChange={(e) => setDesignation(e.target.value)} required />
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
  const upload = useUploadCandidateDocument()
  const toast = useToast()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  return (
    <Modal open onClose={onClose} title="Add candidate" testid="add-candidate-modal">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          setSaving(true)
          add.mutate(
            { openingId, fullName: fullName.trim(), email: email.trim(), phone: phone.trim() || undefined },
            {
              onSuccess: async (created) => {
                try {
                  for (const file of files) {
                    await upload.mutateAsync({ candidateId: created.id, title: file.name, file })
                  }
                  toast.success('Candidate added', files.length ? `${files.length} document(s) attached` : undefined)
                  onClose()
                } catch (err) {
                  toast.error('Candidate saved, but a document failed to upload', (err as Error).message)
                  onClose()
                } finally {
                  setSaving(false)
                }
              },
              onError: (err) => {
                setSaving(false)
                toast.error('Failed', (err as Error).message)
              },
            },
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
        <div>
          <Label htmlFor="cd-phone">Phone</Label>
          <Input id="cd-phone" data-testid="candidate-phone" type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cd-files">Attachments (resume, documents)</Label>
          <Input
            id="cd-files"
            data-testid="candidate-files"
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">{files.map((f) => f.name).join(', ')}</p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" data-testid="create-candidate-submit" loading={add.isPending || saving}>Add</Button>
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
  const decideOffer = useDecideOffer()
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
          {candidate.offer_status === 'none' && (
            <Button
              size="sm"
              variant="outline"
              data-testid="send-offer"
              loading={sendOffer.isPending}
              onClick={() => sendOffer.mutate({ id: candidate.id, full_name: candidate.full_name }, { onSuccess: () => toast.success('Offer sent for approval') })}
            >
              Send offer for approval
            </Button>
          )}
          {candidate.offer_status === 'pending' && (
            <>
              <Button
                size="sm"
                data-testid="approve-offer"
                loading={decideOffer.isPending}
                onClick={() =>
                  decideOffer.mutate(
                    { id: candidate.id, decision: 'approved' },
                    { onSuccess: () => toast.success('Offer approved') },
                  )
                }
              >
                <Check className="size-4" /> Approve offer
              </Button>
              <Button
                size="sm"
                variant="danger"
                data-testid="reject-offer"
                onClick={() =>
                  decideOffer.mutate(
                    { id: candidate.id, decision: 'rejected' },
                    { onSuccess: () => toast.info('Offer rejected') },
                  )
                }
              >
                <X className="size-4" /> Reject
              </Button>
            </>
          )}
          {candidate.offer_status === 'approved' && (
            <Button size="sm" data-testid="generate-offer-letter" onClick={genLetter}>
              <FileText className="size-4" /> Generate offer letter
            </Button>
          )}
        </div>

        <CandidateDocumentsSection candidateId={candidate.id} />
        <CandidateChecklistSection candidateId={candidate.id} />

        <div className="flex justify-end">
          <Button variant="outline" data-testid="close-candidate" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function CandidateDocumentsSection({ candidateId }: { candidateId: string }) {
  const { data: docs = [] } = useCandidateDocuments(candidateId)
  const upload = useUploadCandidateDocument()
  const toast = useToast()

  return (
    <div className="border-t border-slate-100 pt-3" data-testid="candidate-documents">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Documents</h3>
        <label className="cursor-pointer rounded px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50">
          Upload
          <input
            type="file"
            data-testid="candidate-doc-upload"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              upload.mutate(
                { candidateId, title: file.name, file },
                {
                  onSuccess: () => toast.success('Document uploaded'),
                  onError: (err) => toast.error('Upload failed', (err as Error).message),
                },
              )
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {docs.length === 0 ? (
        <p className="text-xs text-slate-400" data-testid="candidate-docs-empty">No documents yet.</p>
      ) : (
        <ul className="space-y-1">
          {docs.map((d) => (
            <li key={d.id} data-testid="candidate-doc-row" className="flex items-center justify-between rounded border border-slate-100 px-2 py-1.5 text-sm">
              <span className="truncate text-slate-700">{d.title}</span>
              <button
                data-testid="candidate-doc-view"
                className="ml-2 flex shrink-0 items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                onClick={async () => {
                  try {
                    const url = await getCandidateDocUrl(d.storage_path)
                    window.open(url, '_blank', 'noopener')
                  } catch (err) {
                    toast.error('Could not open document', (err as Error).message)
                  }
                }}
              >
                <ExternalLink className="size-3" /> View
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const CHECKLIST_STATUSES = ['pending', 'sent', 'received', 'verified'] as const
const CHECKLIST_TONE: Record<string, 'slate' | 'blue' | 'amber' | 'green'> = {
  pending: 'slate',
  sent: 'blue',
  received: 'amber',
  verified: 'green',
}

function CandidateChecklistSection({ candidateId }: { candidateId: string }) {
  const { data: items = [], isLoading } = useCandidateChecklist(candidateId)
  const start = useStartCandidateChecklist()
  const update = useUpdateChecklistItem()
  const toast = useToast()

  return (
    <div className="border-t border-slate-100 pt-3" data-testid="candidate-checklist">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Communication checklist</h3>
        {!isLoading && items.length === 0 && (
          <Button
            size="sm"
            variant="outline"
            data-testid="start-checklist"
            loading={start.isPending}
            onClick={() =>
              start.mutate(candidateId, {
                onSuccess: () => toast.success('Checklist started'),
                onError: (err) => toast.error('Failed', (err as Error).message),
              })
            }
          >
            <ListChecks className="size-4" /> Start checklist
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400" data-testid="checklist-empty">
          Track documents sent to and received from this candidate — start the checklist.
        </p>
      ) : (
        <ul className="space-y-1" data-testid="checklist-items">
          {items.map((it) => (
            <li key={it.id} data-testid={`checklist-item-${it.item_key}`} className="flex items-center justify-between gap-2 rounded border border-slate-100 px-2 py-1.5 text-sm">
              <span className="text-slate-700">{it.label}</span>
              <div className="flex items-center gap-2">
                <Badge tone={CHECKLIST_TONE[it.status] ?? 'slate'}>{it.status}</Badge>
                <Select
                  data-testid={`checklist-status-${it.item_key}`}
                  value={it.status}
                  onChange={(e) =>
                    update.mutate(
                      { id: it.id, status: e.target.value },
                      {
                        onSuccess: () => toast.success('Checklist updated'),
                        onError: (err) => toast.error('Failed', (err as Error).message),
                      },
                    )
                  }
                  className="h-8 w-32"
                >
                  {CHECKLIST_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
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
