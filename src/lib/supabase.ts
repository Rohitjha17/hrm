import { createClient } from '@supabase/supabase-js'
import { env } from './env'
import type { Database } from '@/types/database.types'

/**
 * Single shared Supabase client for the browser. Uses the public anon key,
 * which is RLS-gated — every query is authorized at the database layer.
 */
export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'hrms-auth',
    },
  },
)
