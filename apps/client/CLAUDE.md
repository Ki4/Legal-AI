<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->

---

## Project-specific instructions for Claude

> Everything below this line is maintained by the project team. Do NOT let Vercel CLI overwrite it.

### Change Documentation Rule (MANDATORY)

Every time Claude makes a **non-trivial** change (skip typos / formatting / pure renames whose "why" is obvious from the diff):

1. **Before** — state in one line **what** will change and **why** in chat, so Sergey can confirm.

2. **After a logical unit of work** — append ONE dated entry to `.claude/changelog.md` under **"Commit history"** (newest on top) with: **Why** (1-3 sentences) + **Files touched** (one line each) + commit hash once known.

This is a *why-log* — `git log` already answers "what". **No "Pending commits" staging ritual** (simplified session 16): git tracks uncommitted state; the dropped bookkeeping was net overhead for a solo dev.

**Rationale:** Sergey is learning development and delegates execution to Claude. Without a "why" log per change, he loses context between sessions. `git log` answers "what changed", but only the changelog answers "why" — which is the question that matters when revisiting code months later.

### Reference documents

- **Strategy (canonical):** `memory/project_strategy_v2.md` (Claude's private memory) and `docs/notebooklm/01_Strategy_and_Vision.md` (in repo, synced copy)
- **Product philosophy:** `docs/notebooklm/02_Product_Philosophy_Escalation.md`
- **Risk FAQ:** `docs/notebooklm/03_Risk_Management_FAQ.md`
- **Current roadmap:** `docs/notebooklm/04_Tech_Roadmap_Phase_0_1.md`
- **Session log:** `.claude/session-summary.md`
- **Change log:** `.claude/changelog.md`

### Session protocol

- **Session start:** read `.claude/session-summary.md` + `.claude/changelog.md` (Pending commits section). Remind Sergey of any stuck work.
- **One session = one focus.** Do not mix unrelated tasks.
- **Session end** (triggered by phrases "закінчуємо", "на сьогодні все", "давай на сьогодні", "на добраніч"): update `session-summary.md` with test results, next steps, files changed, decisions made. Update `changelog.md` if any groups were committed.

### Language preferences

- UI: Ukrainian only
- Chat: Russian acceptable
- Code comments: English preferred (for future team members)
- Commit messages: English preferred

### Quality bar

- Legal documents must be court-ready — quality is #1 priority, speed is #2
- TypeScript strict mode; all type imports via `import type { }`
- No `any` unless unavoidable and commented
- Every new service must have Olga's sign-off before going to production
