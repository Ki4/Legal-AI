/**
 * generate.test.ts — offline pipeline tests (plan T5). No network: Groq is
 * either disabled (groqApiKey: null) or replaced via deps.declension.
 *
 * Fixtures are the git SSoT: the real alimony template + checklist from
 * n8n/templates/services/, the real form config and sample answers from the
 * client app (cross-folder imports — vitest transpiles; tsc excludes __tests__).
 *
 * Fixture patch (noted per task): SAMPLE_ANSWERS.alimony ships
 * defendant_tax_number '2845678901', which FAILS the ІПН checksum under the
 * server's strict validation (the admin preview never format-validates its
 * samples). Patched here to the checksum-valid '2845678905'; every other key
 * stays byte-identical to the git sample.
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

import { loadDocEngine } from '../doc-engine.js'
import { WATERMARK, generateDocument, watermarkText } from '../generate.js'
import type { GenerateDeps } from '../generate.js'
import { repoRoot } from '../env.js'
import type { Checklist, ErrorPayload, FormConfig, ServiceRow } from '../types.js'
import { validateAnswers } from '../validate.js'
// Cross-folder imports of the client SSoT (same convention as parity/form-schema tests)
import { SAMPLE_ANSWERS } from '../../../client/src/admin/lib/sampleAnswers'
import { alimonyConfig } from '../../../client/src/data/alimonyConfig'

// ── Fixtures (git SSoT) ───────────────────────────────────────────────────────

const servicesDir = path.join(repoRoot, 'n8n', 'templates', 'services')
const TEMPLATE = readFileSync(path.join(servicesDir, 'alimony.document.txt'), 'utf8')
const CHECKLIST = JSON.parse(
  readFileSync(path.join(servicesDir, 'alimony.checklist.json'), 'utf8'),
) as Checklist

const CONFIG = alimonyConfig as FormConfig

const ANSWERS: Record<string, unknown> = {
  ...SAMPLE_ANSWERS.alimony,
  defendant_tax_number: '2845678905', // fixture patch — see header note
}

function makeService(overrides: Partial<ServiceRow> = {}): ServiceRow {
  return {
    slug: 'alimony',
    title: 'Позовна заява про стягнення аліментів',
    description: null,
    status: 'active',
    generation_mode: 'template',
    form_config: CONFIG,
    document_template: TEMPLATE,
    required_checklist: CHECKLIST,
    price: 800,
    ...overrides,
  }
}

const tmpDirs: string[] = []

function freshDeps(overrides: Partial<GenerateDeps> = {}): GenerateDeps {
  const outDir = mkdtempSync(path.join(os.tmpdir(), 'mcp-gen-'))
  tmpDirs.push(outDir)
  return { groqApiKey: null, outDir, ...overrides }
}

afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true })
})

interface SuccessMeta {
  ok: boolean
  service: string
  saved_to: string
  excerpt: string
  checklist: { ok: boolean; missing: unknown[]; satisfied: unknown[] }
  declension: { used_ai: boolean; note: string }
  watermark: string
  next_action: string
  warnings: unknown[]
}

const parseMeta = (text: string): SuccessMeta => JSON.parse(text) as SuccessMeta
const parseErr = (text: string): ErrorPayload => JSON.parse(text) as ErrorPayload

/** Raw engine render of the patched sample with ai={} — the pipeline's reference bytes. */
function rawNominativeText(): string {
  const engine = loadDocEngine()
  const cleaned = validateAnswers(CONFIG, ANSWERS, 'strict').cleaned
  return engine.renderDocumentWithStyles(TEMPLATE, engine.buildContext(cleaned, {})).text
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generateDocument pipeline', () => {
  it('render parity (crown): pipeline output byte-equals watermarked raw-engine render', async () => {
    const deps = freshDeps() // groqApiKey: null → ai = {}
    const result = await generateDocument(makeService(), ANSWERS, deps)

    expect(result.isError).toBe(false)
    expect(result.content).toHaveLength(2)

    const meta = parseMeta(result.content[0].text)
    const fullText = result.content[1].text

    // Crown assertion: byte-equality with the raw engine + watermark framing.
    expect(fullText).toBe(watermarkText(rawNominativeText()))

    expect(meta.ok).toBe(true)
    expect(meta.service).toBe('alimony')
    expect(meta.checklist.ok).toBe(true)
    expect(meta.checklist.missing).toEqual([])
    expect(meta.watermark).toBe(WATERMARK)
    expect(meta.declension.used_ai).toBe(false)

    // Excerpt: from the UNwatermarked text — non-empty, strictly shorter.
    expect(meta.excerpt.length).toBeGreaterThan(0)
    expect(meta.excerpt.length).toBeLessThan(fullText.length)

    // Draft file exists and matches content[1] byte-for-byte.
    expect(existsSync(meta.saved_to)).toBe(true)
    expect(readFileSync(meta.saved_to, 'utf8')).toBe(fullText)
  })

  it('needs_review service → structured service_unavailable refusal, no file written', async () => {
    const deps = freshDeps()
    const result = await generateDocument(makeService({ status: 'needs_review' }), ANSWERS, deps)

    expect(result.isError).toBe(true)
    const payload = parseErr(result.content[0].text)
    expect(payload.ok).toBe(false)
    expect(payload.error_type).toBe('service_unavailable')
    expect(payload.errors[0].problem).toBe('service_unavailable')
    expect(payload.errors[0].message).toContain('status=needs_review')
    expect(payload.errors[0].hint).toContain('НЕ намагайтеся скласти документ самостійно')

    expect(readdirSync(deps.outDir)).toEqual([])
  })

  it('failed checklist → fail-closed: checklist_failed, document text withheld, no file', async () => {
    const deps = freshDeps()
    const doctored: Checklist = {
      items: [
        {
          id: 'impossible_clause',
          description: 'Клаузула, якої немає в шаблоні',
          appliesIf: 'true',
          mustMatchAny: ['НЕІСНУЮЧИЙ_РЯДОК_XYZ'],
        },
      ],
    }
    const result = await generateDocument(makeService({ required_checklist: doctored }), ANSWERS, deps)

    expect(result.isError).toBe(true)
    expect(result.content).toHaveLength(1)
    const payload = parseErr(result.content[0].text)
    expect(payload.error_type).toBe('checklist_failed')
    expect(payload.errors[0].problem).toBe('checklist_failed')
    expect(payload.errors[0].expected).toContain('Клаузула, якої немає в шаблоні')
    expect(payload.errors[0].hint).toContain('дефект шаблону')

    // The rendered document must be ABSENT from every content item (fail-closed).
    const docMarker = rawNominativeText().trim().slice(0, 60)
    expect(docMarker.length).toBeGreaterThan(0)
    for (const item of result.content) {
      expect(item.text).not.toContain(docMarker)
    }

    expect(readdirSync(deps.outDir)).toEqual([])
  })

  it('invalid birth_date (15.03.1990) → structured validation error naming the field', async () => {
    const deps = freshDeps()
    const result = await generateDocument(
      makeService(),
      { ...ANSWERS, birth_date: '15.03.1990' },
      deps,
    )

    expect(result.isError).toBe(true)
    const payload = parseErr(result.content[0].text)
    expect(payload.error_type).toBe('validation')
    const issue = payload.errors.find((e) => e.field === 'birth_date')
    expect(issue).toBeDefined()
    expect(issue?.problem).toBe('invalid_format')
    expect(payload.next_action).toContain('НЕ вигадуйте значення')

    expect(readdirSync(deps.outDir)).toEqual([])
  })

  it('injected plausible declension → used_ai:true, lands in the text, watermark top AND bottom', async () => {
    const FAKE_AI: Record<string, string> = {
      plaintiff_instrumental: 'Іванову Інну Петрівну',
      plaintiff_genitive: 'Іванової Інни Петрівни',
      defendant_instrumental: 'Івановим Іваном Івановичем',
      defendant_genitive: 'Іванова Івана Івановича',
      marriage_place_locative: 'Шевченківському відділі РАЦС у м. Києві',
      children_genitive: 'Іванова Олега Івановича, 15.05.2018 р.н.',
    }
    const deps = freshDeps({ groqApiKey: 'offline-test-key', declension: async () => FAKE_AI })
    const result = await generateDocument(makeService(), ANSWERS, deps)

    expect(result.isError).toBe(false)
    const meta = parseMeta(result.content[0].text)
    expect(meta.declension.used_ai).toBe(true)

    const fullText = result.content[1].text
    // The injected instrumental form only exists via ai.* (nominative is «Іванов Іван Іванович»).
    expect(fullText).toContain('Івановим Іваном Івановичем')

    // Watermark banner block present at the very top AND the very bottom.
    const lines = fullText.split('\n')
    expect(lines[1]).toBe(WATERMARK)
    expect(lines[lines.length - 2]).toBe(WATERMARK)
  })

  it('injected garbage declension → no throw; stem-guard reverts to nominative bytes', async () => {
    const deps = freshDeps({
      groqApiKey: 'offline-test-key',
      declension: async () => ({ plaintiff_instrumental: 'XYZ123' }),
    })
    const result = await generateDocument(makeService(), ANSWERS, deps)

    expect(result.isError).toBe(false)
    // AI DID respond (non-empty object) — used_ai reflects that; the stem-guard
    // decides what reaches the document.
    expect(parseMeta(result.content[0].text).declension.used_ai).toBe(true)
    // guardDeclension rejects 'XYZ123' (word count + stem mismatch) → the output
    // is byte-identical to the pure nominative render.
    expect(result.content[1].text).toBe(watermarkText(rawNominativeText()))
  })

  it('fixed deps.now → deterministic draft filename', async () => {
    const deps = freshDeps({ now: () => new Date(2026, 6, 10, 14, 30, 12) })
    const result = await generateDocument(makeService(), ANSWERS, deps)

    expect(result.isError).toBe(false)
    const meta = parseMeta(result.content[0].text)
    expect(path.isAbsolute(meta.saved_to)).toBe(true)
    expect(path.basename(meta.saved_to)).toBe('DRAFT-alimony-20260710-143012.txt')
  })
})
