# document-layout-preview — Plan

> Як будуємо (групи G1…G5). Tier 2. Виконувати у **свіжому чаті** за requirements.md. Рекомендована
> модель: Opus (юр-дотично + новий UI-рушій). Старт — `/clear`, читати requirements першим.

## Архітектурний ескіз

```
sampleAnswers.ts ─┐
services row ─────┤→ renderDocumentWithStyles (вже, браузер) → { text, styleHints }
                  │                                                    │
   blockRegistry.ts (SSoT: блоки + зв'язки + help_text + color)        │
                  │                                                    ▼
                  └──────────────→ paginate(text, styleHints, blocks, pageMetrics)
                                       │  детермінований: вимірювання + honor keep-block/page-break
                                       ▼
                   <DocumentLayoutPreview/>  (A4-сторінки + підсвічування + overflow-warning + caveat)
                                       │
                                       └── <LayoutGuide/> (collapsible, з реєстру)
                          вмонтовано в service-mirror (нова секція/вкладка «Розкладка»)
```

## G1 — Реєстр блоків+зв'язків (SSoT, код-модуль)
- `apps/client/src/admin/lib/blockRegistry.ts`: канонічні блоки (§1.1) + зв'язки (§1.2) як дані
  `{ id, label, primitives, help_text, color }`. Pure, без залежностей.
- Хелпер `relationOf(styleKeywords) → relationId | null` (мапінг keep-with-next/page-break-before →
  зв'язок). Експорт типів.
- **Тести:** реєстр повний (усі канонічні блоки мають label+help_text+color), мапінг примітивів,
  0 «мертвих» атрибутів (нема widow/orphan у v1-словнику).

## G2 — Розпізнавання блоків (детерміновано)
- `apps/client/src/admin/lib/detectBlocks.ts`: `detectBlocks(text, styleHints) → Block[]`
  (`{ id, label, startPara, endPara, relation }`). Якорі — заголовки/«ПРОШУ»/«Додатки:» +
  keep-with-next-діапазони зі `styleHints` (як §4). Реюз патернів `preview-excerpt.js`/`citations`.
- **Fail-closed:** нерозпізнаний сегмент → блок `unknown` без падіння.
- **Тести:** на реальних divorce/alimony (реюз goldens/sampleAnswers) — канонічні блоки знайдено,
  appendices→signature = один keep-together-юніт; дрейф-guard.

## G3 — Рушій пагінації (детермінований, тестований ПЕРШИМ)
- `apps/client/src/admin/lib/paginate.ts`: `paginate(blocks, lineHeights, pageMetrics) → Page[]`
  (`{ pageNo, segments[] }` + `overflow: blockId[]`). Honor: keep-together (не різати блок →
  переносити цілим), page-break-before. Висоти абзаців — інжектовані (вимірюються в компоненті, у
  тесті — моки), щоб рушій лишався чистим і тестованим.
- **Тести (детерміновані, мок-висоти):** keep-together блок не розривається; блок-вищий-за-сторінку →
  у `overflow`; page-break-before форсує нову сторінку; багатосторінковий розклад коректний.

## G4 — Компонент `<DocumentLayoutPreview/>` + `<LayoutGuide/>`
- `apps/client/src/admin/components/DocumentLayoutPreview.tsx`: рендер у A4-контейнері (TNR ~14,
  поля ДСТУ-конфіг), вимірювання висот (ref/getBoundingClientRect) → `paginate` → межі сторінок +
  підсвічування блоків (кольори з реєстру) + overflow-попередження + **caveat «наближено»**.
- `<LayoutGuide/>` — collapsible-легенда з реєстру (color→label→help_text). Дефолт згорнуто.
- Реюз теми Legal Light + наявних `Tooltip`/collapsible. Ізольований компонент (реюз у майбутньому
  редакторі).
- **Тести (RTL):** рендериться для divorce+alimony; легенда розкривається; caveat присутній;
  overflow-попередження показується на форсованому довгому блоці.

## G5 — Вмонтування в service-mirror + докі
- Нова секція/вкладка «Розкладка» у service-mirror; вантажить послугу (вже є) + sampleAnswers.
- IMPROVEMENTS: занотувати fidelity-наступний-крок (точний PDF-preview через Gotenberg) + редагування
  розкладки (інтерактив) як майбутні ітерації. Оновити roadmap v3.2.
- DECISIONS: запис «розкладка = детермінований рушій прев'ю поверх styleHints; advisory-fidelity;
  модель блоки+зв'язки у код-реєстрі».

## Порядок і ризик
- Будувати **знизу вгору**: G1→G2→G3 (чиста логіка + тести) ПЕРЕД G4 (UI). Рушій пагінації (G3) —
  найризикованіший за коректністю → тестувати першим на мок-висотах.
- Усе адитивне, read-only → rollback = не вмонтовувати секцію. Feature-flag не потрібен.
- Реюз існуючого (рушій, sampleAnswers, Tooltip, патерни розпізнавання) — мінімум нового коду.
