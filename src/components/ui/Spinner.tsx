import { cn } from '@/lib/cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
        'size-4',
        className,
      )}
    />
  )
}

export function FullPageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      data-testid="full-page-spinner"
      className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-500"
    >
      <Spinner className="size-6 text-brand-600" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
