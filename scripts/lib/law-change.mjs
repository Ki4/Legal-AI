/**
 * law-change.mjs — the canonical "a watched law changed" operation.
 *
 * One place that both the manual CLI (scripts/service-lifecycle.mjs) and the automated
 * monitor (scripts/check-law-updates.mjs) call, so the producer of law_change_log rows is
 * single-sourced (no drift between manual and CRON paths). Steps:
 *   1. reverse index — find every service that watches this law (matched by canonical URL,
 *      never by free-text slug — see scripts/law-registry.mjs);
 *   2. append one append-only audit row to law_change_log (action='flagged');
 *   3. flip each dependent service to status='needs_review' and acknowledge the new
 *      revision date in its watched_laws entry (so the same change isn't re-flagged).
 *
 * This is pure data work — no console output. Callers decide how to report.
 */

import { normalizeUrl } from '../law-registry.mjs';

/**
 * @typedef {{ slug: string, title: string, url: string }} Law
 * @typedef {{ sbGet, sbPatch, sbInsert }} SupabaseClient
 */

/**
 * Find services whose watched_laws contain the given law (by canonical URL).
 * @param {Array} services  rows with at least { id, slug, status, watched_laws }
 * @param {Law} law
 */
export function affectedServices(services, law) {
  const key = normalizeUrl(law.url);
  return (services || []).filter((s) =>
    (s.watched_laws || []).some((l) => normalizeUrl(l.url) === key),
  );
}

/**
 * Record a law change and flip dependent services to needs_review.
 *
 * @param {SupabaseClient} client
 * @param {object} opts
 * @param {Law}    opts.law          canonical law (from the registry)
 * @param {string} opts.newDate      new revision date, YYYY-MM-DD
 * @param {string} [opts.oldDate]    previous revision date; derived from watched_laws if omitted
 * @param {'manual'|'cron'} [opts.detectedBy='manual']
 * @param {string} [opts.notes]
 * @param {Array}  [opts.services]   pre-fetched services (avoids a round-trip); fetched if omitted
 * @param {boolean}[opts.dry=false]  when true, performs no writes
 * @returns {Promise<{ affected: Array, derivedOld: string|null, logRow: object|null }>}
 */
export async function applyLawChange(client, opts) {
  const {
    law,
    newDate,
    oldDate = null,
    detectedBy = 'manual',
    notes = null,
    dry = false,
  } = opts;

  const services =
    opts.services || (await client.sbGet('services', 'select=id,slug,status,watched_laws'));

  const affected = affectedServices(services, law);

  // Derive the previous date from the first dependent service if not provided explicitly.
  let derivedOld = oldDate;
  if (!derivedOld) {
    const key = normalizeUrl(law.url);
    for (const s of affected) {
      const hit = (s.watched_laws || []).find((l) => normalizeUrl(l.url) === key);
      if (hit?.last_known_date) {
        derivedOld = hit.last_known_date;
        break;
      }
    }
  }

  if (dry) return { affected, derivedOld, logRow: null };

  // 1. Append the audit row (even with zero dependents — keeps a complete history).
  const [logRow] = await client.sbInsert('law_change_log', {
    law_slug: law.slug,
    law_title: law.title,
    old_revision_date: derivedOld,
    new_revision_date: newDate,
    detected_by: detectedBy,
    affected_services: affected.map((s) => s.slug),
    action: 'flagged',
    notes,
  });

  // 2. Flip each dependent service + acknowledge the new revision date in watched_laws.
  const key = normalizeUrl(law.url);
  for (const s of affected) {
    const next = (s.watched_laws || []).map((l) =>
      normalizeUrl(l.url) === key ? { ...l, last_known_date: newDate } : l,
    );
    await client.sbPatch('services', `id=eq.${s.id}`, {
      status: 'needs_review',
      needs_law_review: true,
      watched_laws: next,
    });
  }

  return { affected, derivedOld, logRow };
}
