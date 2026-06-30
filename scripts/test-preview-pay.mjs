#!/usr/bin/env node
// =============================================================
// Live smoke for the preview-pay workflow (#83 G4).
// Drives the FULL monetisation seam end-to-end on ONE fresh case:
//   1. form-submit (scenario 4) → case_id (status=generating)
//   2. NOT-READY  : pay while still generating → expect 4xx, paid stays false
//   3. WRONG-OWNER: pay with a different signed user → expect 4xx (not_owner)
//   4. poll Supabase until status=preview_ready + doc_storage_path
//   5. HAPPY      : pay → 200 { signed_url, expires_at }; GET url → %PDF; case paid=true
//   6. RE-MINT    : pay again → 200 new url; paid_at UNCHANGED (idempotent)
//
// Needs Docker n8n + ngrok up. Reads secrets from apps/client/.env.local.
// Usage: node scripts/test-preview-pay.mjs
// =============================================================

import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = process.env.N8N_BASE_URL || 'http://localhost:5678'
const FORM_SUBMIT = `${BASE}/webhook/form-submit`
const PREVIEW_PAY = `${BASE}/webhook/preview-pay`
const SUPABASE_URL = 'https://nexkairsedqtczievxpa.supabase.co'
const OWNER_ID = '236581343'
const STRANGER_ID = '999000111'

function env(key) {
  const txt = readFileSync(resolve(__dirname, '../apps/client/.env.local'), 'utf8')
  const m = txt.match(new RegExp(`^${key}=(.*)$`, 'm'))
  if (!m) throw new Error(`${key} not found in apps/client/.env.local`)
  return m[1].trim()
}
const BOT_TOKEN = env('TELEGRAM_BOT_TOKEN')
const SERVICE_KEY = env('SUPABASE_SERVICE_KEY')

// Forge a valid Telegram WebApp initData (mirror verify-init-data.js).
function signInitData(userId) {
  const user = JSON.stringify({ id: Number(userId), first_name: 'Serhii', language_code: 'uk' })
  const authDate = Math.floor(Date.now() / 1000)
  const dcs = [`auth_date=${authDate}`, `user=${user}`].sort().join('\n')
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const hash = crypto.createHmac('sha256', secretKey).update(dcs).digest('hex')
  return `user=${encodeURIComponent(user)}&auth_date=${authDate}&hash=${hash}`
}

async function getCase(id) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/cases?id=eq.${id}&select=id,user_id,status,paid,paid_at,doc_storage_path`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  )
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : null
}

const minimalForm = {
  service_slug: 'divorce',
  user_id: OWNER_ID,
  answers: {
    last_name: 'Превʼютенко', first_name: 'Павло', middle_name: 'Тестович',
    birth_date: '1990-01-01',
    registered_address: 'м. Київ, вул. Тестова, 1, кв. 1',
    spouse_last_name: 'Превʼютенко', spouse_first_name: 'Іван',
    spouse_registered_address: 'м. Київ, вул. Тестова, 2, кв. 3',
    marriage_date: '2020-06-01',
    marriage_place: 'Відділ РАЦС Шевченківського району м. Києва',
    spouse_consents: true, has_children: false,
    divorce_reasons: ['lost_feelings', 'incompatibility'],
    joint_household: 'no', simplified_proceedings: 'yes',
    court_costs_on: 'defendant', pretrial_settlement: 'none',
    evidence_preservation: 'none', originals_location: 'plaintiff',
    no_other_lawsuits: true,
  },
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const ok = (label, cond, detail = '') => {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? '  — ' + detail : ''}`)
  if (!cond) failures++
}

async function pay(caseId, userId, extra = {}) {
  const res = await fetch(PREVIEW_PAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ case_id: caseId, init_data: signInitData(userId), ...extra }),
  })
  let body
  try { body = JSON.parse(await res.text()) } catch { body = null }
  return { status: res.status, body }
}

async function main() {
  console.log('— preview-pay live smoke —\n')

  // 1) Create a fresh case via form-submit (early response → case_id, status=generating).
  const fs = await fetch(FORM_SUBMIT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ ...minimalForm, init_data: signInitData(OWNER_ID) }),
  })
  const fsBody = JSON.parse(await fs.text())
  const caseId = fsBody.case_id
  ok('form-submit created a case', !!caseId, `case_id=${caseId} status=${fsBody.status}`)
  if (!caseId) return

  // 2) NOT-READY: pay before the async tail uploads the PDF → must refuse, paid stays false.
  const notReady = await pay(caseId, OWNER_ID)
  ok('not-ready pay → 4xx', notReady.status >= 400 && notReady.status < 500,
    `http=${notReady.status} error=${notReady.body?.error}`)
  const afterNotReady = await getCase(caseId)
  ok('not-ready pay did NOT flip paid', afterNotReady?.paid === false, `paid=${afterNotReady?.paid}`)

  // 3) WRONG-OWNER: a different signed user must not be able to pay for this case.
  const stranger = await pay(caseId, STRANGER_ID)
  ok('wrong-owner pay → 4xx', stranger.status >= 400 && stranger.status < 500,
    `http=${stranger.status} error=${stranger.body?.error}`)

  // 4) Poll until the tail finishes (status=preview_ready + doc parked).
  let row = null
  for (let i = 0; i < 45; i++) {
    row = await getCase(caseId)
    if (row && row.doc_storage_path && (row.status === 'preview_ready' || row.status === 'paid')) break
    if (row && row.status === 'failed') break
    await sleep(2000)
  }
  ok('case reached preview_ready with doc', row?.status === 'preview_ready' && !!row?.doc_storage_path,
    `status=${row?.status} doc=${row?.doc_storage_path}`)
  if (row?.status !== 'preview_ready') {
    console.log('\n⚠️  Tail did not complete — aborting payment tests. Check n8n executions.')
    return
  }

  // 5) HAPPY: pay → 200 { signed_url, expires_at }; the URL must download a real PDF.
  const happy = await pay(caseId, OWNER_ID)
  ok('happy pay → 200', happy.status === 200, `http=${happy.status}`)
  ok('response carries signed_url + expires_at', !!happy.body?.signed_url && !!happy.body?.expires_at,
    `expires_at=${happy.body?.expires_at}`)
  if (happy.body?.signed_url) {
    const dl = await fetch(happy.body.signed_url)
    const buf = Buffer.from(await dl.arrayBuffer())
    const isPdf = buf.slice(0, 5).toString('latin1') === '%PDF-'
    ok('signed_url downloads a PDF', dl.status === 200 && isPdf,
      `http=${dl.status} bytes=${buf.length} head=${buf.slice(0, 5).toString('latin1')}`)
  }
  const paidRow = await getCase(caseId)
  ok('case flipped to paid', paidRow?.paid === true && paidRow?.status === 'paid',
    `paid=${paidRow?.paid} status=${paidRow?.status} paid_at=${paidRow?.paid_at}`)
  const firstPaidAt = paidRow?.paid_at

  // 6) RE-MINT: pay again → 200, fresh URL, but paid_at must NOT change (idempotent).
  await sleep(1100) // ensure a later wall-clock so a buggy overwrite would be detectable
  const remint = await pay(caseId, OWNER_ID)
  ok('re-mint pay → 200', remint.status === 200, `http=${remint.status}`)
  ok('re-mint returns a signed_url', !!remint.body?.signed_url)
  const remintRow = await getCase(caseId)
  ok('re-mint did NOT overwrite paid_at (idempotent)', remintRow?.paid_at === firstPaidAt,
    `before=${firstPaidAt} after=${remintRow?.paid_at}`)

  console.log(`\n${failures === 0 ? '✅ ALL PASS' : `❌ ${failures} FAILURE(S)`}  (case ${caseId})`)
  process.exitCode = failures === 0 ? 0 : 1
}

main().catch((e) => { console.error('❌ smoke crashed:', e); process.exitCode = 1 })
