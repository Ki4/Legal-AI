# checklist-validator — Validation

> Scorecard. Фіча вважається завершеною, коли всі пункти ✅.

## G1 — Валідатор

- [x] `evalExpr` додано в `module.exports` render-document.js — без зміни поведінки (972/972 vitest зелені після зміни)
- [x] `evalCondition`/`validateChecklist` — 15 тестів: `"true"` літерал, реальні вирази (`and`/`or`/`not`/`!=`), missing/satisfied/skipped-by-appliesIf
- [x] Інтеграційні тести проти РЕАЛЬНИХ шаблонів (не мок): divorce `children_dispute='separate'` → custody-пункт задоволений через "відкладено" (НЕ через "вирішено") — підтверджено явним `expect(text).not.toContain(...)` + `toContain(...)`
- [x] Негативні тести (обидва сервіси): вирізане речення з реального рендеру → `validateChecklist` коректно репортує `missing`

## G2 — Checklist-конфіги

- [x] `divorce.checklist.json` — 5 пунктів, усі задоволені на базовому кейсі + edge case (немає дітей → пункт пропущено, не missing/satisfied) + edge case (court_fee_exempt='yes')
- [x] `alimony.checklist.json` — 4 пункти, задоволені на обох гілках `alimony_type` (percent/fixed)

## G3 — Схема + n8n-гачок (живий деплой завершено, сесія 31)

- [x] `supabase/migrations/021_checklist_validation.sql` — застосовано живо (Sergey, сесія 30); підтверджено цією сесією прямим запитом до Supabase (`cases.checklist_failed`, `cases.abstained`, `services.required_checklist` існують)
- [x] `scripts/sync-build-document-node.mjs` — footer викликає `validateChecklist`, коли `svc.required_checklist.items` непорожній; `_checklist_result` у return. Задеплоєно живо разом з рештою вузлів сесії 29 одним прогоном `deploy-workflow.mjs form-submit` (37→40 ноди, без конфліктів)
- [x] `scripts/sync-checklist-field.mjs` — ідемпотентний патчер; перевірено: `--check` (fail) → apply → `--check`/повторний запуск (no-op)
- [x] `scripts/upload-document-checklist.mjs` — запущено живо для divorce + alimony. Виявлено і виправлено баг: Postgres `jsonb` переупорядковує ключі об'єкта при зберіганні → наївне `JSON.stringify` порівняння хибно репортувало "differs after upload" навіть коли дані ідентичні. Виправлено канонізацією (рекурсивне сортування ключів) перед порівнянням
- [x] Виявлено і виправлено побіжний баг у вузлі **Update Case Abstention** (сесія 29/PR#45, ніколи не деплоївся живо до цієї сесії): використовував застарілий формат параметра Supabase-ноди (`id: <expr>` напряму) — поточна версія ноди мовчки відкидає це поле, лишаючи `filters: {}` порожнім → `"At least one select condition must be defined"` на кожному кейсі. Виправлено на `filters.conditions` (за зразком вже робочого вузла "Get Profile"); виправлено і в `scripts/sync-abstention-node.mjs`, щоб регенерація не повторила баг
- [x] Smoke test: сценарій 2 (`has_children=true`, divorce) через живий webhook → execution #50, `status=success`, `_checklist_result.ok===true`, `cases.checklist_failed=false`, `cases.abstained=null` записані без помилок

## G4 — Admin-бейдж + доки

- [x] `DashboardPage.tsx` — бейдж «Документи з неповним чеклістом» (дзеркало abstention-бейджа); tsc clean, client vitest 92/92
- [x] `docs/architecture/DECISIONS.md` — розділ «Checklist validator» (детермінований regex-чек, переюзана мова умов, mustMatchAny, footer-гачок, не блокує доставку)
- [x] `specs/roadmap.md` + changelog — записано
- [x] Issue #4 — закрито через PR#48 merge (`Closes #4`), сесія 30

## Definition of Done

Build Document footer перевіряє наявність обов'язкових юридичних пунктів детерміновано (без LLM) для будь-якого сервісу з непорожнім `required_checklist`; провал флагується в `cases.checklist_failed` і видний у Dashboard без участі Ольги. **Живий деплой завершено (сесія 31):** migration 021 застосована, workflow задеплоєно (включно з відкладеними з сесії 29 нодами хібрид-харднінгу), чеклісти divorce+alimony завантажені, smoke test зелений (execution #50). Усі пункти G1–G4 виконано.
