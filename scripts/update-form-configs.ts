/**
 * Populates services.form_config in Supabase for all services.
 *
 * Run:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   npx tsx scripts/update-form-configs.ts
 *
 * SUPABASE_SERVICE_KEY is the service_role key (bypasses RLS).
 * Find it in: Supabase → Project Settings → API → service_role secret
 */

import { createClient } from '@supabase/supabase-js'
import { divorceFormConfig }   from '../src/data/divorceFormConfig'
import { mobilizationConfig }  from '../src/data/mobilizationConfig'
import { alimonyConfig }       from '../src/data/alimonyConfig'
import { businessConfig }      from '../src/data/businessConfig'
import { courtSearchConfig }   from '../src/data/courtSearchConfig'

const SUPABASE_URL        = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌  Missing env vars. Run:')
  console.error('   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... npx tsx scripts/update-form-configs.ts')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

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
    const { error } = await supabase
      .from('services')
      .update({ form_config: config })
      .eq('slug', slug)

    if (error) {
      console.error(`❌  ${slug}: ${error.message}`)
    } else {
      console.log(`✅  ${slug} — updated (${config.steps.length} fields, ${config.tabs.length} tabs)`)
    }
  }

  console.log('\n✔  Done.')
}

run()
