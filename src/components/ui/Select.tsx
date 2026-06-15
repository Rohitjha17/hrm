import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900',
          'focus:outline-none focus:ring-2 focus:ring-brand-500',
          'disabled:bg-slate-50 disabled:text-slate-500',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    )
  },
)
