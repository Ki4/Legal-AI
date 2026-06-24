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
})
