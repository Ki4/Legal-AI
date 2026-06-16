-- Migration 016: Register alimony-change service (Issue #37, G1).
-- Context:
--   Зміна розміру аліментів (↑/↓) — the pilot of generation_mode='template'.
--   Unlike alimony/divorce (hardcoded JS builders), this service renders directly
--   through the doc-engine (render-document.js + alimony-change.document.txt).
--   Status is 'disabled' — enabled only after Olga's sign-off (G1 scope).
--
-- After applying this migration, push the document template:
--   node scripts/upload-document-template.mjs alimony-change
-- Form config is static in the React app (apps/client/src/data/alimonyChangeFormConfig.ts)
-- and served directly — no Supabase form_config upload needed for G1.
--
-- watched_laws = articles cited in n8n/templates/services/alimony-change.document.txt
-- (extracted by scripts/extract-citations.mjs — see alimony-change.citations.json).
-- Titles verified against zakon.rada.gov.ua (2026-06-16).

INSERT INTO public.services (slug, title, form_config, generation_mode, status, ai_prompt, watched_laws)
VALUES (
  'alimony-change',
  'Зміна розміру аліментів',
  '{}'::jsonb,
  'template',
  'disabled',
  'Ти — помічник для відмінювання українських ПІБ для позовної заяви про зміну розміру аліментів. Відповідай ТІЛЬКИ JSON без markdown і пояснень. Потрібні поля: plaintiff_genitive, defendant_genitive, children_genitive.',
  $json$[
    {
      "slug": "simeinyi-kodeks",
      "title": "Сімейний кодекс України",
      "url": "https://zakon.rada.gov.ua/laws/show/2947-14",
      "last_known_date": "2026-03-04",
      "articles": [
        {"number": "182", "title": "Розмір аліментів"},
        {"number": "183", "title": "Стягнення аліментів за виконавчим написом нотаріуса"},
        {"number": "184", "title": "Зменшення розміру аліментів"},
        {"number": "191", "title": "Аліменти за минулий час"},
        {"number": "192", "title": "Зміна розміру аліментів"},
        {"number": "197", "title": "Заборгованість зі сплати аліментів"}
      ]
    },
    {
      "slug": "tsyvilnyi-protsesualnyi-kodeks",
      "title": "Цивільний процесуальний кодекс України",
      "url": "https://zakon.rada.gov.ua/laws/show/1618-15",
      "last_known_date": "2025-07-17",
      "articles": [
        {"number": "27",  "title": "Підсудність справ за місцем проживання або місцезнаходженням відповідача"},
        {"number": "28",  "title": "Підсудність на вибір позивача"},
        {"number": "174", "title": "Форма і зміст позовної заяви"},
        {"number": "175", "title": "Зміст позовної заяви"},
        {"number": "176", "title": "Ціна позову"}
      ]
    },
    {
      "slug": "pro-sudovyi-zbir",
      "title": "Закон України «Про судовий збір»",
      "url": "https://zakon.rada.gov.ua/laws/show/3674-17",
      "last_known_date": "2026-03-10",
      "articles": [
        {"number": "4", "title": "Розмір ставок судового збору"},
        {"number": "5", "title": "Пільги щодо сплати судового збору (п.3 ч.1 — збільшення аліментів)"}
      ]
    }
  ]$json$::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  title         = EXCLUDED.title,
  generation_mode = EXCLUDED.generation_mode,
  ai_prompt     = EXCLUDED.ai_prompt,
  watched_laws  = EXCLUDED.watched_laws;
-- Note: status is intentionally NOT included in DO UPDATE — a manual 'active'
-- sign-off from Olga must not be overwritten by re-running this migration.

-- ─── Verification (run after applying) ────────────────────────────────────────
-- SELECT slug, status, generation_mode, (document_template IS NOT NULL) AS has_template
-- FROM public.services WHERE slug = 'alimony-change';
--   expect: status='disabled', generation_mode='template', has_template=false
--
-- After: node scripts/upload-document-template.mjs alimony-change → has_template=true
-- After Olga sign-off: UPDATE public.services SET status='active' WHERE slug='alimony-change';
