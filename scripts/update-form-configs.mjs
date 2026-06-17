#!/usr/bin/env node
/**
 * Populates services.form_config in Supabase for all services.
 *
 * Run (from repo root, needs tsx to resolve the .ts FormConfig imports):
 *   npx tsx scripts/update-form-configs.mjs
 *
 * Env (apps/client/.env.local): VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY.
 * SUPABASE_SERVICE_KEY is the service_role key (bypasses RLS) — Supabase →
 * Project Settings → API → service_role secret.
 *
 * Uses the shared dependency-free REST client (scripts/lib/supabase-rest.mjs)
 * instead of @supabase/supabase-js, which only lives in apps/client/node_modules
 * and isn't resolvable from a repo-root script (Node walks up from the script's
 * own directory, not apps/client/).
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv, createSupabaseClient } from './lib/supabase-rest.mjs'
import { divorceFormConfig }   from '../apps/client/src/data/divorceFormConfig'
import { mobilizationConfig }  from '../apps/client/src/data/mobilizationConfig'
import { alimonyConfig }       from '../apps/client/src/data/alimonyConfig'
import { businessConfig }      from '../apps/client/src/data/businessConfig'
import { courtSearchConfig }   from '../apps/client/src/data/courtSearchConfig'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
loadEnv(resolve(ROOT, 'apps/client/.env.local'))

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌  Missing env: VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY (apps/client/.env.local)')
  process.exit(1)
}

const { sbPatch } = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const configs = [
  { slug: 'divorce',      config: divorceFormConfig  },
  { slug: 'military',     config: mobilizationConfig },
  { slug: 'alimony',      config: alimonyConfig      },
  { slug: 'business',     config: businessConfig     },
  { slug: 'court_search', config: courtSearchConfig  },
]

async function run() {
  console.log('🔄  Updating form_config for', configs.length, 'services...\n')

  for (const { slug, config } of configs) {
    try {
      await sbPatch('services', `slug=eq.${slug}`, { form_config: config })
      console.log(`✅  ${slug} — updated (${config.steps.length} fields, ${config.tabs.length} tabs)`)
    } catch (error) {
      console.error(`❌  ${slug}: ${error.message}`)
    }
  }

  console.log('\n✔  Done.')
}

run()
