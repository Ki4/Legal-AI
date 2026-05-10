/**
 * seed-divorce-laws.ts
 * Парсить статті законів з zakon.rada.gov.ua,
 * векторизує через Google text-embedding-004,
 * зберігає в Supabase pgvector.
 *
 * Run:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... GEMINI_API_KEY=... npx tsx scripts/seed-divorce-laws.ts
 */

import { createClient } from '@supabase/supabase-js'

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL        = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const GEMINI_API_KEY      = process.env.GEMINI_API_KEY!
// --force: ігнорувати кеш версії і переписати всі дані
const FORCE_RESEED        = process.argv.includes('--force')

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_API_KEY) {
  console.error('❌  Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Які закони парсити ────────────────────────────────────────────────────────

interface LawConfig {
  code: string
  title: string
  source_type: 'code' | 'law' | 'regulation' | 'court' | 'clarification'
  authority_weight: number
  service_slugs: string[]
  // Які статті брати — null = всі статті закону
  relevant_articles: string[] | null
}

const DIVORCE_LAWS: LawConfig[] = [
  {
    code: '2947-14',
    title: 'Сімейний кодекс України',
    source_type: 'code',
    authority_weight: 5,
    service_slugs: ['divorce', 'alimony'],
    // Статті про розірвання шлюбу + аліменти
    relevant_articles: ['95', '96', '99', '100', '105', '106', '107', '109', '110', '111', '112', '113', '141', '180', '181', '182'],
  },
  {
    code: '1618-15',
    title: 'Цивільний процесуальний кодекс України',
    source_type: 'code',
    authority_weight: 5,
    service_slugs: ['divorce', 'alimony', 'court_search'],
    // Підсудність, зміст позовної заяви, прийняття, спрощене провадження
    relevant_articles: ['27', '28', '175', '176', '177', '178', '187', '188', '274', '279'],
  },
  {
    code: '3674-17',
    title: 'Закон України "Про судовий збір"',
    source_type: 'law',
    authority_weight: 4,
    service_slugs: ['divorce', 'alimony', 'court_search'],
    // Розміри, пільги
    relevant_articles: ['4', '5'],
  },
]

// ─── Парсер zakon.rada.gov.ua ─────────────────────────────────────────────────

interface ParsedArticle {
  article_num: string    // 'Стаття 110'
  article_title: string  // 'Право на пред'явлення позову...'
  content: string        // текст для ембедингу (обрізаний до 4000 символів)
  full_content: string   // повний текст без обрізки (для відображення)
}

async function fetchLawHtml(code: string): Promise<string> {
  // /print — повна версія закону з усім текстом (на відміну від /page — shell без тексту)
  const url = `https://zakon.rada.gov.ua/laws/show/${code}/print`
  console.log(`  📥 Fetching: ${url}`)

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LegalAI-Bot/1.0)',
      'Accept-Language': 'uk,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml',
    },
  })

  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`)
  return resp.text()
}

function extractVersionDate(html: string): string {
  // Шукаємо "Редакція від DD.MM.YYYY" або "станом на DD.MM.YYYY"
  const patterns = [
    /Редакція від (\d{2}\.\d{2}\.\d{4})/,
    /станом на (\d{2}\.\d{2}\.\d{4})/,
    /від (\d{2}\.\d{2}\.\d{4})/,
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) {
      // Convert DD.MM.YYYY → YYYY-MM-DD
      const [d, m, y] = match[1].split('.')
      return `${y}-${m}-${d}`
    }
  }
  // Fallback: сьогодні
  return new Date().toISOString().split('T')[0]
}

function stripHtml(html: string): string {
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

function parseArticles(html: string, relevantNums: string[] | null): ParsedArticle[] {
  const articles: ParsedArticle[] = []

  // zakon.rada.gov.ua /print структура:
  // <span class=rvts9>Стаття 110.</span> Назва статті</p>
  // <p class=rvps2>1. Текст...</p>
  // <p class=rvps2>2. Текст...</p>
  // <span class=rvts9>Стаття 111.</span> ...

  // Знаходимо всі статті через HTML-парсинг
  const articleStartRegex = /<span class=rvts\d+>Стаття\s+(\d+)[.\s]<\/span>\s*(.*?)<\/p>/g

  // Збираємо позиції початку кожної статті
  const starts: Array<{ num: string; title: string; pos: number }> = []
  let m: RegExpExecArray | null
  while ((m = articleStartRegex.exec(html)) !== null) {
    const num = m[1]
    const rawTitle = m[2].replace(/<[^>]+>/g, '').trim()
    starts.push({ num, title: rawTitle, pos: m.index })
  }

  for (let i = 0; i < starts.length; i++) {
    const { num, title, pos } = starts[i]

    if (relevantNums && !relevantNums.includes(num)) continue

    // Беремо HTML від початку цієї статті до початку наступної
    const endPos = i + 1 < starts.length ? starts[i + 1].pos : html.length
    const chunk = html.slice(pos, endPos)

    // Витягуємо текст (strips HTML tags)
    const text = stripHtml(chunk)
      .replace(/^\s*Стаття\s+\d+[.\s]*/m, '') // прибрати дублюючий заголовок
      .trim()

    if (!text || text.length < 20) continue

    const fullContent = title
      ? `Стаття ${num}. ${title}\n\n${text}`
      : `Стаття ${num}\n\n${text}`

    articles.push({
      article_num:   `Стаття ${num}`,
      article_title: title,
      full_content:  fullContent,              // повний текст без обрізки
      content:       fullContent.slice(0, 4000), // обрізаний для ембедингу
    })
  }

  if (articles.length === 0) {
    console.warn(`  ⚠️  HTML-парсер не знайшов статей. Спробую текстовий fallback...`)
    return parseArticlesFallback(stripHtml(html), relevantNums ?? [])
  }

  return articles
}

// Fallback: простіший парсер якщо основний не спрацював
function parseArticlesFallback(text: string, relevantNums: string[]): ParsedArticle[] {
  const articles: ParsedArticle[] = []
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const numMatch = line.match(/^Стаття\s+(\d+)/)
    if (!numMatch) continue

    const num = numMatch[1]
    if (relevantNums.length > 0 && !relevantNums.includes(num)) continue

    // Зібрати текст статті до наступної статті (без обмеження рядків)
    const contentLines: string[] = [line]
    let j = i + 1
    while (j < lines.length && !lines[j].trim().match(/^Стаття\s+\d+/)) {
      if (lines[j].trim()) contentLines.push(lines[j].trim())
      j++
      if (j - i > 500) break // захист від нескінченного циклу (збільшено з 100)
    }

    const fullContent = contentLines.join('\n').trim()
    if (fullContent.length < 20) continue

    // Витягнути заголовок статті (текст після "Стаття N.")
    const titleMatch = line.match(/^Стаття\s+\d+\.\s+(.+)/)

    articles.push({
      article_num:   `Стаття ${num}`,
      article_title: titleMatch?.[1]?.trim() || '',
      full_content:  fullContent,              // повний текст
      content:       fullContent.slice(0, 4000), // обрізаний для ембедингу
    })
  }

  return articles
}

// ─── Gemini Embedding API ─────────────────────────────────────────────────────

async function embedText(text: string): Promise<number[]> {
  // gemini-embedding-001 = стабільна модель (768 вимірів)
  // Безкоштовна, підтримує українську, сумісна з ivfflat індексом (<2000 dims)
  const model = 'gemini-embedding-001'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${GEMINI_API_KEY}`

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: 768,  // зменшити з 3072 до 768 для ivfflat сумісності
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Gemini API error ${resp.status}: ${err}`)
  }

  const data = await resp.json() as { embedding: { values: number[] } }
  return data.embedding.values
}

// ─── Supabase: збереження ─────────────────────────────────────────────────────

async function saveChunks(
  lawConfig: LawConfig,
  articles: ParsedArticle[],
  versionDate: string,
): Promise<void> {
  const chunks = articles.map(a => ({
    source_type:      lawConfig.source_type,
    law_title:        lawConfig.title,
    article_num:      a.article_num,
    article_title:    a.article_title,
    content:          a.content,       // обрізаний до 4000 для ембедингу
    full_content:     a.full_content,  // повний текст для відображення/keyword search
    authority_weight: lawConfig.authority_weight,
    service_slugs:    lawConfig.service_slugs,
    law_version_date: versionDate,
    embedding:        null, // заповниться нижче
  }))

  // Embed кожну статтю (з затримкою щоб не перевищити ліміт API)
  console.log(`  🔢 Embedding ${chunks.length} articles...`)
  for (let i = 0; i < chunks.length; i++) {
    const article = articles[i]
    process.stdout.write(`     [${i + 1}/${chunks.length}] ${article.article_num}... `)
    chunks[i].embedding = await embedText(article.content) as unknown as null
    console.log('✓')
    if (i < chunks.length - 1) await sleep(200) // rate limit
  }

  // Атомарне збереження через RPC
  console.log(`  💾 Saving to Supabase via replace_law_chunks...`)
  const { data, error } = await supabase.rpc('replace_law_chunks', {
    p_law_code: lawConfig.code,
    p_chunks:   chunks,
  })

  if (error) throw new Error(`Supabase RPC error: ${error.message}`)

  const result = data as { deleted: number; inserted: number }
  console.log(`  ✅ Done: deleted ${result.deleted} old, inserted ${result.inserted} new chunks`)
}

// ─── Supabase: зберегти повний текст закону ───────────────────────────────────

async function saveLawDocument(
  lawConfig: LawConfig,
  articles: ParsedArticle[],
  versionDate: string,
): Promise<void> {
  // Склеїти всі статті в один текст для FTS і перегляду
  const fullText = articles
    .map(a => a.full_content)
    .join('\n\n---\n\n')

  const { error } = await supabase.rpc('upsert_law_document', {
    p_law_code:        lawConfig.code,
    p_law_title:       lawConfig.title,
    p_source_type:     lawConfig.source_type,
    p_authority_weight: lawConfig.authority_weight,
    p_full_text:       fullText,
    p_version_date:    versionDate,
    p_article_count:   articles.length,
  })

  if (error) throw new Error(`Supabase upsert_law_document error: ${error.message}`)
  console.log(`  📄 Law document saved (${fullText.length} chars, ${articles.length} articles)`)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀  seed-divorce-laws.ts — старт\n')

  for (const lawConfig of DIVORCE_LAWS) {
    console.log(`\n📖  ${lawConfig.title} (${lawConfig.code})`)
    console.log(`    Шукаємо статті: ${lawConfig.relevant_articles?.join(', ') ?? 'всі'}`)

    try {
      // 1. Завантажити HTML
      const html = await fetchLawHtml(lawConfig.code)

      // 2. Витягнути версію
      const versionDate = extractVersionDate(html)
      console.log(`  📅 Версія закону: ${versionDate}`)

      // 3. Перевірити чи вже є актуальна версія в БД
      const { data: existing } = await supabase
        .from('law_chunks')
        .select('law_version_date')
        .eq('law_code', lawConfig.code)
        .limit(1)
        .single()

      if (existing?.law_version_date === versionDate && !FORCE_RESEED) {
        console.log(`  ⏭️  Пропускаємо — версія ${versionDate} вже є в БД (--force щоб переписати)`)
        continue
      }
      if (FORCE_RESEED && existing) {
        console.log(`  🔄 --force: переписуємо наявні дані`)
      }

      // 4. Парсити статті (всі статті для law_documents, тільки relevant для chunks)
      const allArticles = parseArticles(html, null) // всі статті закону
      const relevantArticles = lawConfig.relevant_articles
        ? allArticles.filter(a => lawConfig.relevant_articles!.includes(a.article_num.replace('Стаття ', '')))
        : allArticles
      console.log(`  📝 Знайдено статей: ${allArticles.length} всього, ${relevantArticles.length} релевантних`)

      if (relevantArticles.length === 0) {
        console.warn(`  ⚠️  Жодної релевантної статті не знайдено! Перевірте парсер або список статей.`)
        console.warn(`  💡 Tip: збережіть HTML і перевірте вручну:`)
        console.warn(`         curl -L "https://zakon.rada.gov.ua/laws/show/${lawConfig.code}/print" > /tmp/law.html`)
        continue
      }

      // 5. Зберегти повний текст закону (для перегляду і keyword search)
      await saveLawDocument(lawConfig, allArticles, versionDate)

      // 6. Embed + зберегти релевантні чанки (для векторного пошуку в RAG)
      await saveChunks(lawConfig, relevantArticles, versionDate)

      // Пауза між законами
      await sleep(1000)

    } catch (err) {
      console.error(`  ❌ Помилка для ${lawConfig.code}:`, err)
    }
  }

  // ─── Фінальна статистика ──────────────────────────────────────────────────
  console.log('\n📊  Статистика в БД:')
  const { data: stats } = await supabase.rpc('get_law_versions')
  if (stats) {
    for (const row of stats as Array<{ law_code: string; law_title: string; law_version_date: string; chunk_count: number }>) {
      console.log(`   ${row.law_code}  ${row.law_title}`)
      console.log(`   └─ версія: ${row.law_version_date}, чанків: ${row.chunk_count}`)
    }
  }

  console.log('\n✔️  Готово!')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
