#!/usr/bin/env node
/**
 * Generates n8n workflow v6 JSON from the divorce-document.js template.
 * Embeds the template code into the "Build Document" Code Node.
 *
 * Usage: node scripts/build-n8n-workflow.mjs
 * Output: n8n-workflows/legal-ai-form-submit-v6-hybrid.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Read the divorce document template (only the function, not the test block)
const templateCode = readFileSync(join(ROOT, 'n8n-templates', 'divorce-document.js'), 'utf-8');
// Extract only the buildDivorceDocument function (before the test block)
const fnEnd = templateCode.indexOf('\n\n// ─── ШВИДКИЙ ТЕСТ');
const templateFn = fnEnd > 0 ? templateCode.slice(0, fnEnd) : templateCode;

// Read the declension prompt
const declensionPrompt = readFileSync(join(ROOT, 'prompts', 'divorce-declension-prompt.txt'), 'utf-8');

// ─── Node definitions ─────────────────────────────────────────────────────────

const nodes = [
  // ── Existing nodes (unchanged) ──────────────────────────────────────────────

  {
    parameters: {
      httpMethod: "POST",
      path: "form-submit",
      responseMode: "responseNode",
      options: {}
    },
    id: "webhook-001",
    name: "Webhook",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [-800, 1700],
    webhookId: "form-submit-webhook"
  },

  {
    parameters: {
      jsCode: `// ═══════════════════════════════════════════════════════
// GLOBAL CONFIG — заміна n8n Variables (Starter plan)
// ═══════════════════════════════════════════════════════
return [{ json: {
  SUPABASE_URL:         'https://nexkairsedqtczievxpa.supabase.co',
  SUPABASE_SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5leGthaXJzZWRxdGN6aWV2eHBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU2NDY0NCwiZXhwIjoyMDg4MTQwNjQ0fQ.Kz8gtwIWUvRKw-VHivkZBzf-Oz0R8WFJ6-Fpp8DA1HE',
  ENCRYPTION_KEY:       '6f4f4f78939579244cf59ef6d026daaba703b1070ac457fde4979092fb8440bb'
}}];`
    },
    id: "global-config-001",
    name: "Global Config",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [-800, 1500],
    notes: "⚙️ Ключі API. Starter plan не має Variables, тому тримаємо тут. GEMINI_API_KEY видалено — RAG не потрібен для hybrid підходу."
  },

  {
    parameters: {
      jsCode: `const body = $('Webhook').first().json.body;
const { service_slug, user_id, answers, consented_at } = body;

if (!user_id) return [{ json: { _valid: false, _error: 'missing user_id' } }];
if (!service_slug) return [{ json: { _valid: false, _error: 'missing service_slug' } }];
if (!answers || Object.keys(answers).length === 0) return [{ json: { _valid: false, _error: 'empty answers' } }];

return [{ json: {
  _valid: true,
  _user_id: String(user_id),
  _service_slug: service_slug,
  _answers: answers,
  _consented_at: consented_at || new Date().toISOString(),
  _submitted_at: new Date().toISOString()
}}];`
    },
    id: "validate-001",
    name: "Validate",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [-560, 1700]
  },

  {
    parameters: {
      conditions: {
        boolean: [{ value1: "={{ $json._valid }}", value2: true }]
      }
    },
    id: "valid-if-001",
    name: "Is Valid?",
    type: "n8n-nodes-base.if",
    typeVersion: 1,
    position: [-320, 1700]
  },

  {
    parameters: {
      operation: "getAll",
      tableId: "services",
      filters: {
        conditions: [{ keyName: "slug", condition: "eq", keyValue: "={{ $json._service_slug }}" }]
      }
    },
    id: "get-service-001",
    name: "Get Service",
    type: "n8n-nodes-base.supabase",
    typeVersion: 1,
    position: [-80, 1580],
    credentials: { supabaseApi: { id: "2hBYjVwFlJbTj7AK", name: "Supabase account" } }
  },

  {
    parameters: {
      operation: "getAll",
      tableId: "identities",
      filters: {
        conditions: [{ keyName: "external_id", condition: "eq", keyValue: "={{ $('Validate').item.json._user_id }}" }]
      }
    },
    id: "get-profile-001",
    name: "Get Profile",
    type: "n8n-nodes-base.supabase",
    typeVersion: 1,
    position: [160, 1580],
    credentials: { supabaseApi: { id: "2hBYjVwFlJbTj7AK", name: "Supabase account" } }
  },

  {
    parameters: {
      jsCode: `// ═══════════════════════════════════════════════════════
// Encrypt Data — AES-256-GCM шифрування PII перед збереженням
// Формат: v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
// ═══════════════════════════════════════════════════════
const crypto = require('crypto');

const key = Buffer.from($('Global Config').first().json.ENCRYPTION_KEY, 'hex');
const plaintext = JSON.stringify($('Validate').first().json._answers);

const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

let encrypted = cipher.update(plaintext, 'utf8', 'hex');
encrypted += cipher.final('hex');
const authTag = cipher.getAuthTag().toString('hex');

const result = 'v1:' + iv.toString('hex') + ':' + authTag + ':' + encrypted;
console.log('[Encrypt] Data encrypted, length:', result.length);

return [{ json: {
  _encrypted_data: result,
  _answers: $('Validate').first().json._answers
}}];`
    },
    id: "encrypt-data-001",
    name: "Encrypt Data",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [280, 1580],
    notes: "🔐 AES-256-GCM шифрування PII. Ключ в Global Config, дані в Supabase → взлом одного не розкриває інше."
  },

  {
    parameters: {
      tableId: "cases",
      fieldsUi: {
        fieldValues: [
          { fieldId: "user_id", fieldValue: "={{ $('Get Profile').first().json.user_id }}" },
          { fieldId: "service_id", fieldValue: "={{ $('Get Service').item.json.id }}" },
          { fieldId: "status", fieldValue: "submitted" },
          { fieldId: "encrypted_data", fieldValue: "={{ $('Encrypt Data').first().json._encrypted_data }}" },
          { fieldId: "consented_at", fieldValue: "={{ $('Validate').first().json._consented_at }}" },
          { fieldId: "expires_at", fieldValue: "={{ new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() }}" }
        ]
      }
    },
    id: "insert-case-001",
    name: "Insert Case",
    type: "n8n-nodes-base.supabase",
    typeVersion: 1,
    position: [400, 1580],
    credentials: { supabaseApi: { id: "2hBYjVwFlJbTj7AK", name: "Supabase account" } }
  },

  // ── NEW: Hybrid Template nodes ──────────────────────────────────────────────

  {
    parameters: {
      jsCode: buildPrepareDeclensionCode(declensionPrompt)
    },
    id: "prepare-declension-001",
    name: "Prepare Declension",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [640, 1580],
    notes: "Формує запит до Groq для відмінювання ПІБ, назв установ та дітей (6 полів). Промпт ~200 токенів."
  },

  {
    parameters: {
      method: "POST",
      url: "https://api.groq.com/openai/v1/chat/completions",
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: "Content-Type", value: "application/json" }]
      },
      sendBody: true,
      specifyBody: "json",
      jsonBody: "={{ JSON.stringify($json) }}",
      options: { timeout: 30000 }
    },
    id: "ai-declension-001",
    name: "AI Declension",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [880, 1580],
    credentials: { httpHeaderAuth: { id: "groq-http-auth", name: "Groq HTTP Auth" } },
    notes: "Groq API — лише відмінювання (6 полів JSON). ~200 токенів, температура 0."
  },

  {
    parameters: {
      jsCode: buildDocumentNodeCode(templateFn)
    },
    id: "build-doc-001",
    name: "Build Document",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [1120, 1580],
    notes: "JS шаблон — 95% документа детерміновано, 0% галюцинацій для даних. AI використовується тільки для відмінків."
  },

  // ── Existing nodes (continued) ──────────────────────────────────────────────

  {
    parameters: {
      chatId: "={{ $('Validate').item.json._user_id }}",
      text: "=✅ *Дякуємо! Дані отримано.*\n\n📋 Послуга: {{ $('Get Service').item.json.title }}\n🔢 Кейс №: {{ $('Insert Case').item.json.id }}\n\nДокумент готується... ⏳",
      additionalFields: { appendAttribution: false, parse_mode: "Markdown" }
    },
    id: "notify-user-001",
    name: "Notify User",
    type: "n8n-nodes-base.telegram",
    typeVersion: 1.2,
    position: [1360, 1580],
    credentials: { telegramApi: { id: "6OfTH9OBUuEgKALQ", name: "Telegram account" } }
  },

  {
    parameters: {
      respondWith: "json",
      responseBody: "={{ JSON.stringify({ success: true, case_id: $('Insert Case').item.json.id }) }}"
    },
    id: "respond-ok-001",
    name: "Respond OK",
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1,
    position: [1600, 1580]
  },

  {
    parameters: {
      method: "POST",
      url: "=https://www.googleapis.com/drive/v3/files/1KHtchwlBKlTNDnK8uH0uxpKOXc6V-69zPRTDHxny1xI/copy",
      authentication: "predefinedCredentialType",
      nodeCredentialType: "googleOAuth2Api",
      sendBody: true,
      specifyBody: "json",
      jsonBody: "={{ JSON.stringify({ name: 'Позовна заява — ' + $('Insert Case').item.json.id, parents: ['1mKnckHIFjhAH0MAzE073fqU4_6tZW5FI'] }) }}",
      options: {}
    },
    id: "copy-template-001",
    name: "Copy Template",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [1840, 1580],
    credentials: { googleOAuth2Api: { id: "google-oauth2-001", name: "Google OAuth2" } }
  },

  {
    parameters: {
      jsCode: `const content = $('Build Document').item.json._content;
const newDocId = $json.id;
return [{
  json: {
    _new_doc_id: newDocId,
    _new_doc_url: 'https://docs.google.com/document/d/' + newDocId + '/edit',
    _batch_request: {
      requests: [{
        replaceAllText: {
          containsText: { text: '{{DOCUMENT_CONTENT}}', matchCase: true },
          replaceText: content
        }
      }]
    }
  }
}];`
    },
    id: "build-replace-001",
    name: "Build Replace Request",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [2080, 1580]
  },

  {
    parameters: {
      method: "POST",
      url: "=https://docs.googleapis.com/v1/documents/{{ $json._new_doc_id }}:batchUpdate",
      authentication: "predefinedCredentialType",
      nodeCredentialType: "googleOAuth2Api",
      sendBody: true,
      specifyBody: "json",
      jsonBody: "={{ JSON.stringify($json._batch_request) }}",
      options: {}
    },
    id: "replace-text-001",
    name: "Replace Placeholder",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [2320, 1580],
    credentials: { googleOAuth2Api: { id: "google-oauth2-001", name: "Google OAuth2" } }
  },

  {
    parameters: {
      method: "POST",
      url: "=https://www.googleapis.com/drive/v3/files/{{ $('Build Replace Request').item.json._new_doc_id }}/permissions",
      authentication: "predefinedCredentialType",
      nodeCredentialType: "googleOAuth2Api",
      sendBody: true,
      specifyBody: "json",
      jsonBody: "={{ JSON.stringify({ type: 'anyone', role: 'reader' }) }}",
      options: {}
    },
    id: "share-doc-001",
    name: "Share Document",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [2560, 1580],
    credentials: { googleOAuth2Api: { id: "google-oauth2-001", name: "Google OAuth2" } }
  },

  {
    parameters: {
      chatId: "={{ $('Validate').item.json._user_id }}",
      text: `=📄 <b>Ваша позовна заява готова!</b>\n\n👇 Відкрийте, перегляньте та завантажте як PDF:\n{{ $('Build Replace Request').item.json._new_doc_url }}\n\n💡 <i>Файл → Завантажити → PDF</i> для друку та подачі до суду.`,
      additionalFields: { appendAttribution: false, parse_mode: "HTML" }
    },
    id: "send-link-001",
    name: "Send Doc Link",
    type: "n8n-nodes-base.telegram",
    typeVersion: 1.2,
    position: [2800, 1580],
    credentials: { telegramApi: { id: "6OfTH9OBUuEgKALQ", name: "Telegram account" } }
  },

  {
    parameters: {
      respondWith: "json",
      responseBody: "={{ JSON.stringify({ success: false, error: $('Validate').item.json._error }) }}",
      options: { responseCode: 400 }
    },
    id: "respond-err-001",
    name: "Respond Error",
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1,
    position: [-80, 1880]
  }
];

const connections = {
  "Webhook":              { main: [[{ node: "Global Config", type: "main", index: 0 }]] },
  "Global Config":        { main: [[{ node: "Validate", type: "main", index: 0 }]] },
  "Validate":             { main: [[{ node: "Is Valid?", type: "main", index: 0 }]] },
  "Is Valid?":            { main: [
    [{ node: "Get Service", type: "main", index: 0 }],
    [{ node: "Respond Error", type: "main", index: 0 }]
  ]},
  "Get Service":          { main: [[{ node: "Get Profile", type: "main", index: 0 }]] },
  "Get Profile":          { main: [[{ node: "Encrypt Data", type: "main", index: 0 }]] },
  "Encrypt Data":         { main: [[{ node: "Insert Case", type: "main", index: 0 }]] },
  "Insert Case":          { main: [[{ node: "Prepare Declension", type: "main", index: 0 }]] },
  "Prepare Declension":   { main: [[{ node: "AI Declension", type: "main", index: 0 }]] },
  "AI Declension":        { main: [[{ node: "Build Document", type: "main", index: 0 }]] },
  "Build Document":       { main: [[{ node: "Notify User", type: "main", index: 0 }]] },
  "Notify User":          { main: [[{ node: "Respond OK", type: "main", index: 0 }]] },
  "Respond OK":           { main: [[{ node: "Copy Template", type: "main", index: 0 }]] },
  "Copy Template":        { main: [[{ node: "Build Replace Request", type: "main", index: 0 }]] },
  "Build Replace Request":{ main: [[{ node: "Replace Placeholder", type: "main", index: 0 }]] },
  "Replace Placeholder":  { main: [[{ node: "Share Document", type: "main", index: 0 }]] },
  "Share Document":       { main: [[{ node: "Send Doc Link", type: "main", index: 0 }]] }
};

const workflow = {
  name: "Legal AI — Form Submit v6 (Hybrid Template)",
  nodes,
  connections,
  active: false,
  settings: { executionOrder: "v1" },
  tags: ["hybrid", "v6"]
};

// ─── Helper: build "Prepare Declension" Code Node ─────────────────────────────

function buildPrepareDeclensionCode(promptTemplate) {
  return `// ═══════════════════════════════════════════════════════
// Prepare Declension — маленький запит до Groq
// Тільки відмінювання ПІБ, установ та дітей (6 полів JSON)
// ═══════════════════════════════════════════════════════
const answers = $('Validate').item.json._answers || {};

const plaintiffName = [answers.last_name, answers.first_name, answers.middle_name].filter(Boolean).join(' ');
const spouseName = [answers.spouse_last_name, answers.spouse_first_name, answers.spouse_middle_name].filter(Boolean).join(' ');

let prompt = ${JSON.stringify(promptTemplate)};

// Підставляємо реальні дані в промпт
prompt = prompt.replace('{{plaintiff_full_name}}', plaintiffName);
prompt = prompt.replace('{{spouse_full_name}}', spouseName);
prompt = prompt.replace('{{marriage_place}}', answers.marriage_place || '________');

// Діти (умовний блок)
if (answers.has_children && answers.children_details) {
  prompt = prompt.replace('{{#if children_details}}', '');
  prompt = prompt.replace('{{/if}}', '');
  prompt = prompt.replace('{{children_details}}', String(answers.children_details).replace(/\\n/g, '; '));
} else {
  // Видаляємо блок дітей
  prompt = prompt.replace(/\\{\\{#if children_details\\}\\}.*?\\{\\{\\/if\\}\\}/s, '');
}

console.log('[Declension] Plaintiff:', plaintiffName);
console.log('[Declension] Spouse:', spouseName);
console.log('[Declension] Has children:', !!answers.children_details);

return [{ json: {
  model: 'llama-3.3-70b-versatile',
  max_tokens: 300,
  temperature: 0,
  messages: [
    { role: 'system', content: prompt },
    { role: 'user', content: 'Відміни вказані дані. Поверни ТІЛЬКИ JSON.' }
  ]
}}];`;
}

// ─── Helper: build "Build Document" Code Node ─────────────────────────────────

function buildDocumentNodeCode(templateFunction) {
  return `// ═══════════════════════════════════════════════════════
// Build Document — JS шаблон позовної заяви
// 95% документа детерміновано (адреси, дати, ІПН, статті)
// AI використовується тільки для 6 відмінкових форм
// ═══════════════════════════════════════════════════════

// 1. Парсимо відповідь AI Declension
let ai = {};
try {
  const raw = $('AI Declension').item.json?.choices?.[0]?.message?.content || '{}';
  // Видаляємо markdown code block якщо є
  const cleaned = raw.replace(/\`\`\`json?\\n?/g, '').replace(/\`\`\`/g, '').trim();
  ai = JSON.parse(cleaned);
  console.log('[Build] AI declension parsed OK:', Object.keys(ai).join(', '));
} catch (e) {
  console.log('[Build] ⚠️ AI declension parse failed, using fallbacks:', e.message);
}

// 2. Отримуємо дані з форми
const answers = $('Validate').item.json._answers || {};
const caseId = $('Insert Case').item.json.id;

// 3. Шаблон документа
${templateFunction}

// 4. Генеруємо документ
const document = buildDivorceDocument(answers, ai);
console.log('[Build] Document generated:', document.length, 'chars');

// 5. Виводимо
return [{ json: { _content: document, _case_id: caseId } }];`;
}

// ─── Write output ─────────────────────────────────────────────────────────────

const outPath = join(ROOT, 'n8n-workflows', 'legal-ai-form-submit-v6-hybrid.json');
writeFileSync(outPath, JSON.stringify(workflow, null, 2), 'utf-8');
console.log(`✅ Workflow v6 written to: ${outPath}`);
console.log(`   Nodes: ${nodes.length}`);
console.log(`   Removed: Build RAG Query, Get Gemini Embedding, Search Law Chunks, Prepare Doc Request, Generate Document, Prepare Content`);
console.log(`   Added: Prepare Declension, AI Declension, Build Document`);
console.log(`   Changed: Global Config (removed GEMINI_API_KEY), Build Replace Request (reads from Build Document), Send Doc Link (HTML parse_mode)`);
