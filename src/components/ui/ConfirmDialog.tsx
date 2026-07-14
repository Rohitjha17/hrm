import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

/**
 * Shared danger-confirmation dialog for destructive actions. Renders the
 * consequence text, a Cancel escape hatch and a red confirm button; the
 * caller owns the mutation and closes the dialog on success.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  loading = false,
  onConfirm,
  onClose,
  testid,
}: {
  title: string
  message: ReactNode
  confirmLabel: string
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
  testid?: string
}) {
  return (
    <Modal open onClose={onClose} title={title} testid={testid}>
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-50">
            <TriangleAlert className="size-5 text-red-600" />
          </div>
          <div className="text-sm text-slate-600">{message}</div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            data-testid={testid ? `${testid}-confirm` : 'confirm-dialog-confirm'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
