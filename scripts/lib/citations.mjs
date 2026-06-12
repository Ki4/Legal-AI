/**
 * citations.mjs — pure regex extractor for Ukrainian legal citations in document templates.
 *
 * GraphRAG step 0 (issue #36): turns "law citations baked into template prose" into data —
 * tier-1 trust per DECISIONS "GraphRAG-стек" (explicit references, regex, no review needed).
 *
 * Recognized forms (see n8n/templates/services/*.document.txt for real examples):
 *   - "ч.3 ст.105 СК України"                          → part=3,  article=105
 *   - "п.6 ч.3 ст.175 ЦПК України"                      → point=6, part=3, article=175
 *   - "пп.3 п.1 ч.2 ст.4 Закону України «Про судовий збір»" → subpoint=3, point=1, part=2, article=4
 *   - "ст.112 Сімейного кодексу України" / "ст. 180 Сімейного кодексу України"
 *   - "ст.ст.105, 110, 112 Сімейного Кодексу України"  → articles 105, 110, 112
 *   - "ст.ст. 150, 180–184 СК України"                 → articles 150, 180..184 (range expanded)
 *   - "Сімейного кодексу України (ст. 182-184)"        → law-name-first, paren range
 *
 * Handlebars: {{...}} tags are stripped before matching — citation text lives in the literal
 * branches around/between tags (e.g. an {{#if}}/{{else if}} chain choosing which "п.N ч.1 ст.5"
 * applies), and stripping concatenates those branches so the nearest law name still pairs up.
 * A run of underscores (`________` placeholder blanks) left between a citation and the law
 * name is treated as filler, not a boundary.
 *
 * Output granularity is law + article number (what `services.watched_laws[].articles[]`
 * tracks) — part/point/subpoint are best-effort enrichment, not required for drift checks.
 */

import { resolveLaw } from '../law-registry.mjs';

const SK = resolveLaw('2947-14');
const CPK = resolveLaw('1618-15');
const ZSZ = resolveLaw('3674-17');

if (!SK || !CPK || !ZSZ) {
  throw new Error('citations.mjs: law-registry is missing an expected law (2947-14 / 1618-15 / 3674-17)');
}

/** Recognized citation forms of each law's name, ordered SK → CPK → ZSZ (matches research docs). */
const LAW_NAME_GROUPS = [
  { law: SK, names: ['Сімейного [Кк]одексу України', 'СК України'] },
  { law: CPK, names: ['Цивільного процесуального кодексу України', 'ЦПК України'] },
  { law: ZSZ, names: ['Закону України\\s*«Про судовий збір»'] },
];

const LAW_NAME_ALT = LAW_NAME_GROUPS.flatMap((g) => g.names).join('|');

/** A single article number, optionally a range: "105" or "182-184" / "180–184". */
const ARTICLE_SINGLE = '\\d+(?:\\s*[-–]\\s*\\d+)?';
/** "ст.ст." form: comma-separated list of single-or-range entries: "105, 110, 112" / "150, 180–184". */
const ARTICLE_LIST = `${ARTICLE_SINGLE}(?:\\s*,\\s*${ARTICLE_SINGLE})*`;

/** Optional пп./п./ч. prefixes before "ст." — each captured as digits only. */
const PREFIX = '(?:пп\\.\\s?(?<subpoint>\\d+)\\s*)?(?:п\\.\\s?(?<point>\\d+)\\s*)?(?:ч\\.\\s?(?<part>\\d+)\\s*)?';

/** Filler tolerated between a citation and the law name: whitespace and placeholder underscores. */
const FILLER = '[\\s_]*';

/** Pass A: citation first, law name follows ("ч.3 ст.105 СК України"). */
const CITATION_THEN_LAW_RE = new RegExp(
  `${PREFIX}(?:ст\\.\\s?ст\\.\\s?(?<multi>${ARTICLE_LIST})|ст\\.\\s?(?<single>${ARTICLE_SINGLE}))${FILLER}(?<law>${LAW_NAME_ALT})`,
  'g',
);

/** Pass B: law name first, article in parens ("Сімейного кодексу України (ст. 182-184)"). */
const LAW_THEN_PAREN_RE = new RegExp(
  `(?<law>${LAW_NAME_ALT})\\s*\\(\\s*ст\\.\\s?(?<single>${ARTICLE_SINGLE})\\s*\\)`,
  'g',
);

/** Remove {{...}} tags, concatenating the literal text around/between them. */
function stripHandlebars(text) {
  return text.replace(/\{\{[^}]*\}\}/g, '');
}

/** Expand "105, 110, 112" / "150, 180–184" / "182-184" / "27" into individual article numbers. */
export function expandArticleList(raw) {
  const out = [];
  for (const piece of raw.split(',')) {
    const m = piece.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
    if (!m) continue;
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    for (let n = from; n <= to; n++) out.push(String(n));
  }
  return out;
}

/** Find which registered law a matched name variant belongs to. */
function lawForName(nameText) {
  for (const group of LAW_NAME_GROUPS) {
    if (group.names.some((n) => new RegExp(`^(?:${n})$`).test(nameText))) return group.law;
  }
  return null;
}

/**
 * Extract every citation from template text.
 * @returns {Array<{ raw: string, law: {slug,title,url}, articles: string[],
 *                    part?: string, point?: string, subpoint?: string }>}
 */
export function extractCitations(text) {
  const stripped = stripHandlebars(String(text || ''));
  const out = [];

  for (const m of stripped.matchAll(CITATION_THEN_LAW_RE)) {
    const law = lawForName(m.groups.law);
    if (!law) continue;
    const articles = expandArticleList(m.groups.multi ?? m.groups.single);
    if (!articles.length) continue;
    out.push({
      raw: m[0],
      law,
      articles,
      part: m.groups.part,
      point: m.groups.point,
      subpoint: m.groups.subpoint,
    });
  }

  for (const m of stripped.matchAll(LAW_THEN_PAREN_RE)) {
    const law = lawForName(m.groups.law);
    if (!law) continue;
    const articles = expandArticleList(m.groups.single);
    if (!articles.length) continue;
    out.push({ raw: m[0], law, articles });
  }

  return out;
}

/**
 * Group extracted citations by law, deduplicated, sorted (laws in registry order, articles
 * numerically ascending). This is the "service → articles" shape used for goldens (G2) and
 * the watched_laws drift report (G3).
 * @returns {Array<{ url: string, slug: string, title: string, articles: string[] }>}
 */
export function extractArticlesByLaw(text) {
  const citations = extractCitations(text);
  const byUrl = new Map();
  for (const { law, articles } of citations) {
    if (!byUrl.has(law.url)) byUrl.set(law.url, new Set());
    for (const a of articles) byUrl.get(law.url).add(a);
  }

  const out = [];
  for (const group of LAW_NAME_GROUPS) {
    const set = byUrl.get(group.law.url);
    if (!set || !set.size) continue;
    out.push({
      url: group.law.url,
      slug: group.law.slug,
      title: group.law.title,
      articles: [...set].sort((a, b) => Number(a) - Number(b)),
    });
  }
  return out;
}
