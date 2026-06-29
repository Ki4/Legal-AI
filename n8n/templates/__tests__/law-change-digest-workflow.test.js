import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Guards the GENERATED law-change-digest workflow (specs/features/law-change-impact/ G4):
//   1. it stays in sync with its SSoT (templates + prompt) — build --check;
//   2. it never commits real secrets — only YOUR_* placeholders;
//   3. its graph is intact — every connection target is a real node;
//   4. its Code nodes are syntactically valid JS.
const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')
const wfPath = resolve(repoRoot, 'n8n/workflows/current/law-change-digest.json')
const buildScript = resolve(repoRoot, 'scripts/build-law-change-digest.mjs')

describe('law-change-digest workflow', () => {
  it('is in sync with its SSoT (build --check passes)', () => {
    // Throws (non-zero exit) if the committed JSON drifts from the generator output.
    expect(() => execFileSync('node', [buildScript, '--check'], { cwd: repoRoot })).not.toThrow()
  })

  const wf = JSON.parse(readFileSync(wfPath, 'utf8'))

  it('commits no real secrets — only YOUR_* placeholders', () => {
    const raw = readFileSync(wfPath, 'utf8')
    expect(raw).toContain('YOUR_SUPABASE_SERVICE_ROLE_KEY')
    expect(raw).toContain('YOUR_GROQ_API_KEY')
    // No Supabase JWT / Groq key material leaked into the committed file.
    expect(/eyJ[A-Za-z0-9_-]{20}|gsk_[A-Za-z0-9]{20}/.test(raw)).toBe(false)
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

  it('has syntactically valid Code-node bodies', () => {
    for (const n of wf.nodes) {
      if (n.parameters?.jsCode) {
        expect(() => new Function(n.parameters.jsCode)).not.toThrow()
      }
    }
  })

  it('keeps the digest advisory-only (writes ai_* columns, never notes/action)', () => {
    const write = wf.nodes.find((n) => n.name === 'Write Result')
    const body = write.parameters.jsonBody
    expect(body).toContain('ai_status')
    expect(body).toContain('ai_summary')
    expect(body).toContain('ai_impact')
    expect(body).not.toMatch(/\bnotes\b/)
    expect(body).not.toMatch(/"action"/)
  })
})
