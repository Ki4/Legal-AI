/**
 * preview-excerpt.js
 * doc-engine helper — preview-module G2 (#83), #86-critical.
 *
 * `deriveExcerpt(fullDocText, serviceSlug)` returns a SAFE preview excerpt of a
 * generated legal document: the court header + parties + opening circumstances,
 * cut deterministically BEFORE the legal-reasoning / operative part.
 *
 * ── Why this is the actual moat (#86) ───────────────────────────────────────
 * The excerpt physically CANNOT contain the document's legal essence — no
 * statute citations (ст.NNN), no "ПРОШУ", no numbered requests. That absence —
 * NOT the watermark/blur — is what defeats "screenshot → LLM completes the
 * rest". The cut point IS the first statute citation, which is exactly the
 * forbidden-leak pattern, so leakage is impossible by construction: we slice
 * the document at the first citation and keep only what precedes it.
 *
 * ── Fail-closed ─────────────────────────────────────────────────────────────
 * On template drift (no reasoning marker found) or empty/garbage input, the
 * function returns LESS (header + parties only, or '') — NEVER the whole
 * document. A false-positive (cutting too early) only degrades the preview; a
 * false-negative would leak essence, so every ambiguity resolves toward
 * showing less. The drift-guard test (`hasReasoningMarker`) turns red in CI if
 * a future template ever renders without a detectable citation.
 *
 * ── Service-agnostic ────────────────────────────────────────────────────────
 * The cut rule is identical for divorce & alimony — both render as
 *   header → parties → "ПОЗОВНА ЗАЯВА" → circumstances → [first ст.NNN] →
 *   legal reasoning → ПРОШУ → додатки.
 * `serviceSlug` is accepted for API stability / future per-service tuning; the
 * current rule does not need it.
 *
 * Pure, dependency-free — safe to inline into the form-submit Build/Excerpt
 * node via the sync-* pattern (G3).
 */

// First statute citation: "ст.105", "ст. 180", "ст.ст.105". This marks the
// start of the legal-reasoning zone. It is also the negative-test invariant:
// because the cut happens AT the first match, the excerpt is citation-free by
// construction. Case-insensitive errs toward cutting earlier (safe).
const CITATION_RE = /ст\.?\s*\d/i;

// "ПРОШУ" operative header (rendered spaced as "П Р О Ш У"). Belt-and-
// suspenders: in every real document ПРОШУ comes well after the first
// citation, but if a template ever drops citations entirely this still stops
// before the operative part. Uppercase-only so the lowercase "Прошу суд…"
// inside reasoning never matters (it is already past the cut anyway).
const PROSHU_RE = /П\s*Р\s*О\s*Ш\s*У/;

// Positive-safe block prefixes for the fail-closed fallback: the court-address
// header and the two party blocks. Nothing here ever carries legal essence.
const SAFE_BLOCK_RE = /^(До суду|Позивач\s*:|Відповідач\s*:)/;

function normalize(text) {
  return text.replace(/\r\n?/g, '\n');
}

/**
 * Index of the first legal-reasoning marker (citation or ПРОШУ), or -1 if the
 * document contains neither (template drift → caller must fail closed).
 */
function reasoningCutIndex(text) {
  const c = text.search(CITATION_RE);
  const p = text.search(PROSHU_RE);
  if (c === -1) return p;
  if (p === -1) return c;
  return Math.min(c, p);
}

/**
 * Drift guard (used by tests): does the rendered document contain a detectable
 * reasoning marker at all? Every real golden must return true; if a template
 * rename ever removes citations this returns false and CI goes red BEFORE the
 * fail-closed path could silently shrink production previews.
 */
function hasReasoningMarker(text) {
  if (!text || typeof text !== 'string') return false;
  return reasoningCutIndex(normalize(text)) !== -1;
}

/**
 * Fail-closed fallback: keep only leading court-header / party blocks, stop at
 * the first block that is not positively safe. Guarantees no essence even when
 * the reasoning marker is absent.
 */
function safeHeaderOnly(text) {
  const blocks = text.split(/\n{2,}/);
  const kept = [];
  for (const block of blocks) {
    if (SAFE_BLOCK_RE.test(block.trimStart())) {
      kept.push(block.trim());
    } else {
      break;
    }
  }
  return kept.join('\n\n').trim();
}

/**
 * @param {string} fullDocText - the fully rendered document (doc-engine output).
 * @param {string} [serviceSlug] - reserved; current cut rule is service-agnostic.
 * @returns {string} safe excerpt (header + parties + circumstances), never the
 *                   operative part; '' on empty/garbage input.
 */
function deriveExcerpt(fullDocText, serviceSlug) {
  if (!fullDocText || typeof fullDocText !== 'string') return '';
  const text = normalize(fullDocText);

  const cut = reasoningCutIndex(text);
  if (cut === -1) {
    // No reasoning marker: template drift. Never emit the whole document.
    return safeHeaderOnly(text);
  }

  // Trim back to the paragraph boundary BEFORE the marker so a partial
  // paragraph (which could carry the citation) can never leak.
  let excerpt = text.slice(0, cut);
  const lastBreak = excerpt.lastIndexOf('\n\n');
  if (lastBreak !== -1) excerpt = excerpt.slice(0, lastBreak);
  return excerpt.trim();
}

// ── Exports (for Node.js testing; ignored in n8n Code Node) ────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { deriveExcerpt, hasReasoningMarker };
}
