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
  for (const k of [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]) {
    if (!env[k] && process.env[k]) env[k] = process.env[k] as string
  }
  return env
}
