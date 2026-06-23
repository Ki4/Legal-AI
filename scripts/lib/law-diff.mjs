/**
 * law-diff.mjs — deterministic, dependency-free diff of two law revisions. Pure functions,
 * no I/O, no LLM. Produces the `article_diffs` ground truth for the law-change-impact agent
 * (requirements §2): the factual record of what changed, shown to the lawyer even when the
 * AI abstains.
 *
 *   - diffLines(oldLines, newLines)  — LCS line diff with a size guard.
 *   - buildArticleDiffs({ ... })     — the jsonb payload: prefers per-article hunks (when
 *                                      both sides split into articles), else a law-level diff.
 */

import { extractArticles } from './law-text.mjs';

const MAX_DIFF_LINES = 4000;     // LCS guard: above this, fall back to a coarse remove+add diff
const MAX_HUNKS_BYTES = 32_000;  // storage cap for article_diffs (requirements §2: truncated flag)

/** Split text into trimmed, non-empty lines (stable input for diffing). */
const splitLines = (t) => String(t || '').split('\n').map((l) => l.trim()).filter(Boolean);

/**
 * Classic LCS line diff → ordered ops, each { op:'same'|'add'|'remove', line }.
 * Guards against pathological sizes (whole-code fallback) by bailing to a block diff.
 *
 * @returns {{ ops: {op:string,line:string}[], coarse: boolean }}
 */
export function diffLines(oldLines, newLines) {
  const a = oldLines;
  const b = newLines;
  if (a.length > MAX_DIFF_LINES || b.length > MAX_DIFF_LINES) {
    // Too large for an O(n*m) table — emit a coarse block diff (all removed, then all added).
    return {
      ops: [...a.map((line) => ({ op: 'remove', line })), ...b.map((line) => ({ op: 'add', line }))],
      coarse: true,
    };
  }
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ op: 'same', line: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ op: 'remove', line: a[i] }); i++; }
    else { ops.push({ op: 'add', line: b[j] }); j++; }
  }
  while (i < n) ops.push({ op: 'remove', line: a[i++] });
  while (j < m) ops.push({ op: 'add', line: b[j++] });
  return { ops, coarse: false };
}

/** Reduce line ops to a single changed-only hunk for one article (or null if unchanged). */
function opsToHunk(articleNum, ops) {
  const removed = ops.filter((o) => o.op === 'remove').map((o) => o.line);
  const added = ops.filter((o) => o.op === 'add').map((o) => o.line);
  if (removed.length === 0 && added.length === 0) return null;
  const op = removed.length && added.length ? 'changed' : added.length ? 'added' : 'removed';
  return { article_num: articleNum, op, removed, added };
}

/**
 * Build the article_diffs jsonb payload (requirements §2).
 *
 * @param {object} args
 * @param {string} args.oldText        old (stored) revision text
 * @param {string} args.newText        new (fetched) revision text
 * @param {string|null} [args.lawCode] rada doc-id, e.g. '2947-14'
 * @param {string|null} [args.sourceUrl]
 * @param {() => string} [args.now]    injectable clock (tests)
 * @returns {{ level, law_code, changed_articles, hunks, source_url, captured_at, truncated }}
 */
export function buildArticleDiffs({
  oldText,
  newText,
  lawCode = null,
  sourceUrl = null,
  now = () => new Date().toISOString(),
}) {
  const oldArts = extractArticles(oldText);
  const newArts = extractArticles(newText);
  const perArticle = Object.keys(oldArts).length > 0 && Object.keys(newArts).length > 0;

  let hunks = [];
  let level;
  if (perArticle) {
    level = 'article';
    const nums = [...new Set([...Object.keys(oldArts), ...Object.keys(newArts)])].sort(
      (x, y) => parseInt(x, 10) - parseInt(y, 10),
    );
    for (const num of nums) {
      const o = oldArts[num] ?? '';
      const nw = newArts[num] ?? '';
      if (o === nw) continue;
      const hunk = opsToHunk(num, diffLines(splitLines(o), splitLines(nw)).ops);
      if (hunk) hunks.push(hunk);
    }
  } else {
    level = 'law';
    const hunk = opsToHunk(null, diffLines(splitLines(oldText), splitLines(newText)).ops);
    if (hunk) hunks = [hunk];
  }

  // Storage cap → truncated flag. The lawyer can always verify the full diff at source_url.
  let truncated = false;
  while (Buffer.byteLength(JSON.stringify(hunks), 'utf8') > MAX_HUNKS_BYTES && hunks.length > 0) {
    hunks.pop();
    truncated = true;
  }

  return {
    level,
    law_code: lawCode,
    changed_articles: hunks.map((h) => h.article_num).filter((a) => a != null),
    hunks,
    source_url: sourceUrl,
    captured_at: now(),
    truncated,
  };
}
