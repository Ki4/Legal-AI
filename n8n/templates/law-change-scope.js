/**
 * law-change-scope.js
 * L2 — deterministic impact scope + severity for the law-change-impact agent. No LLM.
 *
 * Given the changed articles of a law plus the relevant law_chunks / law_relations rows
 * (as the digest fetches them from Supabase), computes:
 *   - which services are affected, and
 *   - a per-service severity CEILING that is LEGAL, not demand-based (closes the viz-session
 *     note that edge thickness conflated demand with risk).
 *
 * Severity model (max over all paths from the changed article to the service):
 *   - the changed article directly serves the service (its service_slugs)  → high
 *   - reached via a verified `requires` / `overrides` relation              → high
 *   - via `clarifies`                                                       → medium
 *   - via `references`                                                      → low
 * Modulation: if the diff touches no substantive tokens (money / % / dates / terms / subsistence
 *   minimum), soften one step — a wording/structure edit is lower risk than a number change.
 * Only lawyer-verified relations (verified_by set) are traversed — an unverified graph edge
 * never drives an impact claim. The LLM (L3) proposes its own severity but is bounded ABOVE
 * by this ceiling.
 *
 * n8n entry point (paste into Code Node):
 *   const scope = computeImpactScope({
 *     changedArticles: $json.article_diffs.changed_articles,
 *     lawCode:         $json.law_code,
 *     lawChunks:       $json.law_chunks,     // [{ id, law_code, article_num, service_slugs }]
 *     lawRelations:    $json.law_relations,  // [{ from_chunk_id, to_chunk_id, relation_type, verified_by }]
 *     touchesNumbers:  diffTouchesNumbers($json.article_diffs),
 *   });
 *   return [{ json: { ...$json, scope } }];
 */

const SEVERITY_RANK = { low: 1, medium: 2, high: 3 };
const RELATION_CEILING = { requires: 'high', overrides: 'high', clarifies: 'medium', references: 'low' };

// Tokens that make a change legally "substantive" (quantitative / temporal). A diff touching
// none of these is treated as wording/structure → severity softened one step.
const SUBSTANTIVE_RE = /(грн|\d+\s*%|відсотк|\d+\/\d+|\d{2}\.\d{2}\.\d{4}|місяц|\bрок|\bдн[ів]|прожитков|мінімум|неоподатк)/i;

function maxSeverity(a, b) {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}
function softer(sev) {
  return sev === 'high' ? 'medium' : 'low';
}

/** True if any diff hunk line touches a substantive (numeric / temporal) token. */
function diffTouchesNumbers(articleDiffs) {
  if (!articleDiffs || !Array.isArray(articleDiffs.hunks)) return false;
  return articleDiffs.hunks.some((h) =>
    [...(h.removed || []), ...(h.added || [])].some((line) => SUBSTANTIVE_RE.test(String(line))),
  );
}

/**
 * @param {object} args
 * @param {string[]} args.changedArticles
 * @param {string} args.lawCode
 * @param {Array} args.lawChunks       [{ id, law_code, article_num, service_slugs }]
 * @param {Array} args.lawRelations    [{ from_chunk_id, to_chunk_id, relation_type, verified_by }]
 * @param {boolean} [args.touchesNumbers=true]  default true = no softening (safe)
 * @returns {{ services: Array, changed_articles: string[], norms: string[] }}
 */
function computeImpactScope({ changedArticles, lawCode, lawChunks, lawRelations, touchesNumbers = true }) {
  const changed = new Set((changedArticles || []).map(String));
  const chunks = lawChunks || [];
  const relations = (lawRelations || []).filter((r) => r && r.verified_by);

  const changedChunks = chunks.filter((c) => c.law_code === lawCode && changed.has(String(c.article_num)));
  const changedIds = new Set(changedChunks.map((c) => c.id));
  const chunkById = new Map(chunks.map((c) => [c.id, c]));

  const acc = new Map(); // slug → { slug, severity, articles:Set, relations:Set }
  const bump = (slug, severity, articleNum, relation) => {
    if (!slug) return;
    const cur = acc.get(slug) || { slug, severity: 'low', articles: new Set(), relations: new Set() };
    cur.severity = maxSeverity(cur.severity, severity);
    if (articleNum != null) cur.articles.add(String(articleNum));
    if (relation) cur.relations.add(relation);
    acc.set(slug, cur);
  };

  // 1. Direct: the changed article itself serves these services → high.
  for (const c of changedChunks) {
    for (const slug of c.service_slugs || []) bump(slug, 'high', c.article_num, 'direct');
  }

  // 2. Ripple: verified relations incident to a changed chunk → the neighbor's services, at
  //    the relation type's ceiling.
  for (const r of relations) {
    const ceiling = RELATION_CEILING[r.relation_type] || 'low';
    let neighborId = null;
    if (changedIds.has(r.to_chunk_id)) neighborId = r.from_chunk_id;
    else if (changedIds.has(r.from_chunk_id)) neighborId = r.to_chunk_id;
    if (!neighborId) continue;
    const neighbor = chunkById.get(neighborId);
    if (!neighbor) continue;
    for (const slug of neighbor.service_slugs || []) bump(slug, ceiling, neighbor.article_num, r.relation_type);
  }

  const byArticleNum = (a, b) => parseInt(a, 10) - parseInt(b, 10);
  const services = [...acc.values()]
    .map((s) => ({
      slug: s.slug,
      severity: touchesNumbers ? s.severity : softer(s.severity),
      articles: [...s.articles].sort(byArticleNum),
      relations: [...s.relations],
    }))
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.slug.localeCompare(b.slug));

  const norms = [...new Set([...changed, ...services.flatMap((s) => s.articles)])].sort(byArticleNum);
  return { services, changed_articles: [...changed].sort(byArticleNum), norms };
}

// ── Exports (for Node.js testing; ignored in n8n Code Node) ───────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeImpactScope, diffTouchesNumbers };
}
