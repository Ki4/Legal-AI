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

## G3 — Схема + n8n-гачок (репо, без живого деплою)

- [x] `supabase/migrations/021_checklist_validation.sql` — написано (НЕ застосовано: Supabase CLI не залінкований локально в цій сесії, n8n не запущений)
- [x] `scripts/sync-build-document-node.mjs` — footer викликає `validateChecklist`, коли `svc.required_checklist.items` непорожній; `_checklist_result` у return. Запущено: 71273→74819 chars, `--check` підтверджує sync
- [x] `scripts/sync-checklist-field.mjs` — ідемпотентний патчер; перевірено: `--check` (fail) → apply → `--check`/повторний запуск (no-op)
- [x] `scripts/upload-document-checklist.mjs` — написано за зразком `upload-document-template.mjs` (НЕ запущено живо — немає підключення до Supabase в цій сесії)

## G4 — Admin-бейдж + доки

- [x] `DashboardPage.tsx` — бейдж «Документи з неповним чеклістом» (дзеркало abstention-бейджа); tsc clean, client vitest 92/92
- [x] `docs/architecture/DECISIONS.md` — розділ «Checklist validator» (детермінований regex-чек, переюзана мова умов, mustMatchAny, footer-гачок, не блокує доставку)
- [x] `specs/roadmap.md` + changelog — записано
- [ ] Issue #4 — коментар про зміну архітектури + `Closes #4` при merge

## Definition of Done

Build Document footer перевіряє наявність обов'язкових юридичних пунктів детерміновано (без LLM) для будь-якого сервісу з непорожнім `required_checklist`; провал флагується в `cases.checklist_failed` і видний у Dashboard без участі Ольги. **Живий деплой (migration apply + workflow deploy) відкладено на наступну сесію** — інфра (n8n/Supabase CLI) не була підключена в цій сесії; код+тести+конфіги в репо готові до застосування тим самим способом, що migration 020 зараз.
