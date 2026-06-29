# Project Changelog

> **Purpose:** track every change made to the codebase — what was changed, why, and whether it's committed.
> This is the "why" log. For "what" look at `git log`. For "how to build" look at README.
>
> **Who updates this:** Claude (the AI assistant) must append an entry every time it modifies or creates files.
> Sergey can also add manual entries for changes made outside of Claude sessions.
>
> **Format rule:** newest entries at the top. Each entry dated + session number + commit status.

---

### 2026-06-29 (session 52) — IMPROVEMENTS: DONE roll-up (аудит актуальності беклогу)
**Status:** branch `chore/improvements-done-rollup` · docs-only
**Why:** IMPROVEMENTS — беклог зі стабільними ID, який не архівуємо віком; накопичилось ~27 зашипованих, але не помічених пунктів → активні ідеї тонули. Explore-субагент пройшов по `#N`, я кросс-чекнув докази (міграції/workflow/код + закриті issues з тегами `[#N]`).
**What:**
- `docs/architecture/IMPROVEMENTS.md` — нова секція **«✅ Реалізовано (DONE roll-up)»** після індексу: таблиця `#N → доказ` (~27 пунктів), окремо superseded (#3/#36/#27/#41/#42) + NB про #5 (issue #23 closed як відкладено, НЕ зашиповано). Тіла пунктів і стабільні ID **не чіпали** — лише навігаційна шапка.
- Метод: `claim ≠ fact` — кожен рядок має ≥1 артефакт-доказ (підтверджено `ls migrations/`, `gh issue list --state closed`).
**Files:** `docs/architecture/IMPROVEMENTS.md`.
**Tests:** docs-only.

### 2026-06-29 (session 52) — AI-процес: гігієна памʼяті + апгрейд interview-skill (розбір `genkovich/sdd`)
**Status:** branch `claude/ai-recommendations-video-oa4qzv` · docs/skill-only · Refs IMPROVEMENTS #92/#94/#95
**Why:** Сергій дав репозиторій під відео Beer::Code (`genkovich/sdd` — повноцінний SDD-плагін). Рішення: плагін цілком НЕ ставити (18 skills + 9 агентів конфліктують з нашим зрілим SDD і роздувають контекст — антипатерн #96), а **cherry-pick** найкраще. Перевірено факти проти main: авто-SessionStart-хука з «8000 символів» немає — `/session-start` читає `session-summary.md` цілком (2011 рядків) → context rot.
**What:**
- **Гігієна памʼяті (#94):** `session-summary.md` стиснуто **2011 → 131 рядок** (блок «📌 Стан зараз» + 3 сесії); `changelog.md` стиснуто **1355 → 89 рядків** (3 сесії). Старіше → `apps/client/.claude/archive/{session-log,changelog}-2026-H1.md` (append-only, не читається авто — `grep` за потреби). Контент не втрачено. IMPROVEMENTS НЕ архівуємо (беклог зі стабільними ID, не в read-list `/session-start`) — йому потрібен аудит актуальності, окрема задача.
- **`docs/architecture/GOTCHAS.md` (new, #94):** файл повторюваних грабель (формат 🪤 Симптом→Причина→Правило), засіяно реальними (PowerShell-кирилиця, n8n fan-out depth-first, ч.7≠п.7ч.3, lenient stem-guard, claim≠fact).
- **Interview-skill апгрейджено (#92):** механіку запозичено з `genkovich/sdd` — depth-dial (easy/medium/hard), hard-rules (`AskUserQuestion` з `(Recommended)`, по одному питанню), probing frames (`references/probing-frames.md`, заточені під юр-контекст), stuck-protocol, формат фінального резюме. Вихід — на НАШ `/feature-spec` + тири, не їх `/sdd:specify`.
- **CLAUDE.md (#95):** нова секція «Working process (context hygiene)» — interview-before-guessing, важкий ресёрч у субагент, `/clear` між задачами, граблі → GOTCHAS (4 буліти, компактно).
- **IMPROVEMENTS.md:** #92/#94/#95 → ✅ done; виправлено факт про «8000-char хук»; **#93 (evals) ВІДКЛАДЕНО** за рішенням Сергія (спершу базовий курс).
**Files:** `apps/client/.claude/{session-summary,changelog}.md` (+ `archive/{session-log,changelog}-2026-H1.md`), `docs/architecture/GOTCHAS.md`, `.claude/skills/interview/{SKILL.md,references/probing-frames.md}`, `CLAUDE.md`, `docs/architecture/IMPROVEMENTS.md`.
**Tests:** docs/skill-only — код не зачеплено.

### 2026-06-29 (session 51) — law-change-impact G5: доки (DECISIONS + IMPROVEMENTS deferred)
**Status:** branch `docs/law-change-digest-g5` · docs-only · Closes #73
**Why:** Закрити фічу `law-change-impact` — лишалась лише G5 (журнал рішень + deferred-беклог); код G4 уже на main (#74).
**What:**
- `docs/architecture/DECISIONS.md` — нове рішення «law-change-impact: дві стадії (Node diff / n8n LLM), abstention, severity юридична (#73)»: чому Node-diff у моніторі + LLM-дайджест в n8n (diff знімається до `is_stale`; LLM лише в n8n; звʼязка через `pending`-рядок як чергу); severity юридична з детерм. стелею; нуль вигадок (enum + критик L4a + abstention, advisory-only); 2 live-готчі (n8n depth-first не чекає гілки → лінійний ланцюг; `+ `-префікс ламав verbatim-evidence). + рядок у Зміст.
- `docs/architecture/IMPROVEMENTS.md` — #2а оновлено: статус «петля + агент живі end-to-end» з посиланням на реалізацію; заведено deferred — L4b LLM-критик (не гейт), поартикульний diff як основний, email-дайджест, column-scoped review RPC.
**Files:** `docs/architecture/DECISIONS.md`, `docs/architecture/IMPROVEMENTS.md`.
**Tests:** docs-only.

### 2026-06-29 (session 51) — law-change-impact G4: дайджест-workflow ЗІБРАНО + ЗАДЕПЛОЄНО live (агент «що змінилось» живий end-to-end)
**Status:** MERGED to main · PR #74 (squash `7234981`) · CI зелений (test + Vercel) · workflow CREATED+active live (`qTOIqllA4CQvBJs5`) · Refs #73
**Why:** Фінальна група (G4) фічі `law-change-impact` (Tier 2, roadmap v2.2 🔴) — єдиний реальний юр-ризик (проґавлена зміна закону). G1 (детерм. diff + migration 027), G2/G3 (scope/groundedness/промпти) вже на main; лишалось зібрати n8n workflow, що перетворює `pending`-рядок `law_change_log` на чернетку «що змінилось + вплив по послугах» для підпису Олі.
**What:**
- `scripts/build-law-change-digest.mjs` (new) — генератор workflow JSON з SSoT (анти-дрейф): інлайнить `n8n/templates/law-change-scope.js` (L2) + `law-change-groundedness.js` (L4a) + промпт `n8n/prompts/law-change-digest.txt` (L3). Connection-integrity guard. `--check` = CI-страж від дрейфу.
- `n8n/workflows/current/law-change-digest.json` (new, 10 нод): **Schedule (щогодини) + Webhook** (GH-Actions kick / тест) → Global Config → **Fetch Chunks → Fetch Relations → Fetch Pending** (лінійний ланцюг, бо n8n v1 depth-first НЕ чекає паралельні гілки; `executeOnce`+`alwaysOutputData` → один фетч, ланцюг переживає порожню чергу/граф) → **Compute Scopes** (L2: per-row scope+severity-стеля+заповнений промпт; нормалізує `"Стаття N"`→`"N"`) → **L3 Reasoning** (Groq strict-JSON, per-row) → **Critique & Decide** (L4a groundedness RED→abstain + confidence-гейт + severity clamp) → **Write Result** (PATCH лише `ai_*`, ніколи `notes`/`action`).
- Self-contained: 0 n8n-credentials — усі секрети через Global Config-expression (`Bearer {{GROQ_API_KEY}}`, Supabase apikey/Bearer). Закомічений JSON має лише `YOUR_*` плейсхолдери (deploy інжектить у памʼяті).
- `scripts/deploy-workflow.mjs` — `+ target law-change-digest` (id `qTOIqllA4CQvBJs5`) + `--create` режим (POST нового workflow → друкує id) + винесено `injectKeys()`.
**Live verify (3 прогони наживо через webhook, тестовий рядок ЦПК ст.175 ч.7 = реальна зміна #87):**
- exec 163 **drafted**: summary + per-service (alimony/court_search/divorce), `evidence` дослівний, severity clamped→medium, confidence 0.7 → `ai_*` записані.
- exec 162 **abstained**: RED-span спрацював (LLM скопіював evidence з декоративним `+ ` префіксом → не verbatim; **полагоджено** — diff тепер подається без інлайн-маркерів, блоки ДОДАНО/ВИЛУЧЕНО).
- exec 164 **порожня черга** → success no-op (ланцюг живе без pending).
- G4 UI `AiDraftCard` (`LawChangeLogPage.tsx:208`) **вже на main** → handoff живий end-to-end. Тестовий рядок прибрано, `law_change_log` = 0.
**Files:** `scripts/build-law-change-digest.mjs` (new), `n8n/workflows/current/law-change-digest.json` (new), `scripts/deploy-workflow.mjs`, `n8n/templates/__tests__/law-change-digest-workflow.test.js` (new, 5 guard-тестів), `specs/roadmap.md`.
**Tests:** root `scripts`+`n8n` **1013 ✅** (+5 guard: sync/secrets/connections/JS-parse/advisory-only). build `--check` зелений.
**Залишок (G5):** DECISIONS-запис (2-стадійність, abstention-контракт) + IMPROVEMENTS deferred (L4b LLM-критик — наразі лише advisory AMBER, не гейт; поартикульний diff як основний). Prod-тригер: workflow active зі Schedule; для звʼязки з монітором — GH-Actions може POST-ити webhook після `check-law-updates`.

### 2026-06-27 (session 50) — law-monitor верифікація + 403-фікс + diff СК/ЦПК
**Status:** MERGED to main · 403-фікс `31a5ed6` (`--no-ff` `fix/rada-403-user-agent`) · аналіз read-only · находка → IMPROVEMENTS #87
**Why:** Сергій попросив переконатися, що моніторинг законів і CRON реально працюють, + полагодити 403 з session-50-верифікації.
**What:**
- **Верифікація (✅ обидва живі, з invocation):** детектор `check-law-updates.mjs --dry-run` локально + у CI — однаковий вивід (СК 2026-03-04→2026-05-25, ЦПК 2025-07-17→2026-04-24). CRON: свіжий `workflow_dispatch` прогон = success + усі 4 секрети присутні/інжектяться. ⚠️ `schedule:` лишається ВИМКНЕНИЙ (намірено); планований прогін іде з `--notify` (пише в БД) → перед увімкненням треба розрулити 2 зміни, інакше divorce+alimony авто-флипнуться у needs_review.
- **403-фікс:** `scripts/lib/rada.mjs` USER_AGENT `LegalAI-Bot/1.0`→браузерний. Rada WAF 403-ив бот-UA на `/laws/show/3674-17` (Про судовий збір), пропускаючи кодекси → закон тихо випадав з моніторингу. Тепер усі 3 закони резолвляться (Про судовий збір → 2026-03-10, «✅ OK»). `law-text.mjs` (diff-фетч) реюзає той самий UA → теж полагоджено. Тести rada+law-* **66 ✅**.
- **Diff СК/ЦПК (детермінований, по `/edYYYYMMDD/print` редакціях, фокус на наших цитованих статтях):**
  - **СК — НЕ материально:** змінились ст.65/177/287, жодної нашої.
  - **ЦПК — материально:** ст.175 доповнено **ч.7** (Закон №4833-IX, 07.04.2026) — у позові про стягнення грошей треба **реквізити рахунку позивача**. Зачіпає alimony + divorce(alimony_claim). Форма/шаблон цього не збирають → формальна неповнота. Заведено **IMPROVEMENTS #87** (фікс + sign-off Олі).
**Files:** `scripts/lib/rada.mjs`, `docs/architecture/IMPROVEMENTS.md` (#87).
**Tests:** rada+law-monitor libs **66 ✅**; аналіз diff — read-only (scratchpad-скрипт, не в репо). Зміни в БД НЕ застосовувались (dry-run).

### 2026-06-26 (session 50) — #67 divorce: майно/борги → окреме провадження (Variant B), live + закрито
**Status:** MERGED to main · merge `d68a92b` (`--no-ff` `fix/divorce-property-debt-variant-b`) · **шаблон залито в Supabase + live form-submit задеплоєно** · **issue #67 ЗАКРИТО**
**Why:** Рішення Сергія — робити по власному дослідженню, sign-off Ольги пост-фактум 1 липня (фаза презентації, малий радіус помилки; деталі `docs/strategy/where-we-are-and-scaling.md`). Прод друкував `________` замість опису майна/боргів — видимий дефект.
**What:**
- Merge гілки session 43 (фікс `928b5fe`): майно/борги в тілі констатуються без поділу/прочерку, ПРОШУ-нумерація без пунктів майна/боргів, прибрано з додатків, ст.65 СК з citations (деталі — запис session 43 нижче).
- Конфлікти мержу (session-summary + IMPROVEMENTS index #85/#86 + changelog) резолвлено вручну (актуальний main + збережено історичну session 43 + обидві IMPROVEMENTS-строки).
- **Деплой:** `node scripts/upload-document-template.mjs divorce` → Supabase `services.document_template` (16562→14149 chars, verified DB===file).
**Verify:** live smoke (exec 160, scenario 3): долгова ветка = нова формулювання без `________`, ПРОШУ 1-6 без майна/боргів. Divorce-тести **302 ✅** (parity byte-for-byte). 3 `________` у smoke легітимні (фікс-сума аліментів, судовий збір).
**⚠️ На список Ольги (1 липня):** «спір… відсутній» — фактичне твердження; точніше «не є предметом цього позову» без «спір відсутній».

### 2026-06-26 (session 50) — Declension stem-guard: ЗАДЕПЛОЄНО live + ЗМЕРЖЕНО в main
**Status:** MERGED to main · merge `835d282` (`--no-ff` `feat/declension-stem-guard`) · **live n8n form-submit задеплоєно + верифіковано наживо**
**Why:** Закриття 🔴-кроку session 49 (live-деплой був свідомо відкладений до підняття Docker n8n + ngrok). Сергій підняв інфру → дотиснули.
**What:**
- Інфра звірена наживо: локальний n8n `/healthz` 200, ngrok-туннель `/healthz` 200 (`rosy-caution-progeny.ngrok-free.dev → :5678`), Docker `n8n` Running.
- `node scripts/deploy-workflow.mjs form-submit` → live `D2ab06X3pVUWk1py`, 48 нод, active, credentials збережено, бэкап у `.backups/`.
- **3 реальні webhook-прогони** (`test-webhook.mjs`): 157 minimal, 158 divorce (scenario 1), 159 alimony (a1) — усі `success`.
**Verify (live, з executions API):**
- **divorce 158** `_abstained=null`: guard ПРОПУСТИВ валідні AI-форми — `із Петренком Андрієм Сергійовичем`, `між мною, Петренко Оксану Іванівну` (інструментал істця/відповідача в тілі позову). Без хибного відкату.
- **alimony 159** `_abstained=null`: `Стягнути з Іванова Івана Івановича на користь Іванової Інни Петрівни` (генитив), `уклала шлюб з Івановим Іваном Івановичем`, дитина `Олега Івановича` (генитив). Усі коректні.
- Висновок: guard non-destructive на валідному вході (головний ризик якості знятий); деструктивний відкат галюцинацій лишається покритий 19 unit-тестами (не форсувати наживо без підміни AI-виходу).
**⚠️ Note:** тести створили кейси під тест-identity `236581343` + реальні `sendDocument` у цей чат (як і попередні сесії).


---

> **Старіші записи (сесії ≤49)** перенесено в `archive/changelog-2026-H1.md` (git-історія; `grep` за потреби).
