/**
 * law-registry.mjs — Canonical law registry (single source of truth for law identity).
 *
 * WHY: the same law (e.g. Family Code) used to be stored under different `slug`s across
 * services' `watched_laws` (e.g. `simeinyi-kodeks` in divorce vs `simejnyj-kodeks` in
 * alimony). A reverse index "law → dependent services" keyed on slug would then MISS
 * services — a legal-safety hole (a changed law would block one service but not another).
 *
 * The canonical identity of a law is its zakon.rada.gov.ua URL. This registry pins, per
 * law, ONE canonical { slug, title, url }. Tooling matches laws by normalized URL, so any
 * future slug drift cannot break the reverse index. `slug` stays a human-friendly label.
 *
 * This is the interim "directory". A normalized `laws` DB table is deferred to v2/GraphRAG
 * (where law nodes live) — see docs/architecture/IMPROVEMENTS.md.
 *
 * Consumers: scripts/service-lifecycle.mjs (validate / normalize / log-law-change).
 */

/** @typedef {{ slug: string, title: string, url: string }} Law */

/** @type {Law[]} */
export const LAWS = [
  {
    slug: 'simeinyi-kodeks',
    title: 'Сімейний кодекс України',
    url: 'https://zakon.rada.gov.ua/laws/show/2947-14',
  },
  {
    slug: 'tsyvilnyi-protsesualnyi-kodeks',
    title: 'Цивільний процесуальний кодекс України',
    url: 'https://zakon.rada.gov.ua/laws/show/1618-15',
  },
  {
    slug: 'pro-sudovyi-zbir',
    title: 'Закон України «Про судовий збір»',
    url: 'https://zakon.rada.gov.ua/laws/show/3674-17',
  },
];

/** Canonical comparison key for a law URL (trailing slash / case / whitespace insensitive). */
export function normalizeUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '').toLowerCase();
}

const byUrl = new Map(LAWS.map((l) => [normalizeUrl(l.url), l]));
const bySlug = new Map(LAWS.map((l) => [l.slug, l]));

export function lawByUrl(url) {
  return byUrl.get(normalizeUrl(url)) || null;
}

/**
 * Derive the rada doc-id code from a law's canonical URL (e.g. '2947-14') — the trailing
 * URL segment, matching `law_chunks.law_code` / `law_documents.law_code` in Supabase.
 */
export function lawCode(law) {
  const normalized = normalizeUrl(law?.url);
  return normalized.split('/').pop() || null;
}

export function lawBySlug(slug) {
  return bySlug.get(slug) || null;
}

/**
 * Resolve a law from a free-form CLI argument: canonical slug, full URL, or a rada doc id
 * fragment (e.g. "2947-14"). Returns the canonical Law or null.
 */
export function resolveLaw(arg) {
  if (!arg) return null;
  if (bySlug.has(arg)) return bySlug.get(arg);
  const byFullUrl = lawByUrl(arg);
  if (byFullUrl) return byFullUrl;
  const frag = String(arg).trim().toLowerCase();
  return LAWS.find((l) => normalizeUrl(l.url).endsWith('/' + frag)) || null;
}
