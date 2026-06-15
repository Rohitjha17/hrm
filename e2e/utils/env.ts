import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Read .env.local (written by `npm run env:local`) into a plain object. */
export function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    const raw = readFileSync(path.join(root, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  } catch {
    /* fall back to process.env below */
  }
  return {
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '',
  }
}
