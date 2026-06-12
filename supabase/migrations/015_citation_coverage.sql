-- Migration 015: Close citation-coverage drift in watched_laws (Issue #36).
--
-- Context: scripts/lib/citations.mjs (regex extractor, G1) + the per-service
-- citation goldens (n8n/templates/services/<slug>.citations.json, G2) found 3
-- gaps between what the document templates cite and what watched_laws tracks
-- for the CRON law monitor (see docs/research/service-catalog-branching-map.md §4):
--
--   1. divorce  cites ст.27 ЦПК  (territorial jurisdiction, line 132) — not watched.
--   2. alimony  cites ст.174 ЦПК (claim statements, line 124)         — not watched.
--   3. divorce's surname_after_divorce branch relies on ст.113 СК — not cited (the
--      template text doesn't reference it yet, pending Olga's sign-off ~2026-06-25,
--      see memory/project_cron_schedule_pending.md) and not watched. Added now so
--      the law monitor covers it ahead of that template edit.
--
-- Titles verified against zakon.rada.gov.ua (via protocol.ua / urst.com.ua mirrors):
--   ЦПК ст.27  — "Підсудність справ за місцем проживання або місцезнаходженням відповідача"
--   ЦПК ст.174 — "Види та зміст заяв по суті справи"
--   СК  ст.113 — "Право на вибір прізвища після розірвання шлюбу"
--
-- Executed: 2026-06-12 via Supabase REST (verified: `node scripts/extract-citations.mjs
-- report` → all cited articles watched, exit 0). This SQL is the reproducible
-- record of that change — re-running it is a no-op (full-array replacement).

-- ─── divorce: + ст.27 ЦПК, + ст.113 СК ──────────────────────────────────────────

UPDATE public.services
SET watched_laws = $json$[
  {
    "slug": "simeinyi-kodeks",
    "title": "Сімейний кодекс України",
    "url": "https://zakon.rada.gov.ua/laws/show/2947-14",
    "last_known_date": "2026-03-04",
    "articles": [
      {"number": "65",  "title": "Право подружжя на розпорядження майном"},
      {"number": "105", "title": "Припинення шлюбу внаслідок його розірвання"},
      {"number": "106", "title": "Розірвання шлюбу органом ДРАЦС за заявою подружжя без дітей"},
      {"number": "107", "title": "Розірвання шлюбу органом ДРАЦС за заявою одного з подружжя"},
      {"number": "109", "title": "Розірвання шлюбу за рішенням суду за спільною заявою"},
      {"number": "110", "title": "Право на пред'явлення позову про розірвання шлюбу"},
      {"number": "112", "title": "Підстави для розірвання шлюбу за позовом"},
      {"number": "113", "title": "Право на вибір прізвища після розірвання шлюбу"},
      {"number": "180", "title": "Обов'язок батьків утримувати дитину"},
      {"number": "183", "title": "Розмір аліментів на одну дитину"}
    ]
  },
  {
    "slug": "tsyvilnyi-protsesualnyi-kodeks",
    "title": "Цивільний процесуальний кодекс України",
    "url": "https://zakon.rada.gov.ua/laws/show/1618-15",
    "last_known_date": "2025-07-17",
    "articles": [
      {"number": "27",  "title": "Підсудність справ за місцем проживання або місцезнаходженням відповідача"},
      {"number": "175", "title": "Форма і зміст позовної заяви"},
      {"number": "187", "title": "Подання позовної заяви до суду"},
      {"number": "274", "title": "Справи окремого провадження"}
    ]
  },
  {
    "slug": "pro-sudovyi-zbir",
    "title": "Закон України «Про судовий збір»",
    "url": "https://zakon.rada.gov.ua/laws/show/3674-17",
    "last_known_date": "2026-03-10",
    "articles": [
      {"number": "4", "title": "Розмір ставок судового збору"},
      {"number": "5", "title": "Пільги щодо сплати судового збору"}
    ]
  }
]$json$::jsonb
WHERE slug = 'divorce';

-- ─── alimony: + ст.174 ЦПК ───────────────────────────────────────────────────────

UPDATE public.services
SET watched_laws = $json$[
  {
    "slug": "simeinyi-kodeks",
    "title": "Сімейний кодекс України",
    "url": "https://zakon.rada.gov.ua/laws/show/2947-14",
    "last_known_date": "2026-03-04",
    "articles": [
      {"number": "141", "title": "Рівність прав та обов'язків батьків щодо дитини"},
      {"number": "150", "title": "Обов'язки батьків щодо виховання та розвитку дитини"},
      {"number": "180", "title": "Обов'язок батьків утримувати дитину"},
      {"number": "181", "title": "Способи виконання батьками обов'язку утримувати дитину"},
      {"number": "182", "title": "Розмір аліментів"},
      {"number": "183", "title": "Стягнення аліментів за виконавчим написом нотаріуса"},
      {"number": "184", "title": "Зменшення розміру аліментів"}
    ]
  },
  {
    "slug": "tsyvilnyi-protsesualnyi-kodeks",
    "title": "Цивільний процесуальний кодекс України",
    "url": "https://zakon.rada.gov.ua/laws/show/1618-15",
    "last_known_date": "2025-07-17",
    "articles": [
      {"number": "174", "title": "Види та зміст заяв по суті справи"},
      {"number": "175", "title": "Форма і зміст позовної заяви"}
    ]
  },
  {
    "slug": "pro-sudovyi-zbir",
    "title": "Закон України «Про судовий збір»",
    "url": "https://zakon.rada.gov.ua/laws/show/3674-17",
    "last_known_date": "2026-03-10",
    "articles": [
      {"number": "5", "title": "Пільги щодо сплати судового збору (п.3 ч.1 — аліменти)"}
    ]
  }
]$json$::jsonb
WHERE slug = 'alimony';
