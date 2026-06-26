# Вёрстка судебных документов: типографика + тулчейн (Word/PDF)

**Дата:** 2026-06-24
**Автор:** research по запросу Сергея (стилистика генерации документов: отступы, переносы, разрывы страниц).
**Вход:** deep-research (веб-первоисточники: OOXML-спека, MDN/CSS, docx.js, Gotenberg, Pyphen/WeasyPrint, ДСТУ 4163:2020), фактчек ключевых утверждений о возможностях движков. Сверка с текущим стеком: `n8n/templates/render-document.js`, `n8n/templates/apply-typography.js`, `n8n/templates/services/*.document.txt`.
**Цель:** разложить «красивую вёрстку» на воспроизводимые механизмы, дать рецепт против «осиротевшего блока подписи», выбрать тулчейн под требование *server-side PDF (приватность) + редактируемый DOCX из одного источника, запускаемо из n8n*.

> 🔗 Связанные решения: `docs/architecture/DECISIONS.md` §«Google Docs vs PDF генерація vs DOCX» и §«Doc-engine … Розриви сторінок: правила, не позиції». Этот документ — **внешняя сверка** того решения с мировой практикой и детализация фазы-2 типографики.

---

## 1. Reference-модель: вёрстка = 4+1 ортогональных механизма

«Красивая вёрстка» — это не один «стиль», а **четыре независимых свойства абзаца + один слой текста**. Их постоянно путают (особенно `keepLines` vs `keepNext`), и из этой путаницы растёт баг с подписью (§3). Таблица соответствия трёх миров — это «розеттский камень», который делает наш DSL портируемым между Google Docs (сегодня) и DOCX/PDF (завтра):

| Механизм | Что делает | OOXML / Word | Google Docs API | CSS Paged Media | Наш DSL |
|---|---|---|---|---|---|
| **Widows / Orphans** | не оставлять 1 строку абзаца одну вверху/внизу страницы | `w:widowControl` | ❌ **нет** | `orphans:n` / `widows:n` | (зарезервировать `widow-control`, export-only) |
| **Keep-with-next** | держать абзац на одной странице со **следующим** (межабзацный клей) | `w:keepNext` | `keepWithNext` | `break-after: avoid` | `keep-with-next` ✅ |
| **Keep-lines-together** | не рвать строки **одного** абзаца (внутриабзацный клей) | `w:keepLines` | `keepLinesTogether` | `break-inside: avoid` | `keep-together` ✅ |
| **Page-break-before** | начать абзац с новой страницы | `w:pageBreakBefore` | `pageBreakBefore` | `break-before: page` | `page-break-before` ✅ |
| **Hyphenation + NBSP** | переносы слов + неразрывные пробелы | `w:lang`+`autoHyphenation` / U+00AD / U+00A0 | только U+00A0 в тексте | `hyphens:auto`+`lang` / `&nbsp;` | (нет — добавить, §4) |

**Тонкости, на которых спотыкаются все:**

- **`keepLines` ≠ `keepNext`.** Первый держит строки *внутри одного* абзаца, второй склеивает *соседние* абзацы. Блок подписи — это несколько абзацев → нужен `keepNext`, а не `keepLines`. Это корень бага §3.
- **`pageBreakBefore` перебивает `keepNext`** предыдущего абзаца (OOXML §17.3.1.23 — «разрыв побеждает клей»). Если в шаблоне они окажутся в одной цепочке — она молча разорвётся. Аудит: `page-break-before` не должен стоять в keepNext-цепочке.
- **Дефолт `widows`/`orphans` = 2 — это значение *спеки*, не каждого движка.** PrinceXML по умолчанию ставит `widows:1`. Не зашивать «2» как универсальную константу.

---

## 2. Две эталонные школы вёрстки (выбор делается здесь)

```
        ┌──────────────────────────────┐        ┌──────────────────────────────┐
        │   ШКОЛА A: OOXML / Word       │        │  ШКОЛА B: CSS Paged Media     │
        │   (.docx как источник)        │        │  (HTML+CSS → PDF)             │
        ├──────────────────────────────┤        ├──────────────────────────────┤
клей:   │ keepNext / keepLines          │        │ break-*: avoid / контейнер    │
вдовы:  │ widowControl ✅               │        │ orphans/widows ✅ (Prince/Weasy)│
перенос:│ w:lang=uk + autoHyphenation   │        │ hyphens:auto + lang="uk"      │
правит  │ ДА (юрист открывает .docx)    │        │ НЕТ (PDF read-only)           │
юрист?  │                               │        │                               │
        └──────────────────────────────┘        └──────────────────────────────┘
                     ▲                                        ▲
   Текущий Google Docs ≈ урезанная Школа A          WeasyPrint/Typst/LaTeX/Prince
   (есть keep*, НЕТ widowControl/шрифт/поля/перенос)  (отличный PDF, но PDF-only)
```

Текущий путь (`apply-typography.js` → Google Docs `batchUpdate`) — это **правильно спроектированная, но урезанная Школа A**. Абстракция здравая: директивы маппятся 1:1 (`keep-with-next → keepWithNext`, `keep-together → keepLinesTogether`, `page-break-before → pageBreakBefore`, `indent → indentFirstLine`). Но Google Docs физически не даёт: `widowControl`, шрифт по умолчанию, поля страницы, межстрочный интервал, авто-перенос. Для ДСТУ-документа (§6) это и есть потолок.

---

## 3. Проблема «осиротевшего блока подписи» — конкретное решение

**Баг (найден ресёрчем).** В `divorce.document.txt` стоит `{{!style: keep-together}}` на строке «дата + підпис». Это `keepLinesTogether` → защищает только перенос *внутри этой одной строки*. Она **не** приклеивает блок к списку «Додатки:» и не держит закрывающий блок целиком как единицу. Подпись может уехать на следующую страницу одна.

**Правильный рецепт — цепочка `keep-with-next`:**

```
Додатки:                          ← keepNext   ┐
  1. Копія свідоцтва про шлюб      ← keepNext   │  весь блок склеен и
  2. Квитанція про сплату збору    ← keepNext   │  НЕ оторвётся от
                                    ← keepNext   │  последней строки
«__» ________ 2026 р.   __________  ← keepNext   │
                        (підпис)    ← (последний абзац — БЕЗ keepNext) ┘
```

- **Школа A / Google Docs (сегодня):** проставить `{{!style: keep-with-next}}` на «Додатки:», на **каждый** пункт приложений и на строку даты; на последней строке (подпись) — ничего. Плюс `keep-together` на любой пункт, который может перенестись на >1 строку.
- **Школа B (HTML→PDF):** надёжнее обернуть весь блок в `<div style="break-inside:avoid">` (паттерн «контейнер» — честно соблюдают Chromium, WeasyPrint, Prince), чем городить `break-after:avoid` на лиде (Chromium его исторически плохо тянет; Paged.js поставляет плагин-костыль «temporary fix for break-after avoid»; нативно фича дошла лишь до Chrome 108, stable 29.11.2022). Если блок в рамке — `box-decoration-break: clone`.
- **Жёсткий универсальный предел:** если склеиваемый блок **выше страницы** — любой движок его разорвёт. Не «мазать» keepNext по большим прогонам основного текста, иначе движок вытолкнет всю цепочку на новую страницу, оставив предыдущую полупустой. Единица склейки заведомо короче страницы.

**Перспектива — новая DSL-директива `keep-block` (keep-with-following).** `render-document.js` уже трекает `styleEvents/paraIdx`, поэтому может пометить диапазон `start..end`, а `apply-typography.js` проставит `keepWithNext` на всех абзацах диапазона, кроме последнего. Это «выразить намерение один раз» вместо ручной расстановки — главная ценность против осиротевшей подписи.

---

## 4. Украинский слой: NBSP + переносы — это два **разных** механизма

| Слой | Что | Детерминированность | Где работает |
|---|---|---|---|
| **NBSP (U+00A0)** | приклеить однобукв. предлоги/союзы (`у в з і й а о та що`) к след. слову; не рвать `ст. 110`, `ч. 1 ст. 115`, `№ 5`, `10 000 грн`, `5 %`, `І. П. Петренко` | **полностью детерминирован**, корректен **везде** включая Google Docs | любой формат |
| **Auto-hyphenation** | словарный перенос длинных слов | гейтится **языковым тегом** | зависит от движка |

⚠️ **Поправка фактчека.** Тезис «без `lang`-тега переносов просто нет» верен **только для Firefox/Gecko** (он вообще не поддерживает orphans/widows — открытый баг ~23 года). **Chromium/WebKit перенесут даже без тега, но по дефолтному (часто английскому) словарю** → получишь *неправильные* переносы, а не их отсутствие. Поэтому тег `lang="uk"` / `w:lang="uk-UA"` обязателен для **корректного** переноса.

**Практический вывод.** Самый высокий ROI и нулевой риск — **NBSP-пост-процесс в `render-document.js`** (чистая JS-функция). Запускать **после** раскрытия `{{field}}`/`{{#each}}`, но **до** `apply-typography.js`/Docs API. Работает на текущем Google-Docs-пути уже сегодня. Гард: никогда не переписывать внутри URL, email, кодов и слотов LLM-склонённых имён. Набор однобуквенных слов — в конфиг (вписывается в «дерево на сервис со своими метаданными»). Тесты — golden-file по образцу `citations.json`: проверить U+00A0 в `ст. 110`, `ч. 1 ст. 115 КК України`, `10 000 грн`, хвостовое `в`/`і`, и что URL/коды нетронуты.

---

## 5. Тулчейн: что поддерживает что (ранжировано под наше требование)

Требование: **server-side PDF (приватность, через Telegram `sendDocument`) + редактируемый DOCX из одного источника, из n8n.**

| Тулчейн | Editable DOCX | Чистый PDF | UA-переносы | widows/keep | Из n8n | Вердикт |
|---|---|---|---|---|---|---|
| **`docx` (dolanmiu) + Gotenberg** | ✅ | ✅ (LibreOffice) | ✅ (нужен `hyphen-uk` в образе) | ✅ всё, вкл. widowControl | ✅ JS + HTTP | **🟢 стратег. цель** |
| Google Docs (текущий) | ⚠️ экспортом | ⚠️ экспортом | ⚠️ только NBSP | ⚠️ нет widowControl/полей | ✅ | 🟡 закрыть PII сейчас |
| WeasyPrint / Typst / LaTeX / Prince | ❌ PDF-only | ✅✅ | ✅ (Weasy → Pyphen `hyph_uk_UA`) | ✅ | ⚠️ контейнер/CLI | 🟠 только если PDF-only ОК |
| Headless Chromium / Puppeteer / Paged.js | ❌ | ✅ | ❌ **на Linux-сервере нет словарей** | частично | ✅ | 🔴 дисквалифицирован |
| docxtemplater / Carbone | ✅ | через конверт | ✅ | ⚠️ статикой в шаблоне | ✅ | 🔴 воюет с динамическим DSL |

**Почему `docx` + Gotenberg (стратегическая цель):**
- Единственный путь, дающий из **одного** источника *и* редактируемый DOCX *и* приватный PDF.
- `docx` JS маппится 1:1 на текущие директивы + добавляет то, чего нет в Google Docs: `widowControl`, посекционные `page.margin{top,right,bottom,left}`, размер страницы, дефолтный шрифт/кегль (`styles.default.document`), точный `spacing:{line,lineRule}`, документ-уровневый `hyphenation:{autoHyphenation,hyphenationZone,consecutiveHyphenLimit,doNotHyphenateCaps}`. Чистый JS в n8n Code-ноде, без нативных зависимостей. **Естественный преемник `apply-typography.js`**: меняем билдер `batchUpdate`-запросов на билдер `docx`-Paragraph, кормя теми же `styleHints`.
- ⚠️ сноска: в `docx` `indent.firstLine` — в **twips** (1440/дюйм), не pt. 720 twips = 0.5″ — текущее число случайно совпало, но единица другая; проверить при переносе.
- `docx` сам PDF не делает → DOCX→PDF делает **Gotenberg**, вызываемый из n8n HTTP-нодой (`POST /forms/libreoffice/convert`). Брать **LibreOffice-only образ** (≈на 38% меньше, без Chromium). **Дефолтный образ — английская локаль; для украинского переноса нужен кастомный образ с `libreoffice-l10n-uk` И отдельно пакетом `hyphen-uk`** (паттерны переноса не входят в языковой пакет). Ops: 512MB–1GB RAM; конверсии LibreOffice сериализуются (лок); известна утечка памяти при долгом аптайме → health-check/restart. Перед судом — **визуально продиффить** реальные выводы (headless LibreOffice бывает расходится с Word на краях).

**Чего НЕ делать:**
- **Headless Chromium / Puppeteer / Paged.js — дисквалифицировано.** Chromium на Linux/серверах не имеет системных словарей переноса; Paged.js прямо пишет «Hyphenation is managed in Chrome only on Apple OSX». Выровненный по ширине украинский текст **не будет переноситься** → «реки» межсловных пробелов.
- **WeasyPrint / Typst / LaTeX / Prince — отличная PDF-типографика и честный украинский перенос, но все PDF-only** → редактируемый DOCX из того же источника не получить (нужен второй, расходящийся генератор = два источника правды). Prince вдобавок коммерческий (~$3 800/сервер). Брать WeasyPrint только если когда-нибудь решим, что PDF-only допустим.
- **docxtemplater / Carbone** — заполняют нарисованный юристом .docx-шаблон, но наши стиль-директивы **вычисляются** `render-document.js` поабзацно в рантайме, а не запекаются статически; выражать динамический keepNext/keepTogether внутри Word-шаблона неудобно и воюет с DSL. Плюс лицензионные ловушки (Carbone CCL может зацепить будущий self-serve service-builder как hosted-DaaS).

**PII-течь (#57) можно закрыть уже сегодня, без нового стека.** Публичный `anyone/reader` был *выбором воркфлоу*, а не требованием API. Сервис-аккаунт-владелец вызывает Drive `files.export` (`application/pdf` + `…wordprocessingml.document`), шлёт оба файла через `sendDocument`, удаляет временный Doc. Экспорту нужен лишь read-доступ авторизованного вызывающего (scope `drive.file`/`drive.readonly`), не публичный пермишн. Оговорка: PII всё ещё транзитит через серверы Google — если «приватность» = «не у Google вообще», нужен `docx`/Gotenberg.

---

## 6. ДСТУ 4163:2020 — ориентиры (что мандатно vs конвенция)

ДСТУ 4163:2020 «Уніфікована система організаційно-розпорядчої документації. Вимоги до оформлення документів» (действует с 01.09.2021; правила діловодства обновлены 27.04). Для **позовної заяви** содержание реквизитов диктует **ст. 175 ЦПК** (а ст. 185 — про недоліки/залишення без руху), оформление — ДСТУ + локальные інструкції з діловодства судов.

Типовые/конвенциональные параметры (проверять против актуальной редакции и требований конкретного суда — часть является рекомендацией, а не жёсткой нормой для приватного позивача):
- Шрифт: **Times New Roman, кегль 12–14** (часто 14 для позовів).
- Межстрочный интервал: **1–1.5**.
- Поля: **ліве ≈ 30 мм, праве ≈ 10–15 мм, верхнє/нижнє ≈ 20 мм** (ліве большое — под подшивку дела).
- Выравнивание основного текста — по ширине; первая строка абзаца с отступом ~1.25 см.
- «Шапка» (суд, сторони) — у верхнього правого кута; назва документа — по центру; дата/підпис — закрывающий блок.

⚠️ Важно: **обязательность ДСТУ для приватных лиц ограничена** — это стандарт оформления орг-распорядительной документации (госорганы/делопроизводство). Для позова критичнее соответствие **ст. 175 ЦПК** по содержанию; типографика ДСТУ — это «выглядит профессионально и привычно судье», а не основание для залишення без руху. Не подавать клиенту как «закон требует именно так».

**Что это значит для стека:** точный контроль шрифта/полей/интервала под ДСТУ **недостижим на Google-Docs-пути** и достижим на `docx`+Gotenberg. Это и есть главный триггер миграции (§5): пока «прилично выглядит» хватает — Google Docs ок; как только нужен ДСТУ-точный вид — `docx`.

---

## 7. Что внедрять дальше (от меньшего к большему)

1. **NBSP-пост-процесс в `render-document.js`** (наивысший ROI, движок-независимо, корректно везде вкл. Google Docs). См. §4. Golden-тесты в `n8n/templates/__tests__/`.
2. **Drive `files.export` вместо публичного шэра** (§5) — закрыть PII-течь #57, отправлять PDF+DOCX через `sendDocument`, удалять временный Doc.
3. **Починить блок «Додатки:» цепочкой `keep-with-next`** на текущем Google-Docs-пути (§3) — вручную в шаблонах, сразу.
4. **Зафиксировать DSL→primitive маппинг** в `render-document.js` как документацию портируемости (таблица §1) + добавить `widow-control` (export-only). Один шаблон тогда кормит и Google Docs сегодня, и DOCX/PDF завтра.
5. **DSL-директива `keep-block`** (§3) — компилировать в keepNext-цепочку по диапазону абзацев.
6. **`docx` + Gotenberg-конвейер** (§5) как стратегическая цель — когда нужен контроль шрифта/полей/интервала под ДСТУ или снятие зависимости от Google. Тегировать каждый run `w:lang="uk-UA"` + `autoHyphenation:true`, **и сохранять** NBSP-пасс (перенос на стороне читателя в Word не гарантирован — требует украинского proofing-пакета на его машине).

---

## 8. Где мы уже best-practice / где gap

| | Уже best-practice | Реальный gap |
|---|---|---|
| Абстракция | DSL-директивы, keep*-семантика 1:1, golden-тесты, «правила, не позиции» | — |
| Разрывы | keep-with-next/together/page-break заложены | **осиротевшая подпись** (keepNext-цепочка, §3) |
| Украинский | — | **NBSP/переносы** не обрабатываются (§4) |
| Контроль вида | — | шрифт/поля/интервал/widowControl → только `docx`+Gotenberg (§5–6) |
| Приватность | — | **PII-течь публичного шэра** (#57) — чинится Drive export сегодня |

**Вывод:** абстракция вёрстки спроектирована правильно; рычаги — узкие детерминированные слои (NBSP-пасс + keepNext-цепочка), затем стратегический переход на `docx`/Gotenberg ради ДСТУ-контроля и приватности. Переплатформировать срочно не нужно.

---

## Источники

**OOXML / Word / keep-*:**
- OOXML §17.3.1.23 `pageBreakBefore` — https://ooxml.info/docs/17/17.3/17.3.1/17.3.1.23/
- officeopenxml.com — Paragraph Properties — http://officeopenxml.com/WPparagraphProperties.php
- MS Learn — `PageBreakBefore` — https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.pagebreakbefore
- Practical Typography — keep with next — https://practicaltypography.com/keep-with-next-paragraph.html
- Colin Levy — Paragraph Glue (legal) — https://www.colinslevy.com/post/paragraph-glue-a-microsoft-word-feature-every-legal-user-should-master
- python-docx paragraph-format — https://python-docx.readthedocs.io/en/latest/dev/analysis/features/text/paragraph-format.html
- docx.js (dolanmiu) — https://docx.js.org/ , properties.ts — https://raw.githubusercontent.com/dolanmiu/docx/master/src/file/paragraph/properties.ts

**Hyphenation / NBSP / CSS:**
- MDN `hyphens` — https://developer.mozilla.org/en-US/docs/Web/CSS/hyphens
- Hyphenation depends on document language — https://www.stefanjudis.com/today-i-learned/automatic-hyphenation-depends-on-the-defined-document-language/
- caniuse — hyphens UK — https://caniuse.com/mdn-css_properties_hyphens_language_ukrainian
- Typography for Lawyers — nonbreaking spaces — https://typographyforlawyers.com/nonbreaking-spaces.html
- Pyphen (dictionaries, hyph_uk_UA) — https://pyphen.org/ , https://github.com/Kozea/Pyphen
- WeasyPrint features — https://doc.courtbouillon.org/weasyprint/v52.5/features.html
- Paged.js W3C printing — https://pagedjs.org/en/documentation/3-w3c-specifications-for-printing/

**Тулчейн:**
- docx usage/paragraph — https://github.com/dolanmiu/docx/blob/master/docs/usage/paragraph.md
- Google Drive `files.export` — https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export
- Export Google Docs as PDF (no Docs API) — https://dev.to/googleworkspace/export-google-docs-as-pdf-without-the-docs-api-9o4
- PrinceXML hyphenation — https://www.princexml.com/doc/11/hyphenation/
- Typst hypher — https://github.com/typst/hypher

**ДСТУ 4163:2020 / ЦПК:**
- ДСТУ 4163:2020 — чи обов'язковий — https://radnuk.com.ua/uchast-u-zakupivliakh/hid-dlia-novachkiv/dstu-4163-2020-chy-obov-iazkovyj-dlia-zamovnykiv-i-uchasnykiv/
- Огляд нововведень ДСТУ 4163:2020 — https://buhgalter.com.ua/articles/pervisna-dokumentatsiya/noviy-dstu-41632020-shchodo-oformlennya-dokumentiv-oglyad-novovveden/
- Ст. 175 ЦПК (зміст позовної заяви) — https://protocol.ua/ua/tsivilniy_protsesualniy_kodeks_ukraini_stattya_175/
- Вимоги до позовної заяви (6ААС) — https://6aas.gov.ua/ua/about/vazhlivi-dokumenti/2-uncategorised/2084-requirements-claim.html
