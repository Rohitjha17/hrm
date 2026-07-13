import { Star } from 'lucide-react'
import { HISTORY_FIELD_LABEL, useAppraisalHistory } from './hooks'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'

export function RatingStars({ value }: { value: number | null }) {
  if (!value) return <span className="text-xs text-slate-400">—</span>
  return (
    <span className="inline-flex items-center gap-0.5" data-testid="appraisal-rating-stars" aria-label={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('size-3.5', n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-200')} />
      ))}
    </span>
  )
}

/** Append-only change log for the qualitative fields of an appraisal. */
export function AppraisalHistoryList({ appraisalId }: { appraisalId: string }) {
  const { data: history = [], isLoading } = useAppraisalHistory(appraisalId)

  return (
    <div className="border-t border-slate-200 pt-3">
      <h4 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Change history
      </h4>
      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-slate-400" data-testid="appraisal-history-empty">
          No changes recorded yet.
        </p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto" data-testid="appraisal-history">
          {history.map((h) => (
            <li
              key={h.id}
              data-testid="appraisal-history-entry"
              className="border-l-2 border-brand-200 pl-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="slate">{HISTORY_FIELD_LABEL[h.field] ?? h.field}</Badge>
                <span className="text-slate-400 line-through">{h.old_value || '—'}</span>
                <span className="text-slate-400">→</span>
                <span className="text-slate-700">{h.new_value || '—'}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {h.changer?.full_name || h.changer?.email || 'System'} ·{' '}
                {new Date(h.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
