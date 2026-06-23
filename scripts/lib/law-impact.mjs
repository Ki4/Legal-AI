/**
 * law-impact.mjs — orchestrates the L1 diff capture for the law-change-impact agent.
 * Glues the (network) fetch of the new revision and the (DB) read of the stored old revision
 * to the pure diff in law-diff.mjs. Kept thin so the pure parts stay testable; the only I/O
 * here is injectable.
 */

import { lawCode } from '../law-registry.mjs';
import { fetchLawText } from './law-text.mjs';
import { buildArticleDiffs } from './law-diff.mjs';

/**
 * Capture the deterministic diff for a changed law. The OLD text is the not-yet-stale stored
 * full text (law_documents.full_text); the NEW text is fetched live from rada. Called by the
 * monitor at detect time, BEFORE applyLawChange flags the law's content is_stale.
 *
 * Fail-soft: any missing piece returns null, and the monitor proceeds exactly as today (flip
 * to needs_review without a diff). Never throws — the diff is a bonus, not a gate.
 *
 * @param {{ sbGet: Function }} client            Supabase REST client
 * @param {{ slug:string, title:string, url:string }} law  canonical law (registry)
 * @param {object} [opts]
 * @param {Function} [opts.fetchText=fetchLawText] injectable fetch (tests)
 * @param {() => string} [opts.now]                injectable clock (tests)
 * @returns {Promise<object|null>} article_diffs payload, or null if old/new text unavailable
 */
export async function captureLawDiff(client, law, opts = {}) {
  const { fetchText = fetchLawText, now } = opts;
  const code = lawCode(law);
  if (!code) return null;

  // Old revision — the stored full text that is still the old revision at this instant.
  let oldText = '';
  try {
    const rows = await client.sbGet(
      'law_documents',
      `select=full_text&law_code=eq.${code}&is_stale=eq.false`,
    );
    oldText = (rows && rows[0] && rows[0].full_text) || '';
  } catch {
    oldText = '';
  }

  // New revision — fetched live from rada.
  let newText = '';
  try {
    newText = await fetchText(law.url);
  } catch {
    newText = '';
  }

  if (!oldText && !newText) return null;
  return buildArticleDiffs({ oldText, newText, lawCode: code, sourceUrl: law.url, now });
}
