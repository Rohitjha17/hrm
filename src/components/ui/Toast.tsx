import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ToastContext, type ToastContextValue, type ToastMessage } from './toast-context'

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const

const styles = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-brand-200 bg-brand-50 text-brand-800',
} as const

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const remove = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (t: Omit<ToastMessage, 'id'>) => {
      const id = crypto.randomUUID()
      setToasts((current) => [...current, { ...t, id }])
      window.setTimeout(() => remove(id), 5000)
    },
    [remove],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: push,
      success: (title, description) => push({ title, description, variant: 'success' }),
      error: (title, description) => push({ title, description, variant: 'error' }),
      info: (title, description) => push({ title, description, variant: 'info' }),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((t) => {
          const Icon = icons[t.variant]
          return (
            <div
              key={t.id}
              role="alert"
              data-testid={`toast-${t.variant}`}
              className={cn(
                'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border p-3 shadow-lg',
                styles[t.variant],
              )}
            >
              <Icon className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.description && <p className="mt-0.5 text-sm opacity-90">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="shrink-0 rounded p-1 hover:bg-black/5"
                aria-label="Dismiss notification"
              >
                <XCircle className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
