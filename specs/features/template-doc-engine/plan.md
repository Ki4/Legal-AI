# Template Document Engine — Plan (Tier 2)

**Slug:** `template-doc-engine` · DRAFT · парный к `requirements.md`.

Реализация фазами. Каждая фаза коммитится и проверяется отдельно (context-hygiene из CLAUDE.md).
Стартовать в свежем чате по этой спеке.

## Архитектура (целевая)

```
apps/client/src/admin  (React/TS)      ← Фаза B: авторская панель (разметка + превью)
        │ HTTP
apps/doc-engine  (Python / FastAPI)    ← Фаза A: ядро
   ├─ fill: docxtpl (поля, {%tr%}, {%p if%})
   ├─ declension: каскад pymorphy3 → LLM → флаг (+ Supabase dictionary)
   ├─ dates: date-to-words (uk)
   ├─ schema: авто-деривация полей/условий из шаблона
   └─ pdf: клиент Gotenberg (Docker)
        │
   Supabase: templates + derived-schema + declension-dictionary
        │
apps/mcp-server  (TS)                  ← Фаза C: generic generate_document(послуга, дані) → HTTP к doc-engine
```

Gotenberg: `gotenberg/gotenberg:8`, ендпоінт `/forms/libreoffice/convert`. Word на сервер НЕ ставить.

## Фаза A — Ядро (Python-сервис `apps/doc-engine/`)

Портировать валидированный PoC (`scratchpad/sigtest/poc.py`, `alimony_poc.py`) в сервис.

1. **`fill.py`** — docxtpl render. Гоча: `{%tr%}` кладёт for/endfor в ОТДЕЛЬНЫЕ контрол-строки,
   контент — в строке между (иначе `TemplateSyntaxError`). Не передавать кастомный jinja_env с `{%tr%}`.
2. **`declension.py`** — `decline_fullname(name, case)`: род по по-батькові (‑вна→femn, ‑вич→masc),
   gender-aware выбор разбора pymorphy3, флаг уверенности (Fixd=ок; пробел словаря/None=warning).
   Каскад: pymorphy → LLM-фолбэк → флаг. Библиотека проверенных форм из Supabase (lookup первым).
3. **`dates.py`** — `date_words('2015-06-20') → '20 червня 2015 року'` (месяцы в родовому).
4. **`preflight.py`** — сверка: каждое `{{поле}}` шаблона имеет данные; каждый ключ данных бьётся с плейсхолдером.
5. **`pdf.py`** — POST docx на Gotenberg, вернуть PDF.
6. **`app.py`** — FastAPI: `POST /generate {service, template_id, data} → {pdf, warnings[], flags[]}`.
7. **Шаблон аліменти** (`templates/alimony.docx`) — воспроизвести канонический текст MCP.

**Проверка A:** parity-diff тест против `generate_alimony_document` + автопроверки (склонение/условия/подпись).

## Фаза B — Авторство (`apps/client/src/admin`)

8. **Загрузка docx** + рендер превью в панели.
9. **Разметка полей:** юрист выделяет текст → создаётся поле; система предлагает имя (`plaintiff_full`),
   тип (ПІБ / дата / сумма / текст), нужен ли падеж. Маппинг «выделение → {{поле}}» сохраняется в docx/схему.
10. **Ветвление:** юрист выделяет блок → эндпоинт движка предлагает условие из помеченных полей
    (`marital_status == divorced`) → юрист подтверждает → вставляется `{%p if%}`.
11. **Авто-деривация схемы:** движок парсит шаблон → список полей + условий + повторов (source of truth).
12. **Preflight-превью:** заполнить тест-данными → показать PDF + инлайн-флаги склонения + список сверху.

**Проверка B:** юрист размечает алиментный шаблон с нуля в панели → получает рабочий шаблон, совпадающий с Фазой A.

## Фаза C — MCP-интеграция

13. **Generic тул** `generate_document(послуга, дані)` в MCP → HTTP к doc-engine.
14. **Модель «услуга = список шаблонов»** в Supabase (реализовать проход по 1 шаблону; список — задел).
15. Watermark «ЧЕРНЕТКА» + возврат warnings/flags наверх в диалог с агентом.

**Проверка C:** агент-диалог → `generate_document('alimony', ...)` → PDF идентичен Фазе A.

## Ключевые гочи (из PoC, не повторять)

- `{%tr%}` уничтожает свою строку → контрол-строки отдельно.
- `StrictUndefined` конфликтует с `{%tr%}`.
- pymorphy `parse[0]` без рода схибляет молча (жіноче прізвище гне в чол.) → gender-aware обязателен.
- `keep_with_next` держит подпись — проверять НА Gotenberg-рендере, не Word.
- Управляющие символы в тексте ломают docx XML → санитайз (`ord >= 0x20` + `\t\n\r`).

## Риски

- Языковая граница Python↔TS: держать движок как чистый HTTP-сервис, без общего кода.
- LLM-фолбэк склонения — стоимость/латентность: звать только при провале словаря, кешировать в библиотеку.
- Широкий скоуп: строго по фазам, между фазами — читаемый коммит.
