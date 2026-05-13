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

### Group 6 — Alimony service + monorepo test infra fixes (session 10, 2026-05-13)
**Status:** PENDING COMMIT — готово до коміту, всі тести зелені
**Why:** New service "Стягнення аліментів" added end-to-end. Also fixed Playwright-encoding issue documentation and fixed monorepo paths in test runner and scaffold scripts.

**Files:**
- `n8n/templates/alimony-document.js` — **NEW** — JS template for alimony lawsuit (3 marital statuses, 1-N children, percent/fixed alimony)
- `n8n/workflows/current/form-submit.json` — updated Prepare Declension (unified `defendant_*` fields, handles divorce+alimony) + Build Document (dispatches to per-service builder)
- `n8n/templates/divorce-document.js` — accepts both `defendant_*` and legacy `spouse_*` AI field names
- `apps/client/src/data/alimonyFormConfig.ts` — **NEW** — 4-tab form config for alimony
- `supabase/migrations/010_alimony_service.sql` — **NEW** — INSERT alimony into services table with watched_laws (СК 180-184)
- `test-data/alimony/fixtures/scenario-1.mjs` — 1 дитина, після розлучення, % від доходу
- `test-data/alimony/fixtures/scenario-2.mjs` — **NEW** — 2 дитини, у шлюбі, фіксована сума
- `test-data/alimony/fixtures/scenario-3.mjs` — **NEW** — 1 дитина, ніколи не одружені, % невідомого доходу
- `test-data/alimony/assertions.mjs` — **NEW** — 17 структурних перевірок
- `test-data/alimony/expected/scenario-{1,2,3}.txt` — **NEW** — golden files
- `test-data/divorce/` — скопійовано з `apps/client/test-data/divorce/` в корінь монорепо
- `docs/templates/alimony-reference.docx` — **NEW** — Word-шаблон як референс
- `scripts/test-document.mjs` — виправлено шлях `n8n-templates/` → `n8n/templates/`
- `scripts/scaffold-service.mjs` — виправлено всі шляхи `n8n-templates/` → `n8n/templates/` та `prompts/` → `n8n/prompts/`
- `scripts/test-webhook.mjs` — URL оновлено на `http://localhost:5678/webhook/form-submit`
- `scripts/test-scenarios.md` — додано секцію "⚠️ Playwright + кирилиця → знаки питання"

**Test results:** divorce 4/4 ✅ | alimony 3/3 ✅ | all structural 17/17

**Next steps:**
1. Виконати `supabase/migrations/010_alimony_service.sql` в Supabase SQL Editor
2. Додати form_config в Admin Panel (Service Builder) для slug='alimony'
3. Або завантажити `alimonyFormConfig.ts` через `scripts/update-form-configs.ts`
4. Імпортувати оновлений `form-submit.json` в локальний n8n
5. Тест end-to-end через `node scripts/test-webhook.mjs` (додати scenario для alimony)

---

### Group 4 — Task #2 runbook + session notes
**Status:** PENDING COMMIT (from session 7)
**Why:** prepare everything tomorrow-morning Sergey needs to execute Task #2 (secrets rotation) without re-loading context from the session.

**Files:**
- `docs/runbooks/task-2-secrets-rotation.md` — **NEW FILE** — 9-step runbook with exact commands, gotchas, rollback plan, and rollback branch creation
- `.claude/session-summary.md` — added Session 7 section at top with outcomes, findings, priority changes
- `.claude/changelog.md` — this entry + audit results for law_chunks and git history secrets scan

**Related task:** Task #2 — secrets rotation (to be executed tomorrow morning)
**Next step:** commit when ready.

---

### Group 5 — n8n Code Node tests + validate extraction + workflow improvement plan
**Status:** PENDING COMMIT
**Why:** n8n workflow v6 had zero tests and no error handling. Extracted Code Nodes into testable JS files, wrote 79 tests covering validate, shared utils, and the full divorce document template. Created improvement plan for v7 workflow with error handling, Ensure Profile wiring, and guard nodes.

**Files:**
- `n8n-templates/validate.js` — **NEW FILE** — extracted Validate Code Node into testable function
- `n8n-templates/__tests__/validate.test.js` — **NEW FILE** — 12 tests for payload validation
- `n8n-templates/__tests__/shared-utils.test.js` — **NEW FILE** — 37 tests for shared helper functions (formatDate, val, has, detectGender, isTrue, fullName, formatAddress)
- `n8n-templates/__tests__/divorce-document.test.js` — **NEW FILE** — 30 tests for divorce lawsuit document builder (header, parties, children, alimony, property, debt, AI declension fallbacks, gender detection)
- `n8n-templates/WORKFLOW-IMPROVEMENTS.md` — **NEW FILE** — v7 workflow improvement plan with 7 concrete steps

**Related task:** n8n workflow improvement, test coverage
**Next step:** commit, then wire improvements in n8n UI

---

## 📜 Commit history (most recent first)

> When a pending group above is committed, move it here with the commit hash and date.

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

**Blocker for next step (n8n wiring):**
  1. Confirm `profiles.id` default (`gen_random_uuid()`?)
  2. Confirm `data_retention_consent` default value

**Priority:** deprioritized from Critical → P2 because it only blocks forwarded-link scenario which is not needed for PoC (Phase 0 has only Sergey + Olga as users).

**Related task:** Task #1 — auto-create user on forwarded-link scenario

---

### 2026-04-08 — Fix 13 Telegram UX issues
**Commit:** `1d5aafc`
**Why:** 13-issue Telegram UX audit revealed gaps in swipe handling, draft persistence, back button, haptics and viewport handling on mobile devices. All issues fixed.

**Files:**
- `src/components/DynamicLegalFormBuilder.tsx` — draft persist via localStorage `draft_{slug}`, Telegram BackButton, `h-dvh`, improved swipe (80px + 2× dominance), haptic feedback. Introduces **new required prop** `serviceSlug`.
- `src/components/form/FormField.tsx` — extracted `evalCondition` into `lib/conditions.ts`, added phone input mask
- `src/components/form/fields/{Boolean,Choice,MultiCheck,DatePicker}Field.tsx` — haptic selection, DatePicker viewport-aware positioning
- `src/admin/pages/ServiceEditPage.tsx` — passes `serviceSlug="preview"` to preview components
- `src/lib/conditions.ts` — **NEW FILE** — single source of truth for `evalCondition`
- `src/lib/telegram.ts` — **NEW FILE** — Telegram WebApp helpers

**Related task:** Telegram UX audit

---

### 2026-04-08 — Strategy materials for Olga meeting (Phase 0 prep)
**Commit:** n/a — documentation only, lives in `memory/` (Claude's private memory, not in repo) and `docs/notebooklm/` (in repo, pending commit as part of Group 3 or separate doc commit)

**Files created:**
- `memory/project_strategy_v2.md` (Claude's memory, not in repo) — canonical strategy document v2
- `docs/notebooklm/README.md`
- `docs/notebooklm/01_Strategy_and_Vision.md`
- `docs/notebooklm/02_Product_Philosophy_Escalation.md`
- `docs/notebooklm/03_Risk_Management_FAQ.md`
- `docs/notebooklm/04_Tech_Roadmap_Phase_0_1.md`

**Why:** Sergey has a meeting with Olga tomorrow. Created structured sources for NotebookLM covering team/vesting, 5-phase GTM, product philosophy (3 tiers + escalation), 20-question risk FAQ, 16-week roadmap.

**Related task:** Phase 0 preparation, partner alignment

---

### 2026-04-08 — pre-existing (everything before changelog was introduced)
**Commit:** `b6796a1` and earlier
See `git log --oneline` for history before this changelog was introduced.
Notable recent commits:
- `b6796a1` — Add comprehensive product presentation for lawyer meeting (docs/presentation-for-lawyer.md)
- `651e1bf` — Add GDPR consent screen, privacy policy, and retention policy
- `17ab834` — Session 6: AES-256-GCM encryption for cases + deployment fixes
- `2b830e3` — Session 5: infrastructure for multi-service support

---

## 🛑 Known issues and technical debt

Things we know about but haven't fixed yet. Review at the start of each session.

### Security — 🟡 MEDIUM (deprioritized 2026-04-09, repo is private, only Sergey has access)

- **Secrets in n8n workflow JSON + Git history** — audited on 2026-04-08 (session 7). Runbook ready at `docs/runbooks/task-2-secrets-rotation.md`. **Execute BEFORE giving repo access to anyone external (Olga, Uncle, any partner).**

  **Confirmed leaks:**
  1. `SUPABASE_SERVICE_KEY` (JWT, 219 chars) — in commits `8122e8c`, `18c5ff0`, currently in `n8n-workflows/legal-ai-form-submit-v5-rag.json` and `legal-ai-form-submit-v6-hybrid.json`
  2. `ENCRYPTION_KEY` (AES-256 hex64) — in commit `17ab834`, currently in `legal-ai-form-submit-v6-hybrid.json`. **⚠️ Rotating this without migrating existing encrypted `cases` data will make that data unreadable. Check `SELECT COUNT(*) FROM cases WHERE encrypted_data IS NOT NULL` before rotating.**
  3. `GEMINI_API_KEY` (AIzaSy... 39 chars) — in commit `8122e8c`, currently in `legal-ai-form-submit-v5-rag.json` (file no longer used but still in repo)

  **Not leaked (verified):** Groq, Telegram Bot Token, Anthropic, Google Service Account — all stored in n8n Credentials.

  **Blocks:** showing repo to Olga, any external partner. See `memory/feedback_security_secrets.md` for principles.

### Data quality

- **🟢 LOW PRIORITY — `law_chunks` cleanup deferred.** Decision 2026-04-08: leave as-is. Audit below is for reference when we return to this topic (Tier 2 design, Week 6 per roadmap).

- **`law_chunks` table is currently UNUSED** — audited on 2026-04-08.
  - **Seed script** (`scripts/seed-divorce-laws.ts`) uses `gemini-embedding-001` with `outputDimensionality: 768` and `taskType: RETRIEVAL_DOCUMENT`. Comment in file header says `text-embedding-004` but that's **outdated** — actual code uses `gemini-embedding-001`. DB confirms 768-dim vectors, 21 chunks total.
  - **Old workflow** `legal-ai-form-submit-v5-rag.json` used `gemini-embedding-exp-03-07` (3072-dim, no outputDimensionality) — this is where the original "mismatch" suspicion came from. It was a real mismatch between v5 workflow and seed script.
  - **Current workflow** `legal-ai-form-submit-v6-hybrid.json` **does NOT use embeddings at all**. The comment on Global Config node explicitly says "GEMINI_API_KEY видалено — RAG не потрібен для hybrid підходу". The hybrid template approach bakes law citations directly into the JS template.
  - **Conclusion:** the 21 chunks in `law_chunks` are dead data — not queried by anything. No urgent fix needed. Decision deferred to Tier 2 design phase (Week 6 per roadmap) when we decide whether RAG is reintroduced for the partial-AI tier. At that point we: pick ONE embedding model, re-seed, re-enable embedding in workflow.
  - **Action items:**
    1. Fix outdated comment in `scripts/seed-divorce-laws.ts` header (says `text-embedding-004`, should say `gemini-embedding-001`)
    2. When starting Tier 2 design: evaluate whether RAG is needed, pick model, re-seed
    3. Consider adding `law_code` column or clearer schema docs so future devs understand this table's purpose

### User flow
- **Auto-create user flow (Task #1)** — broken for forwarded-link scenario. Code prep done (Group 2 above), n8n wiring deferred.

### UX
- **Error UX** — on AbortError (timeout), App.tsx incorrectly shows SuccessScreen even if data didn't reach n8n. Medium priority, fix before Phase 1.
- **n8n Error Handler** — no global error trigger + user notification. Low priority.

### Future (post-PoC)
- Rate limiting + Telegram initData signature verification (before first external demo)
- Lawyer invitation system + admin role (before Phase 1)

### Architectural debt — 🟢 LOW PRIORITY (cleanup)

- **Two `.claude/` folders in the project** — noticed by Sergey 2026-04-08.
  - `C:\Users\serge\Legal-AI\.claude\` — contains `launch.json`, `settings.local.json` (parent-level, probably from VS Code workspace root)
  - `C:\Users\serge\Legal-AI\legal-twa\.claude\` — contains `changelog.md`, `launch.json`, `session-summary.md`, `settings.json` (the "real" one we use)
  - **Problem:** split configuration across two levels, possible drift, confusing for new devs (and for Claude on startup).
  - **Action (deferred):** consolidate into one location. Decision needed: does project root make sense if we split legal-twa into separate apps later (see next item)?
  - **When to fix:** next time we touch project structure (probably during monorepo split below).

- **Admin panel lives inside `legal-twa/` but is a separate app** — noticed by Sergey 2026-04-08.
  - Current layout:
    ```
    legal-twa/
      src/
        App.tsx                  ← TWA (Telegram WebApp, client-facing)
        admin/                   ← Admin panel (for lawyers, separate app)
          AdminApp.tsx
          pages/...
          hooks/useAuth.ts
      dist/                      ← TWA build output
      dist-admin/                ← Admin build output (implies separate entry)
    ```
  - **Problems:**
    1. Two different apps share one `package.json`, `tsconfig`, `vite.config` — changes for one can unintentionally affect the other
    2. `dist-admin/` suggests already there are two build targets via one tool — fragile
    3. Deploying admin requires building TWA unnecessarily
    4. New devs see "legal-twa" and expect only the Telegram app, surprise to find admin inside
    5. Different security contexts (TWA = public, admin = authenticated lawyers) should ideally be on different subdomains with different security policies
  - **Target architecture** (discuss with Uncle when he joins):
    ```
    legal-ai/                    ← monorepo root
      apps/
        twa/                     ← Telegram WebApp (currently legal-twa/)
        admin/                   ← Admin panel (extracted from legal-twa/src/admin/)
      packages/
        shared/                  ← Shared code: types, lib/conditions.ts, form engine pieces
        ui/                      ← Shared UI components if any
      .claude/                   ← single Claude config at monorepo root
      package.json               ← workspace root
    ```
  - **Tools to consider:** pnpm workspaces, Turborepo, or Nx for monorepo management
  - **When to fix:** when Uncle joins actively. This is exactly the kind of architectural refactor he should lead. Do NOT attempt before PoC is validated — risk of breaking working code for purely structural benefit.
  - **Interim rule:** keep shared code in `src/lib/` (already doing this), do not add NEW tight coupling between TWA and admin code. When we need to share something, put it in `src/lib/` or `src/types/` — these will become the `packages/shared/` in the future monorepo.

---

## 📝 Changelog rules (how to add entries)

**Every Claude session that modifies files MUST:**

1. **Before starting work** — read the "Pending commits" section at the top. If anything is stuck there, remind the user.
2. **During work** — when creating or editing files, prepare a changelog entry in memory.
3. **After finishing a logical unit of work** — append/update an entry in "Pending commits" with:
   - **Why** the change was made (link to task/issue/bug)
   - **Files** touched and a one-line description of each
   - **Related task** reference
   - **Next step** if not committed immediately
4. **When a group is committed** — move the entry from "Pending commits" to "Commit history" with the commit hash.
5. **At session end** — if any group is still in "Pending commits", mention it in `.claude/session-summary.md` under "Pending commits".

**Format for a new entry:**

```markdown
### Group N — Short descriptive title
**Status:** PENDING COMMIT | COMMITTED: <hash>
**Why:** 1-3 sentences explaining the motivation and context.

**Files:**
- `path/to/file.ts` — one-line description of the change
- `path/to/new-file.ts` — **NEW FILE** — what it does

**Related task:** link or name
**Next step:** what happens next
```
