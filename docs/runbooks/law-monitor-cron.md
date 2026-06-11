# Runbook — Law change monitor (CRON)

Automated watch on zakon.rada.gov.ua for the laws our services depend on. On a detected
change it writes a `law_change_log` row (`detected_by='cron'`) and flips every dependent
service to `status='needs_review'` (taken off sale until a lawyer signs off). The lawyer
reviews in the admin panel → **📋 Зміни законів**.

- **Schedule:** every Monday 06:00 UTC (~08:00–09:00 Kyiv) via GitHub Actions.
- **Manual:** "Run workflow" button in the Actions tab (with an optional dry-run checkbox).
- **Local:** `node scripts/check-law-updates.mjs` (see below).
- **Workflow file:** `.github/workflows/law-monitor.yml`
- **Detector:** `scripts/check-law-updates.mjs` → `scripts/lib/{rada,law-change,supabase-rest}.mjs`
- **Which laws:** the canonical registry `scripts/law-registry.mjs` (identity = rada URL).

---

## One-time setup — add 4 GitHub Actions secrets  *(Sergey)*

GitHub → repo **Ki4/Legal-AI** → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**. Add each of these (names must match exactly):

| Secret name | Value | Where to get it |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://nexkairsedqtczievxpa.supabase.co` | `apps/client/.env.local` |
| `SUPABASE_SERVICE_KEY` | `sb_secret_...` | `apps/client/.env.local` — **service_role key, keep secret** |
| `TELEGRAM_BOT_TOKEN` | bot token | `apps/client/.env.local` (same bot as the app) |
| `TELEGRAM_ADMIN_CHAT_ID` | `236581343` | your Telegram ID (already the admin-alert target in n8n `form-submit`) |

Notes:
- `TELEGRAM_ADMIN_CHAT_ID` is **not** a secret key — it is just the chat the alert lands in
  (your own Telegram). Without it the run still works; it only skips the alert.
- `SUPABASE_SERVICE_KEY` **is** sensitive (bypasses RLS — needed to write `law_change_log`).
  It lives only in `.env.local` (gitignored) and GitHub Secrets — never in committed code.

---

## Run it manually (the "button")

GitHub → **Actions** tab → **Law change monitor** (left list) → **Run workflow** →
optionally tick **dry-run** (check only, no DB writes / no alert) → **Run workflow**.

Use dry-run to preview what would be flagged without taking any service off sale.

---

## Run it locally

Requires `apps/client/.env.local` with `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_KEY`
(+ `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_ID` if you want `--notify`).

```bash
node scripts/check-law-updates.mjs --dry-run    # preview, no writes  (start here)
node scripts/check-law-updates.mjs              # apply: log + flip services
node scripts/check-law-updates.mjs --notify     # apply + Telegram alert
```

---

## After a change is flagged — lawyer review loop

1. Alert arrives in Telegram (if `--notify`): which law, old → new revision date, affected
   services.
2. Affected services are now `needs_review` → **not served** (TWA shows "unavailable",
   the bot won't hand out the form, write-path returns 503).
3. Lawyer opens the admin panel → **📋 Зміни законів**, compares the old vs new law edition,
   decides whether our template is still correct, edits it if needed.
4. Re-activate the service once signed off:
   - admin panel (status badge → Активувати), or
   - `node scripts/service-lifecycle.mjs set-status <slug> active`

---

## How we trust the verdict (reliability)

- The monitor is a **tripwire, not a judge** — it only says "the revision date moved, a human
  must look." It never edits documents or decides legal meaning. Lawyer sign-off is the real
  guarantee.
- **Conservative parser:** matches only "Редакція від / станом на DD.MM.YYYY", never the bare
  "від DD.MM.YYYY" (that is the adoption date). Covered by unit tests incl. the adoption-date
  trap (`scripts/lib/__tests__/rada.test.mjs`).
- **Ambiguity is never swallowed as "OK":** HTTP errors throw (logged as fetch error, not
  "no change"); an unparseable page logs `⚠️ could not parse`. Only a real, parseable old date
  yields "OK".
- **Safe failure direction:** a false positive → a service is needlessly `needs_review` →
  lawyer re-activates (annoying, safe). The dangerous case (a missed change) is what the
  conservative + over-alert design guards against.

## Scale + politeness (so we don't get blocked)

- **Deduped by law, not by service:** iterates the registry (unique laws by URL), so a law
  shared by N services is fetched once. 50 services sharing 10 laws → 10 requests.
- **Retry with backoff + jitter** on `429 / 5xx` + network errors, honoring `Retry-After`
  (`scripts/lib/rada.mjs`). A law is skipped for the run only after retries are exhausted —
  a transient blip no longer drops it until next week.
- **Polite delay** (1s + jitter) between laws.
- Adding a law = add it to `scripts/law-registry.mjs` + reference its URL in the service's
  `watched_laws`. No cron code changes.

### Deferred (when the registry grows to dozens) — IMPROVEMENTS
- Conditional requests (`If-Modified-Since` / `ETag`) → most checks return `304`, near-zero
  traffic. Needs per-law ETag storage, hence a separate iteration.
