# AirCareer (aicareer-weld.vercel.app) — как устроен их «редактируемый документ»

> Session 66, 2026-07-03. Вопрос Сергея: по какому принципу сделан inline-редактор резюме
> у AirCareer и как у них устроена генерация резюме/сопроводительных писем.
> Источник фактов: raw HTML + JS-чанки `/_next/static/chunks/*` (curl), заголовки их API,
> веб-поиск. Догадки помечены.

## 1. Стек (установлено фактически)

| Слой | Что | Источник |
|---|---|---|
| Frontend | **Next.js App Router** + Tailwind + TanStack Query + Framer Motion, деплой Vercel | RSC flight-данные `self.__next_f`, `X-Nextjs-Prerender`, webpack-чанки |
| Auth/Storage | **Supabase** (`iolaqkviryphtbnspncx.supabase.co`) | 96 вхождений в чанках |
| Backend | Отдельный API на **Railway** (`api-production-db80e.up.railway.app`) | заголовок `Server: railway-hikari` |
| Аналитика | PostHog | чанки |
| LLM | не видно с клиента (всё за Railway-API) | единственное серое пятно |

## 2. Редактор — НЕ библиотека, а самописные contentEditable-«листья»

В коде **ноль** вхождений ProseMirror/Tiptap/Slate/Lexical/Quill/draft-js (все хиты «slate» —
это цвет Tailwind в палитре акцентов документа).

Принцип (чанк `9088-…js`, компонент `CVOptimizeFlow`):

- Резюме = **структурированный JSON** `candidateProfile` (секции → опыт → буллеты) + отдельный
  `docStyle` (шрифт default Times, акцент из 6 пресетов, плотность).
- Документ рендерится обычными React-компонентами в контейнер `cv-paper` (имитация A4,
  `pageCount` считается на клиенте).
- **Каждое текстовое поле — отдельный** `<span contentEditable class="cv-editable">`:
  коммит по blur, Escape = откат, Enter перехвачен, drag&drop запрещён, вставка plain-text.
  Пользователь физически не может сломать структуру — он редактирует «значение одного
  JSON-поля», а не документ.
- Undo/Redo — собственный reducer с `history`/`future` поверх profile (⌘Z); «Undo AI» — просто
  ещё одна запись той же истории.
- Автосейв: `PATCH /api/cv/versions/:id {profile, docStyle}` → индикатор «Saving…».

## 3. Генерация и PDF

- Загрузка старого резюме: `POST /api/cv/parse-stream` (SSE) — PDF/TXT → JSON-профиль со стримингом.
- Подгонка под вакансию: `POST /api/cv/optimize {profile, jobText, mode}` — серверный конвейер
  («Tailoring your resume» → «Writing cover letter» → «Rendering PDF»), возвращает новый profile +
  `changeLog` (аннотации что изменил AI) + `coverLetter` (письмо — **read-only**, только copy,
  его inline НЕ редактируют).
- Точечный AI: `POST /api/cv/bullet-transform {action, text, prompt}` — трансформация одного буллета.
- PDF — **на сервере**: `GET /api/cv/versions/:id/pdf` → blob + `pdfSignedUrl` (кэш, судя по всему
  Supabase Storage). На клиенте нет jspdf/html2canvas/react-pdf. (Догадка: headless Chromium на Railway.)

## 4. Что это значит для нашего конструктора документов

AirCareer — это **не** round-trip WYSIWYG над шаблоном. Это редактирование *инстанса*
(значений полей одного резюме), где:

- источник истины — JSON; HTML никогда не парсится обратно;
- каждый editable-узел жёстко привязан 1:1 к одному JSON-полю; структуру текстом не поменять;
- цена ошибки ≈ ноль: испорчено одно личное резюме, владелец сам видит и правит.

У нас объект редактирования — **шаблон** (переменные, `{{#if}}`, повторы, нумерация), общий для
всех будущих документов, с судебными последствиями. Round-trip «HTML-правка → обратно в DSL» —
ровно тот тихий канал порчи, который мы отвергли дважды (ресёрч s65). Пример AirCareer скорее
**подтверждает** наш выбор: даже они не редактируют «документ как текст» — только узкие безопасные
окна поверх структуры.

**Переносимый паттерн, если захотим inline-правку:** contentEditable-листья, привязанные 1:1 к
полям структуры — у нас это могла бы быть правка *значений переменных* прямо в превью готового
документа (режим «Показати змінні» уже знает, где какое поле стоит). Сам шаблон остаётся DSL +
read-only превью; план эволюции S2 (CodeMirror 6 + чипы + styleHints v2 runs) это не меняет.
