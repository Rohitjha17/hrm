import { z } from 'zod'

/**
 * Frontend environment variables. Only the anon key is ever exposed to the
 * browser — it is RLS-gated and safe to ship. The service-role key must never
 * appear here (no VITE_ prefix), it lives only in Edge Functions / scripts.
 */
const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().min(1, 'VITE_SUPABASE_URL is required'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
})

const result = EnvSchema.safeParse({
  VITE_SUPABASE_URL:
    import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY:
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
})

if (!result.success) {
  // Fail loud and clear instead of crashing later with a cryptic network error.
  console.error('❌ Invalid environment configuration:', result.error.issues)
  throw new Error(
    'Environment validation failed. Copy .env.example to .env.local and run `npm run env:local`.',
  )
}

export const env = result.data
