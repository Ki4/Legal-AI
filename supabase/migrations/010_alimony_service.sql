-- Migration 010: Add alimony service to services table
-- Run in Supabase SQL Editor

INSERT INTO services (slug, title, form_config, ai_prompt, watched_laws)
VALUES (
  'alimony',
  'Стягнення аліментів',
  '{}'::jsonb,
  'Ти — помічник для відмінювання українських ПІБ та назв установ для позовної заяви про стягнення аліментів. Відповідай ТІЛЬКИ JSON, без markdown, без пояснень.',
  $json$[
    {
      "slug": "simejnyj-kodeks",
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
      "slug": "cpk",
      "title": "Цивільний процесуальний кодекс України",
      "url": "https://zakon.rada.gov.ua/laws/show/1618-15",
      "last_known_date": "2025-07-17",
      "articles": [
        {"number": "175", "title": "Форма і зміст позовної заяви"}
      ]
    },
    {
      "slug": "pro-sudovyj-zbir",
      "title": "Закон України «Про судовий збір»",
      "url": "https://zakon.rada.gov.ua/laws/show/3674-17",
      "last_known_date": "2026-03-10",
      "articles": [
        {"number": "5", "title": "Пільги щодо сплати судового збору (п.3 ч.1 — аліменти)"}
      ]
    }
  ]$json$::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title        = EXCLUDED.title,
  ai_prompt    = EXCLUDED.ai_prompt,
  watched_laws = EXCLUDED.watched_laws;
