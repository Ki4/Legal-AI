# preview-module — Requirements

> **SDD-Tier 2** контракт. Монетизаційний потік у Telegram Mini App:
> **превʼю (HTML-витяг) → оплата (заглушка) → повний документ (signed URL)**.
> Архітектурні «чому» — `docs/architecture/DECISIONS.md` → «Превью-модуль…».
> Підхід/кроки — `plan.md`. Перевірка — `validation.md`.

---

## 0. Інваріанти (читати першими)

1. **Суть фізично відсутня в превʼю.** У payload, що йде на клієнт до оплати, НЕМАЄ операційної
   частини документа — «ПРОШУ», цитат статей, прохальної частини. Превʼю = безпечний витяг
   (шапка суду + сторони + перший абзац обставин, обрізаний **перед** правовим обґрунтуванням).
   Це і є рів проти «скрін → ШІ дозаповнює» (#86), а не watermark. Watermark/blur — вторинна вітрина.
2. **Повний файл ніколи не йде на клієнт до `paid=true`.** Повний документ кладеться в **приватний**
   Supabase Storage; signed URL мінтиться **сервер-сайд** (n8n service-role) лише після верифікації оплати.
   Клієнту не довіряємо ні `paid`, ні Storage-ключ.
3. **Деградація ≥ сьогодні.** Будь-яка помилка генерації → `status='failed'` + зрозуміле повідомлення;
   ніколи не показуємо зламане превʼю і ніколи не віддаємо документ без оплати.
4. **initData fail-closed (реюз #56).** Кожен виклик preview-pay верифікує Telegram initData HMAC і
   звіряє власника case (telegram_id). Без валідного підпису — відмова. Перша лінія проти ботів.
5. **Оплата — заглушка з чистим швом.** Кнопка «Оплатити» фліпає `paid` через сервер-сайд-перевірений
   вузол. Реальний платіж (Telegram Payments / еквайринг) = заміна одного вузла; контракт
   «paid → mint URL» від нього не залежить. У цій ітерації реальних грошей НЕ беремо.
6. **Юр-формулювання — sign-off Олі пост-фактум** (фаза витрини, як #67/#76). Точка обрізки витягу
   звіряється з Олею, але кодимо з детермінованим placeholder-правилом.

---

## 1. Потік (happy path)

```
TWA: форма → submit (initData) ─POST─▶ n8n form-submit (webhook)
                                         │ 1. verify initData (#56, live)
                                         │ 2. rate-limit check (per-profile, N/24h)
                                         │ 3. generate full doc (як зараз: declension→GoogleDocs→PDF/DOCX)
                                         │ 4. upload full PDF(+DOCX) → ПРИВАТНИЙ Storage → doc_storage_path
                                         │ 5. derive safe excerpt (deterministic cut)
                                         │ 6. UPDATE case: status='preview_ready', preview_excerpt, doc_storage_path
                                         └─resp─▶ { case_id }
TWA: стан 'generating' → POLL case (Supabase) until status ∈ {preview_ready, failed}
TWA: render PreviewPage (A4-стилізований витяг + blur + watermark) + кнопка «Оплатити»
TWA: «Оплатити» ─POST {case_id, initData}─▶ n8n preview-pay (НОВИЙ webhook)
                                              │ 1. verify initData HMAC
                                              │ 2. load case, assert owner == telegram_id
                                              │ 3. assert status == preview_ready (idempotent: paid→re-mint)
                                              │ 4. SET paid=true, paid_at=now
                                              │ 5. mint signed URL (service-role, TTL) з приватного Storage
                                              │ 6. (опц.) sendDocument у бот (PII-приватна доставка, #57)
                                              └─resp─▶ { signed_url, expires_at }
TWA: стан 'paid' → кнопка «Завантажити документ» (signed_url)
```

## 2. Дані / схема (нова міграція)

`supabase/migrations/0NN_preview_module.sql`:
- **`cases`** (наявна) додати:
  - `status text not null default 'generating'` — `generating | preview_ready | paid | delivered | failed`
  - `paid boolean not null default false`
  - `paid_at timestamptz`
  - `preview_excerpt text` — безпечний витяг (НЕ містить ПРОШУ/цитат)
  - `doc_storage_path text` — шлях у приватному Storage до повного PDF (і DOCX, якщо віддаємо)
  - (опц.) `preview_meta jsonb` — { page_count, service_slug } для UI
- **Storage:** приватний bucket `generated-documents` (RLS: лише service-role читає; `public=false`).
  NB: bucket `service-examples` (migration 026) — інший; не плутати. `protect_delete()`-тригер на
  `storage.objects` (memory `reference_supabase_storage`) — врахувати при чистці.
- **Rate-limit:** БЕЗ нового стовпця — рахувати `count(cases) WHERE profile_id=? AND created_at > now()-24h`
  у ноді Validate (простіше за лічильник-з-вікном; одна умова). Ліміт `PREVIEW_RATE_LIMIT` = конфіг ноди.
- **RLS на `cases`:** клієнт (`authenticated`/anon у TWA) читає лише власні case (за telegram_id/profile);
  пише в `paid`/`status`/`doc_storage_path` **тільки** service-role (n8n). Перевірити наявні RLS-політики
  `cases` — можливо вже звужено; не дати клієнту виставити `paid`.

## 3. Що ВХОДИТЬ у цю ітерацію

- Міграція (поля `cases` + приватний bucket).
- form-submit: rate-limit + upload-to-Storage + derive-excerpt + status-write; **зняти** пряму бот-доставку
  PDF/DOCX до оплати (перенести в preview-pay або лишити як пост-оплатний бонус).
- НОВИЙ workflow `preview-pay` (n8n): initData-verify + paid-flip + mint signed URL (+ опц. бот-доставка).
- TWA: стан після сабміту (generating → preview_ready → paid), `PreviewPage` (A4-верстка + blur + watermark),
  кнопки «Оплатити»/«Завантажити», polling case-статусу.
- Detеrмінований екстрактор безпечного витягу (pure-функція + тести) — спільний із doc-engine текстом.
- IMPROVEMENTS-пункт: production image-превʼю через Gotenberg `/screenshot` при міграції #77.

## 4. Що ПОЗА скоупом (явно)

- Реальний платіж / Telegram Payments / еквайринг (лишається заглушка; шов чистий).
- Image-превʼю (картинка реальної сторінки) — відкладено на Gotenberg-міграцію #77.
- Гра з watermark-стійкістю (DRM, анти-скрін) — #86 вже довів, що це недосяжно; ставка на відсутність суті.
- Генерувати-після-оплати (структурний запобіжник проти abuse) — НЕ зараз; шов лишаємо чистим.
- Production-домен/інфра — окремо.

## 5. Відкриті питання (assumptions, ветуються)

- **A1. Точка обрізки витягу.** Припускаю: брати від початку документа до маркера правового
  обґрунтування / «ПРОШУ» (детермінований split по відомому заголовку секції в doc-engine-тексті).
  Для divorce/alimony структура: шапка → вступ/обставини → правове обґрунтування(цитати) → ПРОШУ →
  додатки → дата/підпис. Витяг = до «правове обґрунтування». **Sign-off Олі пост-фактум.**
- **A2. Скільки абзаців показувати** до blur: припускаю шапку + 1 перший абзац обставин (далі blur).
- **A3. Signed URL TTL:** припускаю 24 год (досить завантажити, не вічний лінк).
- **A4. Бот-доставка після оплати:** припускаю ТАК слати PDF файлом у бот (PII-приватно, #57) на додачу
  до signed URL — як страховка, що юзер не втратить документ. Можна вимкнути.
- **A5. DOCX:** припускаю в Storage кладемо лише PDF для signed URL; DOCX — лише бот-файлом після оплати
  (як зараз). Уточнити, чи треба DOCX через signed URL теж.
