/**
 * groundedness.js
 * L4a critic — deterministic groundedness check, no LLM.
 *
 * For every number / date / case-number / name in the AI-generated reasoning
 * paragraph, verifies it exists verbatim in L0 (answers).
 * For every legal citation, verifies it belongs to the L2 set (graph retrieval).
 * Any violation → RED span. Suspicious but unverifiable → AMBER.
 *
 * n8n entry point (paste into Code Node):
 *   const result = checkGroundedness(
 *     $json.reasoning_text,          // string — L3 output
 *     $json.answers,                 // object — L0 form answers
 *     $json.l2_article_ids,          // string[] — e.g. ['ст.192 СК', 'ст.182 СК']
 *   );
 *   return [{ json: { ...$json, groundedness: result } }];
 *
 * result.has_red === true → abstain (L4c), use generic fallback.
 */

// ─── Citation pattern ─────────────────────────────────────────────────────────
// Matches: ст.192, ст.192 СК, ст.28 ч.1 ЦПК, п.3 ч.1 ст.5 ЗСЗ, ст.176 ЦПК
const CITATION_RE = /(?:п\.\d+\s+ч\.\d+\s+)?ст\.\s*\d+(?:\s+ч\.\s*\d+)?(?:\s+(?:СК|ЦПК|ЗСЗ|ЦК|ГК|КК))?/g

// Numbers: monetary amounts (грн), fractions (1/4), percentages (25%)
const MONEY_RE    = /\d[\d\s]*(?:[,\.]\d+)?\s*грн/g
const FRACTION_RE = /\d+\/\d+/g
const PERCENT_RE  = /\d+(?:[,\.]\d+)?\s*%/g

// Dates: DD.MM.YYYY or "DD місяць YYYY"
const DATE_RE     = /\d{2}\.\d{2}\.\d{4}/g
const DATE_WORD_RE = /\d{1,2}\s+(?:січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)\s+\d{4}/g

// Case numbers: NN/NNNNN/YY
const CASE_RE     = /\d+\/\d+\/\d+/g

// Ukrainian full names: 3 Ukrainian words starting with capital letters
const NAME_RE     = /[А-ЯЇІЄҐ][а-яїієґ']+(?:\s+[А-ЯЇІЄҐ][а-яїієґ']+){2}/g

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Flatten all string-like values in answers into a single searchable string. */
function buildL0Corpus(answers) {
  return Object.values(answers || {})
    .filter(v => v !== null && v !== undefined)
    .map(v => (Array.isArray(v) ? v.join(' ') : String(v)))
    .join(' ')
}

/** Normalize citation string for set lookup.
 * 'ст. 192 СК' → 'ст.192 СК', 'ст.182' → 'ст.182' */
function normalizeCitation(raw) {
  return raw.replace(/\s+/g, ' ').replace(/ст\.\s+/g, 'ст.').trim()
}

/** Build a Set of normalized citation ids from the L2 list. */
function buildL2Set(l2ArticleIds) {
  return new Set((l2ArticleIds || []).map(normalizeCitation))
}

// ─── Span builder ─────────────────────────────────────────────────────────────

function makeSpan(text, type, status, reason) {
  return { text, type, status, reason }
}

// ─── Main check ───────────────────────────────────────────────────────────────

/**
 * @param {string} reasoningText   - L3 generated reasoning paragraph
 * @param {object} answers         - L0 form answers (all raw values)
 * @param {string[]} l2ArticleIds  - allowed citation IDs from graph retrieval
 * @returns {{ spans: object[], has_red: boolean, has_amber: boolean }}
 */
function checkGroundedness(reasoningText, answers, l2ArticleIds) {
  const text    = reasoningText || ''
  const corpus  = buildL0Corpus(answers)
  const l2Set   = buildL2Set(l2ArticleIds)
  const spans   = []

  // 1. Citations: must be ∈ L2
  const citationMatches = [...text.matchAll(new RegExp(CITATION_RE.source, 'g'))]
  const seenCitations   = new Set()

  for (const m of citationMatches) {
    const raw  = m[0]
    const norm = normalizeCitation(raw)
    if (seenCitations.has(norm)) continue
    seenCitations.add(norm)

    if (!l2Set.has(norm)) {
      // Citation not in L2 — RED (hallucinated or out-of-scope article)
      spans.push(makeSpan(raw, 'citation', 'RED',
        `Цитата "${norm}" відсутня в L2-наборі (GraphRAG). Можлива галюцинація.`))
    }
  }

  // 2. Monetary amounts: must appear in L0 corpus
  for (const m of text.matchAll(new RegExp(MONEY_RE.source, 'g'))) {
    const raw = m[0].trim()
    // Extract just the digits for a looser match (formatting may differ)
    const digits = raw.replace(/[^\d]/g, '')
    if (digits && !corpus.includes(digits)) {
      spans.push(makeSpan(raw, 'amount', 'RED',
        `Сума "${raw}" відсутня у відповідях форми (L0). Можлива галюцинація.`))
    }
  }

  // 3. Fractions (1/4, 1/3, 1/2): must appear in L0 corpus
  for (const m of text.matchAll(new RegExp(FRACTION_RE.source, 'g'))) {
    const raw = m[0].trim()
    if (!corpus.includes(raw)) {
      spans.push(makeSpan(raw, 'fraction', 'RED',
        `Частка "${raw}" відсутня у відповідях форми (L0). Можлива галюцинація.`))
    }
  }

  // 4. Percentages: must appear in L0 corpus (after normalizing "%" / "відсоток")
  for (const m of text.matchAll(new RegExp(PERCENT_RE.source, 'g'))) {
    const raw    = m[0].trim()
    const digits = raw.replace(/[^\d,\.]/g, '')
    if (digits && !corpus.includes(digits) && !corpus.includes(raw)) {
      spans.push(makeSpan(raw, 'percent', 'AMBER',
        `Відсоток "${raw}" не знайдено дослівно у L0. Перевірте.`))
    }
  }

  // 5. Dates: DD.MM.YYYY — must appear in L0 corpus
  for (const m of text.matchAll(new RegExp(DATE_RE.source, 'g'))) {
    const raw = m[0].trim()
    if (!corpus.includes(raw)) {
      // Allow slight format variation (ISO vs Ukrainian)
      const [d, mo, y] = raw.split('.')
      const iso = `${y}-${mo}-${d}`
      if (!corpus.includes(iso) && !corpus.includes(raw)) {
        spans.push(makeSpan(raw, 'date', 'RED',
          `Дата "${raw}" відсутня у відповідях форми (L0). Можлива галюцинація.`))
      }
    }
  }

  // 6. Dates in word form: e.g. "15 березня 2020" — AMBER (hard to check)
  for (const m of text.matchAll(new RegExp(DATE_WORD_RE.source, 'g'))) {
    const raw = m[0].trim()
    // Convert word month to number for L0 check
    const MONTHS = { 'січня':1,'лютого':2,'березня':3,'квітня':4,'травня':5,'червня':6,
                     'липня':7,'серпня':8,'вересня':9,'жовтня':10,'листопада':11,'грудня':12 }
    const parts  = raw.split(/\s+/)
    const d  = parts[0].padStart(2,'0')
    const mo = String(MONTHS[parts[1]] || 0).padStart(2,'0')
    const y  = parts[2]
    const numeric = `${d}.${mo}.${y}`
    const iso     = `${y}-${mo}-${d}`

    if (!corpus.includes(numeric) && !corpus.includes(iso) && !corpus.includes(raw)) {
      spans.push(makeSpan(raw, 'date', 'AMBER',
        `Дата "${raw}" (${numeric}) не знайдена у L0 — перевірте.`))
    }
  }

  // 7. Case numbers: must appear in L0 corpus
  for (const m of text.matchAll(new RegExp(CASE_RE.source, 'g'))) {
    const raw = m[0].trim()
    if (!corpus.includes(raw)) {
      spans.push(makeSpan(raw, 'case_number', 'RED',
        `Номер справи "${raw}" відсутній у відповідях форми (L0). Можлива галюцинація.`))
    }
  }

  // 8. Full names (Прізвище Ім'я По-батькові): must appear in L0 corpus
  for (const m of text.matchAll(new RegExp(NAME_RE.source, 'g'))) {
    const raw = m[0].trim()
    // Skip known safe tokens like court names (will have mixed-case non-name words)
    // Check: all 3 tokens are capitalised Ukrainian words (already guaranteed by regex)
    if (!corpus.includes(raw)) {
      // Looser check: any of the three words present in corpus?
      const parts = raw.split(/\s+/)
      const anyPresent = parts.some(p => corpus.includes(p))
      if (!anyPresent) {
        spans.push(makeSpan(raw, 'name', 'RED',
          `ПІБ "${raw}" відсутнє у відповідях форми (L0). Можлива галюцинація.`))
      } else {
        // Partial match — AMBER (might be a declined form of the right name)
        spans.push(makeSpan(raw, 'name', 'AMBER',
          `ПІБ "${raw}" відмінюється від записаного у L0 — перевірте відмінок.`))
      }
    }
  }

  const has_red   = spans.some(s => s.status === 'RED')
  const has_amber = spans.some(s => s.status === 'AMBER')

  return { spans, has_red, has_amber }
}

// ── Exports (for Node.js testing; ignored in n8n Code Node) ───────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkGroundedness }
}
