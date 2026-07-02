// Adapter: real `services` rows → the shapes viz-lab views consume, computed in the browser
// from form_config + document_template via the (pure, tested) serviceAnatomy functions —
// the same anatomy the admin "дзеркало" uses. No business metrics here: demand/revenue have
// no source in the schema yet, so requestsPerMonth is null until an analytics source exists.
//
// useVizServices() fetches live services when Supabase is reachable (logged-in admin) and
// falls back to the demo dataset otherwise, so the public /viz-lab still renders.
import { useEffect, useState } from 'react'
import type { FormConfig, FormTab } from '../../types/form'
import { supabase } from '../../lib/supabase'
import { toServiceStatus, type ServiceStatus } from '../../lib/serviceStatus'
import {
  analyzeTemplate,
  diffFormVsTemplate,
  collectBrokenShowIf,
  collectEmptyLabelFields,
  serviceHealth,
  isTemplateAuthoritative,
} from '../../lib/serviceAnatomy'
import type { Health } from './theme'
import type { VizNode, FieldMapping } from './demoData'
import { SERVICES as DEMO_SERVICES, NODES, EDGES, DIVORCE_FIELDS, DIVORCE_FIELD_MAP, DIVORCE_TABS } from './demoData'

export interface VizFieldChip { id: string; label: string; tab: string; map: FieldMapping }

/** One service, shaped for the viz-lab views. */
export interface VizService {
  id: string
  slug: string
  title: string
  icon: string | null
  status: ServiceStatus
  health: Health
  price: number
  tabs: FormTab[]
  fields: VizFieldChip[]
  articles: VizNode[]            // kind 'art' — derived from template citations
  citations: { slug: string; title: string; articles: string[] }[] // laws→articles, for the catalog graph
  doc: VizNode | null           // kind 'doc'
  counts: { used: number; extra: number; missing: number; total: number }
  requestsPerMonth: number | null // null = no analytics source (kept out of structural views)
  /** false = generation_mode='js': the template is a dormant draft, its diff is not an alarm
   *  (issue #86). Optional — undefined (demo data, older callers) means authoritative. */
  templateAuthoritative?: boolean
}

const HEALTH_FROM_LEVEL: Record<'green' | 'amber' | 'red', Health> = { green: 'ok', amber: 'warn', red: 'problem' }

/** Short law tag for an article's `sub` line, e.g. "Сімейний кодекс України" → "СК України". */
function shortLaw(title: string): string {
  if (/Сімейн/i.test(title)) return 'СК України'
  if (/Цивільн/i.test(title)) return 'ЦПК України'
  if (/судов/i.test(title)) return 'Про судовий збір'
  return title
}

interface ServiceRowLike {
  id?: string
  slug: string
  title: string
  icon?: string | null
  price?: number | null
  status?: unknown
  generation_mode?: string | null
  document_template?: string | null
  form_config?: FormConfig | null
}

/** Pure: map one real service row to a VizService using the shared anatomy. */
export function liveServiceToViz(row: ServiceRowLike): VizService {
  const form: FormConfig = row.form_config && Array.isArray(row.form_config.steps)
    ? row.form_config
    : { service_id: '', title: '', tabs: [], steps: [] }
  const analysis = analyzeTemplate(row.document_template ?? '')
  const diff = diffFormVsTemplate(form, analysis)
  const used = new Set(diff.usedFields)

  // Real form fields → used / extra, grouped by their tab.
  const fields: VizFieldChip[] = form.steps.map((f) => ({
    id: f.id, label: f.label || f.id, tab: f.tab, map: used.has(f.id) ? 'used' : 'extra',
  }))
  const templateAuthoritative = isTemplateAuthoritative(row.generation_mode ?? null)

  const tabs: FormTab[] = [...form.tabs]
  // Template placeholders the form never asks → a dedicated "missing" group. Only when the
  // template actually generates the document — a js-mode draft's gaps are not "missing" (issue #86).
  if (diff.unmatchedPlaceholders.length && templateAuthoritative) {
    tabs.push({ id: '__missing', label: 'Бракує у формі' })
    for (const p of diff.unmatchedPlaceholders) fields.push({ id: p, label: p, tab: '__missing', map: 'missing' })
  }

  const articles: VizNode[] = []
  for (const law of analysis.citations) {
    for (const a of law.articles) {
      articles.push({ id: `${law.slug}-${a}`, kind: 'art', x: 0, y: 0, w: 0, h: 0, label: `ст. ${a}`, sub: shortLaw(law.title) })
    }
  }
  const doc: VizNode | null = analysis.hasTemplate
    ? { id: `${row.slug}-doc`, kind: 'doc', x: 0, y: 0, w: 0, h: 0, label: 'Документ', sub: row.title }
    : null

  const level = serviceHealth({
    generationMode: row.generation_mode ?? null,
    hasTemplate: analysis.hasTemplate,
    diff,
    brokenShowIf: collectBrokenShowIf(form),
    emptyLabelFields: collectEmptyLabelFields(form),
    staleCitations: [],
  }).level

  return {
    id: row.id ?? row.slug,
    slug: row.slug,
    title: row.title,
    icon: row.icon ?? null,
    status: toServiceStatus(row.status),
    health: HEALTH_FROM_LEVEL[level],
    price: row.price ?? 0,
    tabs,
    fields,
    articles,
    citations: analysis.citations.map((l) => ({ slug: l.slug, title: l.title, articles: l.articles.map(String) })),
    doc,
    counts: {
      used: diff.usedFields.length,
      extra: diff.unusedFields.length,
      missing: diff.unmatchedPlaceholders.length,
      total: form.steps.length,
    },
    requestsPerMonth: null,
    templateAuthoritative,
  }
}

// ─── Demo fallback (reshape the existing demo dataset into VizService) ─────────
const NODE_MAP: Record<string, VizNode> = Object.fromEntries(NODES.map((n) => [n.id, n]))
const demoArticles = (id: string) => EDGES.filter(([, t]) => t === id).map(([f]) => NODE_MAP[f]).filter((n) => n?.kind === 'art')
const demoDoc = (id: string) => EDGES.filter(([f]) => f === id).map(([, t]) => NODE_MAP[t]).find((n) => n?.kind === 'doc') ?? null

// Hardcoded citations per demo service, mirroring the demo law→article EDGES, so the catalog
// graph layout can be exercised (and screenshotted) without live Supabase.
const DEMO_CITATIONS: Record<string, VizService['citations']> = {
  divorce: [
    { slug: 'sk', title: 'Сімейний кодекс України', articles: ['110', '60', '70', '180'] },
    { slug: 'cpk', title: 'Цивільний процесуальний кодекс України', articles: ['175'] },
    { slug: 'psz', title: 'Про судовий збір', articles: ['4'] },
  ],
  alimony: [
    { slug: 'sk', title: 'Сімейний кодекс України', articles: ['180', '182'] },
    { slug: 'cpk', title: 'Цивільний процесуальний кодекс України', articles: ['175'] },
    { slug: 'psz', title: 'Про судовий збір', articles: ['4'] },
  ],
  property: [
    { slug: 'sk', title: 'Сімейний кодекс України', articles: ['60', '70'] },
    { slug: 'cpk', title: 'Цивільний процесуальний кодекс України', articles: ['175'] },
    { slug: 'psz', title: 'Про судовий збір', articles: ['4'] },
  ],
}

function demoVizServices(): VizService[] {
  return DEMO_SERVICES.map((s) => {
    let fields: VizFieldChip[]
    let tabs: FormTab[]
    if (s.id === 'divorce') {
      fields = DIVORCE_FIELDS.map((f) => ({ id: f.id, label: f.label, tab: f.tab, map: DIVORCE_FIELD_MAP[f.id] ?? 'used' }))
      tabs = DIVORCE_TABS
    } else {
      // synthesize a proportional chip set from the anatomy counts
      fields = []
      const push = (m: FieldMapping, n: number) => { for (let i = 0; i < n; i++) fields.push({ id: `${s.id}_${m}_${i}`, label: `поле ${fields.length + 1}`, tab: 'main', map: m }) }
      push('missing', s.fields.missing); push('extra', s.fields.extra); push('used', Math.min(s.fields.used, 10))
      tabs = [{ id: 'main', label: 'Поля' }]
    }
    return {
      id: s.id, slug: s.slug, title: s.title, icon: null, status: 'active', health: s.health, price: s.price,
      tabs, fields, articles: demoArticles(s.id), citations: DEMO_CITATIONS[s.id] ?? [], doc: demoDoc(s.id),
      counts: s.fields, requestsPerMonth: s.requestsPerMonth,
    }
  })
}

// ─── Catalog graph: services → laid-out law→article→service→document graph ─────
// The demo NODES were hand-positioned; here we auto-lay-out from real data. Four fixed columns
// (geometry ported from the demo stage); nodes even-spaced down each column, documents aligned
// to their service's row. Edge crossings from shared articles (e.g. ст.175 → 3 services) are
// inherent and accepted — this is readable, not crossing-minimal.
export interface VizGraph { nodes: VizNode[]; edges: [string, string][]; stageHeight: number }

const COL = {
  law: { x: 8, w: 185 },
  art: { x: 248, w: 205 },
  srv: { x: 508, w: 200 },
  doc: { x: 760, w: 165 },
} as const
const NODE_H = { law: 66, art: 60, srv: 84, doc: 62 } as const
const TOP = 24
const GAP = 26

/** Pure: build the catalog graph (nodes with coordinates + directed edges) from VizServices. */
export function buildCatalogGraph(services: VizService[]): VizGraph {
  const laws: VizNode[] = []
  const arts: VizNode[] = []
  const srvs: VizNode[] = []
  const docs: VizNode[] = []
  const seenLaw = new Set<string>()
  const seenArt = new Set<string>()
  const edgeSet = new Set<string>()
  const edges: [string, string][] = []
  const addEdge = (from: string, to: string) => {
    const k = `${from}|${to}`
    if (!edgeSet.has(k)) { edgeSet.add(k); edges.push([from, to]) }
  }

  for (const s of services) {
    for (const law of s.citations) {
      if (!seenLaw.has(law.slug)) {
        seenLaw.add(law.slug)
        laws.push({ id: law.slug, kind: 'law', x: 0, y: 0, w: COL.law.w, h: NODE_H.law, label: law.title, sub: shortLaw(law.title) })
      }
      for (const a of law.articles) {
        const id = `${law.slug}-${a}`
        if (!seenArt.has(id)) {
          seenArt.add(id)
          arts.push({ id, kind: 'art', x: 0, y: 0, w: COL.art.w, h: NODE_H.art, label: `ст. ${a}`, sub: shortLaw(law.title) })
        }
        addEdge(law.slug, id)
        addEdge(id, s.slug)
      }
    }
    srvs.push({
      id: s.slug, kind: 'srv', x: 0, y: 0, w: COL.srv.w, h: NODE_H.srv,
      label: s.title, sub: `${s.counts.total} полів · ${s.tabs.length} ${s.tabs.length === 1 ? 'таб' : 'таби'}`,
    })
    if (s.doc) {
      docs.push({ id: `${s.slug}-doc`, kind: 'doc', x: 0, y: 0, w: COL.doc.w, h: NODE_H.doc, label: s.doc.label, sub: s.doc.sub })
      addEdge(s.slug, `${s.slug}-doc`)
    }
  }

  // even-space each column from the top
  const place = (arr: VizNode[], x: number) => {
    let y = TOP
    for (const n of arr) { n.x = x; n.y = y; y += n.h + GAP }
  }
  place(laws, COL.law.x)
  place(arts, COL.art.x)
  place(srvs, COL.srv.x)
  // documents align to their service's row
  const srvY = new Map(srvs.map((n) => [n.id, n.y]))
  for (const d of docs) { d.x = COL.doc.x; d.y = srvY.get(d.id.replace(/-doc$/, '')) ?? TOP }

  const nodes = [...laws, ...arts, ...srvs, ...docs]
  const stageHeight = Math.max(560, ...nodes.map((n) => n.y + n.h)) + TOP
  return { nodes, edges, stageHeight }
}

export interface VizServicesState { services: VizService[]; source: 'live' | 'demo'; loading: boolean }

/** Live services when Supabase is reachable; demo otherwise (so public /viz-lab still renders). */
export function useVizServices(): VizServicesState {
  const [state, setState] = useState<VizServicesState>({ services: demoVizServices(), source: 'demo', loading: Boolean(supabase) })

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('services')
      .select('id, slug, title, icon, price, status, generation_mode, document_template, form_config')
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          setState({ services: demoVizServices(), source: 'demo', loading: false })
          return
        }
        setState({ services: (data as ServiceRowLike[]).map(liveServiceToViz), source: 'live', loading: false })
      })
  }, [])

  return state
}
