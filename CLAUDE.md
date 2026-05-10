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

- Start: read `apps/client/.claude/session-summary.md` + `apps/client/.claude/changelog.md`
- End (phrases: "закінчуємо", "на сьогодні все", "на добраніч", "good night"): update both files
- Language: UI = Ukrainian, chat = Russian OK, code comments = English

## n8n local development

n8n runs locally via Docker. Telegram webhooks use a tunnel (ngrok / cloudflared).
Future: Docker + nginx on VPS (Hetzner CX22 ~€5/month).
