/**
 * Transport-agnostic tool registry (plan D5) — the seam reused by the Phase-2
 * web agent loop. 2 fixed tools (list_services, validate_params) + one dynamic
 * generate_<slug>_document per catalog service, inputSchema generated from the
 * service's form_config.
 */
import type { CatalogSource } from './catalog.js'
import { formConfigToJsonSchema } from './form-schema.js'
import { generateDocument } from './generate.js'
import type { ErrorPayload, RegisteredTool, ServiceRow, ToolResult } from './types.js'
import { validateAnswers } from './validate.js'

export interface RegistryDeps {
  source: CatalogSource
  groqApiKey: string | null
  outDir: string
}

export function toolNameForSlug(slug: string): string {
  return `generate_${slug.replace(/-/g, '_')}_document`
}

const STATUS_UA: Record<string, string> = {
  active: 'Активна — генерація доступна.',
  needs_review: 'На перевірці юриста — генерація тимчасово вимкнена (запобіжник якості).',
  disabled: 'Вимкнена.',
}

function jsonResult(data: unknown, isError = false): ToolResult {
  return { isError, content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function serviceErrorPayload(
  service: string,
  errorType: ErrorPayload['error_type'],
  message: string,
  hint: string,
  nextAction: string,
): ErrorPayload {
  return {
    ok: false,
    service,
    error_type: errorType,
    errors: [{ field: null, label: null, problem: errorType === 'validation' ? 'invalid_option' : 'internal_error', message, hint }],
    warnings: [],
    next_action: nextAction,
  }
}

function makeGenerateTool(service: ServiceRow, deps: RegistryDeps): RegisteredTool {
  const parts = [
    `${service.title}.`,
    service.description ?? null,
    service.price != null ? `Вартість: ${service.price} грн.` : null,
    "Параметри — СИРІ відповіді форми (див. описи полів у схемі). Дати — YYYY-MM-DD. Перед викликом ОБОВ'ЯЗКОВО покажіть користувачеві зведення зібраних даних і отримайте підтвердження.",
    'Результат — ЧЕРНЕТКА для перевірки юристом, не юридична консультація.',
    service.status !== 'active'
      ? '⚠️ Наразі на перевірці юриста — виклик поверне структуровану відмову (це очікувано).'
      : null,
  ].filter((p): p is string => p !== null)

  return {
    name: toolNameForSlug(service.slug),
    description: parts.join(' '),
    inputSchema: formConfigToJsonSchema(service.form_config),
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      // Live status re-check (plan D4): an admin flip acts immediately, without restart.
      let fresh
      try {
        fresh = await deps.source.fetchFresh(service.slug)
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'невідома помилка'
        console.error(`[registry] ${service.slug}: fresh status fetch failed — ${reason}`)
        return jsonResult(
          serviceErrorPayload(
            service.slug,
            'internal_error',
            'Не вдалося перевірити актуальний статус послуги (помилка звернення до бази).',
            'Тимчасова інфраструктурна помилка — спробуйте ще раз за хвилину.',
            'Повторіть виклик пізніше. НЕ намагайтеся скласти документ самостійно.',
          ),
          true,
        )
      }
      if (fresh === null) {
        return jsonResult(
          serviceErrorPayload(
            service.slug,
            'internal_error',
            'Послугу не знайдено в каталозі (можливо, видалена після старту сервера).',
            'Повідомте адміністратора.',
            'Повідомте адміністратора. НЕ намагайтеся скласти документ самостійно.',
          ),
          true,
        )
      }
      const merged: ServiceRow = {
        ...service,
        status: fresh.status,
        document_template: fresh.document_template,
        required_checklist: fresh.required_checklist,
      }
      return generateDocument(merged, args, { groqApiKey: deps.groqApiKey, outDir: deps.outDir })
    },
  }
}

export async function buildRegistry(deps: RegistryDeps): Promise<RegisteredTool[]> {
  const services = await deps.source.fetchAll()
  const slugs = services.map((s) => s.slug)
  const tools: RegisteredTool[] = []

  tools.push({
    name: 'list_services',
    description:
      'Каталог юридичних послуг цього сервера: slug, назва, статус (active — генерація доступна; needs_review — тимчасово вимкнена юристом), ціна і назва generate-інструмента. Викликайте ПЕРШИМ, перед початком інтерв’ю.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async execute(): Promise<ToolResult> {
      return jsonResult(
        services.map((s) => ({
          slug: s.slug,
          title: s.title,
          description: s.description,
          status: s.status,
          status_explanation_ua: STATUS_UA[s.status] ?? s.status,
          price: s.price,
          tool_name: toolNameForSlug(s.slug),
        })),
      )
    },
  })

  tools.push({
    name: 'validate_params',
    description:
      'Перевірка ЧАСТКОВО зібраних відповідей форми БЕЗ генерації документа: повертає помилки формату, поля приховані умовами та список ще не заповнених обов’язкових полів. Викликайте після кожного блоку питань інтерв’ю.',
    inputSchema: {
      type: 'object',
      properties: {
        service: { type: 'string', enum: slugs, description: 'Slug послуги (див. list_services)' },
        params: { type: 'object', description: 'Часткові відповіді форми — сирі значення полів' },
      },
      required: ['service', 'params'],
      additionalProperties: false,
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      const slug = args.service
      const service = typeof slug === 'string' ? services.find((s) => s.slug === slug) : undefined
      if (!service) {
        return jsonResult(
          serviceErrorPayload(
            typeof slug === 'string' ? slug : '(не вказано)',
            'validation',
            `Невідома послуга. Допустимі значення: ${slugs.join(', ')}.`,
            'Викличте list_services і використайте slug звідти.',
            'Виправте параметр service і повторіть виклик.',
          ),
          true,
        )
      }
      const params =
        args.params !== null && typeof args.params === 'object' && !Array.isArray(args.params)
          ? (args.params as Record<string, unknown>)
          : {}
      const report = validateAnswers(service.form_config, params, 'partial')
      return jsonResult({
        ok: report.ok,
        errors: report.errors,
        warnings: report.warnings,
        missing_required: report.missingRequired,
      })
    },
  })

  for (const service of services) {
    tools.push(makeGenerateTool(service, deps))
  }
  return tools
}
