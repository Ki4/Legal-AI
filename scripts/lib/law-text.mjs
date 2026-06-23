/**
 * law-text.mjs — fetch the FULL text of a law from zakon.rada.gov.ua and split it into
 * articles. Companion to rada.mjs (which reads only the revision date). Used by the
 * law-change-impact agent (L1) to diff a new revision against the stored old text.
 *
 * Layers (each independently testable):
 *   - htmlToText(html)        — pure: strip tags/entities, block tags → newlines.
 *   - extractArticles(text)   — pure: split plain text into { "182": "<text>" } by
 *                               "Стаття N" headers. Returns {} on unfamiliar layout.
 *   - fetchLawText(url, opts) — fetch the main page + return its plain text. Reuses the
 *                               polite retry/backoff from rada.mjs.
 *
 * Scraping rada HTML is fragile, so the parser is kept pure and hardened against fixtures
 * with no network. When extraction returns {} the caller falls back to a law-level diff
 * (see law-diff.mjs) — better a reliable whole-text diff than a brittle per-article guess.
 */

import { fetchWithRetry, toMainPageUrl } from './rada.mjs';

const NAMED_ENTITIES = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&laquo;': '«', '&raquo;': '»', '&mdash;': '—', '&ndash;': '–',
};

/** Strip HTML to readable plain text: drop script/style, turn block tags into newlines. */
export function htmlToText(html) {
  if (!html || typeof html !== 'string') return '';
  let s = html;
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  // Close of a block element / <br> → newline, so article headers land on their own lines.
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' '); // drop remaining tags
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  for (const [ent, ch] of Object.entries(NAMED_ENTITIES)) s = s.split(ent).join(ch);
  s = s.replace(/[ \t ]+/g, ' ');                              // collapse inline whitespace
  s = s.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/\n{3,}/g, '\n\n'); // tidy newlines
  return s.trim();
}

/**
 * Split a law's plain text into a map of article number → article text.
 * Header form on rada: "Стаття 182. Обставини, які враховуються судом ..." (number then dot).
 * Returns {} if no article headers are found (caller falls back to a whole-text diff).
 */
export function extractArticles(text) {
  const out = {};
  if (!text || typeof text !== 'string') return out;
  // "Стаття <num>" at the start of a line; capture the number + text until the next header.
  const headerRe = /(^|\n)[ \t]*Стаття\s+(\d+(?:-\d+)?)\b/g;
  const marks = [];
  let m;
  while ((m = headerRe.exec(text)) !== null) {
    marks.push({ num: m[2], start: m.index + m[1].length });
  }
  for (let i = 0; i < marks.length; i++) {
    const from = marks[i].start;
    const to = i + 1 < marks.length ? marks[i + 1].start : text.length;
    out[marks[i].num] = text.slice(from, to).trim();
  }
  return out;
}

/**
 * Fetch a law page and return its plain text (full document).
 * Accepts the same opts as fetchWithRetry (retries / backoff / sleepImpl / onRetry / fetchImpl).
 *
 * @param {string} url
 * @param {object} [opts]
 * @returns {Promise<string>} plain text of the law page
 */
export async function fetchLawText(url, opts = {}) {
  const mainUrl = toMainPageUrl(url);
  const resp = await fetchWithRetry(mainUrl, opts);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${mainUrl}`);
  return htmlToText(await resp.text());
}
