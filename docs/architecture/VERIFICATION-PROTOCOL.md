# Verification Protocol — "claim ≠ fact"

> **Why this exists.** Docs are written at the moment of *intent* ("we'll do X")
> and later read as *fact* ("X is done"). The *source* of a claim gives it no
> immunity: an old doc, an idea said out loud, and my own earlier conclusion are
> all **hypotheses until checked against the code/runtime**. In one session we
> caught two overstatements — the critic stack "already works" and the research
> doc "they already do this"; both were beliefs held on a single piece of
> evidence. This protocol is the fix.

## Status vocabulary

Every "is X done?" answer gets exactly one tag — never a bare yes/no:

- ✅ **live** — actually runs in production. Requires ≥2 independent, *agreeing*
  evidence, at least one of which shows it being **invoked**, not just *defined*.
- ⚠️ **built-not-live** — code/table/node exists (and may be tested), but is
  gated off / on a disabled branch / removed from the live path.
- 📋 **claimed** — asserted in a doc or idea, not yet checked against code →
  **do not state as fact**. Say "per doc X, verifying", not "you have X".
- ❌ **gap** — no code and no config behind it.

## Confirmation rule (the anti-"gotcha")

1. **≥2 independent evidence that agree** before ✅. Independent = different
   layer — e.g. a migration *defines* the RPC **and** the workflow *calls* it on
   a live branch **and** a test exercises it.
2. **Any contradicting evidence blocks ✅.** (e.g. DECISIONS "RAG removed from
   v6" contradicts "retrieval is live" → investigate and downgrade, don't ignore.)
3. **Existence ≠ invocation.** "The function exists" is one evidence and is never
   enough for ✅ on its own.
4. **Runtime state is its own evidence class.** A migration shows the
   *configured* state; the live DB can have been hand-edited since
   (`ON CONFLICT DO UPDATE`, manual flips, ops changes). When the truth lives in
   the running DB/deploy and can't be seen from the repo, the honest tag is
   ⚠️/📋 **plus a named "to confirm: run `<query>`"** — never an invented ✅.

## When to apply

- **One-time audit:** sweep every existing "done"-claim into the ledger below
  with a tag + evidence (backlog section at bottom).
- **Every new "done":** before calling any future item finished, run the
  confirmation rule and add/upgrade its ledger row.

## What this is NOT (no duplication — see CLAUDE.md "No content duplication")

Not the roadmap (*what's planned*), not the changelog (*why*), not GitHub Issues
(*work state*). This ledger's only job: **is a claim actually true, and by what
evidence.** Status + evidence pointers, nothing else.

---

## Status Ledger

Format per row: `TAG — claim — evidence (≥2, file:line) — date — next check`.
Only entries verified *in-session against code* belong here; memory ≠ evidence.

**Reading note — tags describe live-state, NOT desirability or plan-validity.**
A ⚠️ built-not-live row can be the *intended* state: the hybrid stack (L4
critics, `search_law_chunks`, `law_relations`) is scaffolding for a **future
tier** of complex/reasoning documents (alimony-change is the pilot), deliberately
not live. Whether that plan is even right — and which services belong in the new
tier — is an **open product question**, itself 📋-unknown, NOT a verification gap
to "fix". The audit reports what lives, not what should be rushed live.

### Hybrid pipeline (L2 retrieval → L3 reasoning → L4 critics)

- ✅ **built** — nodes + wiring in `form-submit.json` (`Is Hybrid?` → `L2 Get
  Norms` → `Prepare Reasoning` → L3 → L4 critics; ids/lines 618–653, 1303–1328)
  **and** integration test `n8n/templates/__tests__/hybrid-pipeline-integration.test.js`.
  _(2026-06-25)_
- ⚠️ **built-not-live** — gate is `generation_mode === 'hybrid'`
  (`form-submit.json:630`); the only hybrid service is `alimony-change`
  (`019_generation_mode_hybrid.sql:17`), set `status='disabled'`
  (`016_alimony_change_service.sql:76`). No enabled service reaches the branch.
  Three converging evidence, different layers. _(2026-06-25)_
- 📋 **runtime caveat** — migrations are `ON CONFLICT DO UPDATE` and ship manual
  verification `SELECT`s (`016:74`, `019:25`); live `services` could have been
  flipped by hand. **Next check:** `SELECT slug, status, generation_mode FROM
  services;` on prod.

### Metadata-partitioned retrieval (`search_law_chunks`)

- ✅ **built** — `002_law_chunks.sql:146` `WHERE service_slugs @>
  ARRAY[target_service] AND is_stale = false`, backed by GIN index (`002:58`).
  Textbook metadata-partitioning. _(2026-06-25)_
- ⚠️ **built-not-live** — only caller is `L2 Get Norms`, on the hybrid branch
  (see above), so inherits the same disabled-gate. _(2026-06-25)_
  - 📋 converging-but-unconfirmed: DECISIONS reportedly says "RAG removed from
    v6" — **re-confirm the exact line** before citing as evidence.

### Per-service config files (citations / checklist)

- ✅ **files exist** — `divorce/alimony/alimony-change.citations.json`,
  `divorce/alimony.checklist.json` (glob `n8n/templates/services/`). _(2026-06-25)_
- ✅ **citations goldens + drift guard exist** — `*.citations.json` goldens +
  `citations-drift.test.js`: per-template SSoT check (`golden ===
  extractArticlesByLaw(template)`), fails when a template's legal basis drifts.
  Data-driven (~1 test/template), **not** the "28 tests" of changelog:119 (that's
  the separate parser suite `scripts/lib/citations.mjs`, count 📋-unverified). _(2026-06-25)_
  - ⚠️ **dev-time guard, not runtime** — protects committed-template integrity at
    authoring time; does not inspect live generation output.
  - ⚠️ **not enforced by CI** — `.github/workflows/` has only `law-monitor.yml`
    (no vitest step); no root `package.json` / `.husky` / custom hooksPath found.
    The suite runs only when a dev runs vitest manually. **Next check:** confirm
    no per-subdir pre-commit hook (apps/client, n8n). Implication: "1056+ tests
    passing / CI green" claims describe LOCAL runs, not an automated gate.
- ✅ **checklist enforced on the live `template` path** — `Build Document`
  (`form-submit.json:298`) branches on `generation_mode`; both the `hybrid` and
  `template` branches call `validateChecklist(document, ctx,
  svc.required_checklist)` (validator `validate-checklist.js` + test). divorce/
  alimony are `template` live (prod) ⇒ the guard is on the live path. Build
  Document is the convergence point (connections 1343, 1354 feed it). _(2026-06-25)_
  - ⚠️ the legacy `js` branch does **not** call validateChecklist; no live
    service is js+active today (business/court_search/military = js+disabled),
    but a flip back to js would silently drop the guard.
  - 📋 efficacy depends on `services.required_checklist` being populated in prod
    (empty checklist = no-op pass). **Next check (prod):** `SELECT slug,
    required_checklist IS NOT NULL AS has_cl FROM services WHERE slug IN
    ('divorce','alimony');`
  - 📋 unconfirmed whether `_checklist_result.ok=false` **blocks/flags** delivery
    or is only written to `cases.checklist_failed` (`:889`). **Next check:**
    trace checklist_failed consumers.

### Deterministic routing (no LLM/semantic router needed on the form-path)

- ✅ **exists** — `route-alimony-change.js`, a pure function over known form
  fields (glob + grep). _(2026-06-25)_
- ⚠️ **gated** — only matters for the disabled `alimony-change`. The
  architectural conclusion (service known from form ⇒ no probabilistic router
  needed; a router is only for *free-text* input) stands independent of live
  status.

### GraphRAG / `law_relations` (curated legal knowledge graph)

- ✅ **built (schema + write RPC)** — `017_law_relations.sql`: typed edges
  (requires / exception_if / overrides / clarifies / references) between
  `law_chunks`, lawyer-`verified_by`, + `upsert_law_relation` RPC. _(2026-06-25)_
- ✅ **traversal logic built + tested** — `law-change-scope.js` (+
  `__tests__/law-change-scope.test.js`): deterministic in-JS severity
  propagation; **only `verified_by` edges traversed**. _(2026-06-25)_
- ⚠️ **built-not-live** — `law-change-scope` is in **no** workflow under
  `workflows/current/` (grep: 0 matches; current = form-submit + main-bot only);
  session-summary: digest "ready to wire". **Caveat:** confirm no unexported
  digest workflow on the live n8n. _(2026-06-25)_
- ❌ **not a retrieval graph** — `search_law_chunks` (only retrieval RPC) does
  pure vector search, no graph join; no read-side traversal RPC exists. The
  graph serves **law-change impact monitoring**, not RAG. Data seeded for
  `alimony-change` only (disabled pilot, `scripts/seed-alimony-change-laws.mjs`).
- Note: deliberately a *human-verified* graph, **not** Microsoft community-
  GraphRAG — LLM-extracted edges would inject hallucinations into the one asset
  whose value is that it's lawyer-verified. Don't convert it.

### Document generation path (doc-engine `template` vs legacy `js`)

- ✅ **live = `template`** — prod `SELECT` (2026-06-25): `divorce` and `alimony`
  are both `generation_mode='template'`, `status='active'`, `has_template=true`.
  The live generation path is the doc-engine declarative render
  (`render-document.js` + `<slug>.document.txt`) — **not** the legacy JS builder,
  **not** hybrid. (Other services business/court_search/military = `js` + disabled.)
- ⚠️ **repo was stale/misleading (resolved)** — migration `014` backfills `'js'`
  and `016:4` calls divorce/alimony "hardcoded JS builders"; **no migration
  records the flip to `'template'`**. The flip is the by-design no-deploy switch
  (`014:32`), so it lives only in prod. **Lesson:** `generation_mode` is a
  *runtime-class* fact — the repo can never tell the live generation path; only a
  prod query can. This is the case that vindicates Rule #4. _(2026-06-25)_

---

### Audit backlog — tiered (all 📋 until verified; ~60 done-claims, doc sweep 2026-06-25)

Every row is an **unverified doc-claim** (the sweep did NOT check code). Pull each
up into a tagged row above with ≥2 evidence before stating as fact.

**P1 — anti-hallucination spine (verify first; overstatement here corrupts decisions):**
- retrieval/RAG — law_chunks pgvector + hybrid search (IMPROVEMENTS:183); is_stale
  deployed (changelog:362); CRON reads stale=false (DECISIONS:305). _Partly done:
  `search_law_chunks` ✅built / ⚠️live above._
- critics/L4 — L4a regex groundedness (changelog:191); L4b LLM-judge (changelog:194);
  L4c abstention gate (changelog:209). _⚠️ built-not-live confirmed above._
- checklist — validator regex, no-LLM (DECISIONS:920); per-service `*.checklist.json`
  (anti-halluc:54); Build Document quality checklist (spec). _Files ✅; live-enforce 📋._
- citations — parser regex (changelog:17); golden `*.citations.json` whitelist
  (anti-halluc:54); 28 golden-parity tests (changelog:119); live fetch verified-only
  (DECISIONS:920). _Files ✅; tests/live 📋._
- doc-engine — hybrid 95/5 (IMPROVEMENTS:269); divorce/alimony JS zero-halluc
  (IMPROVEMENTS:265). _See conflict row above._
- routing — slug 100% correct (anti-halluc:56); route-alimony-change.js (anti-halluc:56).
  _✅/⚠️ above._

**P2 — runtime/live claims (NOT repo-verifiable; need prod / live-n8n check):**
- migrations "applied live" 023/026/027 (session-summary:254,12), 025 ready (266),
  004/005/007/009 (IMPROVEMENTS). → confirm via prod schema + SELECT.
- main-bot live node-counts 30→41→47 (session-summary:316,194,310); form-submit 42
  (217); off-topic guard live (bot-offtopic-guard:139). → diff live n8n export vs
  `workflows/current/*.json`.
- client deployed on legal-twa-xi.vercel.app (session-summary:322). → check Vercel.

**P3 — UI / CI surface (low-risk; spot-check, don't grind):**
- client-ui — ~25 component/page claims (changelog): form validation, design-system,
  viz-lab, admin pages, service notes/requests.
- tests/CI — client 186+, root 1056+, node 945+, divorce parity 263, tsc strict clean
  (session-summary/changelog). → re-run suites to confirm counts.
