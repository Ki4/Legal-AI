/**
 * generate.ts — the deterministic generation pipeline (plan D4/D5, task T5):
 *
 *   status gate (kill-switch) → strict validation ("structured 400") →
 *   guarded AI declension ({} fallback) → buildContext → deterministic render →
 *   required-clause checklist (fail-closed: text withheld) → watermark → save.
 *
 * The LLM caller never writes a word of the legal text; every refusal is a
 * structured Ukrainian payload the LLM can self-correct from (isError: true
 * tool result, NOT a protocol error).
 */
import { fetchDeclensions } from './declension.js'
import { loadDocEngine } from './doc-engine.js'
import { saveDraft } from './save.js'
import type { ErrorPayload, ServiceRow, ToolResult } from './types.js'
import { validateAnswers } from './validate.js'

export interface GenerateDeps {
  groqApiKey: string | null
  outDir: string
  /** Injectable for tests (offline) — defaults to the real Groq call. */
  declension?: typeof fetchDeclensions
  /** Injectable for tests — defaults to the wall clock. */
  now?: () => Date
}

export const WATERMARK = 'ЧЕРНЕТКА — потребує перевірки юриста, не є юридичною консультацією'

const BANNER = '═'.repeat(66)
const WATERMARK_BLOCK = `${BANNER}\n${WATERMARK}\n${BANNER}`

/**
 * Deterministic watermark framing (exported for the render-parity test):
 * banner line + WATERMARK + banner line, blank line, text, blank line,
 * then the same banner block again at the end.
 */
export function watermarkText(text: string): string {
  return `${WATERMARK_BLOCK}\n\n${text}\n\n${WATERMARK_BLOCK}`
}

function errorResult(payload: ErrorPayload): ToolResult {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] }
}

function internalErrorPayload(service: ServiceRow, message: string): ErrorPayload {
  return {
    ok: false,
    service: service.slug,
    error_type: 'internal_error',
    errors: [
      {
        field: null,
        label: service.title,
        problem: 'internal_error',
        message,
        hint: 'Це помилка сервера/конфігурації послуги, НЕ даних користувача — повідомте адміністратора.',
      },
    ],
    warnings: [],
    next_action:
      'Повідомте адміністратора про внутрішню помилку. НЕ намагайтеся скласти документ самостійно.',
  }
}

export async function generateDocument(
  service: ServiceRow,
  input: Record<string, unknown>,
  deps: GenerateDeps,
): Promise<ToolResult> {
  // 1) Kill-switch (plan D4): only lawyer-approved templates generate.
  if (service.status !== 'active') {
    return errorResult({
      ok: false,
      service: service.slug,
      error_type: 'service_unavailable',
      errors: [
        {
          field: null,
          label: service.title,
          problem: 'service_unavailable',
          message: `Послуга тимчасово недоступна: шаблон на перевірці юриста (status=${service.status}). Генерацію вимкнено як запобіжник якості.`,
          hint: 'Поясніть користувачеві, що документ буде доступний після перевірки юристом. НЕ намагайтеся скласти документ самостійно.',
        },
      ],
      warnings: [],
      next_action:
        'Поясніть користувачеві, що послуга тимчасово недоступна, і запропонуйте звернутися пізніше. НЕ намагайтеся скласти документ самостійно.',
    })
  }

  // 2) Config sanity: a template-mode service without a template is a config
  //    bug (internal), not a user-data problem.
  if (!service.document_template) {
    return errorResult(
      internalErrorPayload(
        service,
        'Конфігурація послуги неповна: відсутній шаблон документа (document_template). Це дефект налаштування послуги.',
      ),
    )
  }
  const template = service.document_template

  // 3) Strict validation — the "structured 400" loop the LLM self-corrects from.
  const report = validateAnswers(service.form_config, input, 'strict')
  if (!report.ok) {
    return errorResult({
      ok: false,
      service: service.slug,
      error_type: 'validation',
      errors: report.errors,
      warnings: report.warnings,
      next_action:
        'Виправте перелічені поля і викличте інструмент ще раз. НЕ вигадуйте значення — перепитайте користувача.',
    })
  }

  try {
    // 4) Declension — the ONLY AI step; any failure already degraded to {}
    //    inside fetchDeclensions, and buildContext stem-guards every value.
    const groqApiKey = deps.groqApiKey
    const ai = groqApiKey
      ? await (deps.declension ?? fetchDeclensions)(report.cleaned, groqApiKey, service.slug)
      : {}
    const usedAi = Object.keys(ai).length > 0

    // 5) Deterministic render (one buildContext call — nominative fallback inside).
    const engine = loadDocEngine()
    const ctx = engine.buildContext(report.cleaned, ai)
    const rendered = engine.renderDocumentWithStyles(template, ctx)

    // 6) Required-clause checklist — fail-closed: a failure is a TEMPLATE
    //    integrity defect, so the document text is WITHHELD entirely.
    const checklist = engine.validateChecklist(rendered.text, ctx, service.required_checklist)
    if (!checklist.ok) {
      return errorResult({
        ok: false,
        service: service.slug,
        error_type: 'checklist_failed',
        errors: [
          {
            field: null,
            label: service.title,
            problem: 'checklist_failed',
            message: "Згенерований документ не пройшов обов'язковий чеклист цілісності шаблону",
            expected: checklist.missing.map((m) => m.description).join('; '),
            hint: 'Це дефект шаблону/конфігурації послуги, НЕ даних користувача — повідомте адміністратора; документ не видано.',
          },
        ],
        warnings: report.warnings,
        next_action:
          'Повідомте адміністратора про дефект шаблону. Документ не видано — НЕ намагайтеся скласти його самостійно.',
      })
    }

    // 7) Excerpt (from the UNwatermarked text) → watermark → save → success payload.
    const excerpt = engine.deriveExcerpt(rendered.text, service.slug)
    const watermarked = watermarkText(rendered.text)
    const now = (deps.now ?? (() => new Date()))()
    const savedTo = saveDraft(deps.outDir, service.slug, watermarked, now)

    const metadata = {
      ok: true as const,
      service: service.slug,
      saved_to: savedTo,
      excerpt,
      checklist,
      declension: {
        used_ai: usedAi,
        note: usedAi
          ? 'відмінки ПІБ через Groq; при відмові — називний'
          : 'AI-відмінювання не використовувалося — ПІБ у називному відмінку',
      },
      watermark: WATERMARK,
      next_action: 'Покажіть користувачеві документ, нагадайте що це чернетка для перевірки юристом.',
      warnings: report.warnings,
    }
    return {
      isError: false,
      content: [
        { type: 'text', text: JSON.stringify(metadata, null, 2) },
        { type: 'text', text: watermarked },
      ],
    }
  } catch (error) {
    // 8) Anything unexpected in 4–7 → internal_error. Reason string carries
    //    engine/template diagnostics only — never answer values (PII rule).
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : 'невідома помилка'
    console.error(`[generate] ${service.slug}: internal error — ${reason}`)
    return errorResult(internalErrorPayload(service, `Внутрішня помилка генерації: ${reason}`))
  }
}
