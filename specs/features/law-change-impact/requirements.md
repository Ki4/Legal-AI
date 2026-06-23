# law-change-impact — Requirements

> **SDD-Tier 2** контракт. Агент «що змінилось»: вхід — виявлена зміна редакції закону; вихід —
> детермінований diff (завжди) + **попередня** чернетка «що змінилось + вплив по послугах»
> (коли впевнено), записана в `law_change_log` для ревʼю юриста.
> Харнесс L0–L5 — `docs/research/service-tiers-and-ai-harness.md`; підхід — `plan.md`.

---

## 0. Інваріанти (читати першими)

1. **Advisory-only.** Агент НІКОЛИ нічого не застосовує. Єдина мутація стану послуг —
   наявний флип у `needs_review` (робить монітор, не агент). Чернетка — текст для людини.
2. **Деградація ≥ сьогодні.** Будь-яка помилка/таймаут/abstention → у рядку лишається
   детермінований `article_diffs` + флип. Ніколи не гірше за поточну поведінку, ніколи галюцинація.
3. **`notes` — людський SSoT.** AI пише лише в `ai_*`-колонки. `notes`/`action`/`reviewed_by`
   виставляє **тільки** юрист (наявний потік migration 013). Кнопка «Вставити в нотатку» копіює
   `ai_summary` у чернетку textarea — далі редагує людина.
4. **Sign-off обов'язковий.** Послуга виходить із `needs_review` лише рішенням Олі (quality bar).
5. **Нуль вигадок конструкцією.** L3 фізично не може назвати статтю/число/дату поза входом
   (enum-констрейнт + детермінований критик L4a) — дзеркало DECISIONS «нуль галюцинацій».

---

## 1. Input

### 1.1 Тригер (L0, наявний)
`scripts/check-law-updates.mjs` виявив `current_revision_date != known_date` для закону з
`scripts/law-registry.mjs`. У мить детекту відомі: `law` (slug/title/url/law_code),
`old_revision_date`, `new_revision_date`, `affected_services[]` (наявний reverse-index).

### 1.2 Тексти для diff (L1)
- **Стара редакція:** `law_documents.full_text WHERE law_code=<code> AND is_stale=false`
  (повний текст; у мить детекту ще стара). Фолбек: конкат `law_chunks.content` за `law_code`.
- **Нова редакція:** `fetchLawText(law.url)` (`scripts/lib/law-text.mjs`) — повний текст
  свіжої сторінки rada.
- Diff береться **до** позначення `is_stale=true` (інакше стару редакцію втрачено).

---

## 2. Output #1 — детермінований diff (L1, ЗАВЖДИ)

`law_change_log.article_diffs` (jsonb) — знімок факту зміни, незалежний від LLM:

```jsonc
{
  "level": "law" | "article",          // law-level (первинно) чи поартикульно
  "law_code": "2947-14",
  "changed_articles": ["182", "184"],  // best-effort за заголовками; [] якщо law-level не розбився
  "hunks": [
    { "article_num": "182", "op": "changed",
      "removed": ["<стара версія рядка(ів)>"],
      "added":   ["<нова версія рядка(ів)>"] }
  ],
  "source_url": "https://zakon.rada.gov.ua/laws/show/2947-14",
  "captured_at": "2026-06-23T12:00:00Z",
  "truncated": false                   // true якщо diff завеликий і обрізаний для зберігання
}
```

- Без LLM. Це **ground truth**, який бачить юрист навіть при abstention.
- Розмір: hunks обрізаємо до розумного ліміту (напр. 32 КБ), `truncated=true` + повний diff
  доступний за `source_url` (юрист завжди може звірити з rada).

---

## 3. Output #2 — AI-чернетка (L3, КОЛИ впевнено)

L3 (Groq, **strict JSON**) → після L4 пишеться в `ai_summary` + `ai_impact` + `ai_confidence`:

```jsonc
{
  "summary": "Стаття 182 СК: змінено формулу мінімального розміру аліментів — …",  // 1–3 речення, людською
  "per_service": [
    {
      "slug": "alimony",                       // ∈ L2 scope
      "severity": "high" | "medium" | "low",   // юридична (§3.1), не попит; обмежена евристикою L2
      "confidence": 0.0,                        // 0–1
      "articles": ["182"],                      // ∈ diff changed-set
      "hypothesis": "Ймовірно зачеплено розрахунок 'не менше 50% ПМ' та абзац 'ПРОШУ'.",
      "evidence": "<verbatim фрагмент з article_diffs>"   // має бути ∈ diff (критик L4a звіряє)
    }
  ],
  "overall_confidence": 0.0
}
```

### 3.1 Severity — юридична, детермінований стеля
LLM пропонує severity, але **L2-евристика обмежує згори** (закриває зауваження viz-сесії 45,
де товщина ребра = попит, а не ризик):
- шлях зв'язку послуги до зміненої статті `requires`/`overrides` → стеля `high`;
- `clarifies` → стеля `medium`;
- `references` / лише `service_slugs` без ребра → стеля `low`;
- модуляція: якщо жоден hunk не зачіпає число/дату/строк (regex) → знизити на один щабель.

### 3.2 Enum-констрейнт (критично)
L3 отримує закриті списки `allowed_articles` (= diff changed-set) і `allowed_slugs` (= L2) і
пише structured output (strict). Будь-яка `article_num`/`slug` поза списками, будь-який `evidence`
не-verbatim-із-diff → детермінований критик L4a ставить RED → див. §3.3.

### 3.3 Abstention (L4c)
Спрацьовує якщо: критик L4a дав RED, що не вичищається, **або** `overall_confidence < 0.5`
(поріг — у конфізі workflow, не хардкод), **або** L3/Groq недоступний/невалідний JSON.
Результат: `ai_status='abstained'`, `ai_summary=NULL`, `ai_impact=NULL`. У рядку — лише
`article_diffs`. UI: «🤖 AI утримався від висновку — потрібен ручний аналіз (diff нижче)».

---

## 4. Схема — migration 027 (`law_change_impact_fields`)

Додає в `public.law_change_log` (append-only журнал, RLS — migration 011/013):

| Колонка | Тип | Призначення |
|---|---|---|
| `article_diffs` | `jsonb` | L1 детермінований diff (§2). Знімок у момент детекту. |
| `ai_summary` | `text` | L3 «що змінилось», людською. NULL до дайджесту / при abstention. |
| `ai_impact` | `jsonb` | L3 `per_service[]` (§3). |
| `ai_confidence` | `real` | `overall_confidence` 0–1. |
| `ai_status` | `text` | `CHECK IN ('pending','drafted','abstained','error')` DEFAULT `'pending'`. Життєвий цикл дайджесту, **окремо** від людського `action`. |
| `ai_model` | `text` | модель L3 (аудит, напр. `llama-3.3-70b-versatile`). |
| `ai_generated_at` | `timestamptz` | коли дайджест відпрацював. |

- **Стани `ai_status`:** `pending` (монітор записав diff, дайджест ще ні) → `drafted`
  (чернетка є) / `abstained` (свідомо без чернетки) / `error` (дайджест упав — лишається diff).
- **RLS:** успадковує політики `law_change_log`. Дайджест пише через `service_role` (n8n);
  юрист (`authenticated`) читає (SELECT, migration 013). ⚠️ Наявний grant UPDATE для
  `authenticated` (migration 013) коарсений — теоретично юрист може писати `ai_*`. Звуження до
  column-scoped review RPC — **deferred, IMPROVEMENTS** (вже відзначено в 013 як trade-off
  соло-фази). Поки прийнятно: `notes` — те, що юрист реально редагує.
- **`detected_by`** лишається `'cron'`/`'manual'` — агент не вводить нового значення.

---

## 5. UI-контракт — панель «Зміни законів» (`LawChangeLogPage.tsx`)

Над наявним `notes`-textarea (між «Зачеплені послуги» і «Notes») — **read-only картка**:

- **Заголовок-бейдж:** `drafted` → `🤖 AI-чернетка · впевненість N%` (колір за порогом:
  ≥0.75 зелений / 0.5–0.75 янтарний); `abstained` → `🤖 AI утримався`; `error`/`pending` →
  нічого або «AI-аналіз ще не готовий».
- **`ai_summary`** — абзац.
- **Вплив по послугах** — список: severity-крапка (high/med/low) · `slug` · `hypothesis` ·
  чіпи `articles`. Тон severity з палітри ACTION/health.
- **Джерело:** посилання «Звірити з редакцією rada ↗» (`article_diffs.source_url`) +
  згорнутий `<details>` із сирим diff (hunks).
- **Кнопка «Вставити в нотатку»** — копіює `ai_summary` у `notesDraft[row.id]` (не пише в БД сама).
- **Дисклеймер:** «Попередня оцінка AI. Рішення — за юристом.» завжди видимий на картці.

`notes`-textarea, кнопки `reviewed/dismissed/flagged`, лічильник pending — **без змін**.

`lawChangeLog.ts`: додати `type AiStatus`, `interface AiImpactItem`, розширити `LawChangeLogRow`
новими полями, хелпери бейджа впевненості/severity (дзеркало `ACTION_META`).

---

## 6. PII / безпека
- Тексти законів — **публічні** (rada), не PII. У промпт L3 йдуть diff + slug + article_num;
  **жодних `cases`/`answers`/PII**. Поверхня промпта — лише законодавчий текст.
- `article_diffs`/`ai_*` не містять персональних даних → читання для `authenticated` (юрист) безпечне.
- Промпти/шаблони без `eval`; критик L4a — string-match, без виконання коду.
- Groq-виклик — наявна n8n-credential (як AI Declension / alimony-change reasoning).

---

## 7. Залежності
- **Supabase:** `law_change_log` (+migration 027), `law_documents.full_text`, `law_chunks`
  (`service_slugs`, `content`, `law_code`, `article_num`, `is_stale`), `law_relations`
  (`verified_by`-фільтр).
- **Node:** `scripts/check-law-updates.mjs`, `scripts/lib/{rada,law-change,law-registry}.mjs`
  (+нові `law-text.mjs`, `law-diff.mjs`). npm `diff` (або власний LCS — без нової залежності, як
  вирішимо в G1).
- **n8n:** новий workflow `law-change-digest` (Groq HTTP, Supabase RPC L2, Code-критик L4a);
  промпти `law-change-digest.txt`, `law-change-critic.txt`; шаблон `law-change-groundedness.js`.
- **GH Actions:** `.github/workflows/law-monitor.yml` — за потреби тригерить дайджест (webhook)
  або дайджест працює власним Schedule (рішення в G4; обидва ідемпотентні).
- **Client:** `LawChangeLogPage.tsx`, `lib/lawChangeLog.ts`.
