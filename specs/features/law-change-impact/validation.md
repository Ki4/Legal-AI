# law-change-impact — Validation

> **SDD-Tier 2** scorecard. Порядок: спершу детермінований шар (L1) доводиться без жодного LLM;
> дайджест вмикається лише коли критики+abstention зелені; картка лише показує — рішення за Олею.
> Контракт — `requirements.md`.

## G1 — Схема + детермінований diff (Node, vitest)
- [ ] Migration 027 застосовується чисто; `law_change_log` має `article_diffs`, `ai_summary`,
      `ai_impact`, `ai_confidence`, `ai_status` (DEFAULT `'pending'`, CHECK), `ai_model`,
      `ai_generated_at`. Наявні рядки не зламані; `notes` недоторканий.
- [ ] `extractArticles(html)` — на фікстурах сторінок rada повертає мапу «Стаття N → текст»;
      деградує до law-level (порожній split) без винятку на нестандартній розмітці.
- [ ] `diffLaw(old, new)` — golden-пари: (а) одна змінена стаття → один hunk `changed`;
      (б) додана стаття → hunk `added`; (в) ідентичні тексти → `hunks: []`; (г) великий diff →
      `truncated: true` із збереженим `source_url`.
- [ ] `applyLawChange` (мок Supabase) пише `article_diffs` у новий рядок із `ai_status='pending'`
      **до** `is_stale=true`; стара редакція знята з `law_documents.full_text`, поки не stale.
- [ ] **Деградація:** rada недоступна на L1 → diff порожній/частковий, рядок усе одно
      створюється (флип у `needs_review` як сьогодні) — монітор не падає.

## G2 — Scope (L2, детермінований)
- [ ] Змінена `ст.182` → scope містить послуги з `law_chunks.service_slugs` (`alimony`,
      `alimony-change`) ∪ сусіди за `law_relations` (лише `verified_by IS NOT NULL`).
- [ ] **Severity-стеля:** `requires`/`overrides`-шлях → не вище `high`; `clarifies` → ≤`medium`;
      `references`/лише slug → `low`; hunk без чисел/дат/строків → знижено на щабель.
- [ ] Невідома/неграф-стаття → scope = лише `service_slugs` (або порожньо) без винятку.

## G3 — Reasoning + критики (L3/L4)
- [ ] L3 повертає валідний strict JSON за контрактом §3; невалідний JSON → abstention (не краш).
- [ ] **Enum-констрейнт (адверсарій):** фікстура, де модель «хоче» назвати статтю поза diff-set
      або послугу поза L2 → критик L4a ставить RED → abstention, а не публікація вигадки.
- [ ] **Groundedness:** кожен `evidence` ∈ `article_diffs` verbatim; будь-який не-verbatim → RED.
- [ ] **Abstention тригери:** (а) RED, що не чиститься; (б) `overall_confidence < поріг`;
      (в) Groq 5xx/таймаут — усі três → `ai_status='abstained'`, `ai_summary=NULL`, лишається diff.
- [ ] Чисел/дат/ПІБ із поза-входу у `summary`/`hypothesis` немає (детерм. перевірка).

## G4 — Дайджест + UI (L5)
- [ ] Дайджест ідемпотентний: бере лише `ai_status='pending' AND article_diffs IS NOT NULL`;
      повторний запуск не дублює і не перезаписує `drafted`/`abstained`.
- [ ] Картка «AI-чернетка» рендериться над `notes`: бейдж впевненості/«утримався», `summary`,
      вплив по послугах (severity-крапка + гіпотеза + чіпи статей), посилання на rada, сирий diff
      у `<details>`, дисклеймер «рішення за юристом».
- [ ] **«Вставити в нотатку»** копіює `ai_summary` у textarea-чернетку; БД не змінюється, доки
      юрист не натисне `Переглянуто`/`Відхилити`. `notes`/`action` — людський SSoT недоторканий.
- [ ] `abstained` → картка показує лише diff + «потрібен ручний аналіз», без вигаданого summary.
- [ ] **Регресія наявної панелі:** flagged→reviewed/dismissed, лічильник pending, фільтр
      «лише очікують», запис `reviewed_by/reviewed_at` — працюють як до фічі.

## Edge cases
- [ ] Закон змінився, але **жодна** послуга не залежить → рядок + diff створюються (історія
      повна), scope порожній, дайджест пише нейтральний summary або abstain.
- [ ] Зміна суто косметична (пунктуація/нумерація) → low-severity або abstain; не «high» паніка.
- [ ] Дві зміни поспіль до ревʼю першої → два окремі append-only рядки, кожен зі своїм diff.
- [ ] n8n лежить тиждень → рядки копляться в `pending` із diff; юрист усе одно бачить diff;
      дайджест добирає їх, коли встане (ідемпотентно).
- [ ] `truncated` diff → юрист має робоче посилання «звірити з rada».

## Sign-off (Оля)
- [ ] На реальній (або staging) зміні закону Оля підтверджує: чернетка **допомагає**, не вводить
      в оману; severity адекватна; жодного хибного «все гаразд» на справжній зміні.
- [ ] Зафіксований поріг впевненості, за яким abstention переважає публікацію (краще «утримався»,
      ніж впевнена помилка — quality bar: коректність > швидкість).
