import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { readFileSync, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { CATALOG_QUERY, type CatalogSource, type ServiceFresh } from '../catalog.js'
import { buildRegistry, toolNameForSlug } from '../registry.js'
import type { FormConfig, ServiceRow } from '../types.js'

const CONFIG: FormConfig = {
  service_id: 'x',
  title: 'X',
  tabs: [{ id: 't', label: 'T' }],
  steps: [
    { id: 'last_name', tab: 't', type: 'text', label: 'Прізвище', required: true },
    {
      id: 'actual_address',
      tab: 't',
      type: 'text',
      label: 'Фактична адреса',
      show_if: { field: 'same_address', operator: '!=', value: true },
    },
    { id: 'same_address', tab: 't', type: 'boolean', label: 'Адреса збігається' },
  ],
}

function service(slug: string, status: ServiceRow['status'], template = 'Позивач: {{last_name}}'): ServiceRow {
  return {
    slug,
    title: `Послуга ${slug}`,
    description: 'Опис.',
    status,
    generation_mode: 'template',
    form_config: CONFIG,
    document_template: template,
    required_checklist: null,
    price: 500,
  }
}

function fakeSource(rows: ServiceRow[], fresh: Map<string, ServiceFresh | null>): CatalogSource {
  return {
    async fetchAll() {
      return rows
    },
    async fetchFresh(slug) {
      if (!fresh.has(slug)) throw new Error(`unexpected fetchFresh(${slug})`)
      return fresh.get(slug) ?? null
    },
  }
}

function freshOf(s: ServiceRow): ServiceFresh {
  return {
    status: s.status,
    document_template: s.document_template,
    required_checklist: s.required_checklist,
  }
}

async function makeTools(rows: ServiceRow[], fresh: Map<string, ServiceFresh | null>) {
  const outDir = mkdtempSync(path.join(os.tmpdir(), 'mcp-registry-'))
  const tools = await buildRegistry({ source: fakeSource(rows, fresh), groqApiKey: null, outDir })
  return { tools, outDir }
}

describe('catalog query (filtering happens server-side in PostgREST)', () => {
  it('selects only template-mode active/needs_review services', () => {
    expect(CATALOG_QUERY).toContain('generation_mode=eq.template')
    expect(CATALOG_QUERY).toContain('status=in.(active,needs_review)')
  })
})

describe('buildRegistry', () => {
  it('registers 2 fixed + N dynamic tools with slug-derived names', async () => {
    const rows = [service('alimony', 'active'), service('divorce', 'needs_review'), service('alimony-change', 'active')]
    const fresh = new Map(rows.map((r) => [r.slug, freshOf(r)]))
    const { tools } = await makeTools(rows, fresh)
    expect(tools.map((t) => t.name)).toEqual([
      'list_services',
      'validate_params',
      'generate_alimony_document',
      'generate_divorce_document',
      'generate_alimony_change_document',
    ])
    expect(toolNameForSlug('alimony-change')).toBe('generate_alimony_change_document')
  })

  it('needs_review generate tool warns in its description', async () => {
    const rows = [service('divorce', 'needs_review')]
    const { tools } = await makeTools(rows, new Map([['divorce', freshOf(rows[0])]]))
    const tool = tools.find((t) => t.name === 'generate_divorce_document')
    expect(tool?.description).toContain('поверне структуровану відмову')
  })

  it('list_services returns statuses, explanations and tool names', async () => {
    const rows = [service('alimony', 'active'), service('divorce', 'needs_review')]
    const fresh = new Map(rows.map((r) => [r.slug, freshOf(r)]))
    const { tools } = await makeTools(rows, fresh)
    const result = await tools[0].execute({})
    expect(result.isError).toBe(false)
    const listed = JSON.parse(result.content[0].text) as Array<Record<string, unknown>>
    expect(listed).toHaveLength(2)
    expect(listed[0]).toMatchObject({ slug: 'alimony', status: 'active', tool_name: 'generate_alimony_document' })
    expect(listed[1].status_explanation_ua).toContain('перевірці юриста')
  })
})

describe('validate_params tool', () => {
  it('rejects an unknown service with the allowed slugs listed', async () => {
    const rows = [service('alimony', 'active')]
    const { tools } = await makeTools(rows, new Map([['alimony', freshOf(rows[0])]]))
    const vp = tools.find((t) => t.name === 'validate_params')!
    const result = await vp.execute({ service: 'nope', params: {} })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('alimony')
  })

  it('returns a partial report: format errors + missing_required, never isError', async () => {
    const rows = [service('alimony', 'active')]
    const { tools } = await makeTools(rows, new Map([['alimony', freshOf(rows[0])]]))
    const vp = tools.find((t) => t.name === 'validate_params')!
    const result = await vp.execute({ service: 'alimony', params: { last_name: 'Ivanov' } })
    expect(result.isError).toBe(false)
    const report = JSON.parse(result.content[0].text) as {
      ok: boolean
      errors: Array<{ field: string | null }>
      missing_required: Array<{ field: string }>
    }
    expect(report.ok).toBe(false) // Latin letters in a name field
    expect(report.errors[0].field).toBe('last_name')

    const empty = await vp.execute({ service: 'alimony', params: {} })
    const emptyReport = JSON.parse(empty.content[0].text) as { ok: boolean; missing_required: Array<{ field: string }> }
    expect(emptyReport.ok).toBe(true)
    expect(emptyReport.missing_required.map((m) => m.field)).toContain('last_name')
  })
})

describe('generate tools (live status re-check)', () => {
  it('renders through the real engine on the happy path and saves a draft', async () => {
    const rows = [service('alimony', 'active')]
    const { tools, outDir } = await makeTools(rows, new Map([['alimony', freshOf(rows[0])]]))
    const gen = tools.find((t) => t.name === 'generate_alimony_document')!
    const result = await gen.execute({ last_name: 'Іванова' })
    expect(result.isError).toBe(false)
    const meta = JSON.parse(result.content[0].text) as { ok: boolean; saved_to: string; checklist: { ok: boolean } }
    expect(meta.ok).toBe(true)
    expect(meta.checklist.ok).toBe(true)
    expect(result.content[1].text).toContain('Позивач: Іванова')
    expect(existsSync(meta.saved_to)).toBe(true)
    expect(meta.saved_to.startsWith(outDir)).toBe(true)
    expect(readFileSync(meta.saved_to, 'utf8')).toBe(result.content[1].text)
  })

  it('refuses when the FRESH status is needs_review even if startup said active', async () => {
    const rows = [service('alimony', 'active')]
    const fresh = new Map<string, ServiceFresh | null>([
      ['alimony', { status: 'needs_review', document_template: rows[0].document_template, required_checklist: null }],
    ])
    const { tools } = await makeTools(rows, fresh)
    const gen = tools.find((t) => t.name === 'generate_alimony_document')!
    const result = await gen.execute({ last_name: 'Іванова' })
    expect(result.isError).toBe(true)
    const payload = JSON.parse(result.content[0].text) as { error_type: string }
    expect(payload.error_type).toBe('service_unavailable')
  })

  it('service vanished from DB → internal_error payload', async () => {
    const rows = [service('alimony', 'active')]
    const { tools } = await makeTools(rows, new Map([['alimony', null]]))
    const gen = tools.find((t) => t.name === 'generate_alimony_document')!
    const result = await gen.execute({ last_name: 'Іванова' })
    expect(result.isError).toBe(true)
    expect(JSON.parse(result.content[0].text)).toMatchObject({ error_type: 'internal_error' })
  })

  it('fresh-status fetch failure → internal_error payload, not a throw', async () => {
    const rows = [service('alimony', 'active')]
    const source: CatalogSource = {
      async fetchAll() {
        return rows
      },
      async fetchFresh() {
        throw new Error('network down')
      },
    }
    const outDir = mkdtempSync(path.join(os.tmpdir(), 'mcp-registry-'))
    const tools = await buildRegistry({ source, groqApiKey: null, outDir })
    const gen = tools.find((t) => t.name === 'generate_alimony_document')!
    const result = await gen.execute({ last_name: 'Іванова' })
    expect(result.isError).toBe(true)
    expect(JSON.parse(result.content[0].text)).toMatchObject({ error_type: 'internal_error' })
  })
})
