import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loadEnv } from '../../../scripts/lib/supabase-rest.mjs'

// All paths derive from this file's location, never from process.cwd() —
// MCP clients spawn the server with an arbitrary working directory.
const here = path.dirname(fileURLToPath(import.meta.url))

export const serverRoot = path.resolve(here, '..')
export const repoRoot = path.resolve(serverRoot, '..', '..')
export const outDir = path.join(serverRoot, 'out')

export interface Config {
  supabaseUrl: string
  supabaseKey: string
  groqApiKey: string | null
}

/**
 * Loads secrets from the repo's single secrets file (apps/client/.env.local;
 * already-set env vars win, e.g. in CI) and returns the server config.
 * Throws when Supabase credentials are missing — the server cannot start without a catalog.
 */
export function loadConfig(): Config {
  loadEnv(path.join(repoRoot, 'apps', 'client', '.env.local'))
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? ''
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? ''
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_KEY — expected in apps/client/.env.local or environment variables',
    )
  }
  return {
    supabaseUrl,
    supabaseKey,
    groqApiKey: process.env.GROQ_API_KEY ?? null,
  }
}
