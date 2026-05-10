# n8n Workflow v7 — Improvement Plan

## Current State (v6-hybrid)

```
Webhook → Global Config → Validate → Is Valid?
  ├─ [true]  → Get Service → Get Profile → Encrypt Data → Insert Case
  │            → Prepare Declension → AI Declension → Build Document
  │            → Notify User → Respond OK → Copy Template
  │            → Build Replace Request → Replace Placeholder
  │            → Share Document → Send Doc Link
  └─ [false] → Respond Error
```

**19 nodes, 6 Code Nodes, linear pipeline, NO error handling after validation.**

## Problems

1. **No error handling** — if any node after "Is Valid?" fails (DB error, AI timeout, Google Docs API), the workflow crashes silently. User gets no response.
2. **Get Profile can return empty** — if user opened the form via forwarded link without doing /start in bot, they have no profile. Insert Case then fails on missing `user_id`.
3. **No try/catch** in Code Nodes — a runtime error (e.g., malformed AI response JSON) kills the entire workflow.
4. **Respond OK fires BEFORE document is ready** — user gets "your document is being generated" but if Google Docs fails, they never get the document and don't know why.
5. **Secrets in Global Config** — SUPABASE_SERVICE_KEY and ENCRYPTION_KEY are hardcoded in the JSON.

## Improvements for v7

### 1. Replace "Get Profile" with "Ensure Profile"

**File:** `n8n-templates/ensure-profile.js` (already written and tested)

**What it does:**
- Looks up `identities` by `provider=telegram` + `external_id=tg_user_id`
- If found → returns existing `user_id`
- If not → creates `profiles` row + `identities` row (with rollback on failure)
- Returns `{ user_id, _was_created, _external_id }`

**How to wire:**
1. Create Code Node "Ensure Profile" after "Get Service"
2. Paste contents of `ensure-profile.js` (from line `const SUPABASE_URL` onward)
3. In "Insert Case", change user_id to: `{{ $('Ensure Profile').first().json.user_id }}`
4. Delete old "Get Profile" node

### 2. Add Error Trigger → Telegram notification

Add an **Error Trigger** node that catches any unhandled error in the workflow and sends a Telegram message to the admin.

```
Error Trigger → Format Error → Send Admin Alert (Telegram)
```

**Format Error** (Code Node):
```javascript
const error = $json;
const msg = [
  '⚠️ Workflow error',
  `Node: ${error.node?.name || 'unknown'}`,
  `Error: ${error.message || JSON.stringify(error)}`,
  `Time: ${new Date().toISOString()}`,
].join('\n');
return [{ json: { text: msg } }];
```

### 3. Add try/catch to Build Document Code Node

The Build Document node parses AI Declension JSON — this can fail if AI returns malformed response. The current code already has a try/catch for parsing, but the template generation itself has no protection.

**Wrap the entire document building:**
```javascript
try {
  const document = buildDivorceDocument(answers, ai);
  return [{ json: { _content: document, _case_id: caseId } }];
} catch (e) {
  console.log('[Build] ❌ Document generation failed:', e.message);
  // Return a placeholder so user gets notified
  return [{ json: {
    _content: null,
    _case_id: caseId,
    _error: e.message,
  }}];
}
```

### 4. Add guard after Ensure Profile

Add an **IF** node after Ensure Profile:
- **true** (has user_id) → continue to Encrypt Data
- **false** (no user_id) → Respond with error

### 5. Add guard after Get Service

Add an **IF** node after Get Service:
- **true** (service found) → continue
- **false** (no service) → Respond with "service not found"

### 6. Split response: early OK + async document generation

Current flow sends "Respond OK" then generates document. Better approach:

```
                                    ┌→ Respond OK (immediate, "working on it...")
Insert Case → Prepare Declension → ┤
                                    └→ AI Declension → Build Document → ...
```

Actually, the current approach IS correct — Respond OK fires first, then document generation continues async. But we need to add error handling for the async part.

### 7. Improved Respond Error format

Current error response is bare. Improve to return structured JSON:

```javascript
// In Respond Error node, set response body to:
{
  "ok": false,
  "error": "{{ $('Validate').item.json._error }}",
  "message": "Невірний запит. Перевірте дані та спробуйте ще раз."
}
```

## File Index

| File | Purpose | Status |
|------|---------|--------|
| `n8n-templates/validate.js` | Validate webhook payload | ✅ Extracted + tested |
| `n8n-templates/ensure-profile.js` | Idempotent user creation | ✅ Written, not wired |
| `n8n-templates/divorce-document.js` | Divorce lawsuit template | ✅ Extracted + tested |
| `n8n-templates/shared/utils.js` | Shared helper functions | ✅ Tested |
| `n8n-templates/__tests__/validate.test.js` | 12 tests | ✅ Passing |
| `n8n-templates/__tests__/shared-utils.test.js` | 37 tests | ✅ Passing |
| `n8n-templates/__tests__/divorce-document.test.js` | 30 tests | ✅ Passing |

## Implementation Order

1. ✅ Extract Code Nodes into testable files
2. ✅ Write tests (79 tests passing)
3. 🔲 Wire Ensure Profile in n8n UI (replace Get Profile)
4. 🔲 Add Error Trigger → admin Telegram alert
5. 🔲 Add guard IF nodes after Get Service and Ensure Profile
6. 🔲 Add try/catch wrap in Build Document
7. 🔲 Export updated workflow as v7 JSON
