# Project Changelog

> **Purpose:** track every change made to the codebase — what was changed, why, and whether it's committed.
> This is the "why" log. For "what" look at `git log`. For "how to build" look at README.
>
> **Who updates this:** Claude (the AI assistant) must append an entry every time it modifies or creates files.
> Sergey can also add manual entries for changes made outside of Claude sessions.
>
> **Format rule:** newest entries at the top. Each entry dated + session number + commit status.

---

## 📋 Pending commits (uncommitted work)

> Everything below is in the working tree but not yet in `git log`.
> Review this section at the start of every session — remind the user if something is stuck here.

_Зараз порожньо — усе закоммічено (звірено в session 11, 2026-06-08). Див. «Commit history» нижче._

---

## 📜 Commit history (most recent first)

> When a pending group above is committed, move it here with the commit hash and date.

### 2026-06-08 (session 11) — Consolidate branches + refresh master context
**Commit:** `e9a2f77` (merges `3c56925`, `d73be82`)
**Why:** робота була розмазана по 3 гілках і session-summary застарів на 2 сесії → втрачався контекст. Звели все в main, оновили master-context. main = єдине джерело правди.
**Files:**
- merge `fervent-pascal-VUvi3` (Блок 0 research) + `spec-driven-development-iLSvy` (IMPROVEMENTS #32-40) → main
- `apps/client/.claude/session-summary.md` — секція Session 11
- `apps/client/.claude/changelog.md` — прибрано історичний «pending», звірено статуси

### 2026-06-01 (session 11) — Service-demand research Блок 0 (Україна)
**Commit:** `d73be82`
**Why:** свіжий проход по реальних джерелах замість старого JTBD (Gemini). Ранг кандидатів + конкурентний teardown + кандидат «військові спори».
**Files:**
- `docs/research/service-demand/00-ukraine.md` — **NEW**
- `docs/research/service-demand/01-candidate-military-disputes.md` — **NEW**
- `specs/roadmap.md` — аліменти готові + секція «Досліджені кандидати»

### 2026-06-01 — SDD constitution + architecture guides (PR #1)
**Commit:** `c4ec281` (merge `claude/spec-driven-development-iLSvy`); follow-ups `56c0323`, `3bf6634` (#32-40)
**Why:** впровадження Spec-Driven Development (brownfield): конституція, agent-команди, гайди.
**Files:**
- `specs/{mission,tech-stack,roadmap}.md` — **NEW**
- `.claude/commands/{session-start,feature-spec,validate,update-changelog}.md` — **NEW**
- `docs/architecture/{SDD,PROMPTING,GRAPHRAG}-GUIDE.md` — **NEW**
- `docs/architecture/IMPROVEMENTS.md` / `DECISIONS.md` — #20-40 (GraphRAG, AI tech debt, Advanced RAG, MCP, portfolio)

### 2026-05-13 (session 10) — Alimony service + monorepo test infra (колишня Group 6)
**Commit:** `492e1be`
**Why:** нова послуга «Стягнення аліментів» end-to-end (3 статуси шлюбу, 1-N дітей, % / фікс); фікс шляхів монорепо в скриптах; нотатка про Playwright+кирилицю.
**Files:**
- `n8n/templates/alimony-document.js` — **NEW** — JS шаблон позову про аліменти
- `n8n/workflows/current/form-submit.json` — Prepare Declension (`defendant_*`) + Build Document (dispatch по service_slug)
- `apps/client/src/data/alimonyFormConfig.ts` — **NEW** — 4-вкладкова форма
- `supabase/migrations/010_alimony_service.sql` — **NEW** — INSERT alimony + watched_laws (СК 180-184)
- `test-data/alimony/*` — **NEW** — 3 сценарії + 17 assertions + golden
- `scripts/{test-document,scaffold-service,test-webhook}.mjs` — фікс шляхів
- **Tests:** divorce 4/4 ✅ | alimony 3/3 ✅ | 17/17 assertions

### 2026-05 (monorepo restructure) — n8n Code Node tests + task-2 runbook (колишні Groups 4 та 5)
**Commit:** `b3c9013` (шляхи `n8n-templates/` → `n8n/templates/`)
**Why:** винесено n8n Code-ноди в тестований JS (79 тестів: validate, shared utils, divorce document); план покращення workflow v7; runbook ротації секретів для Task #2.
**Files:**
- `n8n/templates/validate.js` + `n8n/templates/__tests__/*` — тести Code-нод
- `docs/architecture/workflow-improvements.md` — план v7
- `docs/runbooks/task-2-secrets-rotation.md` — **NEW** — 9-крокова інструкція ротації

### 2026-04-08 — Add strategy docs and change-documentation rules
**Commit:** `795f342`
**Why:** operational hygiene + strategic documents for upcoming Olga meeting. Establishes the Change Documentation Rule so future sessions always log why changes were made.

**Files:**
- `CLAUDE.md` — **NEW FILE** — project-specific instructions with Change Documentation Rule and session protocol
- `.claude/changelog.md` — **NEW FILE** — this file (project-wide "why" log)
- `.claude/session-summary.md` — updated with embedding mismatch note
- `docs/notebooklm/README.md` — **NEW FILE** — upload instructions and use cases
- `docs/notebooklm/01_Strategy_and_Vision.md` — **NEW FILE** — canonical strategy (team, GTM phases, philosophy)
- `docs/notebooklm/02_Product_Philosophy_Escalation.md` — **NEW FILE** — 3 tiers + escalation logic
- `docs/notebooklm/03_Risk_Management_FAQ.md` — **NEW FILE** — 20 Q&A on risks
- `docs/notebooklm/04_Tech_Roadmap_Phase_0_1.md` — **NEW FILE** — 16-week detailed plan
- `.gitignore` — exclude `supabase/.temp/`

**Related task:** Phase 0 preparation, partner alignment, operational hygiene

---

### 2026-04-08 — Prep for auto-create user flow (Task #1)
**Commit:** `6e41cee`
**Why:** the current n8n workflow assumes the user already exists in `profiles` table (created via `/start` in the bot). This breaks when a user opens a forwarded form link without ever going through `/start`. Code-side preparation done, n8n UI wiring deferred until Task #6 (rate limit + initData verification).

**Files:**
- `src/App.tsx` — added `user_first_name` field to webhook payload (resolved from `tg.initDataUnsafe.user.first_name`, fallback `'Клієнт'`)
- `n8n-templates/ensure-profile.js` — **NEW FILE** — full Code Node JavaScript for n8n with idempotent profile lookup/create logic and application-level rollback

**Priority:** deprioritized from Critical → P2 because it only blocks forwarded-link scenario which is not needed for PoC (Phase 0 has only Sergey + Olga as users).

**Related task:** Task #1 — auto-create user on forwarded-link scenario

---

### 2026-04-08 — Fix 13 Telegram UX issues
**Commit:** `1d5aafc`
**Why:** 13-issue Telegram UX audit revealed gaps in swipe handling, draft persistence, back button, haptics and viewport handling on mobile devices. All issues fixed.

**Files:**
- `src/components/DynamicLegalFormBuilder.tsx` — draft persist via localStorage `draft_{slug}`, Telegram BackButton, `h-dvh`, improved swipe, haptic feedback. New required prop `serviceSlug`.
- `src/components/form/FormField.tsx` — extracted `evalCondition` into `lib/conditions.ts`, added phone input mask
- `src/lib/conditions.ts` — **NEW FILE** — single source of truth for `evalCondition`
- `src/lib/telegram.ts` — **NEW FILE** — Telegram WebApp helpers

**Related task:** Telegram UX audit

---

### 2026-04-08 — pre-existing (everything before changelog was introduced)
**Commit:** `b6796a1` and earlier. See `git log` for history before this changelog. Notable:
- `b6796a1` — product presentation for lawyer meeting
- `651e1bf` — GDPR consent screen, privacy policy, retention policy
- `17ab834` — Session 6: AES-256-GCM encryption for cases + deployment fixes
- `2b830e3` — Session 5: infrastructure for multi-service support

---

## 🛑 Known issues and technical debt

Things we know about but haven't fixed yet. Review at the start of each session.

### Security — ✅ RESOLVED (session 9, 2026-05-12)

- **Secrets in n8n workflow JSON + Git history** — ✅ **ROTATED in session 9:** all keys rotated (`SUPABASE_SERVICE_KEY`, `ENCRYPTION_KEY`, `GEMINI_API_KEY`, `VITE_SUPABASE_ANON_KEY`); old keys revoked at source. Leaked values in git history are now invalid. Runbook: `docs/runbooks/task-2-secrets-rotation.md`. Live secrets now in `.env.local` (gitignored) / n8n Credentials.

### Data quality

- **🟢 LOW PRIORITY — `law_chunks` table is UNUSED (dead data, 21 chunks).** Current workflow `form-submit` uses the hybrid template approach (law citations baked into the JS template), no embeddings. Decision (2026-04-08): leave as-is; revisit at Tier 2 / GraphRAG design (v2), where we pick ONE embedding model, re-seed, re-enable retrieval. Action when revisited: fix outdated comment in `scripts/seed-divorce-laws.ts` (says `text-embedding-004`, actual `gemini-embedding-001`).

### User flow
- **Auto-create user flow (Task #1)** — broken for forwarded-link scenario. Code prep done, n8n wiring deferred (not needed for PoC).

### UX
- **Error UX** — on AbortError (timeout), App.tsx incorrectly shows SuccessScreen even if data didn't reach n8n. Fix before Phase 1.
- **n8n Error Handler** — no global error trigger + user notification. Low priority.

### Future (post-PoC)
- Rate limiting + Telegram initData signature verification (before first external demo)
- Lawyer invitation system + admin role (before Phase 1)

### Architectural debt — 🟢 LOW PRIORITY
- **Admin panel shares one build with TWA** inside `apps/client/`. Target (when Uncle joins): split into `apps/twa` + `apps/admin` + `packages/shared`. Interim rule: keep shared code in `src/lib/` / `src/types/`, no new tight coupling between TWA and admin. Do NOT refactor before PoC validated.

---

## 📝 Changelog rules (how to add entries)

**Every Claude session that modifies files MUST:**

1. **Before starting work** — read the "Pending commits" section at the top. If anything is stuck there, remind the user.
2. **During work** — when creating or editing files, prepare a changelog entry in memory.
3. **After finishing a logical unit of work** — append/update an entry in "Pending commits" with **Why** / **Files** / **Related task** / **Next step**.
4. **When a group is committed** — move the entry from "Pending commits" to "Commit history" with the commit hash.
5. **At session end** — if any group is still in "Pending commits", mention it in `.claude/session-summary.md`.

**Format for a new entry:**

```markdown
### Group N — Short descriptive title
**Status:** PENDING COMMIT | COMMITTED: <hash>
**Why:** 1-3 sentences explaining the motivation and context.

**Files:**
- `path/to/file.ts` — one-line description of the change

**Related task:** link or name
**Next step:** what happens next
```
