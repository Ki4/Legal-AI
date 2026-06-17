# checklist-validator — Plan

> Підхід, групи задач, послідовність. Контракт — `requirements.md`, перевірка — `validation.md`.

## Підхід

Замінити оригінальну постановку issue #4 (LLM регенерує при провалі) на детерміновану перевірку, що відповідає поточній архітектурі doc-engine: regex-присутність очікуваних формулювань у фінальному рендері, за умовою застосовності в синтаксисі, який уже існує в `render-document.js` (`parseExpr`/`evalExpr`). Дзеркало вже доведеного патерну — golden-конфіг у git (як `<slug>.citations.json`) + чиста функція-валідатор (як `groundedness.js`) + гачок у вже існуючому footer (як `_review_card`/`_abstained`, без нової ноди).

Офлайн спершу (vitest на реальних шаблонах), потім схема (міграція не вмикає нічого — default `'[]'::jsonb`), потім n8n-гачок у репо (без живого деплою — n8n локально не запущений у цій сесії), потім admin-бейдж. Живий деплой + `supabase db push` — наступна сесія, коли інфра підʼєднана (так само як migration 020 зараз).

## Групи задач

### G1 — Валідатор (офлайн, vitest)
- `render-document.js` — додати `evalExpr` в `module.exports` (1 рядок).
- `n8n/templates/validate-checklist.js` — `evalCondition`, `validateChecklist`.
- `n8n/templates/__tests__/validate-checklist.test.js` — юніт (evalCondition на `"true"` і реальних виразах; validateChecklist: missing/satisfied/skipped-by-appliesIf) + інтеграційні проти реальних шаблонів (divorce з `children_dispute='separate'` → custody-пункт задоволений через "відкладено", не через "вирішено"; обидві гілки `alimony_type` задовольняють пункт суми) + негативний тест (вирізаний речення → `missing`).

### G2 — Checklist-конфіги
- `n8n/templates/services/divorce.checklist.json` — 5 пунктів (підстава розірвання, підсудність, діти-або-відкладено, судовий збір, підпис).
- `n8n/templates/services/alimony.checklist.json` — 4 пункти (ст.180, сума аліментів, звільнення від збору, підпис).
- Розширення G1-тестів: усі пункти обох конфігів `satisfied` на представницьких комбінаціях відповідей (включно з тими, що вже є у parity-тестах — не вигадувати нові fixtures, де можна взяти існуючі).

### G3 — Схема + n8n-гачок (репо, без живого деплою)
- `supabase/migrations/021_checklist_validation.sql` — `services.required_checklist` + `cases.checklist_failed`.
- `scripts/sync-build-document-node.mjs` — footer: викликати `validateChecklist`, коли `svc.required_checklist` непорожній; `_checklist_result` у return.
- `scripts/sync-checklist-field.mjs` — ідемпотентний патчер: додає `checklist_failed` у `fieldsUi.fieldValues` існуючої ноди `Update Case Abstention`.
- `scripts/upload-document-checklist.mjs <slug>` — дзеркало `upload-document-template.mjs`.
- Прогнати `--check`/`--dry-run` на всіх трьох скриптах проти `n8n/workflows/current/form-submit.json` — підтвердити, що зміни валідні, без живого n8n.

### G4 — Admin-бейдж + доки + закриття
- `DashboardPage.tsx` — другий бейдж «Документи з неповним чеклістом» (дзеркало abstention-бейджа, session 29).
- `docs/architecture/DECISIONS.md` — чому детермінований regex-чек, не LLM-регенерація; чому мова умов переюзана з render-document.js.
- `specs/roadmap.md` + `apps/client/.claude/changelog.md` — запис фічі.
- Issue #4 — коментар про зміну архітектури relative до оригінальної постановки, `Closes #4` при merge.

## Послідовність і чекпоінти

```
G1 ──► G2 ──► G3 ──► G4
offline (vitest)   │ репо-only
                    └─ migration не вмикає нічого (default '[]'); footer-гачок
                       спрацьовує лише коли required_checklist непорожній —
                       сьогоднішній прод (required_checklist='[]') не зміниться,
                       поки хто-не-будь не залить конфіг + не задеплоїть workflow
```

Якщо G1 покаже, що `mustMatchAny` недостатньо виразний для якогось реального пункту (напр. потрібен порядок/відстань між фразами) — зупинитись і розширити контракт у requirements.md свідомо, не патчем у тестах.
