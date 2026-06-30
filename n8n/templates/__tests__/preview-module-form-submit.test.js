import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Guards the preview-module G3-core patch of form-submit (#83, p1+2):
//   1. the JSON stays in sync with its patcher (SSoT: preview-excerpt.js inlined);
//   2. the safe excerpt rides the early webhook response;
//   3. the full PDF is parked in the PRIVATE bucket — the bot delivery BEFORE
//      payment is gone (the #86 / monetisation invariant), no secrets leaked;
//   4. the graph is intact.
const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')
const wfPath = resolve(repoRoot, 'n8n/workflows/current/form-submit.json')
const syncScript = resolve(repoRoot, 'scripts/sync-preview-module-form-submit.mjs')

const wf = JSON.parse(readFileSync(wfPath, 'utf8'))
const node = (name) => wf.nodes.find((n) => n.name === name)

describe('preview-module form-submit (G3 core)', () => {
  it('is in sync with its patcher (--check passes)', () => {
    expect(() => execFileSync('node', [syncScript, '--check'], { cwd: repoRoot })).not.toThrow()
  })

  // ── p1: excerpt + early response ─────────────────────────────────────────────
  it('inlines the SSoT excerpt extractor in a Derive Excerpt node', () => {
    const dx = node('Derive Excerpt')
    expect(dx).toBeTruthy()
    expect(dx.parameters.jsCode).toContain('function deriveExcerpt')
    expect(dx.parameters.jsCode).toContain('preview-excerpt.js')
    expect(dx.parameters.jsCode).toContain("$('Build Document').item.json")
  })

  it('routes Build Document → Derive Excerpt → {Notify User, Update Case Abstention}', () => {
    expect(wf.connections['Build Document'].main[0]).toEqual([
      { node: 'Derive Excerpt', type: 'main', index: 0 },
    ])
    const targets = wf.connections['Derive Excerpt'].main[0].map((c) => c.node)
    expect(targets).toContain('Notify User')
    expect(targets).toContain('Update Case Abstention')
  })

  it('returns case_id + status + preview_excerpt in the early response', () => {
    const body = node('Respond OK').parameters.responseBody
    expect(body).toContain('case_id')
    expect(body).toContain('preview_excerpt')
    expect(body).toContain('status')
  })

  it('persists preview_excerpt on the case; inserts as generating', () => {
    const upd = node('Update Case Abstention').parameters.fieldsUi.fieldValues.map((f) => f.fieldId)
    expect(upd).toContain('preview_excerpt')
    // status is owned by Insert Case + Set Preview Ready only — writing it here
    // would clobber 'preview_ready' (n8n depth-first sibling runs last).
    expect(upd).not.toContain('status')
    const ins = node('Insert Case').parameters.fieldsUi.fieldValues.find((f) => f.fieldId === 'status')
    expect(ins.fieldValue).toBe('generating')
  })

  // ── p2: private Storage, no pre-payment bot delivery ─────────────────────────
  it('uploads the full PDF to the PRIVATE generated-documents bucket (binary, service-role)', () => {
    const up = node('Upload PDF to Storage')
    expect(up).toBeTruthy()
    expect(up.parameters.method).toBe('POST')
    expect(up.parameters.url).toContain('/storage/v1/object/generated-documents/')
    expect(up.parameters.contentType).toBe('binaryData')
    expect(up.parameters.inputDataFieldName).toBe('data')
    // service-role auth comes from Global Config at runtime, not a literal key
    const hdrs = JSON.stringify(up.parameters.headerParameters)
    expect(hdrs).toContain('SUPABASE_SERVICE_KEY')
  })

  it('sets doc_storage_path + status=preview_ready after upload', () => {
    const sr = node('Set Preview Ready')
    expect(sr).toBeTruthy()
    const fv = sr.parameters.fieldsUi.fieldValues
    expect(fv.find((f) => f.fieldId === 'doc_storage_path')).toBeTruthy()
    expect(fv.find((f) => f.fieldId === 'status').fieldValue).toBe('preview_ready')
  })

  it('chains Export PDF → Upload → Set Preview Ready → Delete Doc', () => {
    expect(wf.connections['Export PDF'].main[0]).toEqual([
      { node: 'Upload PDF to Storage', type: 'main', index: 0 },
    ])
    expect(wf.connections['Upload PDF to Storage'].main[0]).toEqual([
      { node: 'Set Preview Ready', type: 'main', index: 0 },
    ])
    expect(wf.connections['Set Preview Ready'].main[0]).toEqual([
      { node: 'Delete Doc', type: 'main', index: 0 },
    ])
  })

  it('removes ALL pre-payment document delivery to the bot', () => {
    for (const gone of ['Send PDF', 'Send DOCX', 'Export DOCX']) {
      expect(node(gone)).toBeFalsy()
    }
    // No Telegram node sends the document file anywhere in the workflow.
    const sendsDoc = wf.nodes.filter(
      (n) => n.type === 'n8n-nodes-base.telegram' && n.parameters?.operation === 'sendDocument',
    )
    expect(sendsDoc).toHaveLength(0)
  })

  // ── safety: secrets + graph ──────────────────────────────────────────────────
  it('commits no real secrets — only the Global Config placeholder', () => {
    const raw = readFileSync(wfPath, 'utf8')
    expect(raw).toContain('YOUR_SUPABASE_SERVICE_ROLE_KEY')
    expect(/eyJ[A-Za-z0-9_-]{20}|sbp_[A-Za-z0-9]{10}/.test(raw)).toBe(false)
  })

  it('has intact connections — every target node exists', () => {
    const names = new Set(wf.nodes.map((n) => n.name))
    for (const [from, conn] of Object.entries(wf.connections)) {
      expect(names.has(from)).toBe(true)
      for (const out of conn.main || []) {
        for (const c of out || []) expect(names.has(c.node)).toBe(true)
      }
    }
  })
})
