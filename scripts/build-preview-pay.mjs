/**
 * build-preview-pay.mjs — generate the `preview-pay` n8n workflow JSON.
 *
 * G4 of specs/features/preview-module/ (Tier 2, locked at the session-55 interview).
 * The monetisation seam: after the TWA shows a safe preview, the user taps «Оплатити»
 * → POST { case_id, init_data, deliver_to_bot? } here → the workflow verifies the
 * Telegram initData HMAC, confirms ownership + that a full document is parked in the
 * PRIVATE `generated-documents` bucket, flips the case to `paid`, and mints a short-
 * lived signed URL so the client can download the document. Real money is NOT taken
 * this iteration — the «pay» step is a server-verified flip with a clean seam for a
 * future Telegram-Payments node (requirements §5, invariant 5).
 *
 *   Webhook (POST /webhook/preview-pay, responseNode)
 *     → Global Config (SUPABASE_URL/SERVICE_KEY, TELEGRAM_BOT_TOKEN, bucket, TTL)
 *     → Verify initData   (reuse #56 HMAC; resolves the Telegram user id, fail-closed)
 *     → Is Verified?  ─false→ Respond Error (4xx, never touches the case)
 *     → Get Case          (Supabase REST, by id)
 *     → Assert & Decide   (owner == telegram id; status ∈ {preview_ready,paid} AND
 *                          doc_storage_path set; else _ok=false → 4xx, paid UNTOUCHED)
 *     → Is Ready?     ─false→ Respond Error (4xx, friendly «технічні труднощі»)
 *     → Set Paid          (PATCH paid=true,status='paid'; paid_at ONLY on first flip)
 *     → Mint Signed URL   (Storage createSignedUrl on doc_storage_path, TTL 24h)
 *     → Build Response     (assemble absolute signed URL + expires_at)
 *     → Send to bot?  ─true→ Send PDF (Telegram sendDocument by URL) → Respond OK
 *                     ─false→ Respond OK   ({ signed_url, expires_at })
 *
 * INVARIANTS (requirements.md §0, §5):
 *   - Never flip `paid` without a ready document: the flip lives strictly on the
 *     Is Ready? = true branch; every business rejection returns 4xx with `paid` intact.
 *   - Idempotent: a second pay on an already-`paid` case re-mints the URL and does NOT
 *     overwrite `paid_at` (no double charge once a real payment node lands).
 *   - GDPR (invariant 7): bot delivery is OPT-IN — Send PDF only fires when the request
 *     carries `deliver_to_bot === true`; the primary channel is the signed URL in the TWA.
 *
 * Anti-drift: the initData verifier is inlined from its single source of truth —
 *   n8n/templates/verify-init-data.js   (reused verbatim, exports stripped)
 * Re-run this script after editing it, then deploy.
 *
 * SAFETY / honesty:
 *   - No n8n credentials: every secret is read from Global Config via expression
 *     (apikey / Authorization: Bearer {{SUPABASE_SERVICE_KEY}}; bot token for the opt-in
 *     delivery). The committed JSON keeps only YOUR_* placeholders; deploy-workflow.mjs
 *     injects the real keys in memory and POSTs/PUTs — fully self-contained.
 *   - Degrade ≥ today: a not-ready / not-owned / unsigned request is a clean 4xx, never
 *     a raw 500 and never a silent paid-flip.
 *
 * Usage:  node scripts/build-preview-pay.mjs [--check]
 *           --check   exit 1 if the generated JSON differs from the committed file (CI guard)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outPath = resolve(repoRoot, 'n8n/workflows/current/preview-pay.json');
const checkOnly = process.argv.includes('--check');

const read = (p) => readFileSync(resolve(repoRoot, p), 'utf8').replace(/\r\n/g, '\n');

// ─── SSoT: the initData verifier (inlined; exports tail stripped) ─────────────
const INIT_DATA_SRC = read('n8n/templates/verify-init-data.js')
  .replace(/\/\/ ── Exports[\s\S]*$/m, '')
  .trim();

// ─── Global Config (mirror form-submit; only the keys this workflow needs) ────
const GLOBAL_CONFIG_CODE = [
  '// ═══════════════════════════════════════════════════════',
  '// GLOBAL CONFIG — preview-pay. Keys injected by scripts/deploy-workflow.mjs.',
  '// ═══════════════════════════════════════════════════════',
  'return [{ json: {',
  "  SUPABASE_URL:         'https://nexkairsedqtczievxpa.supabase.co',",
  "  SUPABASE_SERVICE_KEY: 'YOUR_SUPABASE_SERVICE_ROLE_KEY',",
  "  // #56 — verifies the Telegram WebApp initData signature (reused from form-submit).",
  "  TELEGRAM_BOT_TOKEN:   'YOUR_TELEGRAM_BOT_TOKEN',",
  "  // #56 dev/web-fallback escape hatch, OFF in prod. Flip to 'true' locally only.",
  "  ALLOW_UNVERIFIED_UID: 'false',",
  "  // Private bucket holding the full PDF (migration 029, service-role only).",
  "  BUCKET:               'generated-documents',",
  "  // Signed-URL TTL (A3 = 24h). Re-mint allowed while the case is alive.",
  "  SIGNED_URL_TTL:       '86400',",
  '}}];',
].join('\n');

// ─── Verify initData (Code) — reuse #56, resolve Telegram user id, fail-closed ─
const VERIFY_CODE = [
  '// ═══════════════════════════════════════════════════════',
  '// Verify initData — GENERATED by scripts/build-preview-pay.mjs',
  '// Edit n8n/templates/verify-init-data.js and re-run this script.',
  '// ═══════════════════════════════════════════════════════',
  '',
  '// initData HMAC verification (mirror: n8n/templates/verify-init-data.js)',
  INIT_DATA_SRC,
  '',
  '// n8n entry point:',
  'const body = $(\'Webhook\').first().json.body || {};',
  'const { case_id, user_id, init_data, deliver_to_bot } = body;',
  '',
  'if (!case_id) {',
  "  return [{ json: { _ok: false, _error: 'missing_case_id' } }];",
  '}',
  '',
  'const botToken = $(\'Global Config\').first().json.TELEGRAM_BOT_TOKEN;',
  "const allowUnverified = $('Global Config').first().json.ALLOW_UNVERIFIED_UID === 'true';",
  'const resolution = resolveSubmission(init_data, user_id, botToken, { allowUnverified });',
  'if (!resolution.ok) {',
  "  console.log('[preview-pay] auth rejected:', resolution.error, resolution.reason || '');",
  '  return [{ json: { _ok: false, _error: resolution.error, _reason: resolution.reason || null } }];',
  '}',
  '',
  'return [{ json: {',
  '  _ok: true,',
  '  _user_id: resolution.userId,',
  '  _case_id: String(case_id),',
  '  _deliver_to_bot: deliver_to_bot === true,',
  '} }];',
].join('\n');

// ─── Assert & Decide (Code) — owner + ready gate; build idempotent PATCH body ──
const ASSERT_CODE = [
  '// ═══════════════════════════════════════════════════════',
  '// Assert & Decide — GENERATED by scripts/build-preview-pay.mjs',
  '// Owner + ready gate. NEVER returns _ok:true unless a full document exists and the',
  '// caller owns the case; the paid-flip downstream is reachable ONLY via _ok:true.',
  '// ═══════════════════════════════════════════════════════',
  '',
  "const ctx = $('Verify initData').first().json;",
  "const rows = $('Get Case').all().map((i) => i.json).filter((r) => r && r.id != null);",
  'const c = rows[0] || null;',
  'const nowIso = new Date().toISOString();',
  '',
  '// Resolve the verified Telegram id → profile UUID via the identities table',
  '// (form-submit stores cases.user_id = identities.user_id, NOT the raw telegram id).',
  "const idents = $('Get Identity').all().map((i) => i.json).filter((r) => r && r.user_id);",
  'const ownerUuid = idents[0] ? idents[0].user_id : null;',
  '',
  '// Case must exist.',
  'if (!c) {',
  "  return [{ json: { _ok: false, _error: 'case_not_found' } }];",
  '}',
  '// Owner check: the verified Telegram id must resolve to the profile that owns the case.',
  'if (!ownerUuid || String(c.user_id) !== String(ownerUuid)) {',
  "  return [{ json: { _ok: false, _error: 'not_owner' } }];",
  '}',
  '// Ready check: a full document must be parked AND status must allow payment.',
  "// generating / failed / missing doc_storage_path → refuse, paid stays false.",
  "const ready = !!c.doc_storage_path && (c.status === 'preview_ready' || c.status === 'paid');",
  'if (!ready) {',
  "  return [{ json: { _ok: false, _error: 'not_ready', _status: c.status || null } }];",
  '}',
  '',
  '// Idempotent flip: never overwrite paid_at on an already-paid case (re-mint only).',
  'const alreadyPaid = c.paid === true;',
  'const patch = alreadyPaid',
  "  ? { paid: true, status: 'paid' }",
  "  : { paid: true, status: 'paid', paid_at: nowIso };",
  '',
  'return [{ json: {',
  '  _ok: true,',
  '  _case_id: String(c.id),',
  '  _storage_path: c.doc_storage_path,',
  '  _user_id: String(ctx._user_id),',
  '  _deliver: ctx._deliver_to_bot === true,',
  '  _already_paid: alreadyPaid,',
  '  _patch_body: patch,',
  '} }];',
].join('\n');

// ─── Build Response (Code) — assemble absolute signed URL + expires_at ─────────
const BUILD_RESPONSE_CODE = [
  '// ═══════════════════════════════════════════════════════',
  '// Build Response — GENERATED by scripts/build-preview-pay.mjs',
  '// ═══════════════════════════════════════════════════════',
  '',
  "const gc = $('Global Config').first().json;",
  "const a = $('Assert & Decide').first().json;",
  '// Supabase sign endpoint returns { signedURL: "/object/sign/<bucket>/<path>?token=…" }.',
  'const signed = $json.signedURL || ($json.body && $json.body.signedURL) || null;',
  'const ttl = Number(gc.SIGNED_URL_TTL) || 86400;',
  '',
  'return [{ json: {',
  "  _signed_url: signed ? gc.SUPABASE_URL + '/storage/v1' + signed : null,",
  '  _expires_at: new Date(Date.now() + ttl * 1000).toISOString(),',
  '  _deliver: a._deliver === true,',
  '  _user_id: a._user_id,',
  '} }];',
].join('\n');

// ─── Supabase REST header helper ──────────────────────────────────────────────
const SB_KEY = "={{ $('Global Config').first().json.SUPABASE_SERVICE_KEY }}";
const SB_AUTH = "={{ 'Bearer ' + $('Global Config').first().json.SUPABASE_SERVICE_KEY }}";
const sbHeaders = (extra = []) => ({
  parameters: [
    { name: 'apikey', value: SB_KEY },
    { name: 'Authorization', value: SB_AUTH },
    ...extra,
  ],
});

// ─── IF condition helper (boolean: $json._ok === true) ────────────────────────
const ifBool = (expr) => ({
  conditions: { boolean: [{ value1: expr, value2: true }] },
});

// ─── Nodes ────────────────────────────────────────────────────────────────────
const nodes = [
  {
    id: 'webhook-001',
    name: 'Webhook',
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2,
    position: [-820, 700],
    webhookId: 'preview-pay-webhook',
    parameters: { httpMethod: 'POST', path: 'preview-pay', responseMode: 'responseNode', options: {} },
  },
  {
    id: 'global-config-001',
    name: 'Global Config',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-600, 700],
    parameters: { jsCode: GLOBAL_CONFIG_CODE },
    notes: '⚙️ Keys + bucket + signed-URL TTL. deploy-workflow.mjs injects real keys (Starter plan has no Variables).',
  },
  {
    id: 'verify-init-data-001',
    name: 'Verify initData',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-380, 700],
    parameters: { jsCode: VERIFY_CODE },
    notes: '#56 fail-closed HMAC. Resolves the Telegram user id from the signature, never from the request body.',
  },
  {
    id: 'is-verified-001',
    name: 'Is Verified?',
    type: 'n8n-nodes-base.if',
    typeVersion: 1,
    position: [-160, 700],
    parameters: ifBool('={{ $json._ok }}'),
  },
  {
    id: 'get-identity-001',
    name: 'Get Identity',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [60, 480],
    alwaysOutputData: true,
    parameters: {
      method: 'GET',
      url: "={{ $('Global Config').first().json.SUPABASE_URL + '/rest/v1/identities?external_id=eq.' + $('Verify initData').first().json._user_id + '&select=user_id' }}",
      sendHeaders: true,
      headerParameters: sbHeaders(),
      options: { timeout: 15000 },
    },
    notes: 'Resolve telegram id → profile UUID (mirror form-submit Get Profile). cases.user_id holds this UUID, not the raw telegram id. Empty → Assert returns not_owner.',
  },
  {
    id: 'get-case-001',
    name: 'Get Case',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [280, 600],
    alwaysOutputData: true,
    parameters: {
      method: 'GET',
      url: "={{ $('Global Config').first().json.SUPABASE_URL + '/rest/v1/cases?id=eq.' + $('Verify initData').first().json._case_id + '&select=id,user_id,status,paid,paid_at,doc_storage_path' }}",
      sendHeaders: true,
      headerParameters: sbHeaders(),
      options: { timeout: 15000 },
    },
    notes: 'Load the case by id (service-role). alwaysOutputData → empty result still passes one item so Assert can return case_not_found.',
  },
  {
    id: 'assert-decide-001',
    name: 'Assert & Decide',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [280, 600],
    parameters: { jsCode: ASSERT_CODE },
    notes: 'Owner + ready gate. _ok:false on any failure → 4xx, paid untouched. Builds the idempotent PATCH body.',
  },
  {
    id: 'is-ready-001',
    name: 'Is Ready?',
    type: 'n8n-nodes-base.if',
    typeVersion: 1,
    position: [500, 600],
    parameters: ifBool('={{ $json._ok }}'),
  },
  {
    id: 'set-paid-001',
    name: 'Set Paid',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [720, 500],
    parameters: {
      method: 'PATCH',
      url: "={{ $('Global Config').first().json.SUPABASE_URL + '/rest/v1/cases?id=eq.' + $json._case_id }}",
      sendHeaders: true,
      headerParameters: sbHeaders([
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Prefer', value: 'return=minimal' },
      ]),
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json._patch_body) }}',
      options: { timeout: 15000 },
    },
    notes: 'Flip paid=true,status=paid. paid_at written ONLY on the first flip (idempotent re-mint preserves it).',
  },
  {
    id: 'mint-signed-url-001',
    name: 'Mint Signed URL',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [940, 500],
    parameters: {
      method: 'POST',
      url: "={{ $('Global Config').first().json.SUPABASE_URL + '/storage/v1/object/sign/' + $('Global Config').first().json.BUCKET + '/' + $('Assert & Decide').first().json._storage_path }}",
      sendHeaders: true,
      headerParameters: sbHeaders([{ name: 'Content-Type', value: 'application/json' }]),
      sendBody: true,
      specifyBody: 'json',
      jsonBody: "={{ JSON.stringify({ expiresIn: Number($('Global Config').first().json.SIGNED_URL_TTL) }) }}",
      options: { timeout: 15000 },
    },
    notes: 'Server-side signed URL on the private bucket (service-role). TTL 24h (A3). Client never sees the storage key.',
  },
  {
    id: 'build-response-001',
    name: 'Build Response',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1160, 500],
    parameters: { jsCode: BUILD_RESPONSE_CODE },
    notes: 'Assemble absolute signed URL + expires_at; carry the opt-in delivery flag.',
  },
  {
    id: 'send-to-bot-001',
    name: 'Send to bot?',
    type: 'n8n-nodes-base.if',
    typeVersion: 1,
    position: [1380, 500],
    parameters: ifBool('={{ $json._deliver }}'),
    notes: 'GDPR opt-in (invariant 7): true ONLY when the request carried deliver_to_bot===true. Default path skips the bot.',
  },
  {
    id: 'send-pdf-001',
    name: 'Send PDF',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [1600, 400],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: "={{ 'https://api.telegram.org/bot' + $('Global Config').first().json.TELEGRAM_BOT_TOKEN + '/sendDocument' }}",
      sendBody: true,
      specifyBody: 'json',
      jsonBody:
        "={{ JSON.stringify({ chat_id: $('Build Response').first().json._user_id, document: $('Build Response').first().json._signed_url, caption: 'Ваш документ готовий ✅' }) }}",
      options: { timeout: 30000 },
    },
    notes: 'Opt-in bot delivery: Telegram fetches the signed URL itself (no binary handling). onError=continue so a Telegram hiccup still returns the URL.',
  },
  {
    id: 'respond-ok-001',
    name: 'Respond OK',
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1,
    position: [1820, 500],
    parameters: {
      respondWith: 'json',
      responseBody:
        "={{ JSON.stringify({ success: true, signed_url: $('Build Response').first().json._signed_url, expires_at: $('Build Response').first().json._expires_at }) }}",
    },
  },
  {
    id: 'respond-error-001',
    name: 'Respond Error',
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1,
    position: [500, 860],
    parameters: {
      respondWith: 'json',
      responseBody:
        "={{ JSON.stringify({ success: false, error: $json._error, reason: $json._reason || null, message: 'Технічні труднощі. Спробуйте, будь ласка, пізніше.' }) }}",
      options: { responseCode: 422 },
    },
    notes: 'Single 4xx for every business rejection (auth / not-owner / not-ready). paid is NEVER flipped on this path.',
  },
];

// ─── Connections ──────────────────────────────────────────────────────────────
// Linear spine + exclusive IF branches (no sibling fan-out → no depth-first clobber).
const connections = {
  'Webhook': { main: [[{ node: 'Global Config', type: 'main', index: 0 }]] },
  'Global Config': { main: [[{ node: 'Verify initData', type: 'main', index: 0 }]] },
  'Verify initData': { main: [[{ node: 'Is Verified?', type: 'main', index: 0 }]] },
  'Is Verified?': {
    main: [
      [{ node: 'Get Identity', type: 'main', index: 0 }],
      [{ node: 'Respond Error', type: 'main', index: 0 }],
    ],
  },
  'Get Identity': { main: [[{ node: 'Get Case', type: 'main', index: 0 }]] },
  'Get Case': { main: [[{ node: 'Assert & Decide', type: 'main', index: 0 }]] },
  'Assert & Decide': { main: [[{ node: 'Is Ready?', type: 'main', index: 0 }]] },
  'Is Ready?': {
    main: [
      [{ node: 'Set Paid', type: 'main', index: 0 }],
      [{ node: 'Respond Error', type: 'main', index: 0 }],
    ],
  },
  'Set Paid': { main: [[{ node: 'Mint Signed URL', type: 'main', index: 0 }]] },
  'Mint Signed URL': { main: [[{ node: 'Build Response', type: 'main', index: 0 }]] },
  'Build Response': { main: [[{ node: 'Send to bot?', type: 'main', index: 0 }]] },
  'Send to bot?': {
    main: [
      [{ node: 'Send PDF', type: 'main', index: 0 }],
      [{ node: 'Respond OK', type: 'main', index: 0 }],
    ],
  },
  'Send PDF': { main: [[{ node: 'Respond OK', type: 'main', index: 0 }]] },
};

const workflow = {
  name: 'preview-pay',
  nodes,
  connections,
  settings: { executionOrder: 'v1' },
};

// ─── Connection-integrity guard (every target node exists) ────────────────────
const nodeNames = new Set(nodes.map((n) => n.name));
const danglers = [];
for (const [from, conn] of Object.entries(connections)) {
  if (!nodeNames.has(from)) danglers.push(`source "${from}" is not a node`);
  for (const out of conn.main || []) {
    for (const c of out || []) {
      if (!nodeNames.has(c.node)) danglers.push(`"${from}" → "${c.node}" (target missing)`);
    }
  }
}
if (danglers.length) {
  console.error('❌ Connection integrity failed:\n  ' + danglers.join('\n  '));
  process.exit(1);
}

// ─── Secret guard: only YOUR_* placeholders may be committed ──────────────────
const serialized = JSON.stringify(workflow);
if (/eyJ[A-Za-z0-9_-]{20,}/.test(serialized) || /\d{8,}:[A-Za-z0-9_-]{30,}/.test(serialized)) {
  console.error('❌ a secret-looking token (JWT / bot token) is present — aborting.');
  process.exit(1);
}

const json = JSON.stringify(workflow, null, 2) + '\n';

if (checkOnly) {
  const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
  if (current !== json) {
    console.error('❌ preview-pay.json is stale. Run: node scripts/build-preview-pay.mjs');
    process.exit(1);
  }
  console.log('✅ preview-pay.json is in sync with its sources.');
  process.exit(0);
}

writeFileSync(outPath, json, 'utf8');
console.log(`✅ Wrote ${outPath}`);
console.log(`   ${nodes.length} nodes, ${Object.keys(connections).length} connection sources, integrity OK.`);
console.log('   Next: node scripts/deploy-workflow.mjs preview-pay --create   (first time → prints new workflow id)');
