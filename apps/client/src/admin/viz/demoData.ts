// Self-contained demo dataset for the visualization lab.
// Shapes mirror the REAL domain types (FormField/show_if from types/form, the admin Service
// entity, and the law_chunks / law_relations tables) so a later swap to live Supabase data is trivial.
// Numbers (requests, revenue, conversion) are illustrative placeholders for the prioritization layer.

import type { FormField, FormTab } from '../../types/form'
import type { NodeKind, Health } from './theme'

// ─── Graph nodes (law → article → service → document) ────────────────────────
// Coordinates are hand-laid for the layered "Що на що впливає" stage (1080×560).
export interface VizNode {
  id: string
  kind: NodeKind
  label: string
  sub: string
  x: number
  y: number
  w: number
  h: number
  meta?: string
}

export const NODES: VizNode[] = [
  // laws
  { id: 'sk',  kind: 'law', x: 8, y: 60,  w: 185, h: 66, label: 'Сімейний кодекс',  sub: 'СК України' },
  { id: 'cpk', kind: 'law', x: 8, y: 255, w: 185, h: 66, label: 'Цивільний процес.', sub: 'ЦПК України' },
  { id: 'psz', kind: 'law', x: 8, y: 445, w: 185, h: 66, label: 'Про судовий збір',  sub: 'ЗУ № 3674-VI' },
  // articles
  { id: 'a110',  kind: 'art', x: 248, y: 24,  w: 205, h: 60, label: 'ст. 110',    sub: 'Підстави розірвання' },
  { id: 'a6070', kind: 'art', x: 248, y: 114, w: 205, h: 60, label: 'ст. 60, 70', sub: 'Спільна власність' },
  { id: 'a180',  kind: 'art', x: 248, y: 204, w: 205, h: 60, label: 'ст. 180',    sub: 'Утримання дитини' },
  { id: 'a182',  kind: 'art', x: 248, y: 294, w: 205, h: 60, label: 'ст. 182',    sub: 'Розмір аліментів' },
  { id: 'c175',  kind: 'art', x: 248, y: 394, w: 205, h: 60, label: 'ст. 175',    sub: 'Форма позовної заяви' },
  { id: 'z4',    kind: 'art', x: 248, y: 484, w: 205, h: 60, label: 'ст. 4',      sub: 'Ставки судового збору' },
  // services
  { id: 'divorce',  kind: 'srv', x: 508, y: 42,  w: 200, h: 84, label: 'Розірвання шлюбу',    sub: '55 полів · 4 таби', meta: '32 заявки/міс' },
  { id: 'alimony',  kind: 'srv', x: 508, y: 240, w: 200, h: 84, label: 'Стягнення аліментів', sub: '24 поля · 4 таби',  meta: '21 заявка/міс' },
  { id: 'property', kind: 'srv', x: 508, y: 440, w: 200, h: 84, label: 'Поділ майна',         sub: 'чернетка',          meta: '12 заявок/міс' },
  // documents
  { id: 'ddoc', kind: 'doc', x: 760, y: 53,  w: 165, h: 62, label: 'Позовна заява', sub: 'розірвання шлюбу' },
  { id: 'adoc', kind: 'doc', x: 760, y: 251, w: 165, h: 62, label: 'Позовна заява', sub: 'аліменти' },
  { id: 'pdoc', kind: 'doc', x: 760, y: 451, w: 165, h: 62, label: 'Шаблон',        sub: 'готується' },
]

// directed edges (source → target)
export const EDGES: [string, string][] = [
  ['sk', 'a110'], ['sk', 'a6070'], ['sk', 'a180'], ['sk', 'a182'],
  ['cpk', 'c175'], ['psz', 'z4'],
  ['a110', 'divorce'], ['a6070', 'property'], ['a6070', 'divorce'],
  ['a180', 'alimony'], ['a180', 'divorce'], ['a182', 'alimony'],
  ['c175', 'divorce'], ['c175', 'alimony'], ['c175', 'property'],
  ['z4', 'divorce'], ['z4', 'alimony'], ['z4', 'property'],
  ['divorce', 'ddoc'], ['alimony', 'adoc'], ['property', 'pdoc'],
]

// ─── Service business metrics (prioritization layer) ─────────────────────────
export type ServiceStatus = 'active' | 'draft' | 'needs_review' | 'disabled'

export interface ServiceMetrics {
  id: string
  slug: string
  title: string
  health: Health
  status: ServiceStatus
  price: number               // ₴ per generated document
  requestsPerMonth: number    // demand
  revenue: number             // ₴ / month
  conversion: number          // 0..1, form opened → document generated
  abandoned: number           // started-but-dropped forms / month
  fields: { used: number; extra: number; missing: number; total: number }
  issues: number              // open problems blocking "ready"
  // which article ids this service depends on (for fix-impact)
  articles: string[]
}

export const SERVICES: ServiceMetrics[] = [
  {
    id: 'divorce', slug: 'divorce', title: 'Розірвання шлюбу',
    health: 'warn', status: 'needs_review', price: 1500,
    requestsPerMonth: 32, revenue: 48000, conversion: 0.71, abandoned: 13,
    fields: { used: 51, extra: 2, missing: 2, total: 55 }, issues: 2,
    articles: ['a110', 'a6070', 'a180', 'c175', 'z4'],
  },
  {
    id: 'alimony', slug: 'alimony', title: 'Стягнення аліментів',
    health: 'ok', status: 'active', price: 1400,
    requestsPerMonth: 21, revenue: 29400, conversion: 0.64, abandoned: 12,
    fields: { used: 24, extra: 0, missing: 0, total: 24 }, issues: 0,
    articles: ['a180', 'a182', 'c175', 'z4'],
  },
  {
    id: 'property', slug: 'property', title: 'Поділ майна',
    health: 'problem', status: 'draft', price: 0,
    requestsPerMonth: 12, revenue: 0, conversion: 0, abandoned: 12,
    fields: { used: 0, extra: 0, missing: 9, total: 9 }, issues: 4,
    articles: ['a6070', 'c175', 'z4'],
  },
]

export const serviceById = (id: string): ServiceMetrics | undefined =>
  SERVICES.find((s) => s.id === id)

// ─── Law changes (monitoring layer + impact) ─────────────────────────────────
export type ChangeSeverity = 'warn' | 'info'

export interface LawChange {
  id: string
  article: string            // article node id it touches
  ref: string                // human label, e.g. "ст. 182 СК"
  title: string
  severity: ChangeSeverity
  date: string               // ISO
}

export const CHANGES: LawChange[] = [
  { id: 'ch1', article: 'a182', ref: 'ст. 182 СК',  title: 'Нова формула розміру аліментів',        severity: 'warn', date: '2026-05-18' },
  { id: 'ch2', article: 'z4',   ref: 'ст. 4 ЗУ',    title: 'Оновлені ставки судового збору',         severity: 'warn', date: '2026-04-30' },
  { id: 'ch3', article: 'c175', ref: 'ст. 175 ЦПК', title: 'Уточнено перелік додатків до заяви',     severity: 'info', date: '2026-03-12' },
]

/** Services touched by a law change, with summed revenue at risk (fix-impact). */
export function changeImpact(change: LawChange): { services: ServiceMetrics[]; revenueAtRisk: number } {
  const services = SERVICES.filter((s) => s.articles.includes(change.article))
  return { services, revenueAtRisk: services.reduce((sum, s) => sum + s.revenue, 0) }
}

// ─── Divorce form (FieldType / show_if shapes from types/form.ts) ─────────────
// Drives the technical + blueprint views, and is the source the branching tree mirrors.
export const DIVORCE_TABS: FormTab[] = [
  { id: 'parties',  label: 'Сторони' },
  { id: 'marriage', label: 'Шлюб' },
  { id: 'children', label: 'Діти' },
  { id: 'property', label: 'Майно' },
  { id: 'claims',   label: 'Вимоги' },
]

export const DIVORCE_FIELDS: FormField[] = [
  { id: 'first_name',     tab: 'parties',  type: 'text',      label: "Ім'я позивача", required: true },
  { id: 'last_name',      tab: 'parties',  type: 'text',      label: 'Прізвище позивача', required: true },
  { id: 'respondent',     tab: 'parties',  type: 'text',      label: 'ПІБ відповідача', required: true },
  { id: 'marriage_date',  tab: 'marriage', type: 'date',      label: 'Дата реєстрації шлюбу', required: true },
  { id: 'has_children',   tab: 'children', type: 'boolean',   label: 'Є спільні неповнолітні діти?' },
  { id: 'children_count', tab: 'children', type: 'number',    label: 'Кількість дітей', show_if: { field: 'has_children', operator: '==', value: true } },
  { id: 'alimony_claim',  tab: 'children', type: 'boolean',   label: 'Заявити вимогу про аліменти?', show_if: { field: 'has_children', operator: '==', value: true } },
  { id: 'alimony_amount', tab: 'children', type: 'number',    label: 'Розмір аліментів', show_if: { all: [ { field: 'has_children', operator: '==', value: true }, { field: 'alimony_claim', operator: '==', value: true } ] } },
  { id: 'property_dispute', tab: 'property', type: 'boolean',  label: 'Є спір про спільне майно?' },
  { id: 'property_details', tab: 'property', type: 'textarea', label: 'Опис майна', show_if: { field: 'property_dispute', operator: '==', value: true } },
  { id: 'debt_details',     tab: 'property', type: 'textarea', label: 'Опис спільних боргів', show_if: { field: 'property_dispute', operator: '==', value: true } },
  { id: 'court_costs_on',   tab: 'claims',   type: 'choice',   label: 'Хто несе судові витрати', options: [ { value: 'respondent', label: 'Відповідач' }, { value: 'split', label: 'Порівну' } ] },
]

// Field anatomy: how each field maps onto the printed document.
export type FieldMapping = 'used' | 'extra' | 'missing'

// used = form↔template aligned · extra = asked but template ignores · missing = template needs, form never asks
export const DIVORCE_FIELD_MAP: Record<string, FieldMapping> = {
  first_name: 'used', last_name: 'used', respondent: 'used',
  marriage_date: 'used', has_children: 'extra', children_count: 'used',
  alimony_claim: 'extra', alimony_amount: 'used', property_dispute: 'used',
  property_details: 'missing', debt_details: 'missing', court_costs_on: 'used',
}

// ─── Form branching tree (decision/algorithm view) ───────────────────────────
// Hand-authored to mirror the show_if logic above; in production this would be derived from it.
export interface FlowStep {
  id: string
  label: string
  kind: 'start' | 'always' | 'gate' | 'field' | 'end'
  hint?: string
  flag?: FieldMapping             // anatomy flag for field steps
  yes?: FlowStep[]                // branch taken when a gate is true
}

export const DIVORCE_FLOW: FlowStep[] = [
  { id: 'start', kind: 'start', label: 'Старт форми', hint: '/divorce' },
  { id: 'parties',  kind: 'always', label: 'Сторони', hint: 'позивач · відповідач' },
  { id: 'marriage', kind: 'always', label: 'Дата шлюбу' },
  {
    id: 'has_children', kind: 'gate', label: 'Є спільні діти?',
    yes: [
      { id: 'children_count', kind: 'field', label: 'Кількість дітей', flag: 'used' },
      {
        id: 'alimony_claim', kind: 'gate', label: 'Заявити аліменти?',
        yes: [
          { id: 'alimony_amount', kind: 'field', label: 'Розмір аліментів', flag: 'used' },
        ],
      },
    ],
  },
  {
    id: 'property_dispute', kind: 'gate', label: 'Спір про майно?',
    yes: [
      { id: 'property_details', kind: 'field', label: 'Опис майна', flag: 'missing' },
      { id: 'debt_details', kind: 'field', label: 'Опис боргів', flag: 'missing' },
    ],
  },
  { id: 'court_costs', kind: 'always', label: 'Судові витрати' },
  { id: 'end', kind: 'end', label: 'Позовна заява' },
]

// ─── Technical pipeline (how a service is actually implemented) ───────────────
export interface PipelineStage {
  id: string
  label: string
  tech: string
  detail: string
  status: Health
}

export const DIVORCE_PIPELINE: PipelineStage[] = [
  { id: 'form',     label: 'Форма клієнта',  tech: 'React · Mini App',    detail: '4 таби · 55 полів',           status: 'ok' },
  { id: 'submit',   label: 'Прийом заявки',  tech: 'n8n · form-submit',   detail: 'webhook → валідація',         status: 'ok' },
  { id: 'store',    label: 'Збереження',     tech: 'Supabase · Postgres', detail: 'requests · answers (jsonb)',   status: 'ok' },
  { id: 'template', label: 'Збірка документа', tech: 'Handlebars',        detail: '2 поля шаблон ще не отримує',  status: 'warn' },
  { id: 'pdf',      label: 'PDF на видачу',  tech: 'n8n · PDF',           detail: 'позовна заява · .pdf',         status: 'ok' },
]
