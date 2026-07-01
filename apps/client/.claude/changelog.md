# Project Changelog

> **Purpose:** track every change made to the codebase — what was changed, why, and whether it's committed.
> This is the "why" log. For "what" look at `git log`. For "how to build" look at README.
>
> **Who updates this:** Claude (the AI assistant) must append an entry every time it modifies or creates files.
> Sergey can also add manual entries for changes made outside of Claude sessions.
>
> **Format rule:** newest entries at the top. Each entry dated + session number + commit status.

---

### 2026-07-01 (session 59) — ринкове дослідження legal-doc automation + стратегічний синтез (5 інсайтів) + roadmap
**Status:** гілка `claude/legal-doc-automation-market-1rdjz7` → **ЗМЕРЖЕНО В MAIN** (`80ef7df` `--no-ff`) · docs-only (деплой не зачеплено) · факти перевірені змагально (2 deep-research прогони, 3-голосна верифікація)
**Why:** Сергій попросив розібрати ринок автоматизації юрдокументів (хто досяг успіху, скільки вклали, де брешуть, що «закривається стабільно») + новий кут — юрист хоче в медицину, робити документи пачками. Треба факти під рішення «куди лізти», не здогади.
**What:**
- **2 deep-research звіти** (fan-out веб-пошук + adversarial verify): глобальний ринок (3 сегменти; LegalZoom FY2024 $681.9M/+3%/маржа 4%; DoNotPay штраф FTC $193K; галюцинації 17–33% Stanford) + Україна/EU (монополія адвокатури **вузька** — лише представництво в суді; e-Розлучення в Дії займає простий розвід, але лишає нам аліменти/дітей/спірне; batch+медицина валідовані — Gavel/Relativity, EvenUp $2B, Wisedocs).
- **Стратегічний синтез — 5 інсайтів** (3 визначальні): №1 гратися «де починається суд»; №2 вирішує шаблонність (1–4 автомат, 5–10 hand-off), медицина = вертикаль шаблонних позицій у тому ж рушії; №4 human-review зашита в дизайн, «AI-юрист» заборонено.
- **Roadmap v1.1** — інсайти в Decision Log (4 записи) + proposed issues **#NEXT-4** (медвертикаль крізь шкалу шаблонності), **#BLOCKER-5** (ресёрч мед-даних ДО коду медицини — special-category), **#LATER-6** (приватні UA/CEE конкуренти).
**Files:** `docs/research/global-legal-doc-automation-market-2026.md` (new), `docs/research/ukraine-eu-regulatory-and-competitors-2026.md` (new), `docs/strategy/market-strategy-synthesis-2026.md` (new), `docs/research/action-roadmap-2026.md` (v1.1).
**Залишок:** 🔴 Наступна сесія (окремий контекст) = **#NEXT-4**: прогнати медико-юр. позиції крізь шкалу 1–10 у `market-research-legal-services-2026.md` → список 1–4 = кандидати. Мед-код блокується #BLOCKER-5.

### 2026-07-01 (session 58) — keep-block: page-integrity directive + orphaned-signature fix (фундамент document-builder)
**Status:** branch `feat/keep-block-page-integrity` · **ЗАДЕПЛОЄНО + ВЕРИФІКОВАНО LIVE** (Supabase templates DB===file, form-submit 52 ноди active) · n8n+scripts **1114 ✅** (+10 keep-block) · parity divorce 269 / alimony 117 зелені
**Live verify:** exec 210 `success` — живий рушій видав keep-with-next на блоці Додатки (абзаци 76-83 у сценарії діти+аліменти) + старі title/ПРОШУ (19,62); Build Typography Request = 12 batchUpdate, **10 з keepWithNext**; підпис (84) вільний. 🪤 Індекси рантайм-обчислені (76-83 тут vs 63-70 у короткому сценарії) → доводить цінність range-макроса над фіксованими номерами рядків.
**Why:** Перший крок до «білдера документа» (як юрист керує тим, які частини тримати разом / з нової сторінки). Фундамент = детермінований примітив `keep-block` + усунення живого дефекту: блок «Додатки→підпис» міг розірватись, бо `keep-together` стояв на **порожньому абзаці** перед підписом (verified: styleHints para 70 = `""`), а не клеїв блок. Це той самий «осиротевший блок підпису» з research §3. На цьому примітиві стоять усі верхні рівні (семантичні ролі #51, page-aware preview).
**What:**
- **`render-document.js` — нова DSL-директива `keep-block`** (парний range-макрос): `{{!style: keep-block}}` … `{{!style: /keep-block}}`. `renderDocumentWithStyles` десугарить діапазон у **ланцюг `keep-with-next`** на всіх абзацах блоку, **окрім останнього** (інакше клей затягнув би наступний абзац у блок). Downstream-адаптери (`apply-typography` сьогодні, HTML/DOCX завтра) бачать лише `keep-with-next` → **жоден рендерер міняти не треба**.
  - styleHints тепер **мерджить** стилі на абзац (`addStyle`, дедуп) замість overwrite → виправляє латентний баг (два `{{!style:}}` на один абзац раніше затирали один одного). Fail-safe: незакритий `keep-block` / зайвий `/keep-block` ігноруються (ніколи не клеїть «втеклий» діапазон).
- **`divorce.document.txt` + `alimony.document.txt`** — блок «Додатки:»→підпис обгорнуто `keep-block`; прибрано мертвий `keep-together` з порожнього абзацу. **Текст байт-у-байт незмінний** (маркери — standalone, 0 output → parity зелений, legacy-білдери НЕ чіпались). Verified рендером: keep-with-next тепер на Додатки+пунктах+порожніх рядках (63-70), підпис (71) вільний.
- **`form-submit.json`** — Build Document нода ре-синкнута (`sync-build-document-node.mjs`, 78938→80641) — рушій з `keep-block` тепер у живому workflow-JSON (52 ноди збережено).
- **Тести (+10):** `render-document.test.js` — unit на макрос (glue-all-but-last, single-para no-op, blanks, merge зі стилями, fail-safe на незбалансованих, «downstream ніколи не бачить keep-block») + **live-template guard** (рендерить реальні divorce/alimony, чек: Додатки склеєні, підпис вільний → червоніє, якщо хтось прибере маркери).
**Files:** `n8n/templates/render-document.js`, `n8n/templates/services/divorce.document.txt`, `n8n/templates/services/alimony.document.txt`, `n8n/workflows/current/form-submit.json`, `n8n/templates/__tests__/render-document.test.js`.
**Tests:** n8n+scripts **1114 ✅** (parity 269/117 зелені — текст незмінний).
**Залишок:** деплой+verify зроблено (exec 210). 🔴 Наступна ітерація (інтерв'ю session 58): **authoring-модель — іменовані блоки-конструкції + зв'язки між ними + вбудований гайд** (керунок Сергія) + **read-only page-aware прев'ю в адмінці** (межі A4 + підсвічені склеєні блоки), БЕЗ редагування (Olga ще не редагує). Зв'язок: #51 (редактор шаблону), #50 (типографіка), #77 (page-integrity), service-mirror.

### 2026-06-30 (session 57) — #83 MERGE feat/preview-module → main + повний e2e UX-verify live
**Status:** main `032981e` (merge `--no-ff`, Closes #83) запушено · гілка видалена · дрейф усунено (`sync-preview-module-form-submit.mjs --check` = `✓ in sync`) · n8n+scripts 1104 ✅ · UI 284 ✅ · tsc clean
**Why:** Завершити preview-module: змержити гілку в main, щоб усунути main↔live дрейф `form-submit.json` (deploy з main відкотив би live), і верифікувати наскрізний монетизаційний UX наживо на піднятому n8n.
**What:**
- **Merge** 17 комітів гілки в main (--no-ff), issue #83 закрито, гілка `feat/preview-module` видалена. Дрейф підтверджено усунутим (патчер `--check` зелений → committed form-submit == live).
- **Повний e2e наживо** (Docker n8n + ngrok up, 4 active workflows: form-submit 52 ноди, preview-pay 16 нод): прогнав `scripts/test-preview-pay.mjs` (**12/12** — not-ready→422 paid-незмінний, wrong-owner→422, happy→200+signed_url качає 68KB PDF, re-mint ідемпотентний) + ручний прогін divorce з реальними ключами полів (`sampleAnswers`).
**Verify (live):**
- **Витяг** (PreviewPage): шапка+сторони+завязка, **0 leak** (нема «ПРОШУ», нема цитат статей, нема дір `________`), склонення коректне («я, Коваленко Марія Олександрівна … зареєструвала шлюб із Коваленко Віктором Петровичем»).
- **Фінальний PDF**: повністю заповнений, склонення у всіх відмінках вірне (instrumental/accusative), діти/прізвище/місце проживання на місці.
- **Opt-in бот-доставка** (`deliver_to_bot=true`): preview-pay exec 207 нода `Send PDF` → `{ok:true, message_id:443, document.file_name:"Позовна заява.pdf"}` у чат 236581343. Дружнє імʼя ✅.
- **🪤 Урок:** перший прогін показав `________` замість імен → НЕ баг продукту, а мій тест-харнес з вигаданими ключами полів (`plaintiff_name` замість `last_name/first_name/middle_name`, `divorce_reasons` тощо). Виправлено через `sampleAnswers.ts` як SSoT для форми. «claim ≠ fact» спрацював.
**Files:** merge-коміт (без нових файлів коду); `apps/client/.claude/changelog.md`.
**⚠️ Тест-сміття:** smoke створив ~3 тест-кейси в `cases` (identity 236581343) + PDF у Storage `cases/*.pdf` + реальні sendDocument у чат (message_id 443) — прибрати за потреби (Storage API/Dashboard; `protect_delete` блокує SQL DELETE).

### 2026-06-30 (session 56) — #83 preview-module G3b (rate-limit) + G6 (докі) — фіча завершена
**Status:** branch `feat/preview-module` · form-submit (52 нод) задеплоєно live · guard 14 ✅ · сют 1104 ✅ · commit `1d60d79` · Refs #83
**Why:** Закрити дві останні групи preview-module: анти-abuse rate-limit + документація. Після цього вся фіча (G1-G6+G3b) жива end-to-end.
**What:**
- **G3b — per-profile rate-limit:** гейт на гілці `Has Profile?=true` у form-submit (через патчер `sync-preview-module-form-submit.mjs`, анти-дрейф): `Check Rate Limit` (httpRequest, рахує cases цього profile за 24год; service-role з Global Config, 0 extra creds) → `Rate Limit Gate` (Code, `count < LIMIT`) → `Under Rate Limit?` (IF) → Encrypt Data | `Respond Rate Limited` (429). Ліміт `PREVIEW_RATE_LIMIT`=20/24год (env-override для smoke). Рахунок по `cases.user_id`=profile UUID (індекс 029 `(user_id,created_at)`).
  - **Fail-open — навмисно** (зафіксовано після security-review): це вторинний троттл, справжній анти-бот = fail-closed HMAC (#56) вище; обхід неможливий, бо Insert Case б'є в ту саму Supabase, що й count (БД лежить → документ не генерується). Fail-closed 429-ив би легіт-юзера на блипі. Причина задокументована в коментарі гейта.
- **G6 — докі:** DECISIONS (вже s54), IMPROVEMENTS #77 Gotenberg-нотатка (вже) — підтверджено наявні; `specs/roadmap.md` v3.2 +shipped-нотатка (preview-module G1-G6 live; залишок #77 = keep-together + image-превʼю); session-summary «Стан зараз» переписано (фіча live, виправлено факт `cases.user_id`=profile UUID, зафіксовано **main↔live дрейф** → merge-рекомендація).
**Files:** `scripts/sync-preview-module-form-submit.mjs`, `n8n/workflows/current/form-submit.json`, `n8n/templates/__tests__/preview-module-form-submit.test.js`, `specs/roadmap.md`, `apps/client/.claude/session-summary.md`.
**Tests:** guard **14 ✅** (+3 rate-limit) · n8n+scripts **1104 ✅**.
**Live smoke:** під лімітом (12<20)→200+case; над лімітом (forced 2, 13 cases)→429, case НЕ вставлено (count лишився 13). Прод-ліміт 20 відновлено (committed==live).
**🔴 Залишок #83 → наступна сесія:** **merge feat/preview-module → main** (усуває дрейф form-submit.json; main має старий стан, deploy з main відкотив би live). Беклог: реальний платіж (#заглушка), #97/#98/#99.

### 2026-06-30 (session 56) — #83 preview-module: бот opt-in toggle + дружнє імʼя файлу + бот-повідомлення
**Status:** branch `feat/preview-module` · preview-pay (16 нод) + form-submit (48 нод) задеплоєно live · 12/12 demo + guard 10 ✅ + сют 1101 ✅ · commits `138d78c`/`76d67ee` · Refs #83
**Why:** Закрити те, що Сергій бачив у демо-доставці: (1) у PreviewPage не було UI-перемикача opt-in бот-доставки; (2) файл у Telegram приходив як `{uuid}.pdf`; (3) бот зависав на «📝 Формую документ…» (залишок старого потоку).
**What:**
- **Opt-in toggle (`138d78c`):** у PreviewPage чекбокс «Надіслати документ у Telegram» (default OFF) + GDPR-тултип (реюз `Tooltip`): «…копія документа зберігатиметься на серверах Telegram. За замовчуванням — лише захищене посилання (24 год)». Керує `deliver_to_bot` у `requestPreviewPay`.
- **Дружнє імʼя файлу (`76d67ee`):** 🪤 Telegram **ігнорує** Supabase Content-Disposition при sendDocument **по URL** (бере basename шляху → `{uuid}.pdf`). Тому preview-pay тепер **завантажує PDF бінарником** (нова нода `Download PDF`; `?download=<name>` на signed URL задає імʼя бінарника через Content-Disposition) і шле **multipart**-ом — лишаючись 0-cred. Telegram показує «Позовна заява.pdf» (verified: message_id 437, 78 KB).
- **Бот-повідомлення (`76d67ee`):** після зняття бот-доставки (session 54) термінальне повідомлення зависало на «📝 Формую документ…». Перетекстовано ноду `Progress: Building` → «✅ Заявку прийнято! … Перегляд документа та отримання — у застосунку.» Deploy-diff: 48=48 нод, лише текст; бекап знято.
- **🪤 IDE-перемикання гілки (знову!):** посеред сесії IDE зробив `checkout main` → файли «зникли», form-submit виглядав «застарілим» (це була версія з main). Спіймав через `git branch --show-current`, повернувся на `feat/preview-module`, коміти цілі. Урок із session 54 підтверджено — звіряти гілку перед кожним комітом.
**Files:** `apps/client/src/components/PreviewPage.tsx`, `apps/client/src/lib/previewPay.ts`, `scripts/build-preview-pay.mjs`, `n8n/workflows/current/preview-pay.json`, `n8n/workflows/current/form-submit.json`, `n8n/templates/__tests__/preview-pay-workflow.test.js`.
**Tests:** guard **10 ✅** · n8n+scripts **1101 ✅** · UI **284 ✅** · live demo 12/12 (filename + bot message verified у Telegram).

### 2026-06-30 (session 56) — #83 preview-module G5: TWA превʼю→оплата UI (PreviewPage)
**Status:** branch `feat/preview-module` · React/TWA · tsc clean · UI 284 ✅ (+10) · commit `9f05807` · Refs #83
**Why:** Замкнути наскрізний потік превʼю-модуля на фронті — після сабміту юзер бачить вітрину якості (A4-витяг) і проходить «Сплатити»→«Отримати документ», а не зависає на «Формую…». Витяг уже приходить у ранній webhook-відповіді form-submit (G3), preview-pay (G4) живий → лишалась UI.
**What:**
- **`apps/client/src/lib/previewPay.ts` (new)** — pure-хелпери: `derivePreviewPayUrl` (form-submit→preview-pay, спільна n8n-база; явний override `VITE_N8N_PREVIEW_PAY_URL`) + `classifyPayResponse` (paid|not_ready|error) + `requestPreviewPay`. **10 unit-тестів.**
- **`apps/client/src/components/PreviewPage.tsx` (new)** — A4-стилізована «сторінка документа» (serif, justify) з нижнім blur-градієнтом + водяним знаком **ЗРАЗОК** (рів = ВІДСУТНІСТЬ суті #86, не watermark). State-machine: preview → «Сплатити» → paying (авто-ретрай preview-pay на `not_ready` поки доганяє async-хвіст PDF, стеля ~60с) → paid → «Отримати документ» (відкриває 24-год signed URL) / error (дружній ретрай). Тема Legal Light + framer-motion + haptics.
- **`apps/client/src/App.tsx`** — ловить `case_id`+`preview_excerpt` з відповіді → рендерить PreviewPage замість SuccessScreen (fallback на SuccessScreen при таймауті/старому деплої); closing-confirmation / back-button / draft-clear трактують превʼю як приземлений сабміт.
- **`.env.example`** — документує опційний `VITE_N8N_PREVIEW_PAY_URL`.
- **Архітектура:** БЕЗ клієнтського Supabase-polling (`cases` = service-role-only) — витяг їде у відповіді, а preview-pay сам сигналить готовність (`not_ready` 4xx). Узгоджено з рішенням session 54. Розрулено протиріччя plan.md G5 (де було «polling») на користь фактичного бекенду.
**Files:** `apps/client/src/lib/previewPay.ts` (new), `apps/client/src/lib/__tests__/previewPay.test.ts` (new), `apps/client/src/components/PreviewPage.tsx` (new), `apps/client/src/App.tsx`, `apps/client/.env.example`.
**Tests:** previewPay **10 ✅** · UI suite **284 ✅** (+10) · tsc clean · 0 нових lint-помилок (2 наявні — у незміненому config-effect).
**Verify (visual):** відрендерив сторінку в dev-білді з реальним витягом (тимч. `?pp=1`, прибрано) — A4-документ + ЗРАЗОК + fade + CTA «Сплатити» рендеряться коректно у мобільному 420px-layout.
**Залишок #83:** бот-UX (бот завис на «Формую…» — узгодити повідомлення з новим потоком), G6 (докі: DECISIONS вже є, лишилось roadmap-тік + IMPROVEMENTS #77 Gotenberg-нотатка), G3b (rate-limit). Опційний live-тест Сергієм у реальному Telegram.

### 2026-06-30 (session 56) — #83 preview-module G4: preview-pay workflow ЖИВИЙ + верифікований
**Status:** branch `feat/preview-module` · workflow CREATED+active (`snm45SKeVo5X2AqU`, 15 нод) · 12/12 live-smoke зелений · commit `2d4ef0b` · Refs #83
**Why:** Завершити монетизаційний шов превʼю-модуля — новий ізольований n8n workflow `preview-pay`, що після превʼю приймає «оплату» (заглушка, сервер-верифікований флип), мінтить signed URL до приватного PDF. Рішення locked на інтервʼю session 55 (A3 TTL 24год, A4 GDPR opt-in, edge=4xx-без-флипу, ідемпотентність).
**What:**
- **`scripts/build-preview-pay.mjs` (new)** — генератор self-contained workflow JSON за патерном `build-law-change-digest.mjs`: 0 n8n-credentials, секрети через Global Config-expression (deploy інжектить). Анти-дрейф: initData-верифікатор інлайниться з SSoT `n8n/templates/verify-init-data.js`. `--check` = CI-страж.
- **`n8n/workflows/current/preview-pay.json` (new, 15 нод):** Webhook → Global Config → **Verify initData** (#56 реюз, fail-closed) → Is Verified? → **Get Identity** (telegram id → profile UUID, дзеркало form-submit Get Profile) → Get Case → **Assert & Decide** (owner + ready-гейт) → Is Ready? → **Set Paid** (PATCH paid/status; paid_at ЛИШЕ на 1-му флипі) → **Mint Signed URL** (Storage createSignedUrl, TTL 24год) → Build Response → **Send to bot?** (opt-in) → Respond OK/Error.
- **Інваріанти:** (1) `paid` НІКОЛИ не флипається без готового документа — флип строго на гілці Is Ready?=true; будь-яка відмова (auth/not-owner/not-ready) = один 4xx (422), paid недоторканий. (2) Ідемпотентність: 2-й pay на paid → re-mint URL без перезапису paid_at. (3) GDPR (інваріант 7): бот-доставка лише за `deliver_to_bot===true`, основний канал = signed URL.
- **🪤 Знайдено наживо:** `cases.user_id` тримає **profile UUID** (не telegram id) — резолвиться через `identities.external_id`. Перша версія owner-check порівнювала з telegram id напряму → not_owner навіть власнику. Додано Get Identity (як form-submit). Виправити теплий факт у session-summary («owner = user_id» було оманливо).
- **`scripts/deploy-workflow.mjs`** — `+preview-pay` target (id `snm45SKeVo5X2AqU`).
- **`scripts/test-preview-pay.mjs` (new)** — повний e2e live-smoke на одному свіжому case.
**Files:** `scripts/build-preview-pay.mjs` (new), `n8n/workflows/current/preview-pay.json` (new), `scripts/test-preview-pay.mjs` (new), `scripts/deploy-workflow.mjs`, `n8n/templates/__tests__/preview-pay-workflow.test.js` (new, 10 guard-тестів).
**Tests:** preview-pay guard **10 ✅** · повний n8n+scripts **1101 ✅** (+10).
**Live smoke (12/12, один свіжий case через webhook):** not-ready pay→422 (paid=false) · wrong-owner→422 (not_owner) · poll→preview_ready+PDF у Storage · happy pay→200 {signed_url,expires_at}; signed_url качає 68KB `%PDF-` · case→paid+paid_at · re-mint→200, paid_at НЕзмінний · expires_at = +24год.
**Залишок #83:** G5 (TWA-UI: generating→preview_ready→paid, PreviewPage A4+blur+watermark, polling, кнопки) + бот-UX (бот завис на «Формую…»), G6 (докі), G3b (rate-limit).

### 2026-06-30 (session 55) — #83 preview-module G4: інтервʼю-локдаун рішень (spec-only, перед кодингом)
**Status:** branch `feat/preview-module` · spec/docs-only · Refs #83
**Why:** Перед стартом G4 (preview-pay workflow) — `/interview` (medium) зафіксував відкриті A3/A4/A5 + edge-кейси, щоб свіжий чат кодив без здогадок. Виплив GDPR-нюанс (бот-доставка) і другопорядковий наслідок PDF+DOCX (перевідкриває G1/G3).
**What (рішення):**
- **A4/GDPR (інваріант 7):** документ у Telegram-чат **за замовчуванням НЕ йде** (Telegram Cloud = GDPR-ризик); основний канал = signed URL у TWA; бот-доставка PDF — лише за явною opt-in згодою юзера (param default off).
- **A3:** signed URL TTL = **24 год**, ре-мінт дозволено поки case живий.
- **A5/формат:** цієї сесії **лише PDF**; DOCX-через-URL відкладено окремою групою (IMPROVEMENTS #99) — перевідкриває bucket-MIME (029) + DOCX-export у form-submit (зняті session 54).
- **Edge не-готового case:** preview-pay відмовляє (4xx) і **ніколи не флінає `paid` без готового документа**; TWA — доброзичливе «технічні труднощі, спробуйте пізніше».
- **Verify-рівень:** повний цикл (guard-тести + live deploy `--create` + webhook-smoke); потрібні Docker n8n + ngrok.
- **Анти-abuse:** окремий rate-limit на preview-pay не потрібен (initData HMAC + upstream form-submit limit).
**Files:** `specs/features/preview-module/requirements.md` (інваріант 7 + §5 resolved), `specs/features/preview-module/plan.md` (G4 locked-блок), `docs/architecture/IMPROVEMENTS.md` (#97 failure-UX, #98 failure-stats/evals, #99 DOCX-група).
**Tests:** spec/docs-only — код не зачеплено.
**Наступне:** свіжий чат (`/clear`) → імплементувати G4 за оновленою спекою.

### 2026-06-30 (session 54) — #83 preview-module G1 + G3-core: міграція + form-submit реструктуризація (ЖИВЕ)
**Status:** branch `feat/preview-module` · G1 міграція 029 ЗАСТОСОВАНА · G3-core ЗАДЕПЛОЄНО в form-submit + smoke зелений · Refs #83
**Why:** G1 — поля/Storage під превʼю-потік; G3-core — витяг у ранній webhook-відповіді + повний PDF у приватний bucket замість бот-доставки до оплати. Рішення (session 54): `cases` лишається service-role-only, статус+витяг їдуть синхронною відповіддю (БЕЗ клієнтського RLS/polling — `cases` тримає шифровані PII, у TWA немає Supabase Auth/auth.uid()).
**What:**
- **G1 `supabase/migrations/029_preview_module.sql` (new, applied)** — `cases` +`paid/paid_at/preview_excerpt/doc_storage_path/preview_meta`; приватний bucket `generated-documents` (public=false, PDF-only, service-role-only); індекс `(user_id,created_at)`. 🪤 БЕЗ CHECK на `status` (legacy 'submitted' → помилка 23514); owner=`user_id`, НЕ profile_id.
- **G3-core `scripts/sync-preview-module-form-submit.mjs` (new, ідемпотентний +`--check`)** — нова `Derive Excerpt` нода (інлайн G2)→рання відповідь `{case_id,status,preview_excerpt}`; `Update Case Abstention` +`preview_excerpt`; хвіст `Export PDF→Upload PDF до Storage→Set Preview Ready(doc_storage_path+status='preview_ready')→Delete Doc`; знято `Send PDF/Export DOCX/Send DOCX`. Insert `submitted→generating`. 11 guard-тестів.
- **🪤 Фікс (live):** `Update Case Abstention` писала `status='generating'` → через n8n depth-first виконувалась ПІСЛЯ `Set Preview Ready` і затирала `preview_ready`. Прибрано status звідти (веде лише Insert→Set Preview Ready). GOTCHAS +запис «fan-out siblings clobber».
**Files:** `supabase/migrations/029_preview_module.sql`, `scripts/sync-preview-module-form-submit.mjs`, `n8n/workflows/current/form-submit.json`, `n8n/templates/__tests__/preview-module-form-submit.test.js`, `docs/architecture/GOTCHAS.md`.
**Tests:** workflow guard 11 + excerpt 61 · повний n8n+scripts **1091 ✅**.
**Live verify (smoke, 4 кейси через webhook):** рання відповідь = витяг без суті (998/1237 симв.); case `status=preview_ready`, `doc_storage_path=cases/{id}.pdf`, PDF у приватному bucket (73665/79684 байти); anon SELECT cases → 0 рядків (privacy). form-submit (48 нод, active, бекап у `.backups/`).
**Залишок #83:** G4 (preview-pay workflow), G5 (TWA-UI)+бот-UX (бот завис на «Формую…», task #8), G6 (докі), G3b (rate-limit). Наскрізний потік неповний до G4+G5.

### 2026-06-30 (session 54) — #83 preview-module G2: детермінований екстрактор безпечного витягу (#86-критичний)
**Status:** branch `feat/preview-module` · код+тести, ізольована pure-функція · Refs #83
**Why:** Перша (найризиковіша за змістом) група превью-модуля — рів проти «скрін → ШІ дозаповнює» (#86). Витяг, що йде на клієнт ДО оплати, мусить фізично не містити операційної суті (ПРОШУ, цитат, нумерованих вимог). Робимо й тестуємо ізольовано першим (детермінований, без I/O), як вимагає plan.md.
**What:**
- **`n8n/templates/preview-excerpt.js` (new)** — `deriveExcerpt(fullDocText, serviceSlug)`: ріже відрендерений doc-engine-текст РІВНО перед першою цитатою статті (`/ст\.?\s*\d/i`) або «ПРОШУ» → лишає шапку суду + сторони + заголовок + перший(і) абзац(и) обставин. Протікання суті неможливе **за побудовою** (cut-точка = сам заборонений патерн). **Fail-closed**: дрейф шаблону (маркер відсутній) / порожній ввід → повертає МЕНШЕ (лише шапка+сторони / `''`), ніколи весь документ. Сервіс-агностичний (divorce+alimony однакова структура). Pure, без залежностей — готовий до inline у form-submit (G3).
- **`hasReasoningMarker(text)`** — drift-guard хук для тестів: якщо майбутній шаблон відрендериться без цитати, CI червоніє ДО того, як fail-closed тихо вріже прод-превʼю.
- **`n8n/templates/__tests__/preview-excerpt.test.js` (new, 61 тест)** — проганяє екстрактор по ВСІХ 7 goldens (4 divorce + 3 alimony, реюз `test-data/<svc>/expected/*`): позитив (шапка+сторони+заголовок+обставини), негатив із НЕЗАЛЕЖНИМИ regex (0 `ст.NNN`/`статті NNN`, 0 ПРОШУ, 0 нумерованих вимог «1. », 0 ЦПК/СК), drift-guard, prefix-верифікація, fail-closed на дрейф/ворожий ввід.
**Files:** `n8n/templates/preview-excerpt.js` (new), `n8n/templates/__tests__/preview-excerpt.test.js` (new).
**Tests:** excerpt **61 ✅** · повний n8n+scripts **1080 ✅** (+61, нуль регресій).
**Наступне (G1):** міграція `cases`-полів (status/paid/preview_excerpt/doc_storage_path) + приватний bucket `generated-documents` + RLS.

### 2026-06-30 (session 53) — #87 ЦПК ст.175 ч.7: реквізити рахунку позивача — DIVORCE (issue #76, ч.2)
**Status:** MERGED to main · merge `e708f83` (`--no-ff`) · **обидва шаблони залиті в Supabase + form-submit задеплоєно + live smoke зелений** · **issue #76 ЗАКРИТО**
**Why:** Завершення issue #76: той самий блок ст.175 ч.7 (реквізити рахунку), що й в alimony (session 52), але для divorce — **лише під аліментною вимогою** (`alimony_claim`), бо стягнення коштів у розлученні виникає тільки з аліментної гілки. Розірвання шлюбу без аліментів — не грошова вимога, блок не зʼявляється.
**What:**
- **Шаблон + legacy-білдер СИНХРОННО** (parity = engine===builder!): новий блок «частина сьома ст.175» після п.10 ч.3, перед судовим збором, обгорнутий `{{#if alimony_claim}}` / `if (isTrue(a.alimony_claim))` — `n8n/templates/services/divorce.document.txt` + `n8n/templates/divorce-document.js`. Дві гілки (є IBAN / немає → бажаний спосіб) — дзеркало alimony. 🪤 це **ч.7**, не «п.7 ч.3».
- **Build Document нода re-sync** (`sync-build-document-node.mjs`): інлайнений divorce-білдер у `form-submit.json` оновлено (78133→78938 chars).
- **Голдени регенеровано:** scenario-2 = гілка «є рахунок» (IBAN+банк), scenario-3 = гілка «немає рахунку» (payout); scenario-1/4 без alimony → блок відсутній (контент незмінний). Parity **269 ✅** (+6 toggle-кейсів гілок рахунку, у т.ч. «ignored when no alimony_claim»).
- **Форма** `apps/client/src/data/divorceFormConfig.ts` — 4 поля в таб «Шлюб і сімʼя» після `alimony_amount`: `plaintiff_has_account` (boolean, show_if `alimony_claim==true`) + IBAN (`validation:'iban'`) + банк + `plaintiff_payout_method` (каскад show_if на `plaintiff_has_account`).
- **sampleAnswers.ts** (превʼю адмінки) — приклад полів рахунку у divorce-блоці.
- **validateIban + типи форми** — вже були (зроблено в alimony, session 52).
**Files:** `n8n/templates/services/divorce.document.txt`, `n8n/templates/divorce-document.js`, `n8n/workflows/current/form-submit.json`, `test-data/divorce/fixtures/scenario-{2,3}.mjs` (+ `expected/scenario-{2,3}.txt`), `apps/client/src/data/divorceFormConfig.ts`, `apps/client/src/admin/lib/sampleAnswers.ts`, `n8n/templates/__tests__/divorce-template-parity.test.js`.
**Tests:** parity **269 ✅** · root **1019 ✅** · UI **274 ✅** · tsc clean.
**Deploy + live verify:** `upload-document-template.mjs alimony` (10225→10788) + `… divorce` (14149→14945) → Supabase (DB===file); `deploy-workflow.mjs form-submit` (48 нод, active, креди збережено). 3 webhook-smoke: exec 169 divorce-без-аліментів = блок ВІДСУТНІЙ ✅, exec 170 divorce+аліменти = гілка payout ✅, exec 171 alimony = гілка payout ✅ (`________` — легітимний fallback, бо сценарії без полів рахунку; IBAN-гілку покрито 269 parity-тестами). Форма divorce ходить з Vercel-білда `divorceFormConfig.ts`.
**Sign-off Олі (1 липня):** формулювання блоку ст.175 ч.7 — фідбек збираємо пост-фактум (фаза витрини).

### 2026-06-29 (session 52) — #87 ЦПК ст.175 ч.7: реквізити рахунку позивача — ALIMONY (issue #76)
**Status:** branch `feat/87-account-requisites-alimony` · код+тести, ще НЕ задеплоєно · Refs #76
**Why:** ст.175 ЦПК доповнено ч.7 (Закон №4833-IX) — позов про стягнення коштів має містити реквізити рахунку позивача. Аліменти = завжди стягнення → блок безумовний. Реалізуємо alimony як зразок (за `docs/research/cpk-175-7-account-requisites.md`), divorce — наступним. Placeholder-формулювання, sign-off Олі пізніше (малий радіус, як #67).
**What:**
- **Шаблон + legacy-білдер СИНХРОННО** (parity = engine===builder, не лише голдени!): новий блок «частина сьома ст.175» після п.10 ч.3, перед судовим збором — `n8n/templates/services/alimony.document.txt` + `n8n/templates/alimony-document.js`. Дві гілки: є рахунок (IBAN+банк) / немає (бажаний спосіб). 🪤 це **ч.7**, не «п.7 ч.3» (інша норма, лишилась).
- **Conventions matched для байт-parity:** порожнє поле → `________` (FALLBACK движка) через `val()`; standalone if/else-теги.
- **Голдени регенеровано** (scenario-1/2 = є рахунок, scenario-3 = немає+payout — покрито обидві гілки). Parity **117 ✅**.
- **Форма** `scripts/upload-alimony-config.mjs` — 4 поля в таб «Позивач»: `plaintiff_has_account` (boolean) + IBAN (`validation:'iban'`, show_if has_account) + банк + `plaintiff_payout_method` (show_if !has_account).
- **Валідатор IBAN** `apps/client/src/lib/validators.ts` — `validateIban` (UA + 27 цифр + ISO 7064 mod-97); зареєстровано в VALIDATORS; `ValidationRule` розширено (вирівняно дубль у `types/form.ts`). +6 тест-кейсів.
- **sampleAnswers.ts** (превʼю адмінки) — приклад полів рахунку.
**Files:** `n8n/templates/services/alimony.document.txt`, `n8n/templates/alimony-document.js`, `test-data/alimony/fixtures/scenario-{1,2,3}.mjs` (+ `expected/*.txt`), `scripts/upload-alimony-config.mjs`, `apps/client/src/lib/validators.ts` (+test), `apps/client/src/types/form.ts`, `apps/client/src/admin/lib/sampleAnswers.ts`.
**Tests:** parity **117 ✅** · UI **274 ✅** (+iban) · root **1013 ✅** · tsc clean.
**Залишок #76:** (1) divorce — той самий патерн під `{{#if alimony_claim}}`; (2) деплой live (`upload-document-template.mjs alimony` + `upload-alimony-config.mjs`); (3) фінальне формулювання — sign-off Олі.

### 2026-06-29 (session 52) — law-monitor CRON re-enabled + 2 находки adjudicated (issue #33)
**Status:** branch `chore/33-reenable-law-cron` · yml + live-DB ops · Closes #33
**Why:** Хвіст #33 — `schedule:` тримався OFF, бо Оля була відсутня (авто-флип без ревьюера). Оля повернулась (~25.06); закриваємо самі (фаза витрини, авторизовано Сергієм). Прогнали монітор живцем → зафіксували 2 реальні зміни, адъюдикували, увімкнули розклад.
**What:**
- **Live monitor run** (`node scripts/check-law-updates.mjs`): детектор підтвердив 2 зміни — СК `2026-03-04→2026-05-25`, ЦПК `2025-07-17→2026-04-24` (Про судовий збір — без змін). Записано `law_change_log #6` (СК) + `#7` (ЦПК, з `article_diffs`+`ai_status=pending`), baselines (`watched_laws.last_known_date`) забамплено, divorce+alimony флипнуто `needs_review`, чанки 2947-14/1618-15 → `is_stale`.
- **Adjudication (без Олі, авторизовано):** #6 СК → `action=dismissed` (змінені статті не наші, НЕ матеріально); #7 ЦПК → `action=reviewed` (ст.175 ч.7 реквізити рахунку = МАТЕРІАЛЬНО → IMPROVEMENTS #87 / issue #76). `reviewed_by`/`reviewed_at`/`notes` проставлено.
- **Services reactivated:** `service-lifecycle.mjs set-status divorce|alimony active` → обидві `active`, `needs_law_review=false` (лишаються в проді для витрини; ЦПК-правка з placeholder піде окремо #87).
- **`schedule:` re-enabled** у `.github/workflows/law-monitor.yml` (cron `0 6 * * 1`, щопонеділка) + оновлено пояснювальний коментар. Секрети (4 GitHub Actions) вже налаштовані — підтверджено успішними ручними прогонами.
- ℹ️ `ai_status=pending` лишено навмисно — агент-дайджест (G4, n8n) дорисує AI-impact для #6/#7 при наступному hourly-прогоні (бонус, демонструє пайплайн).
**Files:** `.github/workflows/law-monitor.yml` (+ live-DB ops, не git).
**Tests:** ops-задача; код детектора не змінювався (1013 ✅ з session 51).

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
