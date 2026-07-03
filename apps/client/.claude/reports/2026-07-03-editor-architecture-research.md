# Ресёрч: архитектура редакторов документов-шаблонов (для нашего template-редактора)

Дата: 2026-07-03. Контекст: админка Legal-AI, редактор шаблонов для юриста (Ольга). Сейчас: `<textarea>` + plain-text DSL (handlebars-подобные `{{поле}}`, `{{#if}}`/`{{#each}}`, попараграфные `{{!style:...}}`) + live-превью; рендер-движок shared с n8n выдаёт `text + styleHints{параграф: [стили]}` → Google Docs API.

Фидбек юзера: textarea неудобна; хочется «применил стиль — сразу видно»; нужны **инлайн-стили** (жирный только `{{plaintiff_name}}` внутри строки).

---

## 1. Word/OOXML как эталон: paragraph vs run, и что перенять

### 1.1 Модель

Word (WordprocessingML) разделяет форматирование на два уровня:

- **Параграф `w:p` + `w:pPr`** — абзацные свойства: выравнивание, отступы, интервалы, page-break-before, keep-together. Это ровно то, что наши `{{!style: right|center|indent|page-break-before|keep-block}}` уже умеют.
- **Run `w:r` + `w:rPr`** — «прогон»: непрерывный кусок текста внутри абзаца с одним набором **символьных** свойств (bold, italic, underline, size, color…). Ключевое: **runs плоские, не вкладываются** (в отличие от HTML) — абзац = плоский список runs, каждый со своим `rPr`.
  Источники: [officeopenxml.com — Paragraph Properties](http://officeopenxml.com/WPparagraphProperties.php), [MS Learn — Working with runs](https://learn.microsoft.com/en-us/office/open-xml/word/working-with-runs), [Apache OpenOffice wiki — WordProcessingML](https://wiki.openoffice.org/wiki/OOXML/WordProcessingML).

Нюансы модели, полезные для понимания:
- Внутри `pPr` есть **второй** `rPr` — он форматирует не текст, а сам «знак абзаца» (¶). Так Word разруливает «стиль абзаца по умолчанию для новых символов» ([c-rex.net — rPr for the Paragraph Mark](https://c-rex.net/samples/ooxml/e1/Part4/OOXML_P4_DOCX_rPr_topic_ID0EIEKM.html)).
- **Sticky-форматирование**: при наборе Word продолжает `rPr` текущего run'а; при выделении и «Bold» run автоматически **расщепляется** на 2–3 run'а. Т.е. run — не то, что пользователь создаёт руками, а то, что редактор поддерживает автоматически. Для нас вывод: пользователь не должен видеть «runs», он видит «выделил → жирный».
- **Style separator** (Ctrl+Alt+Enter) — скрытый знак абзаца, позволяющий держать два *абзацных* стиля «в одной строке» ([How-To Geek](https://www.howtogeek.com/how-to-use-style-separators-in-microsoft-word/)). Это костыль Word ровно потому, что абзацные стили не работают на кусок строки — подтверждение, что смешивать уровни нельзя: инлайн должен быть отдельным механизмом, а не «пол-абзацным `{{!style}}`».

### 1.2 Поля Word как прообраз шаблонного DSL

- **`{ MERGEFIELD name }`** — переменная; **`{ IF expr op expr "да" "нет" }`** — условный текст. Это 30-летний прообраз `{{поле}}` и `{{#if}}` ([wordmvp.com — IF fields](https://wordmvp.com/FAQs/MailMerge/MMergeIfFields.htm), [TechRepublic](https://www.techrepublic.com/article/how-to-use-conditional-fields-in-a-word-mail-merge/)). Важный UX-паттерн: **Alt+F9** переключает «код поля ↔ результат» — то самое «полу-WYSIWYG»: разметка и превью — два вида одного и того же текста, а не два документа.
- **Content controls (SDT)** — типизированные контейнеры-плейсхолдеры (текст/дата/выпадающий список), их нельзя «случайно поредактировать изнутри», можно привязать к XML-данным ([MS Learn — Content controls in Word](https://learn.microsoft.com/en-us/office/client-developer/word/content-controls-in-word), [Windward — Fields vs Content Controls](https://www.windwardstudios.com/blog/fields-vs-content-controls)). Это прообраз **атомарного чипа-переменной** в редакторе: неделимый, типизированный, с человекочитаемой подписью.

### 1.3 Что минимально перенять: styleHints v2 с runs

Переносим ровно одну идею — **run как диапазон символьных стилей внутри абзаца**, поверх существующих абзацных styleHints:

```jsonc
// styleHints v2 (обратно совместим: v1 = запись без "runs")
{
  "3": {
    "styles": ["center", "bold"],            // абзацный уровень (как сейчас)
    "runs": [
      { "start": 9, "end": 24, "styles": ["bold"] },       // символьный уровень
      { "start": 30, "end": 41, "styles": ["underline"] }
    ]
  }
}
```

Критичные решения:
1. **Offsets считаются ПОСЛЕ подстановки переменных** (длина `{{plaintiff_name}}` ≠ длине «Іваненко Іван Іванович»). Значит движок должен нести инлайн-маркеры *сквозь* рендер: практичный способ — на этапе рендера заменять инлайн-теги на sentinel-символы (например, ``/``), после сборки строки абзаца вычислять `start/end` и вырезать sentinels. Это чисто аддитивное изменение движка, старые шаблоны дают идентичный вывод (parity-тесты не трогаются, добавляются новые).
2. **Google Docs API уже готов**: `UpdateTextStyleRequest` принимает `range{startIndex, endIndex}` + `textStyle{bold:…}` — инлайн-runs ложатся 1:1; правило — применять запросы в порядке **убывания индексов**, чтобы вставки не сдвигали последующие диапазоны ([Google — Format text](https://developers.google.com/workspace/docs/api/how-tos/format-text), [Batch requests: атомарность batchUpdate](https://developers.google.com/workspace/docs/api/how-tos/batch)).
3. **Синтаксис DSL** — инлайн-обёртка в духе имеющегося стиля, например: `Позивач: {{!b}}{{plaintiff_name}}{{/!b}}` или `{{#style bold}}...{{/style}}`. Плоско, без вложенности (как runs в OOXML) — комбинированный стиль = один тег с списком: `{{!b,u}}...{{/!}}`. Держать список инлайн-стилей минимальным: bold, italic, underline — юристу больше и не нужно.

---

## 2. Обзор legaltech-конструкторов

| Продукт | Тип редактора шаблона | Условная логика | Инлайн-стили | Что перенять |
|---|---|---|---|---|
| **Gavel (ex-Documate)** | Word add-in поверх настоящего .docx; правка вручную = jinja-теги в тексте | `{%p if %}…{%p endif %}`, `else/elif`; в add-in: выделил абзац → «Show paragraph when…» → выбрал переменную/значение из формы ([help.gavel.io](https://help.gavel.io/articles/conditional-paragraphs)) | бесплатно из docx (runs Word) | UX «выделил текст → задал условие в диалоге», `%p`-маркер «условие на весь абзац» = наша построчная семантика |
| **Clio Draft (ex-Lawyaw)** | Word add-in Template Builder: выделил текст → клик по полю в панели → текст заменяется merge-полем ([help.clio.com](https://help.clio.com/hc/en-150/articles/24381897009563-Clio-Draft-Microsoft-Word-Template-Builder-Add-in)) | условия «добавить/убрать клаузу» | из docx | панель полей рядом с текстом (у нас уже есть — variable palette), вставка «заменой выделенного» |
| **HotDocs** | Word add-in (вкладка Author + Field Editor pane); поля подкрашены: плейсхолдеры синим, инструкции/условия зелёным ([help.hotdocs.com](https://help.hotdocs.com/preview/help/HotDocs_Fields_Overview.htm)) | «conditional regions» вокруг текста, свой скриптовый язык ([Conditional Region](https://help.hotdocs.com/author/current/Creating_a_Conditional_Region.htm)) | из docx | **цветовое кодирование по типу тега** (переменная vs условие); анти-паттерн: свой скриптовый язык → жалобы на крутую кривую обучения ([Lawyerist review](https://lawyerist.com/reviews/document-management-automation/hotdocs/), [Juro — HotDocs alternatives](https://juro.com/learn/hotdocs-alternatives)) |
| **docassemble** | шаблон = настоящий .docx с Jinja2 (docxtpl): `{{ var }}`, `{%p if %}` ([suffolklitlab](https://assemblyline.suffolklitlab.org/docs/authoring/docx/)) | полный Jinja2 (if/for/elif) | из docx (форматирование run'а в Word проходит сквозь docxtpl) | синтаксис `{%p %}` = «съесть абзац целиком» — прямой аналог нашей построчной директивы; анти-паттерн: «developer's tool», юристам без программиста тяжело ([docassembledevelopment.com](https://docassembledevelopment.com/blog/hotdocs-vs-modern-alternatives-migration-guide/)) |
| **Woodpecker** | Word add-in, поля + IF/THEN + формулы, авто-конвертация документа в шаблон ([legal.io](https://www.legal.io/legal-software/164/Woodpecker)) | IF/THEN, dropdown-поля | из docx | «bulk insert / переиспользование полей» между шаблонами |
| **BRYTER** | Word-шаблон `{{Placeholder}}` + Word add-in ([help.bryter.io](https://help.bryter.io/hc/en-us/articles/8003074973085-Create-Templates-for-Automatic-Document-Generation)) | conditional blocks (абзацы) + **inline variants** — условный кусок ВНУТРИ строки ([Inline Conditional Variants](https://help.bryter.io/hc/en-us/articles/21811579902877)) | из docx | явное разделение «условный абзац» vs «инлайн-вариант» — два разных инструмента, не один |
| **Juro** | собственный browser-native структурный редактор контрактов (не Word) | smartfields + conditional logic на уровне секций/клауз ([juro.com](https://juro.com/lp-intelligent-contract-automation)) | да, свой WYSIWYG | доказательство, что «уйти из Word в браузер» продаётся юристам, но это флагманский продукт целой компании — масштаб инвестиций не наш |
| **Doczilla (RU)** | собственный веб-конструктор, no-code: стили, шрифты, форматирование в своём редакторе ([doczilla.pro](https://doczilla.pro/ru/professionalynyy-konstruktor-dokumentov-moduly-platformy-doczilla-pro/)) | формулы и логические условия | да, свой редактор | **автоматические склонения/падежи/суммы прописью** как встроенная фича движка — для украинского языка та же боль (у нас уже hybrid-подход с AI-склонением) |
| **InstaDoc/Instaco, FastDoc (UA)** | веб-конструкторы с готовыми шаблонами, выпадающие списки, маркетплейс шаблонов ([instaco.com.ua](https://instaco.com.ua/en/documents-constructor), [fastdoc.com.ua](https://fastdoc.com.ua/ua/)) | простая (подстановки, выбор контрагента) | ограниченно | конкурентный ориентир UA-рынка; глубина логики у них ниже нашей |

**Главный вывод по индустрии.** Доминирующих паттерна два, и оба «не наши» в чистом виде:
(а) **Word add-in поверх настоящего docx** (Gavel, Clio Draft, HotDocs, Woodpecker, BRYTER) — инлайн-стили достаются бесплатно из runs Word, а весь UI-труд уходит в панель полей/условий. Работает потому, что юристы живут в Word.
(б) **Собственный веб-WYSIWYG** (Juro, Doczilla, InstaDoc) — дорого, это ядро продукта целых компаний.
**Никто не даёт юристу голую textarea с DSL.** Но и полный WYSIWYG с условной логикой никто не решил «красиво»: у всех условные блоки — это либо теги в тексте (Gavel/docassemble — тот же наш DSL), либо диалог «выделил → задал условие», где условие потом живёт как подсветка/тег. Наш side-by-side (разметка + превью) — это по сути Alt+F9 Word'а, паттерн легитимный; проблема не в паттерне, а в том, что левая панель — сырая textarea.

---

## 3. Editor-фреймворки под наш стек (React/Vite)

| Критерий | CodeMirror 6 | ProseMirror/TipTap | Lexical | Slate |
|---|---|---|---|---|
| Модель документа | **плоский текст** + декорации поверх | структурное дерево (schema) | структурное дерево | структурное дерево |
| Round-trip в наш DSL | **тривиален: документ И ЕСТЬ DSL-текст** | нужна двусторонняя (де)сериализация — lossy-риск | то же | то же |
| Чипы-переменные | `MatchDecorator` + `Decoration.replace` widget + atomic ranges — штатный приём ([codemirror.net/examples/decoration](https://codemirror.net/examples/decoration/), [практический пример с dropdown-виджетами](https://medium.com/@rory.hering/safe-inline-editing-of-content-using-react-18-codemirror-6-and-two-custom-plugins-dropdowns-and-89647a700fa8)) | atomic inline node (Mention-паттерн, штатно в TipTap) | DecoratorNode (мутирует документ) | custom inline void node |
| Условные блоки | fold/подсветка строк-декорациями — текст не трогается | block-ноды: конфликт, когда `{{#if}}` охватывает пол-абзаца или не совпадает с границами узлов | то же | то же |
| «Полу-WYSIWYG над разметкой» в проде | **Obsidian Live Preview** ([forum.obsidian.md](https://forum.obsidian.md/t/how-to-configure-codemirror-to-work-like-live-preview/43047), [разбор архитектуры](https://github.com/blueberrycongee/codemirror-live-markdown/blob/main/CODEMIRROR_LIVE_PREVIEW_DESIGN.md)), **Overleaf** — и source, и Visual Editor на CM6 ([overleaf.com/blog](https://www.overleaf.com/blog/were-retiring-our-legacy-source-editor)) | Asana, NYT, ChatGPT-инпут ([liveblocks.io обзор](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)) — но это «настоящий» rich-text, не разметка | Meta-продукты | Discord, Grafana |
| Минусы для нас | это НЕ WYSIWYG: жирный текст можно *показать* жирным, но модель остаётся текстовой | round-trip WYSIWYG↔DSL уже отклонён в прошлом ресёрче проекта («ни один WYSIWYG не выражает условную логику») | **нет чистых декораций** — decorator-ноды мутируют документ ([emergence-engineering](https://emergence-engineering.com/blog/lexical-prosemirror-comparison), [jkrsp.com](https://jkrsp.com/blog/lexical-vs-slate-vs-prosemirror-architecture/)) — плохо для «подсветить, не меняя DSL» | менее зрелый, меньше гарантий |

**Рекомендация: CodeMirror 6.** Решающий аргумент — источник истины. Наш DSL-текст течёт в shared-движок и в n8n; любой структурный редактор ставит между юристом и движком (де)сериализатор, каждый баг которого — это юридически критичный документ с потерянным условием. У CM6 документ = DSL-строка, декорации чисто визуальны и не могут испортить текст. Прецеденты Obsidian и Overleaf показывают, что поверх текстовой модели достижим уровень «выглядит как отрендеренный документ, пока курсор не внутри синтаксиса». Ключевой механизм из разбора Obsidian-подобной архитектуры: `shouldShowSource(range)` — если курсор/выделение пересекает диапазон тега, показать сырой синтаксис, иначе — виджет/скрытие; подводные камни — стабильность высоты строк (скрывать маркеры через `font-size:0.01em`, не `display:none`) и пропуск перестройки декораций во время drag-выделения.

---

## 4. Три сценария эволюции редактора

Общая предпосылка для всех: **инлайн-стили — это изменение DSL + движка (styleHints v2 runs), а не редактора.** Его придётся делать в любом сценарии, и оно аддитивно (см. §1.3): старые шаблоны рендерятся байт-в-байт как раньше → существующие parity-тесты остаются зелёными, новые тесты покрывают runs.

### S1 — полировка textarea (~2–4 дня)
Что: больше высота/fullscreen-режим редактора, моноширинный шрифт, фикс прыжков каретки (контролируемая вставка через `setRangeText` вместо перезаписи value), превью крупнее + fullscreen-overlay + zoom A4, вставка переменной в позицию каретки.
Даёт юристу: меньше раздражения, но «применил стиль — сразу видишь» не появляется; теги остаются сырым текстом.
Риски: нулевые (движок не трогается, кроме styleHints v2).
Вердикт: не решает фидбек, годится только как быстрые заплатки *внутри* S2.

### S2 — CodeMirror 6, «полу-WYSIWYG над DSL» (~1.5–3 недели, инкрементально) ← рекомендуемый
Что, по слоям (каждый слой шиппится отдельно):
1. Замена textarea на CM6 (`@uiw/react-codemirror`), простая грамматика DSL (Lezer или `StreamLanguage`) → подсветка `{{…}}`, `{{#if}}`, `{{!style}}` разными цветами (паттерн HotDocs: переменные — один цвет, логика — другой).
2. `MatchDecorator` → `{{plaintiff_name}}` рисуется **чипом** с человекочитаемой украинской подписью из form_config (atomic: курсор перепрыгивает, Backspace удаляет целиком); `{{!style:…}}` → компактная иконка-виджет (📐 центр, **Ж** жирный…), клик — тумблер стилей. Курсор внутри → разворачивается в сырой тег (паттерн Obsidian live preview).
3. Строки внутри `{{#if}}…{{/if}}` — лёгкая цветная полоса слева + отступ (line-decoration), сворачивание блока (fold). Инлайн-стили `{{!b}}…{{/!b}}` — mark-decoration: текст в редакторе реально показывается жирным.
4. Sync-scroll с превью: у нас маппинг «строка DSL ↔ индекс абзаца превью» почти 1:1 (движок это уже знает) — точная синхронизация по индексам элементов, а не по процентам ([разбор алгоритмов sync-scroll](https://dev.to/woai3c/implementing-synchronous-scrolling-in-a-dual-pane-markdown-editor-5d75), [спека Joplin](https://joplinapp.org/help/dev/spec/sync_scroll/)); курсор в редакторе → подсветка соответствующего абзаца в превью и наоборот.
Даёт юристу: «пишу текст, а не код» — теги спрятаны за чипы/иконки, стили видны прямо в редакторе, превью синхронно; при этом вся мощь DSL (if/each) сохраняется и видна честно.
Риски: низкие. Документ остаётся DSL-строкой → движок, n8n, parity-тесты не затронуты. Худший сбой декораций = некрасиво показало, но сохранился корректный текст. Основная сложность — аккуратность `shouldShowSource`/atomic ranges (изучено на прецедентах, см. §3).

### S3 — полный ProseMirror/TipTap WYSIWYG (~4–8+ недель)
Что: структурный редактор, переменные — mention-ноды, условные блоки — block-ноды с рамками, стили — marks; сериализация дерева обратно в DSL.
Даёт юристу: максимум «как в Word».
Риски: высокие и уже известные проекту — round-trip WYSIWYG↔DSL был отклонён в прошлом ресёрче; условие, охватывающее пол-абзаца/несколько абзацев не по границам узлов, ломает block-модель; каждый баг сериализатора — тихая порча юридического шаблона; двойная поддержка (DSL для n8n + схема редактора). Обоснован только если редактор станет продуктом (Service Builder для внешних юристов) — и тогда правильнее смотреть на паттерн «Word add-in поверх docx», а не на свой WYSIWYG.

---

## 5. Вердикт

1. **Инлайн-стили: перенять из OOXML ровно понятие run** → styleHints v2 `{styles, runs:[{start,end,styles}]}` (эскиз в §1.3), offsets после подстановки переменных через sentinel-токены, вывод в Google Docs через `updateTextStyle` с range (применять по убыванию индексов). Аддитивно, parity-тесты сохраняются.
2. **Редактор: сценарий S2 — CodeMirror 6.** DSL-текст остаётся единственным источником истины (нулевой риск для legally-critical рендера), а юрист получает чипы-переменные, видимые стили и честные условные блоки. Это ровно паттерн Obsidian/Overleaf, проверенный в проде на миллионах пользователей, и он согласуется с ранее принятым решением «side-by-side, не round-trip».
3. S1-фиксы (fullscreen, zoom превью, sync-scroll) делать не отдельным этапом, а первыми инкрементами S2. S3 отложить до момента, когда редактор шаблонов станет внешним продуктом.
