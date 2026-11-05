import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/toast-context'
import { useDecideLeave, type LeaveRequestRow } from './hooks'

export function LeaveDecisionModal({
  request,
  decision,
  onClose,
}: {
  request: LeaveRequestRow
  decision: 'approved' | 'rejected'
  onClose: () => void
}) {
  const decide = useDecideLeave()
  const toast = useToast()
  const [remarks, setRemarks] = useState('')
  const employee = request.requester?.full_name || request.requester?.email || 'Employee'

  return (
    <Modal
      open
      onClose={onClose}
      title={`${decision === 'approved' ? 'Approve' : 'Reject'} leave · ${employee}`}
      testid="leave-decision-modal"
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          decide.mutate(
            { id: request.id, decision, remarks: remarks.trim() || undefined },
            {
              onSuccess: () => {
                toast.success(decision === 'approved' ? 'Leave approved' : 'Leave rejected')
                onClose()
              },
              onError: (error) => toast.error('Decision failed', (error as Error).message),
            },
          )
        }}
      >
        <p className="text-sm text-slate-600">
          {request.leave_type?.name} · {request.start_date} to {request.end_date} · {request.days}{' '}
          day{Number(request.days) === 1 ? '' : 's'}
        </p>
        <div>
          <Label htmlFor="leave-decision-remarks">Remarks</Label>
          <Textarea
            id="leave-decision-remarks"
            data-testid="leave-decision-remarks"
            rows={3}
            placeholder="Add information visible to the employee"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={decision === 'rejected' ? 'danger' : 'primary'}
            loading={decide.isPending}
          >
            {decision === 'approved' ? 'Approve leave' : 'Reject leave'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
