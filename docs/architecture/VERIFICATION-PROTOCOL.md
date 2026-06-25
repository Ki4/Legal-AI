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
- 📋 **citations-drift CI guard** — claimed; **next check:** confirm the test
  file exists and runs in CI.
- 📋 **checklist enforced on live (template/js) path** — claimed from roadmap;
  **next check:** find a checklist-validator node on the non-hybrid branch of
  `form-submit.json`.

### Deterministic routing (no LLM/semantic router needed on the form-path)

- ✅ **exists** — `route-alimony-change.js`, a pure function over known form
  fields (glob + grep). _(2026-06-25)_
- ⚠️ **gated** — only matters for the disabled `alimony-change`. The
  architectural conclusion (service known from form ⇒ no probabilistic router
  needed; a router is only for *free-text* input) stands independent of live
  status.

### Document generation path (doc-engine `template` vs legacy `js`)

- ⚠️ **conflict / unresolved** — `IMPROVEMENTS.md:620` claims alimony is
  `generation_mode='template'` live, but repo-configured state says
  divorce/alimony = `'js'` (legacy JS builders): `014_doc_engine.sql`
  defaults+backfills `'js'`; `016_alimony_change_service.sql:4` explicitly calls
  alimony/divorce "hardcoded JS builders"; **no** migration flips them to
  `'template'` (`011:31` only sets `status='active'`). The doc-engine flip is a
  no-deploy live switch (`014:32`), so prod *could* differ from migrations.
  **Next check (prod, Sergey):** `SELECT slug, generation_mode FROM services
  WHERE slug IN ('divorce','alimony');` _(2026-06-25)_

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
