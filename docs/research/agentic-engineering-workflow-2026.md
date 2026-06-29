# Як найкраще працювати з Claude (Code): робочий процес агентної розробки

**Дата:** 2026-06-29 (session за відео Beer::Code)
**Автор:** дослідження на запит Сергія — воркшоп Кирила Сулімовського (agenticengineering.it.com/workflow-june,
PRD / vertical slices / multi-agent / AI-driven delivery) + офіційні рекомендації Anthropic «як працювати з Claude».
**Вхід:**
- Відео Beer::Code «Чому AI пише тобі сміття: 5 помилок» (той самий автор/екосистема `agenticengineering`).
- Курс **Agentic Engineering 1.0** (Кирило Сулімовський, ~73 уроки, укр.) — orchestrator-worker multi-agent,
  PRD-first, спеціалізовані суб-агенти (`backend-architect`, `frontend-specialist`, `code-reviewer`).
  *(Сайт воркшопу за Cloudflare — зміст зведено з публічних анонсів/пошуку; first-party не відкрився.)*
- **Anthropic, first-party:** `anthropic.com/engineering/effective-context-engineering-for-ai-agents`,
  `anthropic.com/engineering/effective-harnesses-for-long-running-agents`,
  `code.claude.com/docs/en/best-practices`, `anthropic.com/research/claude-code-expertise`.
**Мета:** зібрати **practical workflow** роботи з Claude і накласти на наш репо — що вже робимо, що додати.

> 🔗 Не дублює, доповнює: `docs/architecture/SDD-GUIDE.md` (наш SDD), `PROMPTING-GUIDE.md`,
> `VERIFICATION-PROTOCOL.md`, `SKILLS-HARNESS-PLAN.md`. План дій — `IMPROVEMENTS.md` #92–#96.

---

## 1. Головна теза (спільна у відео, курсі й Anthropic)

> **Якість виходу = якість процесу навколо моделі, а не сама модель.**
> Один наскрізний цикл: **Контекст → Керування контекстом → Перевірка → Вимірювання → Накопичення.**
> Кожна сходинка підпирає наступну. Anthropic формулює це як «context engineering»: ключове обмеження —
> **контекстне вікно швидко заповнюється, і якість падає в міру заповнення**; усе зводиться до того, щоб у
> вікні в кожен момент був **мінімальний набір високо-сигнальних токенів**.

---

## 2. Робочий цикл (синтез Anthropic best-practices + воркшоп)

### Фаза 0. Контекст і допит (перед кодом)
- **PRD/спека-first.** Для нетривіального — спершу витягнути контекст, тоді кодити. Anthropic прямо радить
  патерн **«Let Claude interview you»**: мінімальний промт + «interview me using AskUserQuestion … keep
  interviewing until we've covered everything, then write a complete spec to SPEC.md». → у нас це
  skill `/interview` (IMPROVEMENTS #92) + `/feature-spec` для Tier 2.
- **Специфічний промт** замість «зроби краще»: назви файл, сценарій, приклади тест-кейсів, що значить
  «готово». Покажи приклад патерну в коді («дивись, як зроблено `HotDogWidget`»).
- **Хороша спека self-contained:** перелічує файли/інтерфейси, що **поза скоупом**, і **наскрізну перевірку**,
  що доводить роботу. «Час на точну спеку окупається більше, ніж час на спостереження за імплементацією».

### Фаза 1. Explore → Plan → Code → Commit (4 фази, plan mode)
- **Explore:** plan mode, агент читає файли й відповідає, **нічого не пише**.
- **Plan:** «створи детальний план — які файли, який flow». План можна редагувати руками (`Ctrl+G`).
- **Implement:** вийти з plan mode, кодити **строго за планом**, одразу писати/ганяти тести.
- **Commit:** описовий меседж + PR.
- **Коли пропускати plan:** якщо дифф описується одним реченням (друкарська, лог, ренейм) — роби прямо.
  Це наш **спек-тир 0/1/2** (`SDD-GUIDE.md`): ефорт ∝ ризику.

### Фаза 2. Vertical slices (з воркшопу)
- Не «весь backend, тоді весь frontend», а **тонкий вертикальний зріз** наскрізь (форма → нода → шаблон →
  тест) на одну гілку, з власною перевіркою. У нас це лягає на «одна послуга = один slice» і
  `specs/features/<slug>/` триплет.

### Фаза 3. Verification loop (перевірка — не вірити на слово)
- Дати агенту **перевірку, яку він сам запустить**: тести, build exit code, лінтер, скрипт-дифф проти
  фікстури, скріншот проти дизайну. «Claude зупиняється, коли робота **виглядає** зробленою» — без перевірки
  ти і є цей цикл.
- **Вимагати докази, не запевнення:** показати вивід тесту/команди/скріншот.
- **Жорсткість gate:** в одному промті → `/goal`-умова (окремий evaluator після кожного ходу) → **Stop hook**
  (детермінований, блокує завершення, поки не пройде).
- **Рев'юер у свіжому контексті:** «той, хто писав, не приймає сам себе». `/code-review` skill — суб-агент
  бачить **тільки дифф** і критерії. Застереження Anthropic: рев'юер, якого просять знайти дири, **завжди**
  щось знайде → казати йому «лише те, що впливає на коректність/вимоги», інакше over-engineering.

### Фаза 4. Multi-agent / orchestrator-worker (воркшоп + Anthropic)
- **Суб-агенти — головний інструмент контролю контексту**, не лише «ролі». Важкий ресёрч/греп читає купу
  файлів у **окремому вікні** й повертає в головне лише **вижимку** → головне вікно лишається чистим.
- Патерни: **Writer/Reviewer** (одна сесія пише, друга в свіжому контексті рев'юить — не упереджена до
  свого коду), **тести↔код** (один пише тести, інший — код під них), **fan-out** (`claude -p` у циклі по
  списку файлів для міграцій).

### Фаза 5. Memory / накопичення
- **CLAUDE.md** — вантажиться щосесії; тримати **коротким** (для кожного рядка: «чи призведе видалення до
  помилки агента?» — ні → виріж). Роздутий CLAUDE.md → агент **ігнорує половину**.
- Доменні/рідковживані знання — у **skills** (вантажаться на вимогу), не в CLAUDE.md.
- **Hooks** — для того, що має статись **детерміновано щоразу** (lint після edit, блок запису в `migrations/`).
- Граблі агента фіксувати **раз** у файл, що автозавантажується (у нас → `GOTCHAS.md`, IMPROVEMENTS #94).

---

## 3. Керування контекстом — конкретні важелі (Anthropic)

- **`/clear` між незв'язаними задачами** («kitchen sink session» — антипатерн №1).
- **Після 2 невдалих коригувань — `/clear`** і кращий стартовий промт (контекст засмічений невдалими спробами).
- **Компакція:** авто або `/compact <focus>`; у CLAUDE.md можна задати, що зберігати при компакції
  (список змінених файлів, тест-команди).
- **Just-in-time, не all-upfront:** агент тримає легкі покажчики (шляхи, запити) і дотягує дані тулами на льоту
  — замість завалити вікно наперед. Це наш гібрид: CLAUDE.md upfront + glob/grep on-demand.
- **Позиційна увага:** початок і кінець вікна — найуважніші («lost in the middle»). Головну думку — на початок,
  найважливіше продублювати в кінці.
- **MCP-гігієна:** описи тулів кожного під'єднаного MCP їдять контекст наперед. `/context` показує вартість;
  лишати потрібні, решту вимикати (IMPROVEMENTS #96).

---

## 4. Накладення на наш репо (де ми вже сильні / де дири)

| Крок процесу | Стан у Legal-AI | Дія |
|---|---|---|
| Контекст на старті | ✅ PROMPTING-GUIDE, CLAUDE.md (79 р.), SessionStart-хук | + skill `/interview` (#92), правила в CLAUDE.md (#95) |
| Керування / SDD | ✅ SDD-GUIDE, `specs/features/*` триплети, тири 0/1/2 | свіжий чат на задачу; субагент для ресёрчу (#95) |
| Verification loop | ✅✅ VERIFICATION-PROTOCOL, groundedness L4a, ~30 тестів, parity | звичка `/code-live` рев'ю перед merge; добудувати L4b (built-not-live) |
| Вимірювання | 🟡 eval лише для класифікатора інтенту | **evals генерації divorce/alimony + judge (#93) — пріоритет №1** |
| Накопичення | 🟡 величезні summary/changelog | стиснути + `GOTCHAS.md` (#94); CLAUDE.md ≤200 р. |
| Multi-agent | 🟡 субагенти доступні, але не в протоколі | прописати Writer/Reviewer і ресёрч-субагента як норму |

**Висновок:** кроки 1-3 процесу (контекст, керування, верифікація) у нас **на рівні вище**, ніж у типовому
гайді — завдяки SDD + «нуль галюцинацій конструкцією». Реально бракує **вимірювання якості генерації (evals)**
і **гігієни пам'яті**. Почати, як радить автор відео, з **одного болючого** — у нас це **#93 (evals)**.

---

## Джерела
- Anthropic — Effective context engineering for AI agents: <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
- Anthropic — Effective harnesses for long-running agents: <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents>
- Claude Code — Best practices: <https://code.claude.com/docs/en/best-practices>
- Anthropic — How Claude Code is used in practice: <https://www.anthropic.com/research/claude-code-expertise>
- Agentic Engineering (Кирило Сулімовський): <https://lms.agenticengineering.it.com/> · воркшоп: <https://agenticengineering.it.com/workflow-june>
- Beer::Code — «Чому AI пише тобі сміття: 5 помилок» (YouTube).
