-- Migration 022: divorce template cites ст.157 СК (participation in upbringing /
-- visitation schedule for the parent living separately) — close citation-coverage
-- drift before the new clause goes live (Issue #28, divorce-with-children G1).
--
-- Title verified via zakon.rada.gov.ua mirrors (protocol.ua, kodeksy.com.ua,
-- urist-ua.net): "Стаття 157. Вирішення батьками питань щодо виховання дитини".
-- Note: disputed-schedule cases defer to a separate proceeding without citing
-- ст.159 СК (court-ordered visitation order) in the document text — mirrors the
-- existing residence-dispute clause, which likewise cites no article for the
-- deferral itself.
--
-- last_known_date values copied unchanged from the live row (read via REST
-- before writing this migration) — this migration only appends one article.

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
      {"number": "157", "title": "Вирішення батьками питань щодо виховання дитини"},
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
