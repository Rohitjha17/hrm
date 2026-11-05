import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        // Browser autofill/history has pushed stale values into these fields
        // (reported: a "8" showing in Remarks). Opt out so every open is clean.
        autoComplete="off"
        autoCorrect="off"
        spellCheck={true}
        data-form-type="other"
        className={cn(
          'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500',
          'focus:outline-none focus:ring-2 focus:ring-brand-500',
          className,
        )}
        {...props}
      />
    )
  },
)
