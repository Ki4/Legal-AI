-- Migration 007: Add watched_laws + needs_law_review to services, source_url to law_documents
-- Purpose: Track which law articles each service depends on + enable CRON monitoring
-- Structure: [{slug, title, url, last_known_date, articles: [{number, title}]}]
-- Executed: pending

-- ─── 1. Services: watched_laws + needs_law_review ─────────────────────────────

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS watched_laws JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS needs_law_review BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.services.watched_laws IS 'Law articles this service depends on. Used by CRON monitor to detect legislative changes on zakon.rada.gov.ua';
COMMENT ON COLUMN public.services.needs_law_review IS 'Set to true by CRON when a watched law revision date changes. Admin must review and reset.';

-- ─── 2. Law documents: source_url ─────────────────────────────────────────────

ALTER TABLE public.law_documents
ADD COLUMN IF NOT EXISTS source_url TEXT;

UPDATE public.law_documents SET source_url = 'https://zakon.rada.gov.ua/laws/show/2947-14' WHERE law_code = '2947-14';
UPDATE public.law_documents SET source_url = 'https://zakon.rada.gov.ua/laws/show/1618-15' WHERE law_code = '1618-15';
UPDATE public.law_documents SET source_url = 'https://zakon.rada.gov.ua/laws/show/3674-17' WHERE law_code = '3674-17';

-- ─── 3. Populate watched_laws for divorce service ─────────────────────────────
-- Real revision dates fetched from zakon.rada.gov.ua on 2026-03-26:
--   СК України:  Редакція від 04.03.2026 (закон 4779-IX)
--   ЦПК України: Редакція від 17.07.2025
--   Про судовий збір: law_version_date from law_chunks = 2026-03-21

UPDATE public.services
SET watched_laws = '[
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
      {"number": "110", "title": "Право на пред''явлення позову про розірвання шлюбу"},
      {"number": "112", "title": "Підстави для розірвання шлюбу за позовом"},
      {"number": "180", "title": "Обов''язок батьків утримувати дитину"},
      {"number": "183", "title": "Розмір аліментів на одну дитину"}
    ]
  },
  {
    "slug": "tsyvilnyi-protsesualnyi-kodeks",
    "title": "Цивільний процесуальний кодекс України",
    "url": "https://zakon.rada.gov.ua/laws/show/1618-15",
    "last_known_date": "2025-07-17",
    "articles": [
      {"number": "175", "title": "Форма і зміст позовної заяви"},
      {"number": "187", "title": "Подання позовної заяви до суду"},
      {"number": "274", "title": "Справи окремого провадження"}
    ]
  },
  {
    "slug": "pro-sudovyi-zbir",
    "title": "Закон України \"Про судовий збір\"",
    "url": "https://zakon.rada.gov.ua/laws/show/3674-17",
    "last_known_date": "2026-03-10",
    "articles": [
      {"number": "4", "title": "Розмір ставок судового збору"},
      {"number": "5", "title": "Пільги щодо сплати судового збору"}
    ]
  }
]'::jsonb
WHERE slug = 'divorce';
