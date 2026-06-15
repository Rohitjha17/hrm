import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadEnv } from './env'

const env = loadEnv()

/** A Supabase client signed in as the given user — for asserting RLS directly. */
export async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn ${email}: ${error.message}`)
  return client
}

/** Service-role client (bypasses RLS) — for seeding/asserting engine internals. */
export function adminClient(): SupabaseClient {
  return createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
