# Legal AI — Master Context Document

> **Як читати:** спершу блок «📌 Стан зараз» (нижче) — це жива витримка. Далі — останні 3 сесії
> повністю. Старіші сесії (≤61) перенесено в `archive/session-log-2026-H1.md` (git-історія, читати
> за потреби — `grep`). Архівувати, коли живий файл переростає ~3 сесії / ~200 рядків.

---

## 📌 Стан зараз (оновлювати щосесії — це і є контекст, що читається на старті)

**🟢 SESSION 86 (2026-07-12→15) — БІЗНЕС-МОДЕЛЬ: deep-research ринку → конкурентний аналіз → зафіксовано сегмент (соло-медФОП) + MVP (самоаудит). Код НЕ чіпали. Гілка `docs/business-model-med-fop` (від main), НЕ в main.**
- **Привід:** юрист поставила співпрацю на паузу (2-3 тижні) з 3 бізнес-ризиками: (1) документи копіюються — один пакет розходиться по чатах лікарів; (2) прецедент — конкуренти пробували підписку на документи й відкотились на разові; (3) «навіщо юристу платформа, якщо пакет продам сама через телеграм-канал». Треба було знайти модель, де виграють усі троє.
- **Deep-research (5 напрямів → 22 джерела → 108 тверджень → адверсаріальна перевірка топ-25):** **24/25 підтверджено, 1 спростовано**. Верифікація двічі впиралась у session-limit → хвіст доручено Opus-субагентам (однопрохідна перевірка по першоджерелах). Ключові факти: **LegalZoom 65% виручки = підписки** (SEC 10-K FY2025), склад підписок — не документи, а registered agent/compliance/консультації; **LicenseOffice продає абонентку медФОП від 10 000 грн/міс** (прямий конкурент у нашій вертикалі); Ситарчук 5 000 грн/міс; SmartFin 354 грн/міс з 50+ кадровими шаблонами ВСЕРЕДИНІ підписки; ABA-бенчмарки: **~25% utilization, 1 юрист ≈ 2 500 підписників**, режим провалу документо-підписок = front-loaded work; LawDepot white-label — **партнеру 75%+ маржі**; **FTC заборонила DoNotPay** рекламуватись як заміна юриста (не тестували якість, не залучили жодного юриста) → наш HITL = не обмеження, а вивчений індустрією урок.
- **🪤 Спростовано (0:3):** деталь «власний адвокат 24/7» у Ситарчук — такого формулювання на сторінці нема. Раніше контестований теза про law-monitor **підтвердилась 3:0** — LicenseOffice продає «оновлення документації + інформування про зміни» як частину ядра абонентки.
- **Конкурентна розвідка (2 Opus-агенти):** ринок **бінарний, середина порожня** — ручні юрфірми 5–10+ тис./міс (без продукту: ні кабінету, ні трекінгу, ні автоалертів; фокус на клініки) VS tech (Taxer 54 грн, SmartFin 295 — без медправа; Експертус 3.3к, LIGA360 6–9к — для установ). **Кабінет соло-медФОП за ~2к не робить НІХТО** (negative search обома агентами).
- **📌 ГОЛОВНИЙ ВИСНОВОК:** продаємо **не документ, а стан «я в порядку перед регулятором»** (документ копіюється — стан ні). Виграємо **собівартістю, а не ціною**: конкурент не спуститься до нас, не зруйнувавши свою економіку (low-end disruption). Гіпотеза «автоматизація + юрист + низька ціна» вірна у формулюванні «низька **СОБІВАРТІСТЬ**».
- **Зафіксовано сегмент: соло-медФОП** (~35 тис. ліцензіатів; стоматологи/косметологи з медліцензією, 0–3 найманих). Ролей нема → продукт простіший на порядок. Клініки/ТОВ = поле конкурентів, фаза 4+.
- **📌 MVP = інтерактивний самоаудит** (84 питання перевіряючих): одночасно продукт, воронка, інструмент CustDev і **датчик попиту**. Ключовий інсайт для розробки: **самоаудит — це теж `form_config`** (`tabs`+`show_if`), звіт — це `document_template` → **єдиний реально новий код = тонкий шар скорингу** («відповідь→прогалина→вага»). Решта — конфігурація.
- **Масштабування:** «послуга = дані, а не код». **doc-engine** знімає *виробництво* документа, **MCP+skills** знімає *інтервʼю* (найдорожча година юриста; tool авто-генериться з `form_config`). Тест зрілості: нова ніша закривається конфігом; треба код → це баг рушія. Порядок ніш: медицина → **ветеринарія** (копія плейбука) → охорона/перевізники → горизонтальні пакети (кадри, ПДн) → інші юристи (white-label).
- **🪤 Попит — точна різниця (ядро бізнесу):** **транзакційний попит ДОВЕДЕНО** («оформи пакет» за 6–8 тис. разово — на цьому живе весь ринок юрфірм), **підписковий НЕ доведено**. Пакет = знімок, комплаенс = процес. Вхід — не через холодну аудиторію, а **через конверсію наявного потоку клієнтів юриста** в підписку.
- **🪤 Регуляторний календар медФОП (Opus-розвідка):** НСЗУ щомісяця до 5-го · об'єднана звітність щокварталу (зміна з 01.01.2026) · ф.20/17 щороку · **1 місяць** на зміни ліцензії · **7 днів** ТЦК · дедлайн додатку 2 **до 08.07.2026** · нові ліцумови з 08.01.2026. Ціна помилки: неоформлений працівник **86 470 грн** = 3–4 роки підписки; недопуск інспектора 138 352 грн. ⚠️ **військовий облік для ФОП НЕ обовʼязковий** (поширений міф — не продавати як страшилку).
- **🪤 Поправки до концепт-колоди «Medical License Assistant»:** (1) 6 модулів = 2-річний продукт, не MVP; «плюшок мало» = хибний сигнал (проблема гостроти цінності, не кількості); (2) рольова матриця = ТОВ, суперечить сегменту соло-ФОП; (3) **«закриває 100% вразливостей перед МОЗ» = DoNotPay-ризик**, прибрати.
- **Гейти:** фаза 1 (самоаудит безкоштовно + ручне закриття) → **≥50% дійшли до кінця аудиту**; фаза 2 (монетизація, оплата вручну) → **≥5 платящих**. Нема платящих = проблема сегмента/болю, **не функцій** → повертаємось до сегмента, а не пиляємо модулі.
- **Документи (9, гілка `docs/business-model-med-fop`):** `docs/research/{business-model-research-2026-07, competitive-analysis-med-fop-2026-07, interview-script-solo-fop}.md` + `docs/strategy/{business-case, business-model, mvp-business-plan, mvp-pmf-plan, med-fop-platform-vision, legal-platform-vision}.md`. `business-model.md` = злиття business-case+mvp-business-plan **без осіб/ситуації** (чисті факти).
- **Наступний крок — НЕ код:** 5–10 інтервʼю за скриптом (Mom Test; ключові питання: «чому бухгалтеру платите щомісяця, а юристу — ні?» + «покажіть, де у вас лежать документи»). Закриття = прохання про реальне зобовʼязання, не комплімент.

**🟢 SESSION 82 (2026-07-10→11) — MCP document service PoC (#96): архітектура дяді реалізована, наскрізь верифікована, демо пройдено → PR #97 ЗМЕРЖЕНО в main (Closes #96). Follow-up: знахідки A/B з демо (див. нижче).**
- **Що це:** дядя (вхідний Tech Lead) запропонував «LLM-інтервʼюер + детермінована фабрика»: MCP-сервер з tool-ом на документ, валідація кожного параметра («структурний 400» → LLM перепитує), скіли з деревом рішень. Розбір його меседжа + затверджений план = `specs/features/mcp-document-service/plan.md`. Виконано в цій же сесії (Fable-оркестратор + субагенти T3/T4/T5/skills).
- **Що працює (доведено):** `apps/mcp-server` — 4 tools з живого каталогу Supabase (list_services · validate_params · generate_alimony_document · generate_divorce_document). **76 офлайн-тестів** зелені (байтовий render-parity з `render-document.js`, parity копій валідаторів проти клієнтських оригіналів, kill-switch, fail-closed чеклист). **Живий stdio-E2E ALL PASS** (`npx tsx e2e/stdio-e2e.mts`): битий ІПН → структурна помилка → self-correct; валідні SAMPLE_ANSWERS → чернетка з водяним знаком у `out/` (жива Groq-деклензія); divorce(needs_review) → відмова service_unavailable; прогін з битим GROQ-ключем → nominative fallback, генерація НЕ блокується.
- **Скіли (драфт до sign-off Олі):** `.claude/skills/{legal-intake,alimony-claim,divorce-claim}` — юрконтент тільки з файлів репо; вже підхоплені харнесом. `.mcp.json` у корені підключає сервер до Claude Code.
- **⏳ Приймання PoC = живе демо D7** (потрібна НОВА сесія Claude Code — MCP-сервери підіймаються на старті; `/mcp` → legal-docs): інтервʼю → битий ІПН → перепит → зведення+підтвердження → generate alimony → відмова divorce → (опц.) live-флип статусу. Після демо — merge PR (`Closes #96`).
- **🪤 Знахідки:** (1) `sampleAnswers.ts` — ІПН з битою контрольною сумою (фонова задача заведена); (2) form_config у БД збігся з git SSoT (E2E пройшов без розбіжностей).
- **T9 (stretch, ПІСЛЯ демо):** мінімальний веб-чат `apps/chat` + серверний agent-loop на тому ж registry (план D8) — окреме рішення Сергія.
- **✅ D7 демо-прогін виконано (2026-07-11):** повний живий інтейк alimony через `legal-intake`→`alimony-claim` (перепит битого IBAN спрацював) → generate OK → чернетка у `out/`. Каркас надійності (kill-switch · format-валідація · fail-closed чеклист · водяний знак) — **працює як задумано**. Звіт: `specs/features/mcp-document-service/DEMO-FINDINGS-2026-07-11.md`.
- **🪤 2 знахідки з демо (код НЕ чіпав, лише задокументовано):**
  - **A (severity середній):** `alimony.document.txt:65,136,139` друкує `{{formatDate defendant_birth_date}} року народження` **без `{{#if}}`-гарду** → на порожній даті `formatDate`→`________` (`render-document.js:557`); прочерк лізе навіть у ПРОШУ СУД. Решта опц-полів у шаблоні загарджені — це пропущений виняток. Fix: гард у 3 місцях.
  - **B (severity ВИСОКИЙ):** AI-відмінювання ПІБ (Groq, `declension.ts`) недетерміноване — при збої тихо падає в називний (`used_ai=false`), а сам `.txt` **не має маркера** → Olga побачить «Стягнути з Іванов Іван Іванович» як норму. `used_ai` глобальний, не per-field. **Емпірика: 1 з 3 реальних файлів уже впав.** Підриває «byte-parity»+«court-ready». Fix: видимий маркер при фолбеку зараз; локальний детермінований відмінювач стратегічно.

**🟢 SESSION 80 (2026-07-07) — Підготовка до зустрічі з Олею (сьогодні 14:00): GDPR-бриф #91 + реактивація alimony + план демо. Паралельний тред до 78/79 (їхню law-monitor знахідку НЕЗАЛЕЖНО підтвердив наживо).**
- **#92 bookkeeping:** G1 (адмінка категорій) виявився вже зробленим у #85 (`362e6d0`) → тікнуто в issue. G2 (TWA-каталог) + G3 (політика доставки) **відкладено до медвертикалі** (нуль цінності до 2-ї live-категорії) + коментар + зв'язок #93. Issue #92 лишається open на G2/G3.
- **GDPR-бриф #91 (BLOCKER-5):** `docs/research/gdpr-med-data-brief-2026-07.md` — desk-research, факти ВЕРИФІКОВАНІ проти джерел: ст.7 ЗУ 2297-VI (медддані=заборона крім згоди; ми не медзаклад→підстава=**згода**) · Наказ Омбудсмана №1/02-14 (здоров'я=особливий ризик→**повідомлення 30 роб.днів**) · ст.39 Основ 2801-XII (право на копію власної медкартки=M1) · проєкт 8153 (GDPR-модель, не ухвалений 2026, штрафи 150млн/8%) · GDPR Art.3 (не застосовний до укр-only; тригер=Польща CUKR). **Попередній вердикт: CONDITIONAL GO для M1** за 5 умов + **7 гострих питань для Олі**. ⚠️ **На гілці `research/gdpr-med-brief` (`6044595`), НЕ на main** — merge deferred за Сергієм до пост-демо. Прогрес-коментар у #91. ⚠️ `docs/architecture/med-vertical-plan-2026-07.md` (реф у #91/#92/#93) НЕ існує — бриф покриває його §3.
- **Реактивація alimony (ОНОВЛЮЄ pending-стан сесії 79):** для ACT 1 демо треба жива послуга. Крос-звірка цитат: зміна СК 4824-IX = **ст.65** (нотар. згода на продаж спільного майна) — НЕ чіпає статей ні alimony (141,150,180-184), ні divorce (105,110,112,157). Сергій апрувнув **alimony→active** через адмінку («Підтвердити»). **divorce лишено в needs_review** = живий приклад для ACT 3. Прод-TWA верифіковано наживо (пряма no-store звірка спільної БД `nexkairsedqtczievxpa`): **alimony=active** (рендерить інтро→consent-гейт→форму 10 полів), **divorce=needs_review** («тимчасово недоступна»), 3 плейсхолдери=disabled. Стейл «недоступна» на 1-му reload = кеш GET `/services`, чиститься свіжим відкриттям.
- **План зустрічі:** `C:\Users\serge\Desktop\Olga-meeting-plan-2026-07-07.md` (ПОЗА репо — на робочому столі) — 5 актів клік-за-кліком + усі питання (B1 фідбек на документ · B2 медсписок+шкала 1–10 · B3 сім GDPR-питань · B4 sign-off «Список Олі») + law-change історія в ACT 3 (4824-IX/ст.65) + нюанси (ACT 1 у **реальному Telegram** — submit потребує підписаного `init_data`; свіже відкриття Mini App проти стейл-кешу). Consent-гейт **вже є** у TWA (доказ для B3).
- **🪤 Гочас (тулінг) — новий:** Chrome-MCP скрін/кліки/`find`/`read_page` заблоковані `document_idle` (не спрацьовує під Vite-HMR / Supabase-realtime websockets) — і на :5174, і на прод-TWA. Працює лише JS-інʼєкція (`javascript_tool`) + navigate + console. → на демо кліки за Сергієм (**опція A**); **опція B** = адмінка як prod-preview без HMR розблокує кліки Claude.
- **🪤 IDE-гочас підтверджено знову:** WebStorm перемкнув гілку з `research/gdpr-med-brief` на `main` посеред роботи — звіряти `git branch --show-current` ПЕРЕД комітом.

**🟢 SESSION 79 (2026-07-07) — Ops + верифікація, БЕЗ змін продукту/коду. (1) Полагоджено Docker Desktop (n8n «зник»); (2) наскрізь підтверджено, що CRON law-monitor відпрацював штатно 6.07 попри вимкнений ноут.**
- **Docker «n8n зник»:** Docker Desktop 4.41.2 не стартував — сервіс `com.docker.build` падав (`exit status 1`, відомий баг 4.41.2, фікс у 4.44) і ронив рушій; `docker ps` порожній → здавалось, контейнер видалено. **Дані цілі** (`docker_data.vhdx` 6.24 GB, том `n8n_data`). Фікс (data-safe): kill УСІХ docker-процесів вкл. `com.docker.build` → рестарт → рушій встав ~15с → `docker start n8n` (Up, :5678, HTTP 200). **НЕ тиснути «Reset to factory defaults»** (стирає томи). Durable: апгрейд ≥4.44 ПІСЛЯ файл-бекапу vhdx. Гочас → memory `gotcha_docker_build_service_crash`.
- **Law-monitor — верифіковано наскрізь (claim≠fact), попри вимкнений ноут+ngrok ~33 год:** крон живе у **GitHub Actions** (`.github/workflows/law-monitor.yml`), НЕ в n8n → тому спрацював при вимкненому ноуті. Run `28783188467` — trigger=`schedule`, success, 6.07 09:55 UTC (=11:55 Kyiv, час алерта). Задетектив **Сімейний кодекс `2026-03-04 → 2026-05-25`** (реальна редакція, підстава 4824-IX — сира сторінка рады в `article_diffs`). БД звірено НЕЗАЛЕЖНО: `law_change_log #8` (`detected_by=cron`, дати+timestamp збігаються), `divorce`+`alimony`=**needs_review**, TWA «тимчасово недоступна» = штатний наслідок. Інші 2 закони (ЦПК, судзбір) = ✅ OK → монітор розрізняє, не флагає все. **Чекає ревʼю Олі** (`reviewed_by=null`) → реактивація `service-lifecycle.mjs set-status <slug> active`.
- **«Чому не знаходило раніше»:** розклад був ВИМКНЕНИЙ до 29.06 (re-enable у session 52, коли Оля повернулась) + червневі прогони (11,26.06) = ручні `--dry-run` (зміну БАЧИЛИ, але не писали в БД / не флипали / не сдвигали baseline). 6.07 = перший боєвий автозапуск. Майбутня редакція (підстава 2147а-VIII, «відбудеться пізніше») в черзі → знову флагне після активації.

**🟢 SESSION 78 (2026-07-07) — fix(admin) #94: футер картки послуг виходив за межі картки. Гілка `fix/services-card-footer-overflow` → ЗМЕРЖЕНО+ЗАПУШЕНО в main (`8ac473f` фікс + merge `219a611`, Closes #94). tsc clean.**
- **Баг:** на «Мої послуги» у картці зі статусом `needs_review` футер (статус-пилюля + 2 кнопки Підтвердити/Вимкнути + 3 іконки) = один flex-ряд **без `flex-wrap`**; розпірка `flex-1` виштовхувала групу іконок за правий край картки, пилюля стискалась і «Потребує ревʼю» ламалось на 2 рядки.
- **Фікс (`ServiceCard.tsx`, 3 Tailwind-класи):** футер → `flex-wrap gap-x-2 gap-y-2` (перенос замість overflow); пилюля+кнопки → `whitespace-nowrap flex-shrink-0`; `flex-1`-розпірку → `ml-auto` на групі іконок.
- **Верифікація:** tsc clean, снапшот-тестів на компонент нема. Авто-скрін через Chrome-тул заблоковано (`/services` не досягає `document_idle` через відкритий Supabase/HMR-конект) → підтверджено через HMR у живому вікні :5174 + Сергій підтвердив візуально «всё ок».
- **Контекст:** Сергій працював у 3 паралельних терміналах → фікс свідомо в ізольованій гілці від `origin/main`.

**🟢 SESSION 77 (2026-07-05) — Fast-follow #90 (задеплоєно) + чистка Supabase + eslint-гігієна + матеріали до Олі. Усе код ЗМЕРЖЕНО+ЗАПУШЕНО в main.**
- **Fast-follow #90 (гілка `fix/90-fast-follow` → merged + n8n ЗАДЕПЛОЄНО):** (a) `Notify User` у form-submit → `onError=continueRegularOutput` (заблокований бот більше не роняє генерацію); деплой `deploy-workflow.mjs form-submit` (52=52 ноди, креди×20 збережено) + **API-звірка живого WF: `Notify User.onError` присутній, `active:true`**. (b) fallback-копія paid-екрану «натисніть Почати» → «**переконайтесь, що бота не заблоковано**, і натисніть Почати». (c) `delivery_error` enum — відкладено (Tier-2). PreviewPage 8✅ · workflow-тести 25✅. **Живий 403-прогін (реальний блок бота через TWA) — опційно за Сергієм (config-рівень підтверджено).**
- **Чистка Supabase (за явним «да»):** 3 тест-кейси (`a98495f5`,`1f491bc5`,`0bfa096c` — усі `service_id=1`, paid, ОДИН OWNER-профіль `60e7666d`) видалено (Storage DELETE PDF + SQL DELETE cases). Лишилось **4 cases** (було 7), 0 leftover.
- **Eslint (гілка `fix/eslint-react-hooks` → merged):** 9 pre-existing помилок (react-hooks плагін-дрейф) усунено. `only-export-components`→винесено date-хелпери в новий `dateInput.ts`; `set-state-in-effect`×6 + `refs`×1 → justified `eslint-disable-next-line`. **`eslint .`=0**, UI **555✅**.
- **Матеріали до Олі (гілка `docs/olga-demo-2026-07-06` → merged, лише docs):** демо-сценарій (5 актів) + **системна карта «поетапно + що за що відповідає»** (схвалено Сергієм — основа його презентації) + NotebookLM-snapshot `05_Current_State`. Слайд-дек (Artifact `3832782a-…`) — ⚠️ **Сергію не сподобався, переробляє сам**. Заземлено на живій БД (Explore-агент): 2 live template-послуги, оплата-заглушка, hybrid/RAG built-not-live, медвертикаль=гіпотеза під GDPR+sign-off.
- **🪤 Гочас:** у Bash-тулі (POSIX sh) НЕ використовувати PowerShell here-string `@'...'@` для `git commit -m` — інжектить літеральний `@` у subject; heredoc `git commit -F - <<'EOF'`.

**🟢 SESSION 76 (2026-07-05) — #90 ЗАДЕПЛОЄНО в живий n8n + ВЕРИФІКОВАНО НАСКРІЗЬ → ЗМЕРЖЕНО в main (Closes #90). Обидві гілки delivered_to_bot доведено на живому n8n.**
- **Деплой:** `deploy-workflow.mjs preview-pay` — нода `Finalize Delivery` додана (0 нод затерто), ключі Global Config відновлено, workflow active. Живий WF звірено через API: 2 respondToWebhook (opt-in-гейт цілий), обидві гілки → Finalize → єдиний Respond OK.
- **Живий HAPPY (opt-in зі стартом):** `delivered_to_bot=true`; форма `Send PDF` = **flat** `{ok:true, result:{message_id}}`; реальний PDF у чат (підтверджено).
- **Живий FAIL (opt-in при ЗАБЛОКОВАНОМУ боті):** `delivered_to_bot=false`, `signed_url` повернувся (док за лінком). **Запінено реальну 403-форму:** n8n віддає **`{error:{status:403, name:AxiosError}}`** — НЕ `{ok:false}`, НЕ під `.body`. `Finalize` дефолтить у `false` (ключ на `ok===true`). **Робастність за побудовою підтверджена емпірично.**
- **🪤 Гочас закрито:** форму провалу `Send PDF` тепер запінено вживу (`{error:{…}}`), а не тільки «робастно за побудовою».
- **Fast-follow (окремі мікрозадачі):** (1) `Notify User` у form-submit шле в бот ДО оплати без `onError=continue` → заблокований юзер валить генерацію; (2) копірайт #90 fallback «натисніть Почати» → точніше «переконайтесь, що бота не заблоковано» (реальна причина `false`=блок); (3) чистка тест-кейсів у Supabase.

**🟢 SESSION 75 (2026-07-05) — #89 ЗМЕРЖЕНО в main (Vercel-деплой) + deferred #90: чесний серверний сигнал `delivered_to_bot`. Гілка `feat/delivered-to-bot-signal` (`12586a9` фіча + `a6969fe` ревʼю), UI 555 ✅, scripts+n8n 1146 ✅, tsc/eslint(changed) clean. ✅ ЗМЕРЖЕНО в s76 (Closes #90) — задеплоєно + верифіковано наскрізь.**
- **#89 merge:** `feat/twa-delivery-ux` → main (`67623de`, Closes #89, гілку видалено), Vercel prod-деплой тригернувся, коментар у #89. UX-пакет TWA тепер live у проді.
- **#90 знахідка (understand-workflow, 4 читачі + синтез, чистий прогін):** n8n **вже** робить `sendDocument` синхронно (Send PDF inline перед Respond OK), результат (`{ok:true}`/403) є в процесі, але **скидається** (Respond OK читає лише Build Response; Send PDF `onError=continue`). → правда доступна за НУЛЬ додаткової латентності, «зробити синхронним = +латентність» = хибна розвилка. Фікс локальний у preview-pay.
- **#90 дизайн (обрав Сергій):** boolean `delivered_to_bot` + Start-aware honest fallback. **n8n:** нова Code-нода `Finalize Delivery` (між Send PDF→Respond OK) читає `$('Send PDF')` → ключ на `Telegram ok===true` (message_id НЕ вимагаємо; defensive `.body`-unwrap), honest-by-default. Обидві гілки `Send to bot?` сходяться → **єдиний** Respond OK (2 respondToWebhook, opt-in-гейт цілий). **Клієнт:** parse `delivered_to_bot` (missing→false, backward-compat), стейт `deliveryConfirmed` (окремий від intent `deliverToBot`), paid-копія `true`→«Копію надіслано у ваш чат» / `false`→«Доставку копії в чат не підтверджено» + хінт «Почати» (future-enabling, не re-send).
- **#90 adversarial-ревью (4 лінзи → верифікація, чистий прогін 12 агентів, 5 підтверджено, 0 блокерів, усі застосовані):** behavioral-тест Finalize (компілює jsCode + стаб `$`, а не string-match) · fallback «press Start» over-promise → future-enabling · amber/green 11px WCAG AA fail → -700 · застарілі доки «ok+message_id» → «ok===true».
- **🪤 Гочас:** live-форма провалу Send PDF (`{ok:true,message_id}` flat чи під `.body`?) статично НЕ пінингована — код робастний за побудовою (ключ на `ok===true`), але живий 403-прогін ОБОВʼЯЗКОВИЙ до shipping.

**🟢 SESSION 74 (2026-07-05) — UX-пакет TWA (план вихідних п.1): помітний opt-in доставки (2 картки) + ErrorBoundary + delivery-aware стани + a11y live-regions. Гілка `feat/twa-delivery-ux` (`8a821b3` фіча + `2bebcda` ревʼю-раунд 2), UI 550 ✅, tsc/eslint(changed)/build:client OK, live-verified (Playwright). ✅ ЗМЕРЖЕНО в s75 (`67623de`, Closes #89). Issue #89 ЗАКРИТО.**
- **A. 2-карткова розвилка доставки** (`PreviewPage.tsx`, `DeliveryChoice`): «🔒 Захищене посилання» (signed URL 24год, приватність-first, вибрана дефолтно → `deliverToBot=false`) vs «📩 Також у Telegram» (→ true; GDPR-розкриття тепер ІНЛАЙН у картці, не в схованому tooltip). Нативні `sr-only` radio (fieldset/legend/`name="delivery"` = a11y+клавіатура) + React-driven візуал; дефолт OFF збережено. Форму obrав Сергій (AskUserQuestion).
- **B2. ErrorBoundary (новий, `role="alert"`)** навколо `<App/>` у `main.tsx` — TWA не мав ЖОДНОГО → render-throw = білий екран; тепер ⚠️ + укр. текст + «Оновити» + сирий діагностичний рядок + haptic.
- **B1/B3.** paid-екран показує «Копію також надсилаємо у ваш чат» лише при opt-in; помилки розділено `preparing`/`technical` + guard на порожній webhook.
- **Adversarial-ревью (5 лінз → верифікація кожної; 3 підтверджено):** «надіслано» флагнули **3 незалежні лінзи** → змінено на present-continuous «надсилаємо» (клієнт НЕ може підтвердити, що Telegram sendDocument дійшов — 403 якщо юзер не /start; хибна доставка = дефект для court-ready). +тест wire-контракту `deliver_to_bot` (`requestPreviewPay` НЕ pure — робив fetch, був не покритий). +`ring-primary-500` (був неіснуючий `-300`). **Deferred (n8n):** серверний сигнал `delivered_to_bot` у paid → точний факт замість present-continuous.
- **Ревʼю-раунд 2 (`2bebcda`) — ПОВНА верифікація** (на вимогу Сергія «як полагатися на часткову роботу?»): 1-й прогін втратив 6/18 verify по session-limit → перезапустив свіже ревью по вже-виправленому коду (13 агентів, **0 упалих**) + аудит 4 фіксів = усі CORRECT. 5 нових low/medium підтверджено й застосовано: a11y live-regions (`role=alert/status`+`aria-live`, WCAG 4.1.3 на грошовій дії) · `autoFocus` первинної дії між фазами · ДО-оплатна копія «прийде»→«Надішлемо» (узгоджено з хеджем) · зайвий фінальний sleep у retry · прибрано false-green тест + мертвий guard.
- **🪤 Гочаси:** (1) session-limit тарифу вбиває workflow-verify-агентів → «N confirmed» ≠ повна картина; правильна реакція = ПЕРЕзапуск повного ревью (ліміт скидається ~1:30 Amsterdam), + `unverified`-список у workflow, + `journal.jsonl`. (2) verify-агент лишав осиротілий тест-файл — чистити перед комітом (git status). (3) Resume-from-cache НЕ годиться після правок коду — старі находки про неіснуючий код; треба свіже ревью по новому HEAD.

**🟢 SESSION 73 (2026-07-04) — #88 ЗАКРИТО: п.2–6 + adversarial-ревью → MERGE у main (`e28a37d`, Closes #88), гілку `fix/admin-quick-wins` видалено. UI 534 ✅ (+14) · tsc/build:admin OK · live-verify повний · Vercel-деплой тригернувся.**
- **П.2–6 (коміт `5595bae`):** /design під AdminGuard · мертвий чек-лист якості видалено · вкладку
  «AI-промпт» сховано для template-driven режимів (предикат `templateDrivesGeneration`:
  template|hybrid|null; факт: `services.ai_prompt` не читає ЖОДЕН живий workflow — лише архівний v5,
  hybrid-промпти живуть у `n8n/prompts/`; для legacy js — чесний банер «промпт не впливає») +
  `visibleTab`-fallback · Dashboard: збій завантаження = укр. помилка + «Спробувати ще раз» (raw
  message дрібним моно для діагностики), НЕ фейкове «Ще немає послуг» · «Abstention rate» →
  «Складні справи (AI передав юристу)».
- **Adversarial-ревью диффа (workflow: 3 лінзи → верифікація кожної знахідки): 12 підтверджено,
  1 відбито, усі виправлені ДО merge.** Головні: (1) blocker у свіжому ж тесті — Proxy-заглушка
  сторінок = thenable (`get`-trap віддає функцію і на `then`) → async vi.mock-фабрика ніколи не
  резолвиться → vitest deadlock на collection (саме тому висіли прогони; переписано на плоскі
  `{[exportName]: stub}`); (2) регресія Dashboard: deps `[user]`→`[userId]` (supabase емить свіжий
  об'єкт user на кожен TOKEN_REFRESHED ≈ щогодини → каталог колапсував би в skeleton) +
  `cancelled`-guard проти stale-відповідей; (3) застарілий копірайт ×3 (empty-state Dashboard,
  FormBuilder «ID поля…», lead AI-вкладки) — юриста більше не шлють у сховану вкладку.
- **Live-verify :5174 (жива Supabase, divorce):** AI-вкладки нема (Форма/Шаблон/Опції) · чекбоксів 0 ·
  dead-ref банер `{{missing_field_xyz}}` блокує публікацію (кнопка disabled) · confirm публікації з
  коректною копією для active (скасовано — БД ціла) · «У чернетку» + тост · **симетричний гейт форми
  вживу заблокував save** після видалення поля `registered_address` (точний тост; після reload 15/15
  полів на місці, БД ціла) · консоль 0 помилок · драфт фінально 14939 байт-у-байт.
- **🪤 Гочас сесії:** session-limit тарифу вбиває workflow-агентів посеред прогону — «0 знахідок» від
  упалого ревью ≠ чистий дифф (дивитись `failures`/`agents_error` в результаті!); осиротілі
  vitest-процеси вбитих агентів висять — чистити перед новим прогоном.

**🟡 SESSION 72 (2026-07-04) — #88 п.1 publish-gate ГОТОВО (змержено в main у s73 разом із п.2–6) + 2 стратегічні рішення. UI 520 ✅ (+17) · tsc/build:admin OK.**
- **Publish-gate проти структурних «________» (п.1 #88), коміт `7e4eaff`:** дизайн на Fable → adversarial
  red-team (3 лінзи, 3 blocker-и) → **контракт форма↔шаблон має 4 ребра, загейчено всі**: (a) публікація —
  `collectDeadRefs()` 4 класи (unmatched / missing-sources / unknown-ai-path / unknown-answers-path;
  виняток `GRACEFUL_DEFAULTS` — гендери/n_children рендерять дефолт, не діру) + confirm зі статус-залежною
  копією (для disabled не брешемо «клієнти одразу отримають»); (b) «Відновити» — dead-ref backstop у
  `gateSnapshotAndSet` (був parse-only!) + нова кнопка «У чернетку»; (c) збереження форми — симетричний
  гейт (блокує лише ВНЕСЕНІ dead refs, baseline `savedConfig`); (d) флип js→template поза UI —
  GOTCHAS-правило + IMPROVEMENTS **#104** (render-time hard-fail) / **#105** (lint опціональних полів).
  Плюс: атомарний **«Зберегти і опублікувати»** при formDirty (ordering-діра закрита конструкцією, не
  попередженням) · **formDirty ≠ draftDirty** (кейстрок шаблону ≠ «незбережені зміни») · **parity-тест
  дзеркало↔рушій** (`buildContext({},{})` === `providedContextKeys()`, 15/15 — дрейф валить CI, не юриста).
  Політика (red-teamed v2): `.claude/reports/2026-07-04-publish-gate-policy.md`.
- **Рішення (DECISIONS.md): похідний реєстр змінних; збережуваний ВІДХИЛЕНО.** Correct-by-construction =
  дисципліна поверх view (палітра вже обчислює union form_config + PROVIDED_CONTEXT); окрема таблиця =
  другий источник істини про «поле існує» → drift-клас поверхом вище. Траєкторія без роботи двічі:
  (1) гейти v2 ✅ → (2) registry-дисципліна (inline-підсвітка невідомих змінних у CM тим самим предикатом +
  reference-guard/guided-rename у FormBuilder) → (3) preflight-панель (#10 vision) ПЕРЕД заливом
  медвертикалі (**майбутнє = медицина**: M1–M11 ≈ 9 простих template-послуг; вікно = #BLOCKER-5 GDPR +
  sign-off Олі M1–M18; M8–M18 = hand-off юристу, підтверджує стратегію ескалації).
- **Fable-window аналіз** (`2026-07-04-fable-window-tasks.md`, 8 аналітиків): слам-данків нема — усе
  reasoning-важке або вже заспечено (GraphRAG-онтологія в `GRAPHRAG-GUIDE.md`!), або gated на Олю/інфру.
  Вибір Сергія = publish-gate через Fable — зроблено цієї ж сесії.
- **Плани вихідних** (`2026-07-04-weekend-plan-to-monday.md`): зустріч з Олею **пн 06.07 вечір** (покаже
  «що є + плани», дедлайн НЕ жорсткий — рішення Сергія); п.1 плану (шов generation_mode) закрито ще в s71.
- **⚠️ Знахідка:** 8 eslint-помилок **pre-existing на main** (дрейф react-hooks плагіна після s71;
  `git diff main` тих рядків порожній; `npm run lint` = ті самі 8) — кандидат окремої мікрогілки.

**🟢 SESSION 71 (2026-07-04) — FIX: створення нової послуги в адмінці було ПОВНІСТЮ зламане (2 баги) → ЗМЕРЖЕНО в main і ЗАПУШЕНО (merge `e5ff0b5`), гілку `fix/new-service-generation-mode` видалено. tsc/eslint clean.**
- **Баг #1 — `services.id` sequence відставав від MAX(id):** таблиця старша за `migrations/` (serial через дашборд); рядки 1-5 сіялися з явними id без руху owned-послідовності → `nextval` усередині зайнятого діапазону → КОЖЕН `INSERT` без id (admin «Нова послуга») падав `duplicate key services_pkey`. Юрист не міг створити ЖОДНОЇ послуги. Фікс: **міграція 032** `setval` до MAX(id) (недеструктивно) — **застосована на живій БД** (Сергій, SQL editor «Success»).
- **Баг #2 — DB-дефолт `generation_mode='js'`** (міграція 014): нова послуга роутилась би в legacy js-білдер n8n (нема хардкод-функції) і кидала помилку. Фікс: `ServiceEditPage.handleSave` insert-гілка → `generation_mode:'template'` (тільки insert; update не чіпає 'hybrid'/'js').
- **Live verify через REST** (той самий PostgREST-ендпоінт, що й браузерний `supabase.from('services').insert`): після міграції `INSERT` без id авто-присвоює id + `generation_mode='template'` персиститься; `status`-CHECK = `active|needs_review|disabled`; усі тест-рядки видалено (`DELETE 204`), БД чиста (наступний реальний id=9, розриви нешкідливі).
- **✅ Замкнута петля доведена через РЕАЛЬНИЙ admin UI (:5174):** MCP-таб успадкував живу Supabase-сесію Сергія (login не потрібен) → «Нова послуга» → title+slug → «Зберегти» (справжній React `handleSave`) → редирект `/services` + **нова строка id=9** у БД з `generation_mode='template'` (не дефолт `js`), `lawyer_id`=UUID Сергія, без duplicate-key. React-обвʼязка (єдине, що лишалось непокритим) — доведена. Тест-строку + 2 smoke-cases (a8416d68/260cd583) + їх PDF у Storage прибрано (services назад до 5).
- **Регресія n8n:** обидва live-smoke (scenario 1 divorce, scenario 2 children+alimony) → 200, витяг без дір. Unit-сюїта scripts+n8n **1145 ✅**.
- **🧹 Хвіст:** 2 стратегічні звіти в `.claude/reports/` (mvp-synthesis + transition-roadmap) закомічено окремо.
- **🪤 Гочас підтверджено знову:** IDE (WebStorm) перемкнув гілку на `main` посеред роботи — staged-файли поповзли на main; врятувало `git branch --show-current` перед комітом (звіряти ЗАВЖДИ).

**🟢 SESSIONS 64–70 — перенесено в `archive/session-log-2026-H1.md`** (s64: #86 — 16 дір «________» у
проді, дата-фікс + `upload-form-config.mjs`; s66: template-editor конвеєр #51; s67: S2 слайси A+B,
методика клік-тестів `reference_browser_automation_cm`; s68: слайс C; s70: слайс D — фокус-режим +
іконкова рейка, #87). Живі хвости з них — у «Списку Олі» та «ПОРЯДКУ СЕСІЙ» нижче.

**📋 Список Олі (sign-off):** (1) формулювання превʼю-витягу (точка обрізки) + блоку ст.175 ч.7;
(2) #67 divorce wording «спір… відсутній» → «не є предметом цього позову»; (3) **НОВЕ s64:** формулювання
«бажаний спосіб отримання коштів» ст.175 ч.7 + чи робити поле обовʼязковим, коли рахунку нема (зараз
опціональне → у документі легальний, але негарний `________`); (4) валідація таблиці медпозицій M1–M18;
(5) **s65/s66:** текст каркаса позову (8 блоків, `templateSkeleton.ts` — уже live в адмінці) — sign-off
потрібен ДО того, як хтось уперше ОПУБЛІКУЄ послугу, створену з каркаса.

**Що live у проді (form-submit `D2ab06X3pVUWk1py`, active):**
- **2 template-послуги** — divorce + alimony, `generation_mode='template'`, form_config ↔ template вирівняні (s64).
  **СТАТУС (s80): `alimony=active`, `divorce=needs_review`** (CRON-флип 6.07 через СК 4824-IX — чекає sign-off Олі;
  реактивація: адмінка «Підтвердити» або `service-lifecycle.mjs set-status divorce active`). Документ НЕ йде в бот
  до оплати (PDF у приватний Storage, витяг у ранній відповіді). Per-profile rate-limit 20/24год. Склонення ПІБ =
  Groq + stem-guard. #67/#76 live.
- **Агент «що змінилось» (law-change-impact)** — живий end-to-end (n8n `qTOIqllA4CQvBJs5`).
- Preview-module (#83): наскрізний потік TWA→витяг→PreviewPage→оплата(заглушка)→signed URL (sessions 54-57).
- **UX-пакет доставки TWA (#89, s74→ЗМЕРЖЕНО s75 `67623de`):** 2-карткова розвилка доставки + ErrorBoundary +
  delivery-aware стани + a11y. Vercel prod-деплой тригернувся (⚠️ не верифіковано вживу цієї сесії).
- **✅ #90 `delivered_to_bot` — LIVE (s76 deploy preview-pay + s77 fast-follow):** сервер віддає факт доставки в чат;
  form-submit `Notify User onError=continue` задеплоєно (s77). Заблокований бот не роняє генерацію.

**📦 Теплі факти — для роботи з preview-flow:**
- `cases.user_id` = **profile UUID** (НЕ telegram id!). Telegram id → profile через `identities.external_id`
  → `identities.user_id`. Owner-check і rate-limit — по цьому UUID.
- **Storage:** приватний bucket `generated-documents` (PDF-only, service-role), шлях `cases/{case_id}.pdf`.
  Чистка файлів: Storage API DELETE (тригер `protect_delete` блокує SQL DELETE на `storage.objects`, але НЕ
  на таблицю `cases` — тестові cases видаляються звичайним SQL DELETE під service-role).
- **Скрипти:** `build-preview-pay.mjs` + `sync-preview-module-form-submit.mjs` + `test-preview-pay.mjs` (e2e) ·
  **`upload-form-config.mjs <slug> [--check]` (s64)** + `upload-document-template.mjs` — **форма і шаблон =
  одна одиниця деплою, заливати разом**. Деплой workflow: `deploy-workflow.mjs preview-pay|form-submit`.
- **🪤 IDE перемикає гілку:** WebStorm робив `checkout main` посеред роботи. Звіряти
  `git branch --show-current` ПЕРЕД кожним комітом.

**🔴 НАСТУПНА СЕСІЯ (81):**
1. **Прогін плану презентації ще раз** (за прямим проханням Сергія): пройти `C:\Users\serge\Desktop\Olga-meeting-plan-2026-07-07.md` — 5 актів + порядок. Опційно опція B (адмінка prod-preview без HMR) → Claude драйвить кліки ACT 2–3.
2. **Пост-Оля (зустріч сьогодні 14:00):** обробити її фідбек на живий документ (→ задачі/wording); медсписок → шкала templatability 1–10; **відповіді на 7 GDPR-питань → фінальний go/no-go у DECISIONS.md**; sign-off «Список Олі» (вкл. ст.175 ч.7, каркас позову, підтвердження що 4824-IX не чіпає divorce/alimony → реактивувати divorce).
3. **Merge GDPR-брифу:** гілка `research/gdpr-med-brief` (`6044595`) → main (deferred до пост-демо). + дописати відсутній `docs/architecture/med-vertical-plan-2026-07.md` (§1–2 інвентар/шкала, §4 retention).
4. **Fast-follow #90 хвіст:** опційно `delivery_error` enum (Tier-2) + живий 403-прогін. Беклог: точковий фідбек A+B+C+D · діра оплати (найбільша MVP-діра).
**Модель:** прогін/зустріч/фідбек — розмовне; медвертикаль-дизайн + фінальний GDPR go/no-go + `delivery_error` = Tier 2 (Opus+).

**Модель:** з 02.07 Сергій переключив default на **Fable 5** (червневий мемо «Opus + ultra-code» закрито).

**Запуск середовища:** n8n live (Docker) + ngrok (`rosy-caution-progeny.ngrok-free.dev → :5678`).
**Dev-адмінка: `npm run dev:admin` → :5174** (s67: порт-аргумент через npm НЕ пробрасывается; старий
процес на :5175 убито). ⚠️ Правка рушія `render-document.js` НЕ підхоплюється Vite HMR (optimizeDeps) —
чистити `node_modules/.vite` + рестарт (симптом: `{{#bold}}` рендериться як `________`).
Деплой form-submit: `node scripts/deploy-workflow.mjs form-submit`. Деплой дайджесту:
`node scripts/build-law-change-digest.mjs && node scripts/deploy-workflow.mjs law-change-digest`.
Тести: `cd apps/client && npx vitest run --root ../.. scripts n8n` (+ `npm test` для UI). CI-гейт: `.github/workflows/test.yml`.

**⚠️ Інфра:** WebStorm-термінал (JediTerm) не скролить Claude Code TUI → великі звіти писати у `.md`
(memory `feedback_reports_to_file`).

