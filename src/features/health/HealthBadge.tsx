import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/cn'

/**
 * Probes the centralized DB via the `health_check` RPC. Drives a status badge
 * the smoke test asserts on to confirm end-to-end backend connectivity.
 */
export function HealthBadge() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('health_check')
      if (error) throw error
      return data
    },
    refetchInterval: 60_000,
  })

  const status = isLoading ? 'checking' : !isError && data === 'ok' ? 'connected' : 'offline'

  return (
    <span
      data-testid="health-status"
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        status === 'connected' && 'bg-emerald-50 text-emerald-700',
        status === 'checking' && 'bg-slate-100 text-slate-600',
        status === 'offline' && 'bg-red-50 text-red-700',
      )}
    >
      <span
        className={cn(
          'size-2 rounded-full',
          status === 'connected' && 'bg-emerald-500',
          status === 'checking' && 'bg-slate-400',
          status === 'offline' && 'bg-red-500',
        )}
      />
      Backend: {status}
    </span>
  )
}
