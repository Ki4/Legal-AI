/**
 * seed-alimony-change-laws.mjs
 *
 * Seeds law_chunks for the alimony-change service cluster and inserts
 * law_relations edges defined in specs/features/alimony-change/plan.md §G2.
 *
 * Uses upsert_law_chunk (migration 017) — non-destructive: existing chunks
 * for divorce/alimony keep their service_slugs; 'alimony-change' is merged in.
 * Embeddings are left null — run seed-divorce-laws.ts with --force to fill them.
 *
 * Run:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-alimony-change-laws.mjs
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-alimony-change-laws.mjs --dry-run
 *
 * Requires: migration 017_law_relations.sql applied.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const DRY_RUN              = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌  Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Law cluster for alimony-change ──────────────────────────────────────────

const LAWS = [
  {
    code:           '2947-14',
    title:          'Сімейний кодекс України',
    source_type:    'code',
    authority_weight: 5,
    // Articles relevant to alimony-change per plan.md §G2
    articles:       ['141', '150', '180', '182', '183', '184', '191', '192'],
  },
  {
    code:           '1618-15',
    title:          'Цивільний процесуальний кодекс України',
    source_type:    'code',
    authority_weight: 5,
    articles:       ['27', '28', '174', '175', '176', '177'],
  },
  {
    code:           '3674-17',
    title:          'Закон України «Про судовий збір»',
    source_type:    'law',
    authority_weight: 4,
    articles:       ['4', '5'],
  },
]

// ─── Graph edges (plan.md §G2, ярус 1–2) ─────────────────────────────────────
// Format: { from, to, relation_type, condition?, note? }
// "from" / "to" = { law_code, article_num } resolved to chunk IDs at runtime.
//
// Ярус 3 (exception_if with complex logic) is pending Olga's review (~2026-06-25).

const EDGES = [
  {
    from: { law_code: '2947-14', article_num: 'Стаття 192' },
    to:   { law_code: '2947-14', article_num: 'Стаття 182' },
    relation_type: 'requires',
    note: 'При зміні аліментів суд враховує умови ст.182 (розмір аліментів): відсоток від доходу, прожитковий мінімум, конкретні потреби дитини.',
    verified_by: 'auto',
  },
  {
    from: { law_code: '2947-14', article_num: 'Стаття 192' },
    to:   { law_code: '2947-14', article_num: 'Стаття 183' },
    relation_type: 'clarifies',
    note: 'Ст.183 деталізує спосіб стягнення у частках від доходу — застосовується при alimony_type=percent.',
    verified_by: 'auto',
  },
  {
    from: { law_code: '2947-14', article_num: 'Стаття 192' },
    to:   { law_code: '2947-14', article_num: 'Стаття 184' },
    relation_type: 'clarifies',
    note: 'Ст.184 деталізує стягнення у твердій сумі — застосовується при alimony_type=fixed.',
    verified_by: 'auto',
  },
  {
    // When decreasing alimony: no exemption → pay court fee per ст.4 ЗСЗ.
    // Condition uses machine-readable format matching buildContext field name.
    from: { law_code: '2947-14', article_num: 'Стаття 192' },
    to:   { law_code: '3674-17', article_num: 'Стаття 4' },
    relation_type: 'exception_if',
    condition: "change_direction == 'decrease'",
    note: 'При зменшенні аліментів (платник = позивач) судовий збір сплачується за загальним правилом ст.4 ЗСЗ (1% від ціни позову, але не менше флору).',
    verified_by: 'auto',
  },
  {
    // When increasing alimony: plaintiff is the recipient → exempt per п.3 ч.1 ст.5 ЗСЗ.
    from: { law_code: '2947-14', article_num: 'Стаття 192' },
    to:   { law_code: '3674-17', article_num: 'Стаття 5' },
    relation_type: 'exception_if',
    condition: "change_direction == 'increase'",
    note: 'При збільшенні аліментів (одержувач = позивач) — звільнення від судового збору згідно п.3 ч.1 ст.5 ЗСЗ.',
    verified_by: 'auto',
  },
  {
    // Price of claim must always be calculated and declared per ст.176 ЦПК.
    from: { law_code: '2947-14', article_num: 'Стаття 192' },
    to:   { law_code: '1618-15', article_num: 'Стаття 176' },
    relation_type: 'requires',
    note: 'Ст.176 ЦПК: позовна заява повинна вказувати ціну позову. Для аліментів = |різниця| × 12 місяців.',
    verified_by: 'auto',
  },
  {
    // Increase: plaintiff = alimony recipient → alternative jurisdiction per ст.28 ч.1 ЦПК.
    // Recipient may file at their own address or defendant's — validation.md §G2.
    from: { law_code: '2947-14', article_num: 'Стаття 192' },
    to:   { law_code: '1618-15', article_num: 'Стаття 28' },
    relation_type: 'exception_if',
    condition: "change_direction == 'increase'",
    note: 'При збільшенні (позивач = одержувач аліментів): підсудність за вибором позивача — ст.28 ч.1 ЦПК (місце проживання позивача або відповідача).',
    verified_by: 'auto',
  },
  {
    // Decrease: plaintiff = payer → general jurisdiction per ст.27 ЦПК.
    // Payer has no alternative jurisdiction choice — files at defendant's address.
    from: { law_code: '2947-14', article_num: 'Стаття 192' },
    to:   { law_code: '1618-15', article_num: 'Стаття 27' },
    relation_type: 'exception_if',
    condition: "change_direction == 'decrease'",
    note: 'При зменшенні (позивач = платник аліментів): загальна підсудність — ст.27 ЦПК (місце проживання відповідача).',
    verified_by: 'auto',
  },
]

// ─── Parser (zakon.rada.gov.ua /print) ───────────────────────────────────────

async function fetchLawHtml(code) {
  const url = `https://zakon.rada.gov.ua/laws/show/${code}/print`
  console.log(`  📥 Fetching ${url}`)
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LegalAI-Bot/1.0)',
      'Accept-Language': 'uk,en;q=0.9',
    },
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`)
  return resp.text()
}

function extractVersionDate(html) {
  const patterns = [
    /Редакція від (\d{2}\.\d{2}\.\d{4})/,
    /станом на (\d{2}\.\d{2}\.\d{4})/,
    /від (\d{2}\.\d{2}\.\d{4})/,
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) {
      const [d, m, y] = match[1].split('.')
      return `${y}-${m}-${d}`
    }
  }
  return new Date().toISOString().split('T')[0]
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseArticles(html, relevantNums) {
  const articles = []

  // Primary parser: zakon.rada.gov.ua /print HTML structure
  const articleStartRegex = /<span class=rvts\d+>Стаття\s+(\d+)[.\s]<\/span>\s*(.*?)<\/p>/g
  const starts = []
  let m
  while ((m = articleStartRegex.exec(html)) !== null) {
    const num = m[1]
    const rawTitle = m[2].replace(/<[^>]+>/g, '').trim()
    starts.push({ num, title: rawTitle, pos: m.index })
  }

  for (let i = 0; i < starts.length; i++) {
    const { num, title, pos } = starts[i]
    if (!relevantNums.includes(num)) continue

    const endPos = i + 1 < starts.length ? starts[i + 1].pos : html.length
    const chunk  = html.slice(pos, endPos)
    const text   = stripHtml(chunk)
      .replace(/^\s*Стаття\s+\d+[.\s]*/m, '')
      .trim()

    if (!text || text.length < 20) continue

    const fullContent = title
      ? `Стаття ${num}. ${title}\n\n${text}`
      : `Стаття ${num}\n\n${text}`

    articles.push({
      article_num:   `Стаття ${num}`,
      article_title: title,
      content:       fullContent.slice(0, 4000),
    })
  }

  if (articles.length === 0) {
    return parseArticlesFallback(stripHtml(html), relevantNums)
  }
  return articles
}

function parseArticlesFallback(text, relevantNums) {
  const articles = []
  const lines    = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line     = lines[i].trim()
    const numMatch = line.match(/^Стаття\s+(\d+)/)
    if (!numMatch) continue
    const num = numMatch[1]
    if (!relevantNums.includes(num)) continue

    const contentLines = [line]
    let j = i + 1
    while (j < lines.length && !lines[j].trim().match(/^Стаття\s+\d+/)) {
      if (lines[j].trim()) contentLines.push(lines[j].trim())
      j++
      if (j - i > 500) break
    }

    const fullContent = contentLines.join('\n').trim()
    if (fullContent.length < 20) continue

    const titleMatch = line.match(/^Стаття\s+\d+\.\s+(.+)/)
    articles.push({
      article_num:   `Стаття ${num}`,
      article_title: titleMatch?.[1]?.trim() ?? '',
      content:       fullContent.slice(0, 4000),
    })
  }

  return articles
}

// ─── Chunk seeding ────────────────────────────────────────────────────────────

async function seedChunks(lawConfig, versionDate) {
  const html     = await fetchLawHtml(lawConfig.code)
  const date     = versionDate ?? extractVersionDate(html)
  const articles = parseArticles(html, lawConfig.articles)

  console.log(`  📝 Parsed ${articles.length}/${lawConfig.articles.length} articles (version: ${date})`)

  const results = { inserted: 0, updated: 0, failed: 0, ids: {} }

  for (const article of articles) {
    const chunk = {
      source_type:      lawConfig.source_type,
      law_code:         lawConfig.code,
      law_title:        lawConfig.title,
      article_num:      article.article_num,
      article_title:    article.article_title,
      content:          article.content,
      authority_weight: lawConfig.authority_weight,
      service_slugs:    ['alimony-change'],
      law_version_date: date,
      embedding:        null,  // filled by embedding script later
    }

    process.stdout.write(`     ${article.article_num}... `)

    if (DRY_RUN) {
      console.log('(dry-run)')
      results.ids[`${lawConfig.code}:${article.article_num}`] = null
      continue
    }

    const { data, error } = await supabase.rpc('upsert_law_chunk', { p_chunk: chunk })

    if (error) {
      console.log(`❌ ${error.message}`)
      results.failed++
    } else {
      console.log(`✓ (id: ${data})`)
      results.ids[`${lawConfig.code}:${article.article_num}`] = data
      // We can't distinguish insert vs update from the RPC return alone, so count as updated
      results.updated++
    }
  }

  return results
}

// ─── Chunk ID lookup ──────────────────────────────────────────────────────────

async function lookupChunkId(lawCode, articleNum) {
  const { data, error } = await supabase
    .from('law_chunks')
    .select('id')
    .eq('law_code', lawCode)
    .eq('article_num', articleNum)
    .single()

  if (error || !data) {
    throw new Error(`Chunk not found: ${lawCode} / ${articleNum} — run seeding first`)
  }
  return data.id
}

// ─── Edge seeding ─────────────────────────────────────────────────────────────

async function seedEdges() {
  console.log('\n🔗 Seeding law_relations edges...')
  let ok = 0; let fail = 0

  for (const edge of EDGES) {
    const label = `${edge.from.article_num} → ${edge.to.article_num} (${edge.relation_type})`
    process.stdout.write(`  ${label}... `)

    if (DRY_RUN) {
      console.log('(dry-run)')
      continue
    }

    let fromId, toId
    try {
      fromId = await lookupChunkId(edge.from.law_code, edge.from.article_num)
      toId   = await lookupChunkId(edge.to.law_code,   edge.to.article_num)
    } catch (err) {
      console.log(`❌ lookup failed: ${err.message}`)
      fail++
      continue
    }

    const relation = {
      from_chunk_id: fromId,
      to_chunk_id:   toId,
      relation_type: edge.relation_type,
      condition:     edge.condition ?? null,
      note:          edge.note ?? null,
      verified_by:   edge.verified_by ?? null,
      confidence:    1.0,
      created_by:    'auto',
    }

    const { data, error } = await supabase.rpc('upsert_law_relation', { p_relation: relation })

    if (error) {
      console.log(`❌ ${error.message}`)
      fail++
    } else {
      console.log(`✓ (id: ${data})`)
      ok++
    }
  }

  console.log(`\n  Relations: ${ok} ok, ${fail} failed`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🚀  seed-alimony-change-laws.mjs${DRY_RUN ? ' [DRY RUN]' : ''}\n`)

  // 1. Seed law_chunks for each law in the cluster
  for (const lawConfig of LAWS) {
    console.log(`\n📖  ${lawConfig.title} (${lawConfig.code})`)
    console.log(`    Articles: ${lawConfig.articles.join(', ')}`)
    try {
      const results = await seedChunks(lawConfig)
      console.log(`  ✅ Done: ${results.updated} chunks upserted, ${results.failed} failed`)
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`)
    }
  }

  // 2. Seed law_relations edges
  if (!DRY_RUN) {
    await seedEdges()
  } else {
    console.log('\n🔗 Would seed law_relations edges (dry-run — skipped):')
    for (const e of EDGES) {
      console.log(`  ${e.from.article_num} → ${e.to.article_num} (${e.relation_type})${e.condition ? ` [if: ${e.condition}]` : ''}`)
    }
  }

  // 3. Summary
  console.log('\n📊  Cluster summary:')
  if (!DRY_RUN) {
    const { data: chunks } = await supabase
      .from('law_chunks')
      .select('law_code, article_num')
      .contains('service_slugs', ['alimony-change'])
      .order('law_code')

    if (chunks) {
      const byLaw = {}
      for (const c of chunks) {
        byLaw[c.law_code] = (byLaw[c.law_code] ?? [])
        byLaw[c.law_code].push(c.article_num)
      }
      for (const [code, articles] of Object.entries(byLaw)) {
        console.log(`   ${code}: ${articles.join(', ')}`)
      }
    }

    const { count } = await supabase
      .from('law_relations')
      .select('*', { count: 'exact', head: true })
    console.log(`   law_relations: ${count} total edges`)
  }

  console.log('\n✔️  Done!')
  console.log('\nNext: run embedding script to fill null embeddings:')
  console.log('  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... GEMINI_API_KEY=... npx tsx scripts/seed-divorce-laws.ts --force')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
