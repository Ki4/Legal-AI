/**
 * law-change-groundedness.js
 * L4a critic — deterministic groundedness for the law-change-impact agent draft. No LLM.
 *
 * Verifies the L3 "what changed" draft against the GROUND TRUTH (the deterministic
 * article_diffs + the L2 scope). Any claim that can't be backed → RED span → abstention (L4c):
 * the digest then withholds the draft (ai_status='abstained') and the lawyer sees the diff only.
 *
 * Checks:
 *   1. each per_service.slug ∈ scope services (allowed_slugs)               → else RED
 *   2. each cited article (per_service.articles + "ст.N" in the prose) ∈
 *      allowed_articles (diff changed_articles ∪ scope.norms)              → else RED
 *   3. each per_service.evidence appears VERBATIM in the diff hunks         → else RED
 *
 * n8n entry point (paste into Code Node):
 *   const result = checkLawChangeGroundedness($json.ai_draft, {
 *     articleDiffs: $json.article_diffs,
 *     scope:        $json.scope,
 *   });
 *   return [{ json: { ...$json, groundedness: result } }];
 *
 * result.has_red === true → abstain.
 */

// "ст.182", "ст. 182", "статті 182", "стаття 182-1" → captures the article number.
const ARTICLE_CITE_RE = /(?:ст\.?|статт[іяею])\s*(\d+(?:-\d+)?)/gi;

/** Flatten every diff hunk line (removed + added) into one searchable corpus. */
function buildDiffCorpus(articleDiffs) {
  if (!articleDiffs || !Array.isArray(articleDiffs.hunks)) return '';
  const lines = [];
  for (const h of articleDiffs.hunks) {
    for (const l of h.removed || []) lines.push(String(l));
    for (const l of h.added || []) lines.push(String(l));
  }
  return lines.join('\n');
}

/** Set of article numbers cited in a free-text string. */
function citedArticles(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(ARTICLE_CITE_RE)) out.add(m[1]);
  return out;
}

function makeSpan(text, type, status, reason) {
  return { text, type, status, reason };
}

/**
 * @param {object} draft  L3 output { summary, per_service:[{slug,articles,hypothesis,evidence}] }
 * @param {object} ctx    { articleDiffs, scope }
 * @returns {{ spans: object[], has_red: boolean, has_amber: boolean }}
 */
function checkLawChangeGroundedness(draft, ctx = {}) {
  const spans = [];
  const d = draft || {};
  const articleDiffs = ctx.articleDiffs || {};
  const scope = ctx.scope || {};

  const allowedSlugs = new Set((scope.services || []).map((s) => s.slug));
  const allowedArticles = new Set([
    ...(articleDiffs.changed_articles || []).map(String),
    ...(scope.norms || []).map(String),
  ]);
  const corpus = buildDiffCorpus(articleDiffs);

  // 1–3: per-service items.
  for (const item of d.per_service || []) {
    if (item.slug && !allowedSlugs.has(item.slug)) {
      spans.push(makeSpan(item.slug, 'service', 'RED',
        `Послуга "${item.slug}" поза scope (L2). Можлива вигадка.`));
    }
    for (const a of item.articles || []) {
      if (!allowedArticles.has(String(a))) {
        spans.push(makeSpan(`ст.${a}`, 'citation', 'RED',
          `Стаття "${a}" поза дозволеним набором (diff ∪ scope). Можлива галюцинація.`));
      }
    }
    if (item.evidence && !corpus.includes(String(item.evidence).trim())) {
      spans.push(makeSpan(item.evidence, 'evidence', 'RED',
        'Цитата-доказ відсутня дослівно в diff. Можлива вигадка.'));
    }
  }

  // 2 (prose): articles cited in summary + each hypothesis must be allowed.
  const proseArticles = citedArticles(d.summary);
  for (const item of d.per_service || []) {
    for (const a of citedArticles(item.hypothesis)) proseArticles.add(a);
  }
  for (const a of proseArticles) {
    if (!allowedArticles.has(a)) {
      spans.push(makeSpan(`ст.${a}`, 'citation', 'RED',
        `Стаття "${a}" у тексті поза дозволеним набором. Можлива галюцинація.`));
    }
  }

  const has_red = spans.some((s) => s.status === 'RED');
  const has_amber = spans.some((s) => s.status === 'AMBER');
  return { spans, has_red, has_amber };
}

// ── Exports (for Node.js testing; ignored in n8n Code Node) ───────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkLawChangeGroundedness };
}
