// dedup-update.js — idempotent-webhook helper (IMPROVEMENTS #83)
//
// Telegram RE-DELIVERS an update if it doesn't get a fast 200 (e.g. during a
// transient error like session 39's 500), which causes the SAME message to be
// processed twice. This is the pure dedup core: it keeps a small in-memory map
// of recently-seen update_id → timestamp and reports whether an update is a
// duplicate. The n8n Code node wires `store` to `$getWorkflowStaticData('global')`
// so the map survives across executions.
//
// Pure + side-effecting only on the passed-in `store` object, so it's unit
// testable without n8n. A blind Wait does NOT dedup — it only delays the same
// (or a second) execution; this actually drops the duplicate.

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 min — well past Telegram's retry window

/**
 * @param {Record<string, number>} store  mutable map: updateId → epoch-ms first seen
 * @param {number|string|null|undefined} updateId  Telegram update_id
 * @param {number} now  current epoch-ms (Date.now())
 * @param {number} [ttlMs]  how long an id is remembered
 * @returns {{ isDuplicate: boolean, store: Record<string, number> }}
 */
function dedupUpdate(store, updateId, now, ttlMs = DEFAULT_TTL_MS) {
  // Prune expired entries so the map can't grow unbounded.
  for (const k of Object.keys(store)) {
    if (now - store[k] > ttlMs) delete store[k];
  }

  // No update_id (shouldn't happen for real Telegram updates) → never dedup,
  // failing open so a genuine message is never silently dropped.
  if (updateId === null || updateId === undefined || updateId === '') {
    return { isDuplicate: false, store };
  }

  const key = String(updateId);
  if (Object.prototype.hasOwnProperty.call(store, key)) {
    return { isDuplicate: true, store };
  }
  store[key] = now;
  return { isDuplicate: false, store };
}

// ── Exports (for Node.js testing; skipped in n8n Code Node) ───────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { dedupUpdate, DEFAULT_TTL_MS };
}
