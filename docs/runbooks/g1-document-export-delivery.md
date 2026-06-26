# G1 — Приватна доставка документа (docx/pdf) через Google :export

> Issue #71 (G1 + G3). Замінює публічну Google-Doc ссилку на **приватний файл** у Telegram.
> Застосовується в **n8n-редакторі** (form-submit), бо ці вузли (Telegram sendDocument,
> HTTP response=file) у проєкті ще не вживались — параметри заповнюються в UI + одразу тест.
>
> **Передумова (БЛОКЕР):** Google OAuth scope креденшела `Google OAuth2` (`google-oauth2-001`)
> має включати `https://www.googleapis.com/auth/drive` (або `drive.readonly`). Copy/Share вже
> працюють, тож scope **скоріш за все вже є** — підтвердити перед тестом (інакше `:export` дасть 403).

## Поточний хвіст (як є)
```
Apply Typography → Share Document (публічний доступ) → Send Doc Link (повідомлення зі ссилкою)
```
Проблема: документ з ПІБ/ІПН стає «anyone with link» (PII), юзер качає вручну (Файл → Завантажити).

## Новий хвіст (G1 + G3)
```
Apply Typography → Export PDF → Send PDF → Export DOCX → Send DOCX → Delete Doc
```
Документ **ніколи не публічний**; після експорту видаляється з Drive.

## Вузли (додати)

### 1. «Export PDF» — HTTP Request
- **Method:** `GET`
- **URL:** `https://www.googleapis.com/drive/v3/files/{{ $('Build Replace Request').item.json._new_doc_id }}/export?mimeType=application/pdf`
- **Authentication:** Predefined Credential Type → Google OAuth2 API → креденшел `Google OAuth2` (той самий, що Share Document).
- **Options → Response → Response Format = `File`** (повертає бінарник у property `data`).

### 2. «Send PDF» — Telegram, **Operation: Send Document**
- **Chat ID:** `={{ $('Validate').item.json._user_id }}`
- **Binary File:** ON · **Binary Property:** `data`
- **File Name (additionalFields):** `={{ $('Get Service').item.json.title }}.pdf`
- **Caption:** `=✅ Ваш документ: {{ $('Get Service').item.json.title }}`
- Credential: `Telegram account` (`6OfTH9OBUuEgKALQ`).

### 3. «Export DOCX» — HTTP Request (копія №1, інший mimeType)
- URL `...export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### 4. «Send DOCX» — Telegram Send Document (копія №2)
- File Name `=...title.docx`, Binary Property `data`.

### 5. «Delete Doc» — HTTP Request (G3 — приватність)
- **Method:** `DELETE`
- **URL:** `https://www.googleapis.com/drive/v3/files/{{ $('Build Replace Request').item.json._new_doc_id }}`
- Google OAuth2. **`onError: continueRegularOutput`** — видалення не має валити доставку.

## Перемкнути зʼєднання
- `Apply Typography` → **Export PDF** (замість → Share Document).
- `Export PDF → Send PDF → Export DOCX → Send DOCX → Delete Doc`.
- `Share Document` + `Send Doc Link` (публічний шлях) — **відключити** (або лишити за фіче-флагом
  на період обкатки; тоді ПІБ ще світиться — прибрати після підтвердження export-шляху).

## HTML
mimeType `text/html` — потрібен для **превʼю/архіву**, не для Telegram-доставки (юзеру шлемо PDF+DOCX).
Превʼю court-ready вже є в адмінці (G2, таб «Документ»). Окремий Export HTML додавати лише за потреби.

## Чек-ліст при тесті (наживо)
1. **Scope** `drive`(`.readonly`) у креденшелі (інакше `:export` → 403).
2. **Export** повертає бінарник (а не JSON-помилку про scope/permissions).
3. **sendDocument** надсилає файл, що **відкривається** (PDF/DOCX не биті).
4. Після **Delete Doc** — документ зник з Drive (відкрити стару ссилку → 404 ⇒ PII закрито).
5. Прогнати на divorce + alimony (обидва live `template`).

## Чому не згенерований JSON
Ці типи вузлів у `n8n/workflows/` ще не вживались → точну схему параметрів (binary-property у
sendDocument, response=file у HTTP) неможливо звірити з наявним кодом і неможливо протестувати поза
n8n. Тому SSoT тут — цей runbook + редактор (де n8n валідує параметри), а не вгаданий експорт-JSON.
Коли вузли зібрані й протестовані — експортувати `form-submit.json` у репо як завжди.
