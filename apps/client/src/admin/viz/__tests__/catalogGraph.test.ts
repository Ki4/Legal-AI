import { describe, it, expect } from 'vitest'
import { buildCatalogGraph, type VizService } from '../vizData'
import type { VizNode } from '../demoData'

const docNode = (slug: string): VizNode => ({ id: `${slug}-doc`, kind: 'doc', x: 0, y: 0, w: 0, h: 0, label: 'Документ', sub: slug })

function svc(slug: string, title: string, citations: VizService['citations'], hasDoc: boolean): VizService {
  return {
    id: slug, slug, title, icon: null, status: 'active', health: 'ok', price: 0,
    tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], fields: [], articles: [],
    citations, doc: hasDoc ? docNode(slug) : null,
    counts: { used: 0, extra: 0, missing: 0, total: 5 }, requestsPerMonth: null,
  }
}

const SK = 'Сімейний кодекс України'
const CPK = 'Цивільний процесуальний кодекс України'

// divorce + alimony share article sk-180 and cpk-175; property is a draft (no document).
const SERVICES: VizService[] = [
  svc('divorce', 'Розірвання шлюбу', [{ slug: 'sk', title: SK, articles: ['110', '180'] }, { slug: 'cpk', title: CPK, articles: ['175'] }], true),
  svc('alimony', 'Стягнення аліментів', [{ slug: 'sk', title: SK, articles: ['180', '182'] }, { slug: 'cpk', title: CPK, articles: ['175'] }], true),
  svc('property', 'Поділ майна', [{ slug: 'sk', title: SK, articles: ['60'] }], false),
]

describe('buildCatalogGraph', () => {
  const g = buildCatalogGraph(SERVICES)
  const byKind = (k: string) => g.nodes.filter((n) => n.kind === k)
  const ids = new Set(g.nodes.map((n) => n.id))

  it('dedupes laws, articles, and counts services/documents', () => {
    expect(byKind('law').map((n) => n.id).sort()).toEqual(['cpk', 'sk'])
    // sk-110, sk-180, sk-182, sk-60, cpk-175 → 5 unique (sk-180 & cpk-175 shared)
    expect(byKind('art')).toHaveLength(5)
    expect(byKind('srv')).toHaveLength(3)
    expect(byKind('doc')).toHaveLength(2) // property is a draft → no document
  })

  it('places each kind in its own column', () => {
    expect(byKind('law').every((n) => n.x === 8)).toBe(true)
    expect(byKind('art').every((n) => n.x === 248)).toBe(true)
    expect(byKind('srv').every((n) => n.x === 508)).toBe(true)
    expect(byKind('doc').every((n) => n.x === 760)).toBe(true)
  })

  it('every edge endpoint refers to a real node', () => {
    for (const [f, t] of g.edges) { expect(ids.has(f)).toBe(true); expect(ids.has(t)).toBe(true) }
  })

  it('wires law→article→service and service→document, with a shared article fanning out', () => {
    const has = (f: string, t: string) => g.edges.some((e) => e[0] === f && e[1] === t)
    expect(has('sk', 'sk-180')).toBe(true)
    expect(has('sk-180', 'divorce')).toBe(true)
    expect(has('sk-180', 'alimony')).toBe(true)       // shared article → both services
    expect(has('divorce', 'divorce-doc')).toBe(true)
    // the shared law→article edge is deduped to a single entry
    expect(g.edges.filter((e) => e[0] === 'sk' && e[1] === 'sk-180')).toHaveLength(1)
  })

  it('aligns each document to its service row and produces finite coordinates', () => {
    const divorce = g.nodes.find((n) => n.id === 'divorce')!
    const doc = g.nodes.find((n) => n.id === 'divorce-doc')!
    expect(doc.y).toBe(divorce.y)
    expect(g.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true)
    expect(g.stageHeight).toBeGreaterThanOrEqual(560)
  })

  it('even-spaces nodes down each column from the top (strictly increasing y per kind)', () => {
    const ys = (k: string) => g.nodes.filter((n) => n.kind === k).map((n) => n.y)
    for (const k of ['law', 'art', 'srv']) {
      const col = ys(k)
      for (let i = 1; i < col.length; i++) expect(col[i]).toBeGreaterThan(col[i - 1])
      expect(col[0]).toBe(24) // TOP
    }
  })
})

describe('buildCatalogGraph — edge cases', () => {
  it('returns an empty graph at the minimum stage height for no services', () => {
    const g = buildCatalogGraph([])
    expect(g.nodes).toEqual([])
    expect(g.edges).toEqual([])
    expect(g.stageHeight).toBe(560 + 24) // Math.max(560) + TOP
  })

  it('includes a citation-less service as a node with no incoming article edges', () => {
    const g = buildCatalogGraph([svc('lonely', 'Самотня', [], true)])
    expect(g.nodes.filter((n) => n.kind === 'law')).toHaveLength(0)
    expect(g.nodes.filter((n) => n.kind === 'art')).toHaveLength(0)
    expect(g.nodes.some((n) => n.id === 'lonely' && n.kind === 'srv')).toBe(true)
    // only the service→document edge exists
    expect(g.edges).toEqual([['lonely', 'lonely-doc']])
  })

  it('omits the document node + edge for a service without a doc', () => {
    const g = buildCatalogGraph([svc('draft', 'Чернетка', [{ slug: 'sk', title: SK, articles: ['60'] }], false)])
    expect(g.nodes.some((n) => n.kind === 'doc')).toBe(false)
    expect(g.edges.some(([, t]) => t.endsWith('-doc'))).toBe(false)
    // law→article→service still wired
    expect(g.edges).toContainEqual(['sk', 'sk-60'])
    expect(g.edges).toContainEqual(['sk-60', 'draft'])
  })

  it('labels the service sub with field count and a singular/plural tab word', () => {
    const oneTab: VizService = { ...svc('s1', 'S1', [], false), tabs: [{ id: 'a', label: 'A' }] }
    const g1 = buildCatalogGraph([oneTab])
    expect(g1.nodes.find((n) => n.id === 's1')!.sub).toContain('1 таб')
    // the shared fixture services have 2 tabs → "таби"
    const gShared = buildCatalogGraph(SERVICES)
    expect(gShared.nodes.find((n) => n.id === 'divorce')!.sub).toContain('таби')
  })

  it('dedupes a law/article shared across services into a single node and edge', () => {
    // sk-180 is cited by both divorce and alimony in the shared fixture.
    const gShared = buildCatalogGraph(SERVICES)
    expect(gShared.nodes.filter((n) => n.id === 'sk-180')).toHaveLength(1)
    expect(gShared.edges.filter((e) => e[0] === 'sk' && e[1] === 'sk-180')).toHaveLength(1)
    // but the article fans out to both services
    expect(gShared.edges).toContainEqual(['sk-180', 'divorce'])
    expect(gShared.edges).toContainEqual(['sk-180', 'alimony'])
  })
})
