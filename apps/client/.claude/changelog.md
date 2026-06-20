# Project Changelog

> **Purpose:** track every change made to the codebase — what was changed, why, and whether it's committed.
> This is the "why" log. For "what" look at `git log`. For "how to build" look at README.
>
> **Who updates this:** Claude (the AI assistant) must append an entry every time it modifies or creates files.
> Sergey can also add manual entries for changes made outside of Claude sessions.
>
> **Format rule:** newest entries at the top. Each entry dated + session number + commit status.

---

### 2026-06-20 (session 41) — service-mirror Slice 1 (G1-G3): read-only admin анатомія послуги (#66)
**Status:** COMMITTED (client-only, Vercel auto-builds) · branch `feature/service-mirror`
**Why:** Реалізація слайса 1 спеки service-mirror — показати юристу «що є»: форма як є + анатомія документа + health + закони. Read-only → ризик 🟢, нічого не пише в `services`, не чіпає генерацію.
**What happened:**
- **G1** `apps/client/src/lib/serviceAnatomy.ts` (NEW) — чисті функції: `analyzeTemplate` (lean tag-екстрактор + порт regex цитат, БЕЗ імпорту CJS render-document — стоп-умова спеки; depth-tracking виключає loop-item поля), `diffFormVsTemplate` (used/unused/unmatched), `serviceHealth` 🟢/🟡/🔴, `collectBrokenShowIf`/`describeShowIf`/`collectEmptyLabelFields`/`fieldTypeLabel`/`analyzeService`. **Вычисляемый слой** (`PROVIDED_CONTEXT`/`DERIVED_SOURCES`) дзеркалить `buildContext()` — інакше computed-ключі (plaintiff_name, court_fee…) давали б лавину фальшивих unmatched. 28 тестів: паритет цитат проти golden + інваріант `unmatched===[]` на реальних шаблонах.
- **G2** `ServiceViewPage.tsx` (NEW) — read-only сторінка: header+health light, анатомія (used/unused/unmatched), цитати з лінками zakon.rada, форма як є (типи людською, `show_if` природною мовою, `id` під «технічні деталі»). Роути розведено: `services/:id`→view, `services/:id/edit`→редактор; картка каталогу→view, ✏️→edit. Тільки SELECT.
- **G3** health-badge на картці каталогу (`DashboardPage`); на детальній — збагачення цитат з `law_chunks.is_stale` (badge «застаріло») + pending `law_change_log` (banner «змінено» → /law-changes), feed у health. Поле з id, що збігається з computed-ключем, рахується «використаним» (прибрало шум `has_children`).
- **Знахідки дзеркала (ще до завершення UI):** (1) divorce друкує `property_details`/`debt_details`, форма не питає → `________` у проді → **issue #67** (Variant B: фікс шаблону, окремо); (2) `has_children` shadowing у doc-engine → IMPROVEMENTS #84; (3) hybrid AI-fed поля (`changed_facts`…) не в шаблоні → показано як «не в шаблоні (могло живити AI)».
- **G4** доки: `DECISIONS.md` (розворот + межа анатомії + знахідки), `IMPROVEMENTS.md` #84, `roadmap.md` v2.2.
**Files:** `apps/client/src/lib/serviceAnatomy.ts` (NEW) + `__tests__/serviceAnatomy.test.ts` (NEW, 28), `apps/client/src/admin/pages/ServiceViewPage.tsx` (NEW), `AdminApp.tsx`, `DashboardPage.tsx`, `docs/architecture/{DECISIONS,IMPROVEMENTS}.md`, `specs/roadmap.md`.
**Tests:** client vitest **175/175** ✅ (+28) · tsc clean · vite build ✅. **Не зроблено:** live-перевірка в браузері з адмін-логіном (потребує запущений застосунок + сесію) — лишилось у validation як ручний крок.

### 2026-06-20 (session 41) — Tier-2 spec: admin "service-mirror" (read-only огляд + feedback intake)
**Status:** COMMITTED (spec/docs only, no code) · branch `feature/service-mirror-spec`
**Why:** Розворот напряму адаптації адмінки. Поточна адмінка — інструмент *редагування* з розірваною петлею (таб «AI-промпт» декоративний — генерація йде з `document_template`, не з `ai_prompt`) і технічно ворожим юристу білдером. Рішення Сергія: спершу зробити адмінку **дзеркалом** — показати юристу те, що є (форма як є + анатомія + закони + health), зібрати фідбек і приклади документів, і лише ПОТІМ будувати білдер на основі закономірностей, а не наосліп.
**What happened:**
- `specs/features/service-mirror/{plan,requirements,validation}.md` (NEW) — Tier-2 спека. **Слайс 1** (read-only, ризик 🟢): сторінка перегляду послуги — форма «як є» (типи людською, `show_if` природною мовою, без `field.id` на видноті), **анатомія документа** (поля форми ↔ використані шаблоном / unused / unmatched-плейсхолдери) + **health-світлофор** 🟢/🟡/🔴, **закони списком** (цитати з шаблону → лінки + badge «застаріло/змінено»). Анатомія рахується в браузері чистою функцією `serviceAnatomy.ts` з даних, що вже є (`form_config` + `document_template`) — паритет-тест цитат проти golden. **Слайс 2** коментарі юриста (`service_notes`), **слайс 3** заявка на послугу + приклад документа (Storage) — контуром.
- Рішення по розвилках: граф `law_relations` (react-flow) — окремим слайсом ПІСЛЯ списку; живе превʼю документа — не в слайсі 1 (лише поля in/out + health).
- `docs/architecture/IMPROVEMENTS.md` — **#84** (зонтичний): граф-viz, AI-чернетка з прикладу (north-star «Legal Engineer»), превʼю документа, ролі/RLS (тригер — логін Ольги; «developer» НЕ роль застосунку), HITL-редагування графа (v2.2), email, тести-в-адмінці → замінено на health-check.
**Files:** `specs/features/service-mirror/plan.md` (NEW), `requirements.md` (NEW), `validation.md` (NEW), `docs/architecture/IMPROVEMENTS.md` (#84 + index).
**Tests:** none (спека/доки). Реалізація слайса 1 — наступна гілка.

### 2026-06-20 (session 40) — extend form validation: names (Cyrillic), passport, max-length (#81 cont.)
**Status:** COMMITTED (client-only) · branch `feature/form-validation-names`
**Why:** Sergey's live test showed garbage like `ыуйцу"` in a name field would land in a court document. Extends #81's email/phone/ІПН validation to the remaining "simple field" classes.
**What happened:**
- **Name** (`validateName`, rule `name`): Cyrillic letters + spaces + hyphen + apostrophe variants only — rejects Latin, digits and punctuation (catches the trailing `"`). Inferred for `first/last/middle/maiden_name` + `patronymic` (tightened from a generic `name$` so institutional `*_name` like `tcc_name` is NOT caught — those can opt in via explicit `validation`).
- **Passport** (`validatePassport`, rule `passport`): old book format (2 Cyrillic + 6 digits, e.g. АА123456) or a 9-digit ID-card number; inferred from `passport` in the id.
- **Max-length**: `maxLength?` added to `FormField`; `FormField.tsx` applies a hard cap (default text 200 / textarea 2000) so a "wall of text" can't reach the document. Verified all `text` fields are short (names/addresses/numbers); all long free-text fields are already `textarea`.
- Same inline-error + submit-gate plumbing as #81 (no new wiring).
**Files:** `apps/client/src/lib/validators.ts` (+name/passport), `apps/client/src/lib/__tests__/validators.test.ts` (+15 tests), `apps/client/src/types/form.ts` (`maxLength`, rule union), `apps/client/src/components/form/FormField.tsx` (maxLength caps).
**Tests:** client vitest 147/147 ✅ (+15) · tsc clean.

### 2026-06-20 (session 40) — bot /stop handler (#82) + idempotent webhook dedup (#83) — deployed + live-verified
**Status:** DEPLOYED + live-verified · branch `feature/form-bot-hardening` · main-bot 44→47 nodes
**Why:** Two robustness gaps surfaced by the friend's session-39 test. `/stop` had no handler (5 chars, not a greeting/off-topic keyword → flowed to the AI Agent and landed on Send Help — wrong reply + wasted Groq call). And Telegram re-delivers an update on a non-fast-200 (e.g. session 39's 500), causing the SAME message to be processed twice.
**What happened:**
- **#82 /stop** (`scripts/sync-bot-stop-command.mjs`, NEW): a new `Is Stop?` IF intercepts `/stop` (startsWith, reads `$('Normalize')._text`) on the existing-user branch, BEFORE Pre-filter — so it never hits the AI and is independent of Pre-filter's own classifier (owned by other patchers; left untouched to avoid a cross-script fight). Routes to a new `Stop Reply` Telegram node — a polite acknowledgement (no subscriptions yet) + the same service shortcut buttons. `Is Callback?`(FALSE) → `Is Stop?` → {`Stop Reply` | `Pre-filter`}. `/stop` registered in the «/» menu (`set-bot-commands.mjs`).
- **#83 dedup** (`n8n/templates/dedup-update.js` + `scripts/sync-webhook-dedup.mjs`, NEW): a `Dedup Update` Code node sits FIRST (`Telegram Trigger → Dedup Update → Normalize`) and drops a repeat `update_id` using the workflow's global static data as a 5-min TTL map; a duplicate returns `[]` so the flow stops. Pure core (`dedupUpdate(store, updateId, now, ttl)`) is unit-tested; the node jsCode is GENERATED from the template (anti-drift, like `prepare-l4b`). Fails open on a missing update_id (never drops a real message).
- **Live-verified** (per the always-send-a-real-webhook rule) against local n8n via direct webhook POST + executions API, with a seeded test identity, cleaned up after: exec 148 `…→ Is Stop? → Stop Reply` for `/stop` (errored only at the send to the synthetic chat — routing correct); exec 150 duplicate `update_id` → `Telegram Trigger → Dedup Update` and STOP (zero side-effects, no admin alert); exec 151 a fresh `update_id` processes again (dedup is per-id, not blanket). Connection-integrity check (all 47 refs valid) caught nothing broken — the structural guard that would have caught session 39's malformed-connection 500.
**Files:** `scripts/sync-bot-stop-command.mjs` (NEW), `scripts/sync-webhook-dedup.mjs` (NEW), `n8n/templates/dedup-update.js` (NEW), `n8n/templates/__tests__/dedup-update.test.js` (NEW, 7 tests), `scripts/set-bot-commands.mjs` (+/stop), `n8n/workflows/current/main-bot.json` (deployed, 47 nodes), `docs/architecture/IMPROVEMENTS.md` (#82/#83 done).
**Tests:** root vitest 1056/1056 ✅ (+7) · live-verified (see above). **Note:** 2 expected «chat not found» admin alerts from the synthetic test user during verification.

### 2026-06-20 (session 40) — form field format validation: email / phone / ІПН (#81)
**Status:** COMMITTED (client-only, no deploy needed — Vercel auto-builds) · branch `feature/form-bot-hardening`
**Why:** A friend's session-39 test showed form fields accept garbage (any text in email/phone/ІПН) → an invalid legal document downstream. The form had only a required-empty check, no format check.
**What happened:**
- `apps/client/src/lib/validators.ts` (NEW) — pure validators: `validateEmail` (non-catastrophic regex), `validatePhoneUA` (+380XXXXXXXXX / 380… / 0… after stripping formatting), `validateInn` (10-digit РНОКПП with the real checksum: weights `[-1,5,7,9,4,6,10,5,7]`, `(Σ%11)%10 === d10`). All return a Ukrainian message or `null`; empty values are always valid (required-ness handled separately).
- `resolveValidationRule(field)` — explicit `field.validation` wins; otherwise inferred from field type/id (`phone` type → phone; id matching email/phone/tax_number → rule), so existing Supabase configs get validation **without a data migration**. `validation?: ValidationRule` added to `FormField` type for future explicit use.
- Inline error in `FormField.tsx` (red border + message, mirroring `DatePickerField` #27): validates on blur (`touched`) or on a failed submit (`forceShowError`).
- Submit gate: `validateFormats()` in `form-utils.ts` blocks submit on bad format too; `findFirstErrorTab` now also jumps to format errors; banner gained a «Перевірте формат полів» section.
**Files:** `apps/client/src/lib/validators.ts` (NEW), `apps/client/src/lib/__tests__/validators.test.ts` (NEW, 24 tests), `apps/client/src/types/form.ts` (`validation` + `ValidationRule`), `apps/client/src/lib/form-utils.ts` (`validateFormats`, `findFirstErrorTab` extended), `apps/client/src/components/form/FormField.tsx` (inline error), `apps/client/src/components/DynamicLegalFormBuilder.tsx` (submit gate + banner).
**Tests:** client vitest 132/132 ✅ (+24) · tsc clean.

### 2026-06-19 (session 39 cont.) — off-topic guard #78 (classifier `topic` + tiered limit + Supabase) + 2 bug fixes — deployed
**Status:** DEPLOYED + live-verified · merged to main (`d425456`/`7325213`)
**Why:** the friend's abuse test (6 off-topic msgs all hit the AI) proved the limit was needed now.
**What happened:**
- **Classifier `topic`** (clear/legal_unclear/off_topic) — validated OFFLINE first (`scripts/eval/`: 93% / 100% on abuse, 0 legit→off_topic). The reliable signal is binary "is this legal", not exact service — so tricky inputs («розлучатися») route in the user's favour.
- **Guard** (`sync-offtopic-guard.mjs`, 7 nodes): legal → warm clarify + reset; off_topic → tiered (1 gentle/2 warning/3 nudge/4+ pause ~15min, AI skipped). Never penalises a confused legitimate user.
- **State in Supabase `bot_rate_limit`** (migration 024, keyed by Telegram id) — chose DB over n8n static data (Sergey wanted admin visibility, #79). Row seeded at onboarding (`Init Rate Limit`).
- **2 bugs found+fixed via real users:** (1) malformed `setConn` (missing `{main:}` wrapper) → 500 on every update; (2) Stanislav's text got NO reply — `Update Rate Limit` sat BETWEEN Off-topic Guard and Guard Switch, broke item-pairing → Switch matched no rule (DB write happened, reply didn't). Fix: Update Rate Limit as a parallel leaf, Switch reads `$json`.
- **Future (spec):** escalation ladder (15min→week→3mo→ban via `pause_level`), hybrid static-cache; known gap — Pre-filter keyword off-topic bypasses the counter.
**Files:** `scripts/sync-offtopic-guard.mjs`, `scripts/sync-bot-ux-polish.mjs`, `scripts/eval/*`, `supabase/migrations/024_bot_rate_limit.sql`, `docs/architecture/bot-offtopic-guard.md`, `n8n/workflows/current/main-bot.json` (44 nodes).
**Tests:** offline eval 93%/100%-abuse; live: off-topic → reply sent + `off_topic_count` 0→1 (exec 147). **Lesson:** always send a REAL webhook message after a main-bot deploy — both bugs slipped a DB/API-only check.

### 2026-06-19 (session 39 cont.) — slash menu + new-user double-greeting fix (from a live first-time test) — deployed
**Status:** DEPLOYED + live-verified · branch `feature/bot-onboarding-commands` → main
**Why:** Sergey's friend tested the bot for the first time and surfaced real issues: no «/» command hint menu, a double greeting on first /start, and (by abuse-testing) that off-topic messages all hit the AI (no limit).
**What happened:**
- **Slash-command menu** (`scripts/set-bot-commands.mjs`, NEW) — `setMyCommands` registers `/start /menu /help` so the native «/» menu appears (was empty). `/stop` deliberately left out (no handler yet → IMPROVEMENTS #82).
- **New-user double-greeting fixed** (LAYER 6 in `sync-bot-ux-polish.mjs`) — **diagnosed with evidence, not guessed:** `exec 105` showed ONE execution ran both Welcome New User AND Show Menu, i.e. it's the onboarding flow (a new user's /start is greeted by Welcome, then continues Mark New User → Pre-filter → Skip AI?(greeting) → Show Menu), **not** a Telegram duplicate-delivery race — so a Wait(1s) would not fix it. Added a `Greeting: is new?` IF after Skip AI?(TRUE): new user → terminal (Welcome already greeted, it has the buttons), existing user → Show Menu. Non-greeting first messages still flow to the AI, so a new user's real query is never swallowed (session-36 G3 stands).
- Fixed a **non-idempotent patcher** bug found while applying L6: two `setConn('Skip AI?')` (L1 vs L6) flip-flopped each run; L6 now owns that connection.
- **Live-verified per the new rule** (always send a real webhook message after a main-bot deploy — this is exactly how yesterday's 500 slipped through): `/menu` → exec 117 success → Show Menu, webhook 200.
- **IMPROVEMENTS #81** (form field validation — email/phone/ІПН, from the friend's test), **#82** (/stop + lifecycle commands), **#83** (idempotent webhook — dedup by update_id; the real fix for Telegram's retry-on-non-200, distinct from the onboarding double-greeting). The off-topic **limit not working** = #78 (designed, deferred) — the friend's abuse test (execs 111-116, 6 off-topic msgs all → AI) validated that it's needed.
**Files:** `scripts/set-bot-commands.mjs` (NEW), `scripts/sync-bot-ux-polish.mjs` (LAYER 6 + L1 idempotency fix), `n8n/workflows/current/main-bot.json` (deployed, 34 nodes), `docs/architecture/IMPROVEMENTS.md` (#81-83).
**Tests:** n8n config + Telegram API; live-verified existing-user /menu (single Show Menu). New-user path fixed by logic + readback (a true new-user retest needs a fresh Telegram account).

### 2026-06-19 (session 39 cont.) — bot copy polish + reaction 👀 + subscribe backlog — deployed
**Status:** DEPLOYED · branch `feature/bot-copy-polish` → main
**Why:** quality copywriting pass on the live main-bot messages (Sergey approved each), + neutral reaction emoji, + a GDPR-aware «notify me» backlog item.
**What happened:**
- **Reaction 🙏 → 👀** — «seen, got it» reads better than gratitude/pleading on a user's question. Smoke-verified live.
- **Copy pass (LAYER 5 in `sync-bot-ux-polish.mjs`)** — rewrote 6 texts warmer + consistent (Welcome / Show Menu / Ask Confirm / Send Help / Service Unavailable / Send TWA Button). Two structural fixes: **Send Help** now carries service buttons (was a dead-end «переформулюйте»); **Service Unavailable** shows only «← До меню» — no textual upsell of other services (the user wanted *that* paused/disabled one). Dropped the retired `_is_new` «🙏 Дякую, що написали» greeting prefix from all nodes (redundant with the new Welcome, and it carried 🙏). Each message previewed in Sergey's real Telegram before deploy.
- **IMPROVEMENTS #80** — «notify me when the service is available» (opt-in). Captures Sergey's GDPR question: no held connection (a bot can `sendMessage(chat_id)` anytime), consent = the button tap, channel = the same Telegram chat (NOT email — data minimisation), and `needs_review` (law changed) vs `disabled` (in dev) warrant different messaging. Deferred until real users + in-dev services exist.
**Files:** `scripts/sync-bot-ux-polish.mjs` (LAYER 5 copy + 👀 reconcile), `n8n/workflows/current/main-bot.json` (deployed, 33 nodes), `docs/architecture/IMPROVEMENTS.md` (#80).
**Tests:** n8n config only; Markdown render confirmed via a live Telegram demo batch; deployed nodes read back from live (texts + buttons + no 🙏 prefix).

### 2026-06-19 (session 39 cont.) — 🙏 reaction on a new user's first message — deployed
**Status:** DEPLOYED · branch `feature/bot-first-message-reaction` → main
**Why:** the one deferred item from the #65 bundle — Sergey gave the explicit go ("сделай реакцию 🙏").
**What happened:** `setMessageReaction` is too new for the n8n Telegram node → raw HTTP, which needs the bot token. Added a `Global Config` code node (placeholder `YOUR_TELEGRAM_BOT_TOKEN`, injected live by `deploy-workflow.mjs` — repo keeps the placeholder, verified no token leak) placed ON THE NEW-USER BRANCH only (`Create Identity → Global Config → Welcome New User`), so the hot path for existing users is untouched. `Normalize` now exposes `_messageId`; a `React First Msg` HTTP leaf fans out off `Welcome New User` (`onError:continueRegularOutput` → a failed reaction never breaks onboarding) and POSTs `setMessageReaction` with `🙏` (in Telegram's allowed set). **Verified:** the exact API call (sendMessage → setMessageReaction 🙏) returns `{"ok":true,"result":true}` live; main-bot active at 33 nodes with the token injected. The full new-user wiring can only be exercised by a genuinely new Telegram user (can't simulate without a real new chat), but it's harmless-by-design (onError continue).
**Files:** `scripts/sync-bot-ux-polish.mjs` (L4c: Normalize `_messageId`, Global Config, React First Msg, new-user rewire), `n8n/workflows/current/main-bot.json` (deployed).
**Tests:** no app logic (n8n config + raw API); API call smoke-verified live.

### 2026-06-19 (session 39) — Telegram bot UX polish bundle (#65) — deployed + live-verified
**Status:** DEPLOYED + live-verified · branch `feature/bot-ux-polish` · closes #65 on merge
**Why:** Sergey wanted the Telegram bot to feel like a smooth app, not a request/response form — loading/progress, smoother interactions, nicer buttons, "emotions". One bundle (he explicitly asked not to split it). Key reframe established up front: a Telegram bot has no visual/CSS layer — its UX levers are message text, inline buttons, timing, `sendChatAction`, `editMessageText`, `answerCallbackQuery`. So this is n8n engineering + microcopy, not a design-tool task.
**What happened (layers, all idempotent patchers + live deploy):**
1. **L1 "alive"** (`scripts/sync-bot-ux-polish.mjs`): `answerCallbackQuery` (native Telegram `callback→answerQuery`) at the head of the callback branch — fixes a real bug where NOTHING answered the callback, so tapped buttons spun a loading clock until timeout; now clears instantly + soft toast «Гаразд ✍️». Plus `sendChatAction: typing` before the Groq dispatcher (AI Agent text repointed to stable `$('Pre-filter')` ref so a Telegram node can precede it). **Live bug caught by smoke test:** `sendChatAction` lives under the `message` resource, not `chat` → first deploy 404'd; fixed (verified node source in container). Re-tested live: exec 89 success, full path Send Typing → AI Agent → Send TWA Button.
2. **Menu buttons** (L4a/L4b): tap-to-pick service buttons on `Show Menu` AND `Welcome New User` (new user's first contact) — reuse the existing `confirm_service_{id}` callback path, no new routing. Live-verified menu tap (exec 90).
3. **L3 generation progress → morph-to-card** (`scripts/sync-form-submit-ux.mjs`): after live UX review, settled on ONE message that morphs in place — `⏳ Готую` → `📝 Формую` (one light `editMessageText` fan-out LEAF off Copy Template's success output) → final result CARD (the old `Send Doc Link` converted from sendMessage to `editMessageText` of the SAME message) with inline buttons [📄 Відкрити документ](url) + [➕ Новий документ](callback `show_menu`, handled by main-bot). Earlier iterations (3 progress steps, then a progress bar) were rejected by Sergey as abrupt/ugly — Telegram has NO fade on edits, so the fix was a constant header (no vertical "jump") + fewer/smaller swaps. Leaves sit OFF the data path + `onError:continueRegularOutput` → can't abort the hardened (#56/#59) chain. Live-verified: exec 91–97 success, all steps fired, full gen chain to the card.
4. **Failure path parity (A)** (`n8n/templates/format-gen-failure.js` + `scripts/sync-user-error-feedback.mjs`): the #59 client failure message brought to the success card's level — HTML, friendlier copy, service title, copyable `<code>` case №, + «➕ Інша послуга» button. Live-confirmed deployed (parse_mode HTML + button).
5. **Case ID handling (C):** removed from the SUCCESS card (UUID is noise when it worked; support finds the case by Telegram id) — shown prominently + tap-to-copy ONLY on the FAILURE card. Note: Telegram has no clipboard-button API; only `<code>` text is tap-to-copy.
6. **Test harness fix:** `scripts/test-webhook.mjs` was itself broken after #56 (sent `user_id`, no `init_data` → 400). Now forges a valid signed `init_data` from the bot token (mirrors `verify-init-data.js`) — used to live-verify L3 without filling the form by hand.
7. **Infra diagnosis (not a code bug):** Sergey's real taps weren't reaching n8n — `getWebhookInfo` showed 404 + pending updates; root cause was **ngrok was offline** (`ERR_NGROK_3200`), not Docker/workflow. Restarted the tunnel (`rosy-caution-progeny.ngrok-free.dev → :5678`); taps flowed immediately. Env-startup checklist now: Docker + **ngrok** + `getWebhookInfo`.
**Files:** `scripts/sync-bot-ux-polish.mjs` (NEW), `scripts/sync-form-submit-ux.mjs` (NEW), `scripts/sync-user-error-feedback.mjs` (failure card + button + serviceTitle), `scripts/test-webhook.mjs` (init_data signing), `n8n/templates/format-gen-failure.js` (+test), `n8n/workflows/current/{main-bot,form-submit}.json` (deployed), `docs/architecture/IMPROVEMENTS.md` (#77 — document formats/PDF export/styling, deferred).
**Tests:** 1020 root vitest ✅ (+1). Live-verified across execs 88–97.
**Deferred (documented, not done):** `setMessageReaction` 🙏 emoji on first message — the one item needing a token-bearing node in main-bot (security surface); left as an opt-in pending explicit go. PDF/file export → IMPROVEMENTS #77 (doc is a Google Doc for now).

### 2026-06-19 (session 38) — bot cleanup: remove dead Wait(1s) + audit stale form-links (#4a)
**Status:** DEPLOYED (Wait removal) + verified-already-covered (#4a) · branch `chore/bot-remove-wait-and-stale-link-audit`
**Why:** Two backlog cleanups from `TELEGRAM-BOT-GUIDE` §4.1 / §4.7.
**What happened:**
1. **Wait(1s) removed (§4.1).** `main-bot` had a `n8n-nodes-base.wait` (`amount: 1`) between `Telegram Trigger` and `Normalize` — no debounce/grouping after it, just a flat 1-second delay on every message (debug leftover). Rewired `Telegram Trigger → Normalize` directly, deleted the node (30→29 nodes), deployed + verified live.
2. **Stale form-links (§4.7 / IMPROVEMENTS #4a) — verified already covered, no code needed.** The concern was that an old bot message's button opens the form with stale context after a config/service change. Checked `apps/client/src/App.tsx:250-269`: the button URL embeds only `slug`+`uid` (not the config), the TWA fetches the *current* `form_config` by slug on open, and a read-path guard shows the «недоступна» screen when `status !== 'active'` (mirroring the authoritative write-path 503), plus a «не знайдено» screen for an unknown slug. Loading the current config from an old link is correct behaviour, so `form_config_version` (the other #4a option) is unnecessary. Marked #4a closed.
**Files:**
- `n8n/workflows/current/main-bot.json` — Wait node removed, Telegram Trigger rewired (deployed)
- `docs/architecture/TELEGRAM-BOT-GUIDE.md` — §4.1/§4.7 + §5 table marked resolved
- `docs/architecture/IMPROVEMENTS.md` — #4a closed (already covered by read-path guard)
**Tests:** no app-code change; live-verified main-bot (Wait gone, 29 nodes, active). #4a was verification-only.

### 2026-06-19 (session 38) — honest service catalog in the bot (#61) — static copy, deployed
**Status:** DEPLOYED · branch `feature/bot-honest-catalog` · closes #61 on merge
**Why:** `main-bot`'s Welcome New User / Show Menu / Send Help all advertised ТЦК/ВЛК, ФОП, Пошук суду — all `disabled` (military is strategically *blocked*: needs a lawyer partner). Only divorce + alimony are `active`, so the bot promised 3 of 5 services that don't exist. Service Unavailable said «тимчасово недоступна... спробуйте пізніше» — reads like an outage. (§4.4 `TELEGRAM-BOT-GUIDE`, IMPROVEMENTS #43/#75.)
**What happened:** rewrote the 4 texts as static honest copy — available = Розлучення+Аліменти (✅); the rest under «🔜 Скоро»; ТЦК framed «разом із юристом»; Service Unavailable now offers the working alternatives instead of a dead "try later". The `_is_new` greeting prefixes (session 36 / #55 G3) are preserved verbatim. Idempotent patcher `scripts/sync-main-bot-honest-catalog.mjs`.
**Decision (Sergey):** static copy now; the *dynamic* catalog (build the menu from `services WHERE status='active'`, auto-syncing on a flip) deliberately stays in the backlog — a per-message Supabase fetch isn't worth it for a set that changes ~monthly, and it's better delivered later as **admin-editable bot copy**. Recorded in IMPROVEMENTS #43 (now "done partially").
**Files:**
- `scripts/sync-main-bot-honest-catalog.mjs` — **NEW** — idempotent text patcher (4 nodes)
- `n8n/workflows/current/main-bot.json` — 4 catalog texts rewritten (deployed live)
- `docs/architecture/TELEGRAM-BOT-GUIDE.md` — §4.4 + §5 marked fixed
- `docs/architecture/IMPROVEMENTS.md` — #43 updated (static done, dynamic/admin-editable deferred)
**Tests:** no code logic (static n8n copy) — idempotency `--check` green; live-deployed node text verified via n8n API. **Not done (intentional):** live callback round-trip skipped — static text with no logic path, and to avoid more test messages to the admin chat.

### 2026-06-18 (session 38) — client notified on document-generation failure (#59) — live-verified
**Status:** DEPLOYED + live-verified · branch `fix/client-generation-failure-feedback` · closes #59 on merge
**Why:** In `form-submit`, everything after `Respond OK` (the 200 that closes the TWA) runs asynchronously: `Copy Template → … → Share Document`. A failure there only ever reached the catch-all `Error Trigger → Send Admin Alert` — and the Error Trigger runs in a SEPARATE execution with no access to the user's chat id, so only the admin was told. The client stayed forever on «Документ готується… ⏳». This already burned a real user (case `56e84825`, expired Google OAuth on Copy Template). See `TELEGRAM-BOT-GUIDE.md` §3.
**What happened:**
1. `n8n/templates/format-gen-failure.js` (NEW) — two pure formatters: `formatGenFailure({error,executionId,caseId,serviceTitle})` (admin alert) and `userFailureMessage(caseId)` (friendly client message). 9 unit tests.
2. `scripts/sync-user-error-feedback.mjs` (NEW) — idempotent patcher (GENERATED-code convention, like `sync-l4b-nodes.mjs`): sets `onError:'continueErrorOutput'` on the 7 generation nodes (Copy Template … Share Document — NOT Send Doc Link, whose failure means the doc IS ready, a different case left out of scope), adds `Format Gen Failure` (Code) + `Notify User Failed` (Telegram → client, `onError:continueRegularOutput`), and wires each generation node's error output (`main[1]`) → `Format Gen Failure`, which **fans out** to both `Notify User Failed` and the existing `Send Admin Alert`. The branch runs in the MAIN execution, so `$('Validate')._user_id` / `$('Insert Case').id` resolve directly — no n8n-API runData lookup, no extra secret. The catch-all Error Trigger stays for anything pre-Respond-OK.
3. **Live bug found and fixed by the smoke test, not the unit tests:** the first wiring chained `Format Gen Failure → Notify User Failed → Send Admin Alert` *sequentially*. The admin leg then received Notify User Failed's Telegram-RESPONSE output (no usable `text`) → Telegram `Bad request` → the failed terminal node flipped the whole execution to `error` → which spuriously fired the catch-all Error Trigger (a second, redundant admin alert). Fixed by fanning `Format Gen Failure` out to both nodes in parallel; re-verified the execution now completes `success` with exactly one user message + one admin alert.
**Live verification (issue #59 DoD):** forged a valid `initData` (so #56 passes legitimately), temporarily pointed Copy Template at an invalid Drive file id (via repo edit + deploy, restored after), submitted one divorce case. Confirmed via the n8n executions API: `Copy Template` errored → `Format Gen Failure` → `Notify User Failed` delivered «⚠️ Вибачте, … технічна помилка … 🔢 Ваш кейс №: …» to the client AND `Send Admin Alert` delivered the admin alert (case id + "The resource you are requesting could not be found" + exec id). Restored Copy Template, redeployed clean, deleted the 3 test `cases` rows.
**Files:**
- `n8n/templates/format-gen-failure.js` — **NEW**
- `n8n/templates/__tests__/format-gen-failure.test.js` — **NEW** — 9 tests
- `scripts/sync-user-error-feedback.mjs` — **NEW** — idempotent patcher
- `n8n/workflows/current/form-submit.json` — +2 nodes (40→42), onError on 7 gen nodes, error-output wiring (deployed live)
- `docs/architecture/TELEGRAM-BOT-GUIDE.md` — §3/§5 marked resolved
- `docs/architecture/DECISIONS.md` — new section: error-output branch vs Error Trigger, and the fan-out gotcha
**Tests:** 1019 root vitest ✅ (+9) · client unchanged · idempotency `--check` green. **Live-verified** (see above).

### 2026-06-18 (session 38) — stale-issue hygiene (#5 downgrade, #33 kept) + Olga tracker mirror
**Status:** COMMITTED (issue metadata + session-summary)
**Why:** Session-start review. Two issues flagged as candidates.
**What happened:**
- **#33** (CRON monitor) — verified it's a deliberate live tracker for two Olga-blocked actions (re-enable `schedule:` + resolve 2 detected law changes, ~2026-06-25). NOT stale — kept open. Mirrored its two specifics into `session-summary.md`'s «Backlog Ольги» block so they're visible at session-start (the durable copy stays in memory `project_cron_schedule_pending`).
- **#5** (lawyer row on signup) — verified current reality: `LoginPage.tsx` exposes only sign-in, `signUp()` is wired to no page (no self-service registration), the single lawyer account is provisioned manually, and revenue-share is deferred. The bug is neither solved nor currently relevant, so downgraded `priority: critical → strategic` and posted a comment documenting reality; kept open as backlog (real DoD — an `on_auth_user_created` trigger — still unmet, to revisit when lawyer roles land).
**Files:** `apps/client/.claude/session-summary.md` (Olga backlog block). Issue metadata via `gh`.

### 2026-06-18 (session 37) — initData HMAC verification in form-submit (#56) — live, issue resolved
**Status:** DEPLOYED + verified live · branch `fix/initdata-hmac-verification` · issue #56 all 3 checklist items done, closes on merge to `main`
**Why:** TWA's write-path only read `initDataUnsafe` (client-readable, spoofable) and accepted a bare `?uid=` from the URL with zero verification — anyone could open the form in a plain browser with someone else's Telegram id and submit a case under their identity. Dependency on #55 (working web_app button, so `initData` actually arrives) was satisfied last session.
**What happened:**
1. `n8n/templates/verify-init-data.js` (NEW) — `verifyInitData(initData, botToken, options)` implements Telegram's official **Mini App** algorithm (not the different Login Widget one): `secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)`, `hash = HMAC_SHA256(key=secret_key, msg=data_check_string)`, timing-safe compare, + a 24h `auth_date` freshness check against replay. 12 unit tests (`__tests__/verify-init-data.test.js`) cover valid/tampered/forged-user-id/wrong-token/expired/missing-field cases — all built by independently re-deriving a real signature in the test, not by calling back into the function under test.
2. `apps/client/src/App.tsx` — now sends the raw signed `tg.initData` string as `init_data` alongside the existing `user_id` field.
3. `scripts/sync-init-data-verification.mjs` (NEW) — idempotent patcher (same GENERATED-code convention as `sync-l4b-nodes.mjs`): adds a `TELEGRAM_BOT_TOKEN` placeholder to Global Config, regenerates `Validate`'s jsCode to call `verifyInitData`, adds a `uid_verified` column mapping to `Insert Case`. Design: `init_data` valid → trust the verified Telegram user id (`uid_verified=true`); `init_data` present but invalid → **hard reject (400)** — a real Telegram client always signs correctly, so this only fires on tampering or a token misconfig, and failing loudly beats failing silently for either; `init_data` absent entirely (old forwarded link opened outside Telegram) → fall back to the raw `user_id`, flagged `uid_verified=false` for audit, per the issue's own checklist wording.
4. `supabase/migrations/023_uid_verified.sql` — `cases.uid_verified BOOLEAN` (NULL = predates this column, true = HMAC-verified, false = unverified fallback) + an audit index. Applied live by Sergey directly in the Supabase SQL editor.
5. `scripts/deploy-workflow.mjs` — `YOUR_TELEGRAM_BOT_TOKEN → TELEGRAM_BOT_TOKEN` added to KEY_MAP (the token already existed in `.env.local`, reused from `check-law-updates.mjs`'s admin-alert path — same bot).
6. **Live bug found and fixed via smoke test, not unit tests:** all 12 unit tests passed locally, but the first live deploy rejected every request — including correctly-signed ones — with a generic `malformed` reason. Root cause, found by temporarily patching the live node to surface the real error: `URLSearchParams` is not a global inside n8n's Code node sandbox (`ReferenceError: URLSearchParams is not defined`), even though `require('crypto')`/`Buffer` are (proven by the pre-existing `Encrypt Data` node). Rewrote the query-string parsing by hand (`split('&')` + `decodeURIComponent`) with no dependency on that global. Re-verified live: valid signature → 200 + `uid_verified=true`; tampered signature (forged user id appended after signing, the exact #56 spoofing scenario) → 400 `invalid_init_data`; no `init_data` at all → 200 + `uid_verified=false`. Confirmed via direct Supabase reads of the resulting `cases` rows, not just HTTP status codes.
**Files:**
- `n8n/templates/verify-init-data.js` — **NEW**
- `n8n/templates/__tests__/verify-init-data.test.js` — **NEW** — 12 tests
- `scripts/sync-init-data-verification.mjs` — **NEW** — idempotent patcher
- `scripts/deploy-workflow.mjs` — KEY_MAP entry
- `supabase/migrations/023_uid_verified.sql` — **NEW** — applied live
- `apps/client/src/App.tsx` — sends `init_data`
- `n8n/workflows/current/form-submit.json` — Validate regenerated, Global Config + Insert Case patched (deployed live)
- `docs/architecture/TELEGRAM-BOT-GUIDE.md` — §8 marked resolved with the implementation summary
- `docs/architecture/DECISIONS.md` — new section on the fail-closed/fail-open asymmetry + the `URLSearchParams` sandbox gotcha
**Tests:** 903 root vitest ✅ (+12 new) · 103 client vitest ✅ · tsc clean. **Live-verified** against the real n8n webhook (not just unit tests) — see point 6 above.
**Merged:** PR #58 → `main` (`a9f8a72`), see follow-up entry below for the fail-open fix folded into the same PR before merge.

### 2026-06-18 (session 37 cont.) — close the fail-open gap the security scanner caught in #56 (#56 hardening)
**Status:** MERGED · same branch `fix/initdata-hmac-verification` / PR #58 → `main` (`a9f8a72`), branch deleted, issue #56 closed
**Why:** the commit-review and push-sweep automated security checks (security-guidance plugin) both independently flagged the same CRITICAL/HIGH finding right after the #56 work above was pushed: the "no `init_data` → fall back to the raw `user_id`, just flagged unverified" branch was still exploitable by the *exact* attack #56 was opened to close — an attacker doesn't need to forge an HMAC signature, they can simply omit `init_data` from the POST body entirely and the server trusted their claimed `user_id` anyway. The fallback was meant for dev/legacy use, but nothing distinguished that from a live attack request.
**What happened:**
1. `n8n/templates/verify-init-data.js` — added `resolveSubmission(initData, userId, botToken, { allowUnverified, maxAgeSeconds })`, a pure testable function that now makes the accept/reject call instead of leaving it inline in generated entry-point code: valid signature → trust it (`uidVerified: true`); present-but-invalid signature → reject regardless of any flag; **missing signature → reject by default**, only falling back to the raw `userId` (`uidVerified: false`) when `allowUnverified` is explicitly `true`.
2. `Global Config` gained `ALLOW_UNVERIFIED_UID: 'false'` — a literal, non-secret, server-only switch (same pattern as `GROQ_MODEL`) the client cannot read or influence. Stays `'false'` in production; an operator would have to flip it by hand in the live n8n Global Config node to ever re-enable the dev fallback.
3. `scripts/sync-init-data-verification.mjs` — regenerated `Validate`'s jsCode to call `resolveSubmission()` instead of duplicating the accept/reject branching inline; added the `ALLOW_UNVERIFIED_UID` placeholder-insertion step (idempotent, like the rest of the script).
4. 4 new unit tests for `resolveSubmission` (valid → verified; invalid signature → rejected even with `allowUnverified: true`; missing signature + default flag → rejected; missing signature + `allowUnverified: true` → accepted unverified) — the missing-signature-rejected case is the one that would have caught this regression before it ever reached production.
5. Live re-smoke-tested against the real webhook with a known `identities.external_id` test profile: valid signed `init_data` → 200, `cases.uid_verified=true` (confirmed via direct Supabase read); tampered → 400 `invalid_init_data` (unchanged); **missing `init_data` → now 400 `missing_init_data`** (this is the fix — previously this returned 200).
**Files:**
- `n8n/templates/verify-init-data.js` — added `resolveSubmission()`
- `n8n/templates/__tests__/verify-init-data.test.js` — +4 tests
- `scripts/sync-init-data-verification.mjs` — generates `resolveSubmission()`-based entry point + `ALLOW_UNVERIFIED_UID` flag
- `n8n/workflows/current/form-submit.json` — Validate regenerated, Global Config patched (deployed live)
- `docs/architecture/TELEGRAM-BOT-GUIDE.md` — §8 updated, fail-open framing corrected
- `docs/architecture/DECISIONS.md` — #56 section rewritten: both invalid paths are now fail-closed, regression explained
**Tests:** 907 root vitest ✅ (+4 new) · live-verified (see point 5). **Merged** to `main` same session — Sergey requested the merge directly rather than reviewing the diff first.

### 2026-06-18 (session 36) — Telegram bot onboarding fixes (#55 G3) — issue complete
**Status:** MERGED · PR#57 (`0123510`) · branch `feature/bot-onboarding-g3` deleted after merge · issue #55 **closed** (all 3 groups G1+G2+G3 done)
**Why:** Continuation of session 35's `main-bot` audit (`docs/architecture/TELEGRAM-BOT-GUIDE.md` §4.2/§4.3). Two functional bugs remained after G1 (Error Trigger) + G2 (web_app button): a brand-new user's first real message was swallowed (Welcome New User was a dead-end node), and tapping `Ask Confirm`'s Так/Ні buttons leaked the raw `callback_data` into Pre-filter/AI Agent as plain text instead of being routed.
**What happened:**
1. `scripts/sync-main-bot-onboarding.mjs` (NEW) — idempotent patcher, same convention as `sync-main-bot-fixes.mjs`. Adds 4 nodes (`Mark New User`, `Is Callback?`, `Route Callback`, `Callback: Confirm Service?`), rewires `Welcome New User`/`User Exists?` connections, updates `Pre-filter`'s code to carry an `_is_new` flag through, adds an `_is_new` greeting prefix to `Show Menu`/`Send Help`/`Ask Confirm`/`Send TWA Button`, and adds a `🔄 Інша послуга` button to `Send TWA Button`. Caught and fixed a self-review bug before deploying: the greeting-prefix injector double-wrapped text on a second run (no it-already-has-the-prefix check) — fixed by detecting a marker substring before wrapping, confirmed idempotent (0 changes) on a second run.
2. Deployed via `scripts/deploy-workflow.mjs main-bot` (26→30 nodes, all 4 new nodes credential-free so no rebinding risk).
3. **Verified live** against the real n8n webhook (`POST /webhook/tg-webhook/webhook`, secret token derived from n8n's own formula `${workflowId}_${nodeId}` after `node_modules` source inspection — Telegram Trigger v1.1+ rejects unauthenticated calls). Three scenarios via the n8n executions API: (a) existing-user text message → `Is Callback?`(FALSE)→`Pre-filter`→AI Agent→`Send TWA Button` with the new 🔄 button and no greeting prefix (`_is_new=false` correctly suppressed it) — confirmed live in Sergey's own Telegram; (b) `callback_query: show_menu` → `Route Callback`→`Callback: Confirm Service?`(FALSE)→`Show Menu`, AI Agent never invoked; (c) `callback_query: confirm_service_1` → same routing → `Get Service (high)`→`Is Active?`→`Send TWA Button` for the correct service. A 4th test with a synthetic (non-existent) chat ID hit Telegram's `400 chat not found` on `Welcome New User` as expected (fake chat can't receive messages) — incidentally re-confirmed G1's Error Trigger still alerts correctly. Cleaned up the test profile/identity rows created during that run.
4. Updated `docs/architecture/TELEGRAM-BOT-GUIDE.md` §4.2/§4.3 (marked fixed, fix description), §5 table, §9 plan (all 3 groups ✅).
**Files:**
- `scripts/sync-main-bot-onboarding.mjs` — **NEW** — idempotent G3 patcher
- `n8n/workflows/current/main-bot.json` — +4 nodes, rewired connections, Pre-filter code, 4 prefixed texts, new button (deployed)
- `docs/architecture/TELEGRAM-BOT-GUIDE.md` — §4.2/§4.3/§5/§9 marked done
**Issue:** #55 — all 3 checklist boxes ticked (G1/G2/G3), comment posted with verification detail; closes automatically on merge to `main`.
**Not done:** out-of-scope items remain backlogged (#6 initData security, IMPROVEMENTS #43/#4a).

### 2026-06-18 (session 35) — Telegram bot un-broken: web_app button + Vercel domain + Error Trigger (#55 G1+G2)
**Status:** COMMITTED · branch `feature/bot-reliability-onboarding` → merged to main · issue #55 **stays OPEN** (G3 onboarding remains) · #56 created (initData security)
**Why:** Session started as `/session-start` → a discussion on reducing RAG hallucinations / lawyer hand-off → pivoted to "polish the Telegram user interaction". While mapping the bot, Sergey hit a live bug: typing «Алименты» (an existing user, real service, high confidence) returned **silence**. Diagnosed via the n8n executions API, not the repo file.
**What happened:**
1. **Audit doc** `docs/architecture/TELEGRAM-BOT-GUIDE.md` (NEW) — mapped the live `main-bot` flow + `form-submit` UX path from the n8n API (the repo file's `active:false` was stale). Logged issues #55 (bot reliability/onboarding/button) + #56 (server-side initData verification, #6) + IMPROVEMENTS #75 (loading indicator + honest catalog) + #76 (TWA custom domain / config-driven base URL).
2. **Root cause of the silence (exec 54):** the whole pipeline ran fine (Normalize → AI Agent classified alimony → Get Service → Is Active) and `Send TWA Button` failed with Telegram `400: can't parse inline keyboard button: Text buttons are unallowed`. Cause: the button used `webAppUrl`, a field name from an **older** n8n Telegram node; n8n 2.20.6 expects `web_app: { url }` (confirmed by reading the node source in the container — `addAdditionalFields` `Object.assign`s the button, so the stale key was sent verbatim and Telegram rejected it). An n8n upgrade silently broke it. Plus `main-bot` had **no Error Trigger** (unlike form-submit) → invisible to user and admin.
3. **G2** — fixed `webAppUrl` → `web_app: { url }`. Live test surfaced a **second, separate** failure: the form opened inside Telegram but Vercel returned `404 DEPLOYMENT_NOT_FOUND` — the bot hardcoded `legal-twa.vercel.app`, but the live prod deployment is at **`legal-twa-xi.vercel.app`** (Vercel auto-suffixed `-xi`; bare name taken). Verified `legal-twa.vercel.app`→404, `legal-twa-xi…/?service=alimony`→200. Repointed the launch URL (centralised in `TWA_BASE_URL`). **Verified live end-to-end: service → web_app button → form opens in Telegram on the new domain.**
4. **G1** — added Error Trigger → Format Error → Send Admin Alert to `main-bot` (mirror of form-submit).
5. Reconciled the repo `main-bot.json` to live (identical except cred ids; deploy rebinds creds from live), minimised `settings` to the public PUT API shape. Migrated the dead domain in `ServiceEditPage.tsx` + `ARCHITECTURE.md`/`DECISIONS.md`.
**Files:**
- `scripts/sync-main-bot-fixes.mjs` — **NEW** — idempotent patcher (G1 error chain + G2 web_app/url, `TWA_BASE_URL` const)
- `n8n/workflows/current/main-bot.json` — reconciled to live + G1+G2 (deployed)
- `docs/architecture/TELEGRAM-BOT-GUIDE.md` — **NEW** — bot map/audit + confirmed root cause + launch decision (§7-9)
- `apps/client/src/admin/pages/ServiceEditPage.tsx`, `docs/architecture/{ARCHITECTURE,DECISIONS}.md` — dead-domain migration
- `docs/architecture/IMPROVEMENTS.md` — #75, #76
**Commits:** `c4b3373` (G1+G2), `0e0bb53` (domain), `0d22042` (IMPROVEMENTS #76), `525e34d` (audit doc).
**Deployed + verified live:** `main-bot` 23→26 nodes, active; typed-service → web_app button → form loads on `legal-twa-xi`. **Not done:** G3 (onboarding: new-user dead-end + callback Так/Ні + 🔄 + greeting prefix) — next session, Sonnet, fresh branch.

### 2026-06-18 (session 34) — Retrieval Debt: wire is_stale flagging into applyLawChange (#11)
**Status:** MERGED · PR#54 (`6705b98`) · branch `feature/retrieval-debt-is-stale` deleted after merge · issue #11 closed automatically (`Closes #11`)
**Why:** Picked from the Tier-1 backlog. Issue #11 asked for an `is_outdated` flag on `law_chunks` + CRON wiring + Telegram alert. Investigating the schema first (per the project's stale-issue habit) found 3 of 4 Definition-of-Done items already existed under a different name: `is_stale BOOLEAN` already on both `law_chunks` and `law_documents` (migration 002/003), already filtered (`WHERE is_stale = false`) in every read RPC (`search_law_chunks`, `search_law_chunks_hybrid`, `search_law_text`, `get_law_articles`), and the Telegram alert already shipped in session 19. The actual gap: nothing ever set the flag to `true` on a detected law change.
**What happened:**
1. `scripts/law-registry.mjs` — new `lawCode(law)`: derives the rada doc-id (e.g. `2947-14`) from a law's canonical URL, matching `law_chunks.law_code` / `law_documents.law_code`.
2. `scripts/lib/law-change.mjs` — the canonical `applyLawChange()` (already the single producer shared by the GitHub Actions CRON and the manual CLI) now additionally PATCHes `law_chunks` and `law_documents` to `is_stale=true` by `law_code`, independent of whether any service depends on the law (the RAG flag protects retrieval, not just document-generation services).
3. `scripts/service-lifecycle.mjs` and `scripts/check-law-updates.mjs` — one new console line each reporting the staleness flip, for operator visibility.
4. Verified live (read-only): `log-law-change simeinyi-kodeks 2026-05-25 --dry-run` against the real Supabase correctly resolved divorce+alimony as dependents; a real PATCH against a non-existent `law_code` confirmed the REST call/schema/permissions work without touching any real row.
**Files:**
- `scripts/law-registry.mjs` — `lawCode()` export
- `scripts/lib/law-change.mjs` — stale-marking step in `applyLawChange()`
- `scripts/lib/__tests__/law-change.test.mjs` — `lawCode` tests + stale-patch assertions (incl. orphan-law case)
- `scripts/service-lifecycle.mjs`, `scripts/check-law-updates.mjs` — console visibility line
- `docs/architecture/IMPROVEMENTS.md` — #29 updated with what was already done vs. newly done vs. deferred
**Tests:** root vitest 994/994 ✅ (was 981, +13: +11 from session 33's merged PRs, +2 new `lawCode` tests; existing law-change tests extended in place) · client vitest 103/103 ✅ · tsc clean
**Not done (explicitly out of scope, was solution narrative not a DoD item):** automated re-indexing (scraping new article text + re-embedding) — separate, larger pipeline. The manual path already works: `replace_law_chunks` (used by `seed-divorce-laws.ts --force`) clears `is_stale` as a side effect of its full delete+insert.
**Issue:** #11 closed (all 4 DoD items satisfied).

### 2026-06-18 (session 34) — Admin toast (#18): mobile verification + close
**Status:** VERIFIED, no code change · issue #18 closed
**Why:** Session 33 shipped the toast (PR#53) but left #18 open pending the one remaining DoD box: "Перевірено на мобільному (toast не перекриває UI)" — blocked last session on having no admin test login.
**What happened:** Used the Supabase admin API (`generate_link`, service-role key, local script — never exposed to the browser) to mint a one-time magic-link session for the lawyer test account, without ever touching/knowing the password. Loaded the real local admin app (`admin.html`) at a 375×667 mobile viewport, opened the live `alimony` service editor, and intercepted `window.fetch` for the Supabase `PATCH /services` call (returning a mocked 403 then a mocked 200) so both the error and success toasts could be exercised live without writing to the real production database. Screenshots confirmed `Toast` (`fixed bottom-4 ... z-[60] max-w-[90vw]`) renders centered, fully within the viewport, and doesn't overlap any persistent UI — `AdminLayout` has no bottom nav bar on mobile (top bar only), and the toast's z-index is above the sidebar/preview-modal anyway. Signed out and cleaned up all temp artifacts (magic-link file, screenshots, Playwright snapshots) afterward.
**Files:** none (verification only).
**Tests:** n/a (manual/browser verification).
**Issue:** #18 closed (last DoD box ticked).

### 2026-06-17 (session 33) — Admin toast on save/load error (#18)
**Status:** MERGED · PR#53 (`dd1d93f`) · branch `fix/admin-save-toast` deleted after merge · issue #18 left OPEN (mobile + live-render not verified this session — low remaining token budget)
**Why:** Second small backlog item this session. Save/load errors in `ServiceEditPage.tsx` failed silently (`setSaving(false)` with no feedback) — a lawyer could lose edits without knowing.
**What happened:** Added a minimal own `Toast` component (`apps/client/src/admin/components/Toast.tsx` — fixed bottom-center, auto-dismiss 4s, no new dependency) and wired it into save-success, save-error, and load-error paths. `publishService` from the issue's "also check" list doesn't exist separately — publishing is just `handleSave` with a status field, already covered.
**Files:**
- `apps/client/src/admin/components/Toast.tsx` — **NEW**
- `apps/client/src/admin/pages/ServiceEditPage.tsx` — toast wiring on save/load
**Tests:** `tsc -b` clean. **Not done:** live browser render (no admin test login in this env) and mobile-overlap check — Sergey to verify manually.

### 2026-06-17 (session 33) — DatePickerField: manual ДД.ММ.РРРР input (#27)
**Status:** MERGED · PR#52 (`ea881d4`) · branch `fix/datepicker-manual-input` deleted after merge · issue #27 closed automatically (`Closes #27`)
**Why:** Small UX fix picked from the backlog (IMPROVEMENTS #10а / issue #27): selecting a birth year far in the past (e.g. 1985) required clicking through many 12-year calendar pages — a real pain point since most clients enter a birth date 30+ years back. Implemented Option A from the issue: a masked text input next to the calendar button, so the date can be typed directly.
**What happened:**
1. `DatePickerField.tsx` — replaced the click-to-open `<div>` trigger with a real `<input>` (masked `ДД.ММ.РРРР`, `inputMode="numeric"`) next to the calendar icon button. Two new pure helpers: `maskDateInput` (digits → live-formatted display string as you type) and `parseDisplay` (validates real calendar bounds — day-in-month, month 1-12, year 1900..now+1 — and converts to the internal ISO `YYYY-MM-DD`). A complete valid date commits immediately via `onChange`; an incomplete or impossible date (e.g. `31.02.1990`) shows a red border + "Некоректна дата" instead of failing silently. Picking via the calendar (or clearing) still works exactly as before and re-syncs the text input via a `value`-watching effect.
2. Moved the field's `id` from the old non-focusable wrapper `<div>` onto the actual `<input>` — `FieldLabel`'s `htmlFor` now correctly focuses the input when the label is clicked (previously a no-op).
3. Exported the two new pure helpers and added `__tests__/DatePickerField.test.ts` — 11 unit tests (masking edge cases incl. backspace/dot-stripping/8-digit cap; date validation incl. leap years, short months, out-of-range years) — first tests for this component, following the project's existing pure-logic-test convention (no component-rendering library in this repo).
4. Browser-verified live via Playwright against the running divorce form: typing `15031985` auto-formats to `15.03.1985` and commits; opening the calendar afterward jumps straight to March 1985 with day 15 selected (the exact problem from the issue); typing an impossible date shows the error state; correcting it clears the error.
**Files:**
- `apps/client/src/components/form/fields/DatePickerField.tsx` — masked input + validation, replaces click-only trigger
- `apps/client/src/components/form/fields/__tests__/DatePickerField.test.ts` — **NEW** — 11 tests
**Tests:** client vitest 103/103 ✅ (was 92, +11) · tsc clean
**Not done:** real-device check on iOS/Android Telegram TWA (listed in the issue's Definition of Done) — only browser (Playwright/Chromium) verified this session.

### 2026-06-17 (session 32) — divorce-with-children G1-G3 (#28): "суд визначить" + графік побачень (ст.157 СК)
**Status:** MERGED · PR#50 (`58ef2d2`) · branch `docs/divorce-with-children-spec` deleted after merge · issue #28 closed automatically (`Closes #28`)
**Why:** Roadmap v2.3 next item after the checklist-validator cycle closed. Scoped down from the original issue #28 during planning: the existing `divorce` service already handled basic has-children residence/dispute/alimony; "опіка" in Ukrainian family law (for children with living parents) isn't a separate guardianship institute, it's the right to participate in upbringing / contact (ст.157 СК). All 3 dependencies the original issue listed (#19 GraphRAG table, #17 hybrid templates, stable alimony service) turned out to already be satisfied by infrastructure built for alimony-change (sessions 20-29). Net-new scope: a `court`-decides option for `children_live_with`, and an agreed/disputed visitation-schedule clause — both fully deterministic, no hybrid/LLM pipeline (confirmed with Sergey before implementation).
**What happened:**
1. Wrote Tier-2 spec triplet (`specs/features/divorce-with-children/{plan,requirements,validation}.md`), mirroring alimony-change's format but scoped to the deterministic delta.
2. Added 2 new form fields + 1 new option to `divorceFormConfig.ts`; added the `court` branch + visitation paragraph + a new "ПРОШУ" numbered item to `divorce.document.txt`.
3. **Highest-risk part:** the existing numbering chain for optional ПРОШУ items (5-8) is a hand-written if/else-if combinatorial chain (no variables/arithmetic in the template DSL). Inserting a new item in the middle would have required rewriting all 3 downstream formulas (verified by generation that the debt formula at 4 dependencies balloons to a ~1200-char single line). Placed the new item LAST instead — zero changes to the existing tested formulas, only one new isolated (programmatically verified across all 16 boolean combinations before pasting into the template) formula.
4. Found and fixed a real bug via the new tests: the `court` branch initially left a dangling "...р.н.." double period and "з ________" placeholder nonsense (asking the court to decide residence "with ________" makes no sense). Fixed the template's with-clause branching.
5. Citation-coverage drift guard (session 22's mechanism) caught the new ст.157 СК citation automatically — regenerated the golden, verified the title via web search (3 independent legal-reference mirrors agree: "Вирішення батьками питань щодо виховання дитини"), and wrote migration 022 to add it to `divorce.watched_laws` (applied live via REST).
6. Live deploy: uploaded the updated template (`upload-document-template.mjs`) and form_config (`update-form-configs.mjs`) to Supabase. Smoke-tested via a new `test-webhook.mjs` scenario 5 against the real local n8n — confirmed via the n8n REST executions API that `Build Document` rendered the new clause correctly (numbered item 7 in that scenario: residence=5, alimony=6, visitation=7) and `_checklist_result.ok===true`.
7. **Unrelated pre-existing bug found & fixed along the way:** `scripts/update-form-configs.ts` had broken relative import paths left over from before the monorepo restructure (`../src/data/...` instead of `../apps/client/src/data/...`), and depended on `@supabase/supabase-js` which isn't resolvable from a repo-root script (only lives in `apps/client/node_modules`, and Node resolves `node_modules` upward from the importing file, not cwd). Rewrote it to use the shared dependency-free `scripts/lib/supabase-rest.mjs` client (matching the convention every other root script already uses) and renamed `.ts` → `.mjs`.
**Files:**
- `specs/features/divorce-with-children/{plan,requirements,validation}.md` — **NEW** — Tier-2 spec triplet
- `apps/client/src/data/divorceFormConfig.ts` — `children_live_with` +`court` option; `visitation_dispute` + `visitation_schedule_text` fields
- `n8n/templates/services/divorce.document.txt` — court branch, visitation paragraph, new last ПРОШУ item, with-clause bugfix
- `n8n/templates/services/divorce.citations.json` — regenerated golden (+ст.157)
- `n8n/templates/__tests__/divorce-children-visitation.test.js` — **NEW** — 9 tests, direct engine-output assertions
- `scripts/lib/__tests__/citations.test.mjs` — updated pinned divorce citation set
- `supabase/migrations/022_divorce_visitation_citation.sql` — **NEW** — applied live
- `scripts/update-form-configs.ts` → `scripts/update-form-configs.mjs` — **rewritten** (broken pre-existing script, fixed as a side effect of needing it)
- `scripts/test-webhook.mjs` — new scenario 5 (visitation schedule smoke test)
- `docs/architecture/DECISIONS.md` — new section on the numbering-chain placement decision
- `specs/roadmap.md` — v2.3 line ticked ✅
**Tests:** root vitest 981/981 ✅ (was 972, +9) · client vitest 92/92 ✅ · tsc clean. Original 263 divorce parity tests pass **unmodified**.
**Live-verified:** real n8n execution, `Build Document` correct; unrelated pre-existing infra issue surfaced (`Copy Template` failing on expired Google OAuth grant — same class of incident as session 15, needs Sergey to re-authorize; not a regression from this work).
**Not done:** nothing outstanding — feature fully shipped (committed, pushed, PR merged, issue closed, live-verified).

### 2026-06-17 (session 31) — live deploy completed: checklist-validator + hybrid hardening + 2 production bugs found & fixed
**Status:** COMMITTED · branch `fix/checklist-deploy-and-abstention-filter` → merged to main
**Why:** Sergey stepped away and authorized autonomous execution of the already-agreed next-session deploy plan (deploy workflow → upload checklists → smoke test → docs), with explicit stop conditions agreed in advance (test regression / live-only node conflict / smoke-test failure). Verified live infra state first rather than trusting session-summary's claim — this surfaced that PR#45's hybrid-hardening nodes (`Prepare L4b`, `L4b LLM Critic`, `Update Case Abstention`) had never actually been pushed to live n8n despite being merged to main since session 29, so this deploy closed that gap too, not just the checklist hook.
**What happened:**
1. Full regression pass before touching prod: root vitest 972/972, client vitest 92/92, tsc clean.
2. `node scripts/deploy-workflow.mjs form-submit` — live n8n was missing 3 nodes from PR#45 (37→40 nodes), pushed cleanly, zero live-only conflicts, auto-backup taken.
3. `node scripts/upload-document-checklist.mjs divorce` / `alimony` — hit a false-negative verification bug: Postgres `jsonb` reorders object keys on storage (by key length then lexicographic), so the script's `JSON.stringify` round-trip compare reported "differs" even though the uploaded data was byte-identical in substance. Fixed with a recursive key-sort canonicalization before comparing (both the pre-check and the post-write verify).
4. Smoke test (scenario 2, `has_children=true`) against the live webhook surfaced a second, unrelated live bug: `Update Case Abstention` (added session 29/PR#45, never live until step 2) used a flat `id` param to match the row to update — the current n8n Supabase node version silently drops that field, leaving `filters: {}` empty and failing on every single case with `"At least one select condition must be defined"`. Fixed by switching to `filters.conditions` (mirrors the already-working pattern in "Get Profile"), in both the live workflow JSON and the generator script `sync-abstention-node.mjs` so a future regen can't reintroduce it.
5. Re-deployed, re-ran the smoke test: execution #50 `status=success`, `_checklist_result.ok===true`, `cases.checklist_failed=false`, `cases.abstained=null` all persisted correctly.
**Files:**
- `n8n/workflows/current/form-submit.json` — Update Case Abstention node: flat `id` → `filters.conditions`
- `scripts/sync-abstention-node.mjs` — same fix, for future regeneration
- `scripts/upload-document-checklist.mjs` — canonicalized (order-insensitive) deep-equal compare, replacing the raw `JSON.stringify` checks
- `specs/features/checklist-validator/validation.md` — G3/G4 ticked, Definition of Done updated
- `specs/roadmap.md` — checklist-validator line: 🔴 → 🟢, "next session" deferral note removed
**Tests:** no regressions — same 972 root / 92 client (no app code changed, only workflow JSON + script logic + docs)
**Not done (intentionally out of scope, per agreed stop conditions):** `alimony-change` status flip, CRON `schedule:` re-enable, anything on the ~2026-06-25 Olga punch list.

### 2026-06-17 (session 30, cont.) — PR#48 merged: checklist-validator → main, issue #4 closed
**Status:** MERGED · `c1b2dc9` (fast-forward, 17 files)
**Why:** Sergey applied migrations 020+021, started Docker, and authenticated n8n — infra unblocked, but live deploy (workflow push + checklist upload) is deferred to a fresh session per his instruction ("новой сессии продолжим"). This session just merges the code; deploy steps below remain the next session's first task.
**Next session — live deploy (infra now available):**
1. `node scripts/deploy-workflow.mjs form-submit` — push regenerated Build Document node (checklist hook) + `checklist_failed` field to live n8n
2. `node scripts/upload-document-checklist.mjs divorce` and `... alimony` — populate `services.required_checklist`
3. Manual smoke test: submit one divorce case with `has_children=true` and confirm `_checklist_result.ok === true` in the n8n execution log
4. Update `specs/features/checklist-validator/validation.md` G3 checkboxes once confirmed live

### 2026-06-17 (session 30, cont.) — checklist-validator: required-clause check (issue #4 / IMPROVEMENTS #39)
**Status:** COMMITTED · branch `feature/checklist-validator` (merged to main above)
**Why:** Issue #4 (🔴 critical, open since the bulk-import in session 11) asked for an automatic check that generated documents contain every legally-mandatory element — missing one means a legally incorrect lawsuit. Hit an explicit Tier-2 trigger in SDD-GUIDE.md ("affects legal correctness — error = invalid lawsuit"), so got a real spec (`specs/features/checklist-validator/`). The issue's original proposal (LLM regenerates the whole document on failure) was stale — divorce/alimony have rendered through the deterministic doc-engine template since session 20, no LLM in that path at all. Replaced with a pure deterministic regex-presence check on the rendered text, reusing render-document.js's own `{{#if}}` condition parser for applicability (`appliesIf`) instead of inventing a second condition language.
**Files:**
- `n8n/templates/render-document.js` — export `evalExpr` (additive, 1 line)
- `n8n/templates/validate-checklist.js` — **NEW** — `validateChecklist`, `evalCondition` (pure, no LLM)
- `n8n/templates/__tests__/validate-checklist.test.js` — **NEW** — 15 tests (unit + integration against real divorce/alimony templates, incl. the "custody decided vs. deferred to separate proceedings" case that justified `mustMatchAny` over a single fixed string)
- `n8n/templates/services/divorce.checklist.json` — **NEW** — 5 items
- `n8n/templates/services/alimony.checklist.json` — **NEW** — 4 items
- `scripts/sync-build-document-node.mjs` — footer calls `validateChecklist` when `svc.required_checklist` is non-empty; `_checklist_result` added to return JSON (no new node)
- `scripts/sync-checklist-field.mjs` — **NEW** — idempotent patcher, adds `checklist_failed` field to the existing "Update Case Abstention" node (no new Supabase node)
- `scripts/upload-document-checklist.mjs` — **NEW** — mirrors `upload-document-template.mjs`
- `supabase/migrations/021_checklist_validation.sql` — **NEW** — `services.required_checklist` JSONB + `cases.checklist_failed` BOOLEAN
- `apps/client/src/admin/pages/DashboardPage.tsx` — second badge, mirrors the abstention-rate badge pattern (session 29)
- `specs/features/checklist-validator/{plan,requirements,validation}.md` — **NEW** — Tier-2 spec triplet
- `docs/architecture/DECISIONS.md` — new section on why deterministic + why the condition language is reused
- `specs/roadmap.md` — new line under Технічний борг
**Tests:** root vitest 972/972 ✅ (was 957, +15) · client vitest 92/92 ✅ · tsc clean
**Not done in this session:** live deploy. n8n wasn't running and Supabase CLI wasn't linked locally, so migration 021 isn't applied and the workflow JSON change isn't pushed to live n8n yet — same as migration 020 currently. Next session: `supabase db push` + `node scripts/deploy-workflow.mjs form-submit` + `node scripts/upload-document-checklist.mjs divorce` / `alimony`.

### 2026-06-17 (session 30) — PR#45 merged + stale-issue cleanup (#7, #14, #25)
**Status:** COMMITTED · branch `chore/stale-issue-cleanup`
**Why:** Session-start review found 3 open GitHub issues whose underlying problem was already solved by earlier work, just via a different approach than originally described — same root cause as session 28's stale-issue hygiene (bulk-imported IMPROVEMENTS in session 11, never re-checked against later sessions). Closed each with a comment pointing to what actually solved it, and corrected `roadmap.md` checkboxes that contradicted already-shipped work.
**Issues closed:**
- **#7** "[#2б] Агент-критик після генерації документу" → solved by L4a `groundedness.js` + L4b LLM critic (`prepare-l4b.js`) + abstention, sessions 24/25/29
- **#14** "[#38] Faithfulness Gate — валідатор галюцинацій" → same L4a/L4b critic mechanism
- **#25** "Технічний борг: delivery pipeline error recovery" → items 4–7 of `workflow-improvements.md` shipped + deployed in session 15 (Refs #30); only deprioritized item 3 (Ensure Profile auto-create, Task #1) remains, not needed for PoC
**Files:**
- `specs/roadmap.md` — 3 stale checkboxes corrected: alimony-change hybrid pilot (done, G1–G5, disabled pending Olga), typography phase 2 (done, session 27), n8n v7 hardening (done, session 15, only Task #1 remains)
**PR#45:** merged to `main` (`97598fe`, fast-forward), branch deleted.

### 2026-06-17 (session 29) — IMPROVEMENTS #74 + #69 + #73 (hybrid pipeline hardening)
**Status:** COMMITTED · `feature/hybrid-integration-test` (`6e4c6f0`, `b39d13e`, `81ffcd0`) · PR#45 open
**Why:** Три IMPROVEMENTS реалізовані за одну сесію: (#74) integration test pinning повного ланцюжка без реального Groq; (#69) L4b LLM Critic підключений у n8n через новий sync-скрипт; (#73) end-to-end трекінг частоти abstention — DB колонка + n8n PATCH нода + dashboard badge. Тепер hybrid pipeline повністю verified у тестах і моніторингу.
**Files:**
- `n8n/templates/__tests__/hybrid-pipeline-integration.test.js` — **NEW** — 8 integration tests (fixture L3 → real checkGroundedness → real renderDocumentWithStyles)
- `n8n/templates/prepare-l4b.js` — **NEW** — `prepareL4b()` + `fillCriticTemplate()` pure fns
- `n8n/templates/build-hybrid-context.js` — `parseL4bResponse()` + 5th param l4bResponse; L4b RED → abstain; AMBER info in review_card
- `n8n/templates/__tests__/prepare-l4b.test.js` — **NEW** — 21 unit tests
- `scripts/sync-l4b-nodes.mjs` — **NEW** — patches Prepare L4b + L4b LLM Critic into form-submit.json
- `supabase/migrations/020_abstention_tracking.sql` — **NEW** — `cases.abstained BOOLEAN DEFAULT NULL`
- `scripts/sync-build-document-node.mjs` — FOOTER: `abstained` in return value
- `scripts/sync-abstention-node.mjs` — **NEW** — idempotent patcher for Update Case Abstention Supabase node
- `apps/client/src/admin/pages/DashboardPage.tsx` — abstention rate badge (last 30 days)
- `n8n/workflows/current/form-submit.json` — 37→40 nodes
**Tests:** 957/957 ✅ · TypeScript clean

### 2026-06-17 (session 28) — harness-visual + process hygiene + IMPROVEMENTS #73 #74
**Status:** COMMITTED · `main` (`2e6c7db`) · pushed
**Why:** Проект розрісся до 28 сесій і стало важко тримати в голові де що є і що треба робити. Сесія присвячена наведенню порядку: локальна карта харнесу (один файл з усім), 2 нових IMPROVEMENTS-ідеї з критики карти, і процесний фікс щоб стейл-issue більше не накопичувались (root cause: bulk-import IMPROVEMENTS → GitHub Issues в сесії 11 без подальшого закриття).
**Files:**
- `apps/client/.claude/harness-visual.md` — **NEW** (локальний, не комітити) — bird's eye стека, n8n flow, AI harness L0–L5 + ABSTAIN path, таблиця послуг, law lifecycle, задачі з залежностями
- `docs/architecture/IMPROVEMENTS.md` — #73 (abstention rate monitoring) + #74 (e2e hybrid integration test)
- `.claude/commands/session-start.md` — крок 4: scan open issues, flag stale у брифінгу
- `CLAUDE.md` — stale issue rule + IMPROVEMENTS ≠ GitHub Issues

### 2026-06-16 (session 27) — typography phase 2: {{!style:}} → Google Docs styling (#50)
**Status:** COMMITTED · `main` (`06019a7`) · PR#43 merged · задеплоєно
**Why:** Документи генерувались як plain text без жодного форматування — «ПОЗОВНА ЗАЯВА» йшла звичайним текстом. Директиви `{{!style:}}` вже були в усіх шаблонах (зарезервовано в doc-engine #34), але рендерер їх ігнорував. Тепер: `renderDocumentWithStyles()` відстежує styleHints → 3 нові ноди в workflow → Google Docs batchUpdate застосовує реальне форматування. +IMPROVEMENTS #72 (multi-template architecture note).
**Files:**
- `n8n/templates/render-document.js` — `classifyTag` розрізняє `style`/`comment`; `renderNodesInto()` shared builder; `renderDocumentWithStyles()` → `{text, styleHints}`
- `n8n/templates/apply-typography.js` — **NEW** — `buildTypographyRequests(styleHints, docBody)` → Google Docs batchUpdate requests
- `n8n/templates/__tests__/apply-typography.test.js` — **NEW** — 16 тестів
- `n8n/templates/__tests__/render-document.test.js` — +9 тестів для `renderDocumentWithStyles`
- `scripts/sync-typography-nodes.mjs` — **NEW** — ідемпотентний патчер (Get Document + Build Typography Request + Apply Typography)
- `scripts/sync-build-document-node.mjs` — template/hybrid → `renderDocumentWithStyles` + `_style_hints`
- `n8n/workflows/current/form-submit.json` — 34→37 нодів
- `docs/architecture/IMPROVEMENTS.md` — #72 (multi-template)

### 2026-06-16 (session 26) — model-agnostic: GROQ_MODEL у Global Config (#40)
**Status:** COMMITTED · `main` (`988373c`) · PR#41 merged · задеплоєно
**Why:** `model: 'llama-3.3-70b-versatile'` був захардкоджений у `prepare-reasoning.js:150` — невидимий для n8n конфігу. Тепер модель = 1 поле у Global Config; зміна провайдера/моделі без редагування коду. Groq key залишається як n8n credential (достатньо для пілоту); `GROQ_API_KEY` placeholder у Global Config — для майбутнього Code node fallback перед VPS.
**Files:**
- `n8n/templates/prepare-reasoning.js` — optional `modelName` param
- `scripts/sync-hybrid-nodes.mjs` — entry point reads GROQ_MODEL from Global Config
- `n8n/workflows/current/form-submit.json` — Global Config: GROQ_MODEL + GROQ_MODEL_FALLBACK + GROQ_API_KEY
- `scripts/deploy-workflow.mjs` — KEY_MAP: YOUR_GROQ_API_KEY → GROQ_API_KEY
- `docs/architecture/DECISIONS.md` — нова секція «Model-agnostic AI harness»
- `docs/architecture/IMPROVEMENTS.md` — #71 оновлено

> Optional scratch area (simplified session 16) — git tracks uncommitted state, so this is usually empty.
> The session-15 entries below are already committed + merged (kept as the why-log; hashes noted).

### 2026-06-16 (session 25, final) — IMPROVEMENTS #71: model-agnostic ecosystem
**Status:** COMMITTED · `main` (`b7d2d70`) · PR#39 merged
**Why:** Зафіксовано 4 паттерни захисту від vendor lock-in (LiteLLM router / fallback chain / model в конфізі / Ollama self-hosted). Контекст: Fable 5 інцидент доводить, що ШІ-моделі — регульована інфраструктура, яку можуть відключити в будь-яку хвилину.
**Files:**
- `docs/architecture/IMPROVEMENTS.md` — #71 в індекс + тіло (4 паттерни, таблиця кроків, пріоритет 🟠)

### 2026-06-16 (session 25, cont.) — alimony-change G5: docs + close #37 + merge (#37)
**Status:** COMMITTED · `main` (`2cedcf8`, `ae3ac80`) · PR#38 merged
**Why:** G5 фіналізує Tier 2-пілот: архітектурні рішення G4 задокументовані в DECISIONS.md,
два відкладені поліпшення (#69 L4b, #70 Google Docs spans) зафіксовані в IMPROVEMENTS.md.
Issue #37 закрито. Сесія 25 завершена, гілка готова до merge.
**Files:**
- `docs/architecture/DECISIONS.md` — новий розділ «Hybrid pipeline (G4)» (no Merge node / injectable checkGroundedness / court fee §3.4 / idempotent sync-hybrid-nodes)
- `docs/architecture/IMPROVEMENTS.md` — #69 (L4b LLM critic) + #70 (Google Docs batch-comments) додані в індекс і тіло

### 2026-06-16 (session 25) — alimony-change G4: handoff + n8n integration (#37)
**Status:** committed · branch `feature/alimony-change-g3` · `a945b10`, `a397866`
**Why:** G4 розширює Build Document dispatch для `generation_mode='hybrid'`, додає 6 нових нодів у form-submit workflow (Is Hybrid? / Skip Hybrid / L2 Get Norms / Prepare Reasoning / L3 Reasoning / L4 Critics) і збирає review-card для юриста. Логіка детермінована: Groq llama-3.3-70b-versatile → L4a critic (groundedness.js) → abstention (RED→fallback) → `ai.reasoning` → шаблон. Деплой потребує запущеного n8n (localhost:5678 не відповідав).
**Files:**
- `n8n/templates/prepare-reasoning.js` — **NEW** — pure fn `prepareReasoning()`: L0 answers + L2 rows → Groq request body + `_l2_article_ids` + `_answers_snapshot`
- `n8n/templates/build-hybrid-context.js` — **NEW** — pure fns: `parseL3Response`, `buildCourtFeeSummary` (§3.4, PM=3328), `buildQuestionsForLawyer`, `buildHybridContext` (L4c abstention + review-card)
- `n8n/templates/__tests__/prepare-reasoning.test.js` — **NEW** — 20 тестів (createRequire, без new Function())
- `n8n/templates/__tests__/build-hybrid-context.test.js` — **NEW** — 40 тестів (vi.fn() mocks, abstention, court fee, questions)
- `supabase/migrations/019_generation_mode_hybrid.sql` — **NEW** — widened CHECK + UPDATE alimony-change to 'hybrid'
- `scripts/sync-hybrid-nodes.mjs` — **NEW** — генерує 6 нових n8n нодів, зсуває 8 downstream нодів +1200px, перемикає з'єднання AI Declension → Is Hybrid?; ідемпотентний
- `scripts/sync-build-document-node.mjs` — MODIFIED — додано гілка `hybrid` у dispatch (читає `$json._ai_reasoning`, `$json._review_card`), `_review_card` у return value
- `n8n/workflows/current/form-submit.json` — MODIFIED — 6 нових нодів + shifted positions + нові з'єднання (deploys pending n8n start)

### 2026-06-16 (session 24, cont.2) — alimony-change G2+G3: граф норм + critics (#37)
**Status:** COMMITTED · `feature/alimony-change-g2` (`8de4e4f`) + `feature/alimony-change-g3` (`0ee2d9b`, `ca776a9`) — не змержені в main
**Why:** G2 будує граф юридичних зв'язків для alimony-change: нова таблиця `law_relations` з двома SECURITY DEFINER RPC (non-destructive upsert_law_chunk + upsert_law_relation), 8 ребрами ст.192→{182,183,184,ст.4/5 ЗСЗ,ст.176/28/27 ЦПК}, RLS (public read only). G3 реалізує критичний рівень (L3/L4): prompt для Groq JSON-mode з enum-обмеженими цитатами, детермінований critic (L4a) для перевірки чисел/дат/ПІБ/справ проти L0, LLM-critic (L4b) для per-sentence статусу GREEN/AMBER/RED + abstention-правило. Знайдено та виправлено: SQL-синтаксис ORDER BY перед FROM у migration 017 (скрін від Сергія) — ORDER BY перенесено після FROM. RLS додав сам Сергій в Supabase → скаптуровано у міграцію 018.
**Files:**
- `supabase/migrations/017_law_relations.sql` — **NEW** — таблиця law_relations + upsert_law_chunk + upsert_law_relation (SECURITY DEFINER, SET search_path, REVOKE PUBLIC, GRANT service_role)
- `supabase/migrations/018_law_relations_rls.sql` — **NEW** — RLS для law_relations (public read, no write policy)
- `scripts/seed-alimony-change-laws.mjs` — **NEW** — seeds 16 статей (СК/ЦПК/ЗСЗ) + 8 law_relations edges, --dry-run, embeddings=null
- `n8n/prompts/alimony-change-reasoning.txt` — **NEW** — L3 Groq JSON-mode prompt (cite only L2_ARTICLE_IDS, 100-200 words, Ukrainian legal prose)
- `n8n/templates/groundedness.js` — **NEW** — L4a critic: citations ∈ L2, amounts/fractions/dates/case_numbers/names ∈ L0 → RED/AMBER spans + has_red flag
- `n8n/prompts/alimony-change-critic.txt` — **NEW** — L4b LLM critic: per-sentence GREEN/AMBER/RED, "суд зобов'язаний" → RED
- `n8n/templates/__tests__/groundedness.test.js` — **NEW** — 16 тестів (ESM vitest, CJS-loader pattern)

### 2026-06-15/16 (session 24, продовження) — alimony-change G1: повна реалізація (#37)
**Status:** COMMITTED · branch `feature/alimony-change-g1` (`9a2cfab`, `273d069`)
**Why:** Пілотна реалізація нового сервісу «Зміна розміру аліментів (↑/↓)» у режимі `generation_mode='template'` (перший сервіс, що не має legacy JS-builder). G1 охоплює: L0.5 routing (route.js), шаблон документа (147 рядків DSL), form_config для UI (TS), 3 golden-сценарії (TC1/TC2/TC9) з очікуваними виводами байт-в-байт, 132 parity-тести (структурна матриця 96 комбо + 29 гілочних перемикачів + 3 golden-луп), citations.json (витягнутий extract-citations.mjs), SQL-міграція 016. Виявлено та виправлено: вкладений `{{ai.reasoning}}` всередині `{{! comment }}` ламав нежадібний TAG_RE-токенізатор → рендер повертав сміттєвий перший рядок.
**Files:**
- `n8n/templates/route-alimony-change.js` — **NEW** — L0.5 route() + ROUTE enum + ABSTAIN_MESSAGES; default enabled=false (G1)
- `n8n/templates/services/alimony-change.document.txt` — **NEW** — 147-рядковий шаблон DSL (юрисдикція, сторони, підстави, збір, борг, ПРОШУ, Додатки)
- `apps/client/src/data/alimonyChangeFormConfig.ts` — **NEW** — FormConfig 4 таби (Сторони/Попереднє рішення/Діти/Зміна обставин), ~38 полів із show_if і hint
- `test-data/alimony-change/fixtures/scenario-{1,2,3}.mjs` — **NEW** — golden-фікстури (TC1 збільш/%, TC2 зменш/fixed non-floor, TC9 зменш/fixed floor+existing_debt)
- `test-data/alimony-change/expected/scenario-{1,2,3}.txt` — **NEW** — байт-ідентичні очікувані виводи
- `n8n/templates/__tests__/alimony-change-template-parity.test.js` — **NEW** — 132 тести (96 структурна матриця + 29 гілочних + 3 golden)
- `n8n/templates/services/alimony-change.citations.json` — **NEW** — авто-витягнутий (СК 182-184/191/192/197, ЦПК 27/28/174/175/176, ЗСЗ 4/5)
- `supabase/migrations/016_alimony_change_service.sql` — **NEW** — INSERT alimony-change (status='disabled', generation_mode='template', watched_laws)

### 2026-06-14/15 (session 23) — Tier-каталог услуг (ТЗ) + критич. обзор legaltech + консолидация веток в main
**Status:** COMMITTED · напрямую в `main` (`35e9381`, `d54aa88`, `a3ccbf9`, + этот коммит) — сессия = свод всего в один main по просьбе Сергея; ветки удалены вручную (git-прокси окружения блокирует ref-delete 403)
**Why:** Сергей с другом-AI-инженером прорабатывали Tier 2/3 услуги: какие услуги попадают в категории, какой Input/Output, как строить AI-харнесс (что детерминировать, где критик, как подсвечивать галлюцинации, что и в каком формате отдавать юристу). Затем — взгляд критика: как это закрывали в мире. Веб-сверка: Stanford (Lexis+ 17% / Westlaw 33% галлюцинаций ДАЖЕ с RAG), DoNotPay/FTC ($193k за overpromise), HotDocs/Docassemble (document automation без LLM 30 лет), Harvey/CoCounsel (юрист в петле + citation grounding + Shepardization, ~0.2%). Вывод усиливает курс: операбельный текст детерминированный, генерация выносится из доверенного пути, abstention + «перевірено юристом» = ров. Закреплён канон Document-Tier 0/1/2/3 (≠ SDD-Tier). Это ТЗ/research — НЕ реализация.
**Files:**
- `docs/research/document-tiers-tz.md` — **NEW** — канон Tier 0/1/2/3 + критич. обзор мирового legaltech (4 эталона, 7 improvements I1–I7); Tier 0 пример (стягнення аліментів: алгоритм + нюансы), схожая Tier 2 (зміна розміру аліментів: сложности/опции/цели, augment→automate)
- `docs/research/service-tiers-and-ai-harness.md` — **NEW** — deep-dive 6-слойного харнесса + 7 дискриминаторов; T1/T2/T3 → канон Tier 0/1/2/3
- `specs/features/alimony-change/{plan,requirements,validation,example}.md` — **NEW** — полное Tier 2 ТЗ: Input/Output, юр. алгоритм (ст.192/182/183/184/191 СК; ст.28/176/175 ЦПК; ст.4/5 ЗСЗ), асимметрия суд. сбора ↑/↓ (exception_if), харнесс L0–L5 (enum-констрейнт + 2 критика + abstention + review-card), пример с подсветкой 🟢/🟡/🔴
- `specs/roadmap.md` — v2.3 указывает на новое ТЗ
- `README.md` — **NEW** — корневой README (EN), порт из ecstatic-bohr (UK-вариант не тащили)
- `docs/architecture/IMPROVEMENTS.md` — порт CI + security-аудита как #53–#68 (+5, чтобы не задеть стабильные #48–#52)
- `apps/client/.claude/{changelog,session-summary}.md` — этот журнал
**Branches:** свёл в main: adoring-dirac (доки, FF), ecstatic-bohr (README+IMPROVEMENTS); fervent-pascal и spec-driven были уже в main. Все 4 удалены — остался только `main`.
**Next:** реализация alimony-change НЕ начата. Перед Tier 2 Опцией C — стендовый eval-харнесс (I1). Рекомендованный v0 = Опция B (юрист пишет обоснование).

### 2026-06-12 (session 21, продолжение) — research GraphRAG-стека + решение в DECISIONS
**Status:** COMMITTED · branch `docs/graphrag-research` → main
**Why:** Сергей принёс кандидатов (PageIndex, LightRAG, NornicDB, Weaviate-стек из видео) и спросил: как в мире строят GraphRAG, можно ли извлекать связи без юриста, есть ли решения «малый корпус без галлюцинаций». Проведено внешнее веб-исследование (Stanford о галлюцинациях Lexis/Westlaw 17–33%, Citation Grounding на украинских судебных данных — regex-извлечение ссылок с precision 1.00, GraphJudger, LightRAG/EraRAG об инкрементальности). Вывод: фреймворки не внедряем (решают проблемы масштаба, которых у нас нет), паттерны заимствуем; связи — по трём ярусам доверия (regex авто / LLM+критик для retrieval / юрист для логико-управляющих); ноль галлюцинаций достигается конструкцией (enum-констрейнт, abstention-фолбэк), не проверкой.
**Files:**
- `docs/research/graphrag-stack.md` — **NEW** — исследование с источниками (разбор 5 кандидатов + доказательная база + ярусы + бюджет)
- `docs/architecture/DECISIONS.md` — новый раздел «GraphRAG-стек: патерни замість фреймворків + три яруси довіри звʼязків» + строка в TOC
- **Addendum (конец сессии):** в оба файла добавлена модель затрат — построение графа = dev-сессии по подписке (без API-ключа; extraction-промпт фиксируется в репо, результат = данные через ревью), платный API только в runtime hybrid-секции, старт возможен на бесплатном Groq. + session-summary: новая секция Session 21.

### 2026-06-11 (session 21) — divorce портовано на шаблон doc-engine (#35)
**Status:** COMMITTED `5760cc1` + docs commit · branch `feature/divorce-template-port`
**Why:** Друга (остання) послуга злазить з hardcoded JS-білдера: контент divorce тепер дані в БД, юрист може правити формулювання без розробника. Спірне зі спеки #34 вирішено: сервіс-специфічні словники (REASONS_MAP, EXEMPT_REASONS) і динамічна нумерація «ПРОШУ» — у самому шаблоні (if-ланцюжки), движок лишився сервіс-агностичним. Движок розширено тільки generic-механізмами, бо легасі-семантика divorce відрізнялась у 4 точках: поля `spouse_*` (аліас), `has_children` = поле форми (шар `answers.*`), нумерований fallback `children_genitive` (шар `ai_raw.*` + `child.raw`), крапка в кінці деталей майна/боргів (хелпер `ensurePeriod`).
**Files:**
- `n8n/templates/render-document.js` — generic-розширення buildContext + `ensurePeriod` (всі з тестами)
- `n8n/templates/services/divorce.document.txt` — **NEW** — шаблон, байт-у-байт еквівалент `buildDivorceDocument`
- `n8n/templates/__tests__/divorce-template-parity.test.js` — **NEW** — 263 parity-тести (матриця нумерації + AI-fallbacks + toggles + 4 голдени)
- `n8n/workflows/current/form-submit.json` — Build Document регенеровано (движок оновився)
- `scripts/set-generation-mode.mjs` — **NEW** — флип `generation_mode` (rollback-інструмент, з guard'ом)
- docs: DECISIONS (divorce-порт), IMPROVEMENTS #52, roadmap, runbook document-template-editing
**Tests:** root vitest 655/655 ✅ (було 385). **Live:** деплой 28 нод → divorce js-регресія exec 40 ✓ → флип template: exec 41 (діти+аліменти), 42 (простий) — live `_content` === движок === legacy байт-у-байт → rollback-флип js exec 43 ✓ → назад template → alimony-регресія exec 44 ✓. Обидві послуги live на `generation_mode='template'`.

### 2026-06-10 (session 15) — local dev runbook + dev-up + Google OAuth recovery
**Status:** COMMITTED `5ce0093` · merged to main via #30
**Why:** Error Trigger (щойно задеплоєний) одразу виявив РЕАЛЬНИЙ тихий збій: нода `Copy Template` падала з Google-OAuth `invalid/expired/revoked` → документи не генерувались, юзер бачив лише «готується». Корінь: OAuth consent screen у Testing → Google анулює refresh-токен за 7 днів простою; плюс ngrok гасився, плюс забутий пароль n8n без SMTP. Зафіксували весь шлях відновлення, щоб не «відкривати в моменті».
**Files:**
- `docs/runbooks/local-dev-startup.md` — **NEW** — чеклист старту (n8n+ngrok), `dev-up.ps1`, gotchas: ngrok offline, OAuth протух → durability-fix (Publish consent → Production), cross-origin login через ngrok-URL, ngrok-interstitial, скидання пароля `user-management:reset`.
- `scripts/dev-up.ps1` — **NEW** — одна команда: підіймає n8n (Docker) + ngrok (статичний домен), idempotent.
**Ops done (live, no repo change):** бекап БД n8n → `user-management:reset` (забутий пароль) → новий власник → Google OAuth переавторизовано (через ngrok-origin) → `docker update --restart unless-stopped n8n`. **Verified:** сабмит exec 34 `success`, lastNode `Send Doc Link` — документ генерується end-to-end ✅.
**Next step (за тобою):** OAuth consent screen → Publish → Production (прибрати 7-денне протухання). Не блокує — токен зараз валідний.

### 2026-06-10 (session 15) — workflow hardening v7: error visibility + guards
**Status:** PENDING COMMIT · Refs #30
**Why:** divorce+alimony — живі послуги, а workflow падав ТИХО при будь-якій помилці після валідації (БД, Groq-таймаут, Google Docs) — юзер без відповіді, оператор без сигналу. Робимо так, щоб провал було ВИДНО.
**Files:**
- `n8n/workflows/current/form-submit.json` — 22→28 нод: **Error Trigger → Format Error → Send Admin Alert** (Telegram-алерт адміну на будь-який unhandled-збій); **Get Profile guard** (`Check Profile` → `Has Profile?` → `Respond No Profile` 422; `alwaysOutputData` на Get Profile/Get Service); try/catch навколо диспатчу Build Document (re-throw з `service+case`); структурний Respond Error (`code/message`).
- `n8n/templates/format-error.js` + `__tests__/format-error.test.js` — **NEW** — формат алерта (5 тестів).
- `n8n/templates/check-profile.js` + `__tests__/check-profile.test.js` — **NEW** — guard-логіка профілю (4 тести).
- `apps/client/src/App.tsx` — на non-503 помилці показує серверний `message` (напр. no_profile) замість загального алерта.
- `docs/architecture/workflow-improvements.md` — секція «v7 applied» + оновлено implementation order.
- `scripts/build-n8n-workflow.mjs` — **DELETED** — застарілий генератор (старі шляхи, divorce-only, захардкожені ротовані секрети, порушення правила #11).
**Tests:** root vitest 162/162 ✅ · client vitest 68/68 ✅ · tsc clean ✅
**Commit:** `a487a01` (branch `feature/workflow-hardening`, pushed) · Refs #30
**Deployed + verified (live):** 22→28 нод, active. Error Trigger спрацював на 3/3 збоях (включно з РЕАЛЬНИМ Google-OAuth падінням `Copy Template` — раніше тихим); no-profile → 422; happy-path → документ end-to-end (`Send Doc Link`).
**Next step:** merge `feature/workflow-hardening` → main з `Closes #30`.

---

## 📜 Commit history (most recent first)

> Append new entries at the top (newest first).

### 2026-06-15 (session 24, продовження) — практичний бриф для друга (.NET AI engineer) + issue #37 (alimony-change Tier 2 pilot)
**Status:** COMMITTED `3d619b2`/`ecb3891`/`b029b1b` · branch `docs/alimony-change-legal-deep-dive`
**Why:** Сергій хоче віддати другу (AI engineer, практика на .NET) самодостатнє практичне ТЗ за мотивами alimony-change — WHAT (вхід/правила/вихід/тест-кейси/критерії), HOW цілком на його розсуд. Окремо: Оля ще не повернулась (~2026-06-25) — позначили 6 пунктів «proposed design» у `test-matrix.md` §6 як pending на той самий таймлайн (зв'язано з `project_cron_schedule_pending`). І заведено issue #37 з чеклістом G1–G5 (`plan.md`) для самого пілота alimony-change — фокус наступної сесії.
**Files:**
- `docs/research/tier2-practice-brief-dotnet.md` — **NEW** — самодостатній практичний бриф (укр.): вхідний JSON, база знань L2 (13 статей, з посиланнями на zakon.rada.gov.ua), L0.5 `route()`, детермінований скелет L1 (registry 2026, 50%-floor як review-card flag, не hard-валідація), L3/L4 grounding+critics, 2 worked examples (TC1/TC3), TC1–TC12, критерії успіху, «що не задано», + посилання на реальні зразки позовних заяв
- `specs/features/alimony-change/test-matrix.md` §6 — нотатка про недоступність Олі (~2026-06-25)
**Issue:** [#37](https://github.com/Ki4/Legal-AI/issues/37) — alimony-change Tier 2 pilot, чекліст G1–G5, G1 не блокується відсутністю Олі (`route()`=`PROCEED` за замовчуванням)
**Next step:** нова сесія — G1 (#37) на окремій гілці: детермінований скелет + L0.5 routing, vitest, без LLM.

### 2026-06-15 (session 24) — alimony-change: юридичний deep-dive (підсудність, індексація, новий шар L0.5)
**Status:** COMMITTED `4ac802b` · branch `docs/alimony-change-legal-deep-dive`
**Why:** Сергій помітив неузгодженість тірів (T0/T1/T2 vs T1/T2/T3) і попросив звести канон + дослідити українське законодавство для пілота Tier 2 (alimony-change), щоб переконатись, що нічого не пропущено, та написати ТЗ (вхідні варіації / тест-кейси / очікуваний вихід). Канон Tier 0/1/2/3 підтверджено (`document-tiers-tz.md`). Юридичне дослідження дало 8 знахідок: 2 КРИТИЧНІ (формулювання `child_needs_up` плутає ст.192 з ст.181/185; `cost_of_living_up` для твердої суми — це індексація ст.184, не ст.192), 2 ВИСОКІ (текст «ПРОШУ» — момент дії; підсудність асиметрична за напрямком), 3 СЕРЕДНІ (значення ПМ-2026; процедура за договором ст.189; борг ст.197) + 1 спостереження (відсутнє значення enum `recipient_income_up`).
**Files:**
- `specs/features/alimony-change/requirements.md` — §0 (юр.алгоритм): нові пп.8 (`agreement_own_procedure`/ст.189), 9 (`existing_debt`/ст.197), резолюція п.7 (момент дії «ПРОШУ»); §1: розбито enum `child_needs_up` → `_general`/`_extraordinary`; нова §2.0 (таблиця маршрутизації `route()`), §2.4 (тексти абстенцій); нова §3.0 псевдокод `route()`; §3.4 конкретні значення ПМ-2026; §4 новий рядок гарнесу `L0.5 Routing`
- `specs/features/alimony-change/test-matrix.md` — **NEW** — «ТЗ для друга»: D1–D9 вхідні вимірювання, таблиця `route()` (R1–R5), детерміновані гілки (підсудність/збір/«ПРОШУ»), L3/review-card специфікація, TC1–TC12 тест-кейси, таблиця «pending Оля» (6 пунктів)
- `specs/features/alimony-change/example.md` — Case A (enum `child_needs_up_general`, текст «ПРОШУ» з моментом дії), Case B (підсудність ст.27 ЦПК, збір 1 331,20 = 0.4×3328)
- `specs/features/alimony-change/plan.md` — G1: новий пункт L0.5-маршрутизації (pending Оля, до підтвердження = завжди PROCEED); шаблон абстенцій
- `specs/features/alimony-change/validation.md` — G1/G2: тести підсудності, «ПРОШУ»-момент, L0.5-маршрутизація, citation-coverage для ABSTAIN_*; нові edge-cases
- `docs/research/document-tiers-tz.md` §6, `docs/research/service-tiers-and-ai-harness.md` §7 — пп.2–4 ✅ RESOLVED (момент дії, ПМ-2026, підсудність); нові пп. для child_needs_up split / cost_of_living_up+fixed / agreement_own_procedure / existing_debt / recipient_income_up — всі «pending Оля»
**Note:** Новий шар L0.5 (`ABSTAIN_EXTRAORDINARY`/`ABSTAIN_INDEXATION`) і нові питання форми (`agreement_own_procedure`, `existing_debt`) — **проєктна пропозиція, не реалізація**; до підтвердження Олею маршрутизація завжди `PROCEED`.
**Next step:** Олі на ревью — таблиця 6 пунктів у `test-matrix.md` §6.

### 2026-06-12 (session 22, продовження) — citation-coverage: regex-екстрактор + golden-страж + закриття дрейфу (#36)
**Status:** PENDING COMMIT · branch `feature/citation-coverage` · Refs #36
**Why:** Шаг 0 GraphRAG (ярус 1 — явні посилання на статті законів: regex, авто-приймається, без ревʼю юриста). Карта каталогу (сесія 22) знайшла дрейф між тим, що цитують шаблони документів, і тим, що відстежує CRON law-monitor через `watched_laws` (cited-but-not-watched = слабка точка: зміна закону може пройти непоміченою). Побудовано regex-екстрактор цитат → golden SSoT (`<slug>.citations.json`) + vitest-страж дрейфу шаблон↔golden → CLI `report`/`sync --dry-run` звіряє golden↔`watched_laws`. Знайдено 2 реальних дрейфи (ст.27 ЦПК divorce, ст.174 ЦПК alimony) і 1 false positive (ст.181 СК alimony — екстрактор коректно розгорнув діапазон «180–184» через en-dash, watched_laws вже коректний). Migration 015 закриває обидва дрейфи + проактивно додає ст.113 СК (divorce, `surname_after_divorce` — готуємо watched_laws заздалегідь під правку шаблону ~2026-06-25).
**Files:**
- `scripts/lib/citations.mjs` — **NEW** — regex-екстрактор (two-pass: citation-перед-законом / закон-перед-дужкою), `expandArticleList` (діапазони через `-`/`–`), нормалізація через `law-registry`
- `scripts/lib/__tests__/citations.test.mjs` — **NEW** — 16 тестів (діапазони, `ст.ст.`, edge case if-ланцюжка, реальні шаблони)
- `n8n/templates/services/{divorce,alimony}.citations.json` — **NEW** — golden SSoT (згенеровано через `--write`)
- `n8n/templates/__tests__/citations-drift.test.js` — **NEW** — страж: `golden === extract(template)`
- `scripts/extract-citations.mjs` — **NEW** — CLI: `--write` / `report` / `sync --dry-run`
- `supabase/migrations/015_citation_coverage.sql` — **NEW** — закриває ст.27 ЦПК (divorce), ст.174 ЦПК (alimony) + додає ст.113 СК (divorce, проактивно). `$json$...$json$::jsonb` dollar-quoting (як migration 010) — без екранування апострофів в українському тексті.
- `docs/architecture/DECISIONS.md` — новий розділ «Citations as data: regex-екстрактор + golden-страж (GraphRAG крок 0)» + TOC
- `specs/roadmap.md` — нова підсекція «2.0 Citation coverage (крок 0, regex-шар) ✅»
**Tests:** root vitest 674/674 ✅ (було 655)
**Live:** migration 015 застосована через Supabase REST (`sbPatch`, без SQL — апострофи в JSON не проблема); `node scripts/extract-citations.mjs report` → «✅ All cited articles are watched» (exit 0). SQL-файл міграції — відтворювана фіксація цієї зміни (ідемпотентний при повторному запуску).
**Note:** перша спроба прогнати SQL-файл вручну в Supabase SQL Editor дала синтаксичну помилку (неекрановані апострофи в `'[...]'::jsonb`, напр. «пред'явлення»). Виправлено переходом на `$json$...$json$::jsonb` (як migration 010) — усуває проблему екранування повністю, без зміни даних (live вже коректний).
**Next step:** merge `feature/citation-coverage` → main з `Closes #36`.

### 2026-06-12 (session 22) — правило model-routing: модель на сессию по тиру задачи
**Status:** COMMITTED · branch `chore/session-22-summary` → main
**Why:** Сергей спросил, стоит ли использовать топ-модель (Fable) для рутинных задач. Решение: модель выбирается раз на сессию по SDD-тиру следующей задачи (1 сессия = 1 фокус → выбор в момент `/session-start`): Tier 0/1 по готовому issue → Sonnet; Tier 2 / архитектура / research / юр-критичное → Opus+. Skill-роутер не пишем — субагенты стартуют с холодным контекстом, совещательной строки в briefing достаточно. Переключение `/model` сохраняет контекст разговора.
**Files:**
- `CLAUDE.md` (root) — пункт «Model per session (routing by tier)» в Session protocol
- `.claude/commands/session-start.md` — briefing завершается строкой **Recommended model** + критерии выбора

### 2026-06-12 (session 22) — карта каталога услуг + ветвлений → вход для GraphRAG шага 0
**Status:** COMMITTED · branch `docs/service-catalog-branching-map` → main
**Why:** Сергей попросил понять полный желаемый каталог услуг (не только live) и от чего зависят ветвления документов — как вход для retrieval-архитектуры (intent detection, FAQ-индексация, clarifying questions из доклада о RAG-маршрутизации). Анализ live-данных (watched_laws + form_config из Supabase + regex по шаблонам) показал: (1) весь семейный кластер сидит на 3 законах — граф один на кластер; (2) ветвления делятся на юр-значимые (≈ готовые рёбра яруса 3 «факт → норма», уже покрыты parity-тестами) и реквизитные; (3) ядро уже реализует детерминированную версию паттернов доклада — техники применимы к трём будущим слоям, не к ядру; (4) найден drift шаблоны↔watched_laws (ст.27, ст.174 ЦПК не watched; ст.113 СК не цитируется) — ровно класс ошибок под regex-слой s21.
**Files:**
- `docs/research/service-catalog-branching-map.md` — **NEW** — каталог 10 услуг, таксономия драйверов ветвлений, правовая база live-услуг, drift-находки, маппинг 7 техник, план шага 0
**Next step:** GraphRAG шаг 0 — regex-экстрактор цитат + sync watched_laws + тест-страж от дрейфа (предложение следующей задачи).

### 2026-06-11 (session 20) — doc-engine: сервіс-агностична генерація документа (Tier 2, #34)
**Status:** COMMITTED on `feature/doc-engine` (spec `6089cb2`, G1 `c8de138`, G2 `91ec5ca`, G3 `285c5c5`, G4 `3c68ba8`, G5 — цей коміт) · merge → main `Closes #34`
**Why:** остання розірвана петля фундаменту — контент документа жив у захардкоджених JS-білдерах усередині ноди Build Document (45K chars, dispatch по slug), `ai_prompt` декоративний → нова послуга/правка формулювання = сесія розробки. Розділено КОД (один движок, тестується раз) і КОНТЕНТ (декларативний шаблон на послугу в БД) — дзеркало доведеної пари DynamicLegalFormBuilder+form_config. Режим = властивість послуги (`generation_mode`), майбутні hybrid/ai_generate — розширення того ж dispatch. Доказ: alimony портовано **байт-у-байт** (117 parity-тестів: матриця 72 комбінації + гілки + 3 голдени) + live-звірка n8n exec'ів. Розриви сторінок/типографіка — зарезервовані `{{!style:}}` директиви (правила-не-позиції), фаза 2 = IMPROVEMENTS #50.
**Files:**
- `specs/features/doc-engine/{plan,requirements,validation}.md` — **NEW** — Tier 2 спека; контракт DSL (§3) = довгоживучий формат, ревʼю Сергієм до коду
- `n8n/templates/render-document.js` — **NEW** — движок: парсер DSL (без eval) + рендерер + хелпери + `buildContext` (computed-шар: імена, гендери, діти)
- `n8n/templates/__tests__/render-document.test.js` — **NEW** — 56 юніт-тестів (кожна конструкція DSL + помилки з номером рядка + скан сирців на eval)
- `n8n/templates/services/alimony.document.txt` — **NEW** — шаблон alimony (SSoT у git; у БД — runtime-копія)
- `n8n/templates/__tests__/alimony-template-parity.test.js` — **NEW** — 117 parity-тестів проти legacy builder + голдени
- `supabase/migrations/014_doc_engine.sql` — **NEW** — `generation_mode` (js|template, CHECK, default js) + `document_template`; **застосовано + верифіковано REST**
- `scripts/upload-document-template.mjs` — **NEW** — generic заливка шаблону (`--dry-run`, ідемпотентний, round-trip звірка)
- `scripts/sync-build-document-node.mjs` — **NEW** — анти-дрейф: нода Build Document ГЕНЕРУЄТЬСЯ з дзеркал (движок + 2 legacy builders + dispatch); інлайн-правка заборонена
- `n8n/workflows/current/form-submit.json` — Build Document 45K→64K chars: + движок + dispatch по `generation_mode` (fallback на legacy js)
- `docs/architecture/DECISIONS.md` — розділ «Doc-engine» (чому шаблон-дані, чому не AI, байт-паритет, правила-не-позиції, анти-дрейф)
- `docs/architecture/IMPROVEMENTS.md` — #49 declension-конвенція, #50 фаза 2 типографіки, #51 admin-редактор; #17 → вирішено інакше
- `docs/runbooks/document-template-editing.md` — **NEW** — як юрист/оператор міняє текст документа (без передеплою)
- `specs/roadmap.md` — техборг «сервіс-агностична генерація» закрито + 3 хвости (divorce-порт, фаза 2, admin-редактор)
- `.gitattributes` — LF-фіксація для шаблонів і test-data (байт-у-байт на будь-якому checkout)
**Tests:** root vitest **385/385** ✅ (було 213, +172). **Live:** деплой 28 нод ✓; e2e до флипу exec 35 ✓; флип alimony→template: exec 36/37 `success`, live-вихід === движок === legacy builder байт-у-байт ✓; rollback-флип ✓ (exec 38); divorce регресія exec 39 ✓. **Стан проду:** alimony на `template`, divorce на `js`.
**Next step:** merge → main (`Closes #34`). Наступні сесії: divorce-порт; фаза 2 типографіки (#50 — запит Сергія «красиві відступи»); admin-редактор (#51).

### 2026-06-11 (session 19) — cron-law-monitor: автоматичний моніторинг змін законів
**Status:** PENDING COMMIT · branch `feature/cron-law-monitor`
**Why:** замикаємо lifecycle-петлю «виробником» записів. Панель ревʼю (s18) вже вміла показувати зміни законів, але їх ніхто не створював автоматично — лише ручний `service-lifecycle.mjs log-law-change`. Тепер CRON сам відстежує zakon.rada → детектує зміну редакції → канонічний flow (`law_change_log` + флип залежних послуг у `needs_review`) → панель Ольги. Хост — GitHub Actions: працює незалежно від ноута/n8n/VPS (надійність важливіша за «все в стеку»), + ручна кнопка, + локальний запуск. Будували одразу під ріст каталогу послуг (дедуп спільних законів, retry/backoff).
**Architecture (anti-drift):** детектор НЕ дублює логіку — переніс канонічний `applyLawChange` у спільний модуль, який тепер кличуть і ручний CLI, і CRON (single producer of `law_change_log`). Ідентичність закону = URL (реєстр), тому спільний закон (СК у divorce+alimony) фетчиться **раз**, не per-service.
**Files:**
- `scripts/lib/supabase-rest.mjs` — **NEW** — спільний REST-клієнт + `loadEnv` (прибрав дубль між 2 скриптами).
- `scripts/lib/rada.mjs` — **NEW** — `extractRevisionDate` (чистий парсер) + `fetchWithRetry` (backoff+jitter+`Retry-After` на 429/5xx/мережеві) + `fetchRevisionDate`. Виправлено баг референса (`printUrl` ReferenceError).
- `scripts/lib/law-change.mjs` — **NEW** — канонічний `applyLawChange` (reverse-index по URL → `law_change_log` `action=flagged` → флип услуг у `needs_review` + bump `last_known_date`). Чисті дані, без console.
- `scripts/check-law-updates.mjs` — **REWRITE** — детектор: ітерує реєстр → детект → `applyLawChange(detected_by='cron')` → Telegram-алерт. Дедуп спільних законів, ідемпотентний (bump дати → наступний прогон бачить «без змін»).
- `scripts/service-lifecycle.mjs` — рефактор: `log-law-change` тепер кличе спільний `applyLawChange` (без інлайн-дублю); спільний supabase-клієнт.
- `.github/workflows/law-monitor.yml` — **NEW** — `workflow_dispatch` (кнопка, з опц. dry-run) + `schedule` (пн 06:00 UTC) **тимчасово закоментований** поки Ольга недоступна (авто-флип нікому ревʼюити; розкоментувати = 2 рядки). Без `npm install` (лише Node built-ins + fetch).
- `scripts/lib/__tests__/rada.test.mjs` + `law-change.test.mjs` — **NEW** — 27 тестів (парс дат + ловушка adoption-date; retry/Retry-After/exhaustion/404-no-retry; reverse-index по URL крізь slug-drift; dry/live applyLawChange).
- `docs/runbooks/law-monitor-cron.md` — **NEW** — налаштування 4 GH-секретів (за Сергієм), ручний запуск, lawyer-review loop, надійність, масштаб.
- `docs/architecture/IMPROVEMENTS.md` — #48 (умовні запити If-Modified-Since/ETag при рості реєстру — відкладено).
- `specs/roadmap.md` — моніторинг змін законів → петля замкнена ✅.
**Tests:** root vitest **213/213** ✅ (було 162 +51 — рада/law-change + інше). Live dry-run проти zakon.rada: парсер коректний (судовий збір збігся з відомою датою).
**🔴 Live finding (рішення за Сергієм):** dry-run виявив 2 РЕАЛЬНІ зміни — СК `2026-03-04→2026-05-25`, ЦПК `2025-07-17→2026-04-24`. Живий флип НЕ робився (зняв би divorce+alimony з продажу). Ольга недоступна ~2 тижні → ревʼю немає кому робити.
**Next step:** Сергій додає 4 секрети в GitHub (runbook); рішення по живому флипу 2 змін (з урахуванням відсутності Ольги); merge гілки.

### 2026-06-11 (session 18) — services ownership: assign core services to lawyer + security-ack
**Status:** PENDING COMMIT · branch `chore/security-ack-and-ownership-note`
**Why:** після merge #32 виявлено: «Мої послуги» в адмінці порожні, хоча divorce/alimony живі. Корінь — модель власності: `DashboardPage` фільтрує `lawyer_id = user.id`, а сіяні міграціями послуги мали `lawyer_id = null` (бесхозні). Рішення (узгоджено з Сергієм, варіант B): призначити живі core-послуги акаунту юриста — менший blast radius, ближче до майбутньої моделі ролей (`project_admin_lawyer_roles.md`), плейсхолдери лишаються прихованими.
**Ops done (live Supabase, no schema change):** `UPDATE services SET lawyer_id = '2909df04-…' WHERE slug IN ('divorce','alimony')` (service_role). Env-specific (uid з `auth.users`), тому НЕ міграція. **Verified (Playwright, dev admin):** обидві послуги тепер у списку — Активна, з діями статусу + edit/view/delete.
**Files:**
- `docs/architecture/IMPROVEMENTS.md` — #47 розширено: acknowledgement security-review migration 013 (3 знахідки) + головна мітигація `disable_signup=true` (invite-only → `authenticated` = команда, 1 акаунт) + чіткий тригер хардингу (RPC/тригер для штампу `reviewed_by` + role-gate ПЕРЕД self-signup / 2-м юристом).
**Security-review (push sweep) — acknowledged, not blocking:** broad `USING(true)` UPDATE, bare-`authenticated` gate, client-stamped `reviewed_by` — усі = свідомо відкладений компроміс #47; мітиговано вимкненою реєстрацією. Деталі + тригер хардингу в #47.
**Note (cosmetic, out of scope):** dashboard показує «0 полів» для tabs-based послуг (лічильник читає `form_config.steps`, alimony на `tabs`).

### 2026-06-10 (session 18) — admin: law_change_log review panel + RLS for authenticated
**Status:** PENDING COMMIT · branch `feature/law-change-log-review` · Refs #32
**Why:** `law_change_log` (migration 011) фіксує зміни відстежуваних законів і флипає залежні послуги в `needs_review`, але юрист (Ольга) не мав, де це побачити — таблиця була RLS-закрита (service_role only). Робимо аудит видимим: панель ревʼю в адмінці, де юрист підтверджує/відхиляє зміну. Прямий наступник #31 — завершує lifecycle-петлю видимою для людини дією.
**Files:**
- `supabase/migrations/013_law_change_log_review.sql` — **NEW** — RLS на `law_change_log`: `SELECT`+`UPDATE` для `authenticated` (юрист читає+позначає ревʼю); `INSERT`/`DELETE` лишаються service_role-only (append-only з UI). **Потребує застосування через Supabase SQL Editor.**
- `apps/client/src/lib/lawChangeLog.ts` — **NEW** — SSoT: типи (`LawChangeAction`/`Row`), `ACTION_META` (UA), `reviewActions` (переходи), `isPending`/`pendingCount`/`formatRevision`, `toLawChangeAction`.
- `apps/client/src/lib/__tests__/lawChangeLog.test.ts` — **NEW** — 14 тестів (guard, переходи, pending-count, формат).
- `apps/client/src/admin/pages/LawChangeLogPage.tsx` — **NEW** — список (нові зверху) + фільтр «лише очікують» (+лічильник) + дії Переглянуто/Відхилити/Повернути + нотатки + чипи зачеплених послуг + хто/коли ревʼю.
- `apps/client/src/admin/AdminApp.tsx` — роут `law-changes` (під AdminGuard).
- `apps/client/src/admin/components/AdminLayout.tsx` — nav-лінк «📋 Зміни законів».
- `docs/architecture/IMPROVEMENTS.md` — #47 (blanket-authenticated RLS без per-tenant scoping — свідомий компроміс соло-фази; як краще: tenant-фільтр / security-definer review RPC).
- `specs/roadmap.md` — пункт «Admin-UI: панель ревʼю law_change_log» закрито.
**Tests:** client vitest 92/92 ✅ (було 78 +14) · tsc -b clean ✅
**Next step:** застосувати migration 013 у Supabase; жива перевірка в адмінці; merge `Closes #32`. Виробник логу (CRON моніторинг zakon.rada) — окрема наступна фіча.

### 2026-06-10 (session 17) — admin lifecycle: is_published → status (single source)
**Status:** PENDING COMMIT · branch `feature/status-single-source` · Refs #31
**Why:** розірвана петля self-service — адмінка писала декоративний `is_published`, а весь serving-шлях (n8n form-submit/main-bot + TWA `App.tsx`) читає `status` (active|needs_review|disabled, migration 011). «Опублікувати» в адмінці нічого не публікувало. Зводимо на `status` як єдине авторитетне джерело; `is_published` лишаємо deprecated-дзеркалом (зворотно, дроп — окрема міграція пізніше).
**Files:**
- `supabase/migrations/012_status_single_source.sql` — **NEW** — реконсиляція `is_published := (status='active')` + COMMENT deprecated. **Потребує застосування через Supabase SQL Editor** (як попередні; не критично для поведінки — `status` вже коректний з 011).
- `apps/client/src/lib/serviceStatus.ts` — **NEW** — SSoT для статусу: тип `ServiceStatus`, `STATUS_META` (лейбли/кольори UA), `statusActions` (дозволені переходи), `toServiceStatus`/`isPublishedFor`.
- `apps/client/src/lib/__tests__/serviceStatus.test.ts` — **NEW** — 10 тестів (guard, переходи, дзеркало).
- `apps/client/src/admin/pages/DashboardPage.tsx` — бейдж 3 станів + дії (Активувати / Вимкнути / Підтвердити для needs_review). Читає+пише `status` (+ дзеркало `is_published`).
- `apps/client/src/admin/pages/ServiceEditPage.tsx` — toggle Опубліковано/Чернетка → status-дропдаун (3 стани). Нова послуга → `disabled`.
- `docs/architecture/ARCHITECTURE.md` — схема `services`: додано `status` (авторитетний), `is_published` позначено deprecated.
**Tests:** client vitest 78/78 ✅ (було 68 +10) · tsc -b clean ✅
**Next step:** застосувати migration 012 у Supabase; (опц.) жива перевірка в адмінці; merge `Closes #31`. Окрема фіча: панель ревʼю `law_change_log` (+ RLS для authenticated).

### 2026-06-10 (session 16) — trim SDD ceremony to tiers (effort ∝ risk)
**Commit:** branch `chore/sdd-trim`
**Why:** для соло-команди повний spec-триплет на КОЖНУ фічу + pending-staging ритуал = overhead, що конкурує зі стройкою (ця сесія — приклад: синхронізував 4 доки руками). Узгоджено: спека потрібна рівно настільки, щоб відпустити агента в автономку і перевірити результат — тобто церемонія ∝ ризик, не звичка.
**Files:**
- `docs/architecture/SDD-GUIDE.md` — рівні **Tier 0/1/2** + тригери Tier 2; Feature Loop позначено як Tier-2-only.
- `CLAUDE.md` (root) — правило tiers у «Issue tracking» (default Tier 1 = issue only; `specs/features/` лише Tier 2).
- `apps/client/CLAUDE.md` — Change Documentation Rule полегшено (прибрано pending-staging; why-log, лише non-trivial).
- `apps/client/.claude/changelog.md` — правила спрощено; «Pending commits» → опціональний scratch; «n8n Error Handler» → ✅ resolved (#30).

### 2026-06-10 (session 14) — IMPROVEMENTS: розведено ID-колізії #12/#20
**Commit:** (this commit)
**Why:** `#N` в IMPROVEMENTS — стабільні ID, але два номери дублювались (#12 = Admin Dashboard + RLS policies; #20 = Service Builder + changelog-skill) → биті anchor-лінки. Розведено за раніше зафіксованою пропозицією.
**Files:**
- `docs/architecture/IMPROVEMENTS.md` — другі входження: «RLS policies» → **#44**, «Skill для changelog» → **#45** (тіла + індекс + anchor'и); ⚠️-маркери прибрано; warning-note → resolved. #1 лишається відсутнім історично (свідомо).
**Note:** перші входження #12/#20 і зовнішнє посилання `(#18/#20)` (= Service Builder, лишається #20) не змінені. Згадки в історії changelog/session-summary не переписувались.

### 2026-06-10 (session 14) — service-lifecycle G5: docs (DECISIONS + roadmap + IMPROVEMENTS)
**Commit:** (this commit) · Refs #29
**Why:** зафіксувати рішення фічі для майбутніх учасників: чому `status`-kill-switch (флип колонки, не деплій), чому `needs_review` блокує як `disabled`, і чому ідентичність закону = URL (не slug). Закрити scorecard.
**Files:**
- `docs/architecture/DECISIONS.md` — новий розділ «Service lifecycle: status kill-switch + ідентичність закону по URL» (+ пункт у зміст)
- `docs/architecture/IMPROVEMENTS.md` — #46 (реєстр-файл → v2 таблиця `laws`) + оновлено «Як краще» в #42 + індекс
- `specs/roadmap.md` — `watched_laws` моніторинг → частково закрито (підпункти: фундамент ✅, CRON/admin-UI — окремо)
- `specs/features/service-lifecycle/validation.md` — scorecard повністю зелений + DoD
**Tests (regression):** divorce 4/4 ✅ · alimony 3/3 ✅ · root vitest 153/153 ✅ · client vitest 68/68 ✅

### 2026-06-10 (session 14) — service-lifecycle G4: manual lifecycle tooling + canonical law registry
**Commit:** `4b708ba` · Refs #29
**Why:** дати людині (Ольга/Сергій) керувати життєвим циклом послуги без деплою: флип `status` за slug + фіксація зміни закону в `law_change_log` з автоматичним флипом залежних послуг у `needs_review`. Виявлено й усунуто баг даних: один і той же закон мав РІЗНІ slug'и у `watched_laws` divorce vs alimony (`simejnyj-kodeks` vs `simeinyi-kodeks`, `cpk` vs `tsyvilnyi-protsesualnyi-kodeks`) → зворотний індекс по slug пропускав би послуги (юридична діра). Рішення: канонічний реєстр законів + матч по URL.
**Files:**
- `scripts/law-registry.mjs` — **NEW** — канонічний реєстр законів (SSoT: slug↔title↔url) + `resolveLaw`/`lawByUrl`/`normalizeUrl`. Інтерим-«справочник»; нормалізована таблиця `laws` відкладена в v2/GraphRAG.
- `scripts/service-lifecycle.mjs` — **NEW** — CLI: `status`, `validate`, `normalize`, `set-status <slug> <status>`, `log-law-change <law> <date>` (зворотний індекс по URL). `--dry-run` скрізь.
**Data fix (live, через `normalize`):** alimony watched_laws slug'и приведені до канону; divorce title «Про судовий збір» уніфіковано. `normalize` ідемпотентний.
**Verification (live Supabase):** reverse index знаходить divorce+alimony (по slug і rada-id 2947-14); live `log-law-change` → log-рядок + обидві→`needs_review` + дата оновлена; `set-status` повертає. Тестовий стан повністю відкочено.

### 2026-06-09 (session 13) — deploy-workflow rate-limit retry + main-bot G3 live deploy
**Commit:** `f5ca036` · Refs #29
**Why:** `activate` після PUT падав на n8n rate-limit. `api()` тепер ретраїть transient «too many requests» (backoff). Зафіксовано live-деплой main-bot (після явного дозволу — деплой блокувався класифікатором).
**Files:**
- `scripts/deploy-workflow.mjs` — retry на rate-limit у `api()`
**Live (main-bot `Ns5VXWiG8Myg3O6S`):** 20→23 ноди, `active: true`; нова `Service Unavailable (bot)` ← правильний live telegram-cred через type-fallback ✅
**Verification (Playwright, dev TWA):** `?service=divorce`→форма; `?service=military`→«тимчасово недоступна» ✅. Telegram-флоу не автотестився (потребує TG-сесії).

### 2026-06-09 (session 13) — service-lifecycle G3: read-path guards (App.tsx + main-bot)
**Commit:** `c6b2d15` · Refs #29
**Why:** доповнити write-path kill-switch (G2) на read-path — неактивну послугу не можна навіть відкрити. (1) TWA не рендерить форму неактивної; (2) бот не віддає кнопку TWA. Write-path 503 лишається авторитетним backstop.
**Files:**
- `apps/client/src/App.tsx` — select `status`; `UnavailableScreen` коли `!= 'active'`; 503/`service_unavailable` показує `message` сервера; BackButton ховається. Константа `SERVICE_UNAVAILABLE_MSG`.
- `n8n/workflows/current/main-bot.json` — +3 ноди (`Is Active? (high|medium)` IF + `Service Unavailable (bot)`), 20→23; false-гілка покриває і «не знайдено».
- `scripts/deploy-workflow.mjs` — ціль `form-submit|main-bot`; credential-fallback за типом (нові ноди); опціональна Global Config-ін'єкція; ім'я бекапу за ціллю.
**Verification:** `tsc -b` ✅ · client vitest 68/68 ✅ · main-bot dry-run 20→23, 0 live-only ✅. (Live-деплой main-bot + Playwright-перевірка зроблені окремо після дозволу — див. наступний запис.)

### 2026-06-09 (session 13) — read-only permission allowlist
**Commit:** `3afc439`
**Why:** зменшити кількість permission-промптів для частих read-only інструментів (через /fewer-permission-prompts: скан транскриптів). Додано лише немутуючі, не-arbitrary-execution патерни; project-scoped.
**Files:**
- `.claude/settings.json` — **NEW** — `permissions.allow`: context7 (docs), playwright/preview screenshots+snapshot, `npm ls *`, `findstr *`

### 2026-06-09 (session 13) — Docs navigation: index in IMPROVEMENTS + TOC in DECISIONS
**Commit:** `939360a`
**Why:** IMPROVEMENTS згруповано по темах, але `#N` — стабільні ID у порядку появи → в тілі не послідовні, незручно читати. Додано відсортований індекс зверху (ID не чіпано — на них посилаються issues/changelog). Виявлено **ID-колізії #12 і #20** + відсутній #1 — позначено в індексі як «чекає рішення».
**Files:**
- `docs/architecture/IMPROVEMENTS.md` — 📇 Індекс (за номером) з anchor-лінками + ⚠️ на колізіях
- `docs/architecture/DECISIONS.md` — 📇 Зміст (логічний TOC)
**Next step:** (опц., чекає дозволу) розвести #12/#20 → #44/#45 з оновленням зовнішніх посилань

### 2026-06-09 (session 13) — service-lifecycle: deploy script + G2 live deploy (deploy-gap closed)
**Commit:** `3c282da` · Refs #29
**Why:** деплой workflow у live n8n був ручною рутиною з пасткою (плейсхолдери ключів у репо-JSON). Скрипт робить це безпечно: бекап live → diff нод → ін'єкція ключів у пам'яті → **збереження env-specific credential-ID** (не з репо) → PUT → activate. G2-guard задеплоєно й перевірено.
**Files:**
- `scripts/deploy-workflow.mjs` — **NEW** — деплой через n8n REST API (`--check` dry-run, `--creds-from=<file>` відновлення прив'язок); бекапи в gitignored `.backups/`
- `.gitignore` — `n8n/workflows/.backups/`
**Verification (live `D2ab06X3pVUWk1py`):** deploy 19→22 ноди, 0 live-only втрачено, 9 cred-прив'язок збережено ✅ · kill-switch disabled `military` → HTTP **503**, `Insert Case` НЕ виконано ✅
**Урок:** перший PUT зламав Supabase-ноди (репо ніс старі cred-ID) → виправлено `--creds-from`. Правило: credential-ID специфічні для середовища, репо ними не керує.

### 2026-06-08 (session 12) — Rule: GitHub Issue tracking
**Commit:** `79f5a6d`
**Why:** Сергій почав використовувати GitHub Issues. Щоб не плодити 5-те дубльоване джерело правди (drift), зафіксували розподіл ролей: issues = статус-борд, що ПОСИЛАЄТЬСЯ на specs/changelog/IMPROVEMENTS. 1 issue/фіча + чекліст G1-G5; Claude рухає статуси через `gh` (довга авторизація); коміти лінкують `Refs/Closes #N`.
**Files:**
- `CLAUDE.md` — нова секція «Issue tracking (GitHub)» + інтеграція в Session protocol

### 2026-06-08 (session 12) — service-lifecycle G2: write-path kill-switch guard
**Commit:** `5826cea`
**Why:** авторитетне enforcement kill-switch на write-path. Після «Get Service» нода-guard блокує генерацію, якщо `status != 'active'` (needs_review/disabled/not_found) — case не створюється, документ не генерується. Захищає навіть пересланий/кешований лінк форми. (Деплой у live n8n зроблено окремо — див. pending «deploy script».)
**Files:**
- `n8n/templates/check-service-status.js` — **NEW** — тестована guard-логіка (дзеркало inline Code-ноди)
- `n8n/templates/__tests__/check-service-status.test.js` — **NEW** — 6 тестів
- `n8n/workflows/current/form-submit.json` — +3 ноди (Check Service Status → Is Service Active? → Respond Unavailable HTTP 503) + rewire
**Tests:** vitest 153/153 ✅ | divorce 4/4 ✅ | alimony 3/3 ✅

### 2026-06-08 (session 12) — service-lifecycle G1: status kill-switch + law_change_log
**Commit:** `fffd813`
**Why:** реалізація G1 спеки. `services.status` (active|needs_review|disabled) = авторитетний kill-switch; `law_change_log` = аудит змін законів. Backfill: divorce+alimony → active (решта disabled). divorce.needs_law_review скинуто (рішення: прапорець був стале leftover, послуга жива). Застосовано + верифіковано через REST.
**Files:**
- `supabase/migrations/011_service_lifecycle.sql` — **NEW** — status + CHECK + backfill + law_change_log (RLS service_role)

### 2026-06-08 (session 12) — service-lifecycle feature spec + deferred compromises
**Commit:** `a2add92`
**Why:** планування Етапу B (service-lifecycle, backend-фундамент) через SDD. Послуга = керований юніт зі `status`-kill-switch + аудит `law_change_log`. Свідомо прийняті тимчасові компроміси винесені в IMPROVEMENTS, щоб не загубити.
**Files:**
- `specs/features/service-lifecycle/{plan,requirements,validation}.md` — **NEW** — спека (scope, guards, scorecard)
- `docs/architecture/IMPROVEMENTS.md` — #41 (needs_law_review дублює status), #42 (law_deps у JSONB), #43 (read-path kill-switch у боті неповний)

### 2026-06-08 (session 11) — Decisions doc (RAG/GraphRAG) + portfolio-value + untrack local settings
**Commit:** `209a8d1`
**Why:** зафіксувати рішення RAG/GraphRAG/Hybrid у DECISIONS.md; зберегти portfolio-value як стратегічний «why»-док; прибрати `.claude/settings.local.json` з git (персональний файл — шум між машинами/сесіями).
**Files:**
- `docs/architecture/DECISIONS.md` — розділ «RAG vs GraphRAG vs Hybrid Template»
- `docs/strategy/portfolio-value.md` — **NEW** — цінність проекту як портфоліо AI Engineer
- `.gitignore` — додано `.claude/settings.local.json`
- `.claude/settings.local.json` — `git rm --cached` (перестали трекати)

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
- **n8n Error Handler** — ✅ RESOLVED (session 15, #30): Error Trigger → admin Telegram alert in `form-submit`. Caught a real silent Google-OAuth failure on first deploy.

### Future (post-PoC)
- Rate limiting + Telegram initData signature verification (before first external demo)
- Lawyer invitation system + admin role (before Phase 1)

### Architectural debt — 🟢 LOW PRIORITY
- **Admin panel shares one build with TWA** inside `apps/client/`. Target (when Uncle joins): split into `apps/twa` + `apps/admin` + `packages/shared`. Interim rule: keep shared code in `src/lib/` / `src/types/`, no new tight coupling between TWA and admin. Do NOT refactor before PoC validated.

---

## 📝 Changelog rules (how to add entries)

This is a **why-log**, not a staging area (simplified session 16). `git log` answers "what"; entries here answer "why".

1. Log only **non-trivial** changes — skip typos / formatting / pure renames whose "why" is obvious from the diff.
2. After a logical unit of work, append ONE dated entry to **"Commit history"** (newest on top) with **Why** + **Files** (+ commit hash once known).
3. **No "Pending commits" staging ritual** — git already tracks uncommitted state. The section at the top is kept only as an optional scratch note; leave it empty if unused.

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
