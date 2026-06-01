# GraphRAG — Гайд для Legal-AI

> Покрокове пояснення як GraphRAG покращує якість юридичних документів.
> Від концепції до реалізації.

---

## Чому звичайний RAG недостатній

### Як працює звичайний RAG (зараз)

```
Форма → answers → vector_search("розлучення з дітьми")
                        ↓
              топ-5 схожих чанків за cosine similarity
                        ↓
              Groq генерує документ
```

**Проблема:** вектор шукає за семантичною схожістю — за словами та змістом. Але юридичні зв'язки не завжди семантичні:

- Ст. 109 СК (розлучення) **зобов'язує** подати до суду за Ст. 57 ЦПК (підсудність)
- Тексти цих статей стилістично різні → вектор може не знайти зв'язок
- Якщо Ст. 57 не потрапила в промпт → документ вказує не той суд → клієнт отримає повернення позову

### Що вирішує граф

Граф зберігає **явні юридичні зв'язки** незалежно від семантики. Юрист один раз прописує: "Ст. 109 requires Ст. 57" — і система завжди їх знаходить разом.

---

## Архітектура GraphRAG

### Схема даних

```sql
-- Вже існує
CREATE TABLE law_chunks (
  id uuid PRIMARY KEY,
  content text,
  embedding vector(768),
  source text,        -- 'СК України', 'ЦПК України'
  article_number text -- '109', '57'
);

-- Нова таблиця
CREATE TABLE law_relations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_chunk_id uuid NOT NULL REFERENCES law_chunks(id) ON DELETE CASCADE,
  to_chunk_id   uuid NOT NULL REFERENCES law_chunks(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN (
    'requires',       -- A не діє без B (процедурна вимога)
    'exception_if',   -- якщо умова → застосовується B замість A
    'overrides',      -- B скасовує або замінює A
    'clarifies',      -- B пояснює або деталізує A
    'references'      -- м'яке посилання (A згадує B)
  )),
  condition     text,          -- для exception_if: 'є неповнолітні діти'
  confidence    float DEFAULT 1.0, -- 0-1, для AI-витягнутих зв'язків
  note          text,          -- коментар юриста
  verified_by   text,          -- ім'я юриста який підтвердив
  verified_at   timestamptz,   -- коли підтверджено
  created_by    text,          -- 'ai' або email юриста
  created_at    timestamptz DEFAULT now(),
  UNIQUE(from_chunk_id, to_chunk_id, relation_type)
);

CREATE INDEX idx_law_relations_from ON law_relations(from_chunk_id);
CREATE INDEX idx_law_relations_to   ON law_relations(to_chunk_id);
CREATE INDEX idx_law_relations_verified ON law_relations(verified_by) WHERE verified_by IS NOT NULL;
```

### Типи зв'язків детально

| Тип | Напрямок | Приклад | Що означає для документу |
|-----|----------|---------|--------------------------|
| `requires` | A → B | Ст.109 СК → Ст.57 ЦПК | Завжди включати B якщо є A |
| `exception_if` | A → B (з умовою) | Ст.109 → Ст.161 якщо є діти | Включати B тільки при умові |
| `overrides` | нова → стара | Ред.2023 → Ред.2019 | Використовувати нову, не стару |
| `clarifies` | Постанова → Стаття | ПВС №11 → Ст.161 СК | Включати разом для точності |
| `references` | A → B | Ст.70 → Ст.63 | Контекст, не обов'язково |

---

## Алгоритм GraphRAG запиту

### Поточний (RAG)
```javascript
// n8n Code node
const results = await supabase.rpc('hybrid_search', { query, limit: 5 })
return results.map(r => r.content).join('\n\n')
```

### Новий (GraphRAG)
```javascript
// n8n Code node — GraphRAG
async function graphRAGSearch(query, answers) {
  // Крок 1: Звичайний vector search
  const seeds = await supabase.rpc('hybrid_search', { query, limit: 5 })

  // Крок 2: Для кожного seed — обходимо граф
  const seedIds = seeds.map(s => s.id)
  const { data: relations } = await supabase
    .from('law_relations')
    .select('from_chunk_id, to_chunk_id, relation_type, condition')
    .in('from_chunk_id', seedIds)
    .not('verified_by', 'is', null)  // тільки перевірені юристом

  // Крок 3: Фільтруємо exception_if за відповідями форми
  const relevantRelations = relations.filter(r => {
    if (r.relation_type !== 'exception_if') return true
    // Перевіряємо умову проти answers
    return evaluateCondition(r.condition, answers)
  })

  // Крок 4: Збираємо сусідні чанки
  const neighborIds = relevantRelations.map(r => r.to_chunk_id)
  const { data: neighbors } = await supabase
    .from('law_chunks')
    .select('id, content, article_number, source')
    .in('id', neighborIds)

  // Крок 5: Об'єднуємо, дедуплікуємо, ранжуємо
  const allChunks = [...seeds, ...neighbors]
  const unique = deduplicateById(allChunks)

  return unique.map(c => `${c.source} Ст.${c.article_number}:\n${c.content}`).join('\n\n---\n\n')
}
```

### Різниця в якості промпту

**До (RAG):** 5 статей, знайдених за схожістю
**Після (GraphRAG):** 5 seed + 3-8 пов'язаних = повний юридичний контекст

---

## Як заповнюється граф

### Варіант 1: AI витягує зв'язки автоматично

```
Prompt: "Проаналізуй статтю. Знайди посилання на інші статті.
         Для кожного посилання вкажи: from_article, to_article, 
         relation_type, condition (якщо є).
         Відповідь у JSON."

→ Результат: law_relations з confidence < 1.0, verified_by = null
→ Статус: pending_review (не використовується в запитах)
```

### Варіант 2: Юрист додає вручну

```
Форма: [Стаття A] →[тип зв'язку]→ [Стаття B]
       [умова якщо exception_if]
       [нотатка]

→ Результат: law_relations з verified_by = юрист, confidence = 1.0
→ Статус: active (використовується одразу)
```

### Варіант 3: AI пропонує → Юрист підтверджує (HITL)

```
1. AI аналізує закони → pending_review
2. Юрист бачить список: "AI знайшов зв'язок: Ст.109 → Ст.57 (requires)"
3. Юрист: ✓ Підтвердити / ✗ Відхилити / ✏️ Виправити
4. Після підтвердження: verified_by = юрист → active
```

---

## Інтерфейс для юриста (що будуємо)

### Сторінка: Law Graph Editor

```
┌─────────────────────────────────────────────────────────┐
│ Law Graph Editor                          [+ Додати зв'язок] │
├─────────────────────────────────────────────────────────┤
│ Фільтр: [Всі закони ▾] [Всі типи ▾] [Статус: всі ▾]   │
├──────────────────────────────────────────────────────────┤
│ Граф / Таблиця                                           │
│                                                         │
│  [Ст.109 СК]──requires──>[Ст.57 ЦПК]        ✓ verified │
│  [Ст.109 СК]──exception_if:діти──>[Ст.161 СК] ✓        │
│  [Ст.161 СК]──clarifies──>[ПВС №11]          ⏳ pending │
│                                                         │
├──────────────────────────────────────────────────────────┤
│ Pending review (AI-пропозиції):                         │
│  Ст.70 СК → Ст.63 СК (references) [confidence: 0.87]   │
│  [✓ Підтвердити] [✗ Відхилити] [✏️ Виправити]          │
└──────────────────────────────────────────────────────────┘
```

### Сторінка: Test Query

```
┌─────────────────────────────────────────────────────────┐
│ Test GraphRAG Query                                     │
├──────────────────────────────────────────────────────────┤
│ Сервіс: [Розлучення ▾]   Умови: [✓ є діти] [✓ майно]   │
│                                                         │
│ [▶ Запустити пошук]                                     │
├──────────────────────────────────────────────────────────┤
│ Результат:                                              │
│                                                         │
│ Seeds (vector search):           Graph neighbors:       │
│ • Ст.109 СК (score: 0.94)       • Ст.57 ЦПК (requires) │
│ • Ст.110 СК (score: 0.89)       • Ст.161 СК (exception)│
│ • Ст.70 СК  (score: 0.82)       • ПВС №11   (clarifies)│
│                                                         │
│ Всього в промпт: 6 статей                               │
│                                                         │
│ [👁 Переглянути промпт]                                 │
└──────────────────────────────────────────────────────────┘
```

---

## Поетапний план впровадження

### Етап 1 — Структура (без юриста)
- [ ] Міграція: `law_relations` таблиця
- [ ] n8n: оновити hybrid_search → graphRAGSearch
- [ ] Тест: перевірити на реальному кейсі розлучення

### Етап 2 — Ручне заповнення (з юристом)
- [ ] Адмін-панель: сторінка Law Graph Editor (таблиця)
- [ ] CRUD для law_relations
- [ ] Фільтр: pending / verified

### Етап 3 — AI-допомога
- [ ] n8n workflow: AI аналізує нові закони → pending_review
- [ ] Адмін-панель: HITL інтерфейс (confirm/reject/edit)

### Етап 4 — Візуалізація графу
- [ ] React Flow: інтерактивний граф вузлів
- [ ] Test Query: порівняти RAG vs GraphRAG результати

---

## Що це дає продукту

| Документ | Без графу | З графом |
|---------|-----------|---------|
| Розлучення без дітей | ✅ OK | ✅ OK |
| Розлучення з дітьми | ⚠️ може пропустити ст. опіки | ✅ повний |
| Аліменти + розлучення | ❌ змішані контексти | ✅ чіткі зв'язки |
| Поділ майна + іпотека | ❌ неповний контекст | ✅ всі норми |
