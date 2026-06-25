# Legal-AI — Monorepo

Ukrainian Legal AI: Telegram Mini App for generating court-ready legal documents (divorce, alimony, etc.).

## Stack
- **Client app**: React/Vite/TypeScript → Vercel (`apps/client/`)
- **Automation**: n8n self-hosted (local dev → VPS)
- **Database**: Supabase (PostgreSQL + pgvector)

## Monorepo structure

```
apps/
  client/       ← Telegram Mini App + Admin panel (React/Vite) → Vercel
  admin/        ← Service Builder (future, separate deploy)

n8n/
  workflows/
    current/    ← ONLY active workflows: form-submit.json, main-bot.json
    archive/    ← Old versions (never edit, reference only)
  templates/    ← JS Code node scripts (copy-paste into n8n editor)
    __tests__/
    shared/
  prompts/      ← AI prompt text files used in n8n nodes

supabase/
  migrations/   ← SQL migrations, sequential numbering (apply via supabase db push)

docs/
  strategy/     ← Business strategy, vision, investor materials, NotebookLM sources
  research/     ← Market research, user research, JTBD
  architecture/ ← Technical decisions (DECISIONS, ARCHITECTURE, IMPROVEMENTS)
  runbooks/     ← Operational guides (secrets rotation, deploys, etc.)
  assets/       ← Screenshots, images

scripts/        ← Repo-level utility scripts (not part of any app)
```

## Rules — follow these in every session

1. **React/UI code** → `apps/client/src/`
2. **n8n Code node scripts** → `n8n/templates/` with tests in `n8n/templates/__tests__/`
3. **n8n workflow export** → `n8n/workflows/current/` — only one active file per workflow, no version numbers in filename (git tracks history)
4. **DB migrations** → `supabase/migrations/` with sequential 3-digit prefix (e.g. `010_...sql`)
5. **AI prompts** → `n8n/prompts/`
6. **Business / strategic docs** → `docs/strategy/`
7. **Research** → `docs/research/`
8. **Tech decisions** → `docs/architecture/`
9. **Operational how-tos** → `docs/runbooks/`
10. **Utility scripts** → `scripts/` (not inside `apps/client/`)
11. **NEVER hardcode secrets** — `.env.local` (gitignored) or Vercel env vars only
12. **New app/product** → new folder under `apps/` with its own `package.json`

## Session protocol

- **Branch always:** every task — any tier, including trivial — on its own branch off `main`. Never commit straight to `main`. `main` stays deployable; merge when verified; rollback = delete the branch (cheap, so prefer acting over over-confirming).
- Start: read `apps/client/.claude/session-summary.md` + `apps/client/.claude/changelog.md`; if a feature is in progress, mark its GitHub issue in-progress.
- **Model per session (routing by tier):** the `/session-start` briefing must end with a **Recommended model** line for the next task — Tier 0/1 implementation from a ready issue/spec → **Sonnet**; Tier 2 specs, architecture, research, debugging the unknown, legally-critical logic design → **Opus or higher**. Sergey switches via `/model` right after the briefing; a mid-session switch keeps the full conversation context (only the generating model changes).
- End (phrases: "закінчуємо", "на сьогодні все", "на добраніч", "good night"): update both files; tick the issue checklist + comment progress on the active issue.
- **Verify before "done" (claim ≠ fact):** any "already done" — from a doc, your idea, or my own earlier conclusion — is a hypothesis until checked against code/runtime. Tag status ✅ live / ⚠️ built-not-live / 📋 claimed / ❌ gap; ✅ needs ≥2 *agreeing* evidence (one showing **invocation**, not just *definition*), and any contradicting evidence blocks it. Protocol + living status-ledger: `docs/architecture/VERIFICATION-PROTOCOL.md`.
- Language: UI = Ukrainian, chat = Russian OK, code comments = English

## Issue tracking (GitHub)

GitHub Issues = status board for units of work. The repo docs stay the source of truth — issues **point** to them, never duplicate them.

- **Spec tiers (effort ∝ risk):** default is **Tier 1** — a GitHub issue (+ roadmap line), no `specs/features/` triplet; I implement from the issue, you review the diff. Write a full **Tier 2** spec only for legally/financially-sensitive, irreversible-migration, multi-subsystem, or high-uncertainty work. Trivial changes (**Tier 0**) need no issue. Triggers + details: `docs/architecture/SDD-GUIDE.md`. Unsure Tier 1 vs 2 → ask in one line, don't write a triplet "just in case".
- **Granularity:** one issue per feature; task-groups (G1, G2, …) are a checklist inside that issue. Issue body = 2-3 lines + link to `specs/features/<slug>/` (Tier 2 only).
- **Claude manages issue status via `gh` CLI** (durable authorization — no need to ask each time): open the issue on feature start, tick the checklist + comment progress per session, close it on merge to `main`.
- **Linking:** every commit/PR for a feature references its issue — `Refs #N` for progress, `Closes #N` on the merge commit/PR so GitHub auto-closes it.
- **No content duplication:** WHAT/HOW lives in `specs/`, WHY in `changelog.md`, backlog in `IMPROVEMENTS.md`. Issues track only state + links.
- **Stale issue rule:** when a problem is solved — even via a different approach than the issue describes — close ALL open issues that describe the same problem. Add a comment: what solved it + ref to the closing issue/PR. Run `gh issue list --state open` at session-start and flag suspicious ones (open >30 days, or their IMPROVEMENTS# is now implemented).
- **IMPROVEMENTS ≠ GitHub Issues:** IMPROVEMENTS.md is an ideas backlog (never "closed"). GitHub Issues are work units (open → in progress → closed on merge). Don't bulk-import IMPROVEMENTS items as issues — create an issue only when you're about to start the work.
- Requires `gh` installed + authed: `winget install GitHub.cli` → `gh auth login` (one-time).

## n8n local development

n8n runs locally via Docker. Telegram webhooks use a tunnel (ngrok / cloudflared).
Future: Docker + nginx on VPS (Hetzner CX22 ~€5/month).
