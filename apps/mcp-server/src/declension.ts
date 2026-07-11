/**
 * declension.ts — the ONLY AI step in the pipeline, hard-guarded (plan T5).
 *
 * Verbatim port from n8n/workflows/current/form-submit.json:
 *  - prompt + request params: "Prepare Declension" Code node (system prompt built
 *    with \r\n line breaks; user message «Відміни вказані дані. Поверни ТІЛЬКИ JSON.»;
 *    llama-3.3-70b-versatile, temperature 0, max_tokens 400);
 *  - endpoint: "AI Declension" HTTP node → POST https://api.groq.com/openai/v1/chat/completions;
 *  - response parsing (markdown-fence stripping): "Build Document" Code node.
 *
 * Failure policy: NEVER throws, never blocks generation — any HTTP error, parse
 * error or timeout (10s) returns {} and buildContext falls back to the
 * nominative case; every value we DO return still passes buildContext's
 * per-field stem-guard (guardDeclension). PII rule: stderr carries reasons
 * only, never field values. (The n8n node's console.log of names is
 * deliberately NOT ported — stdio discipline + PII.)
 */
import type { Answers } from './types.js'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const TIMEOUT_MS = 10_000

interface GroqMessage {
  role: 'system' | 'user'
  content: string
}

interface GroqRequest {
  model: string
  max_tokens: number
  temperature: number
  messages: GroqMessage[]
}

interface GroqResponse {
  choices?: { message?: { content?: string } }[]
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** Mirror of the n8n "Prepare Declension" Code node (prompt text verbatim, incl. \r\n). */
function buildGroqRequest(answers: Answers, slug?: string): GroqRequest {
  const plaintiffName = [str(answers.last_name), str(answers.first_name), str(answers.middle_name)]
    .filter(Boolean)
    .join(' ')

  // divorce: spouse_*, alimony: defendant_* — handle both
  const defLast = str(answers.defendant_last_name) || str(answers.spouse_last_name)
  const defFirst = str(answers.defendant_first_name) || str(answers.spouse_first_name)
  const defMiddle = str(answers.defendant_middle_name) || str(answers.spouse_middle_name)
  const defendantName = [defLast, defFirst, defMiddle].filter(Boolean).join(' ')

  const marriagePlace = str(answers.marriage_place)

  // Extract children (alimony has cert info after 3rd comma — strip it)
  let childrenLine = ''
  if (answers.children_details) {
    childrenLine = String(answers.children_details)
      .split('\n')
      .map((line) => {
        const parts = line.split(/,\s*/)
        return [parts[0], parts[1]].filter(Boolean).join(', ')
      })
      .filter(Boolean)
      .join('; ')
  }

  // The n8n node reads the slug from workflow context; the MCP pipeline passes it
  // in. Without one, infer from the field convention (alimony = defendant_*).
  const serviceSlug = slug ?? (str(answers.defendant_last_name) ? 'alimony' : 'divorce')
  const serviceLabel = serviceSlug === 'alimony' ? 'аліменти' : 'розлучення'

  let prompt =
    'Ти — помічник для відмінювання українських ПІБ та назв установ для позову про ' +
    serviceLabel +
    '. Відповідай ТІЛЬКИ JSON, без markdown, без пояснень.\r\n\r\nОтримані дані:\r\nПозивач: ' +
    plaintiffName +
    '\r\nВідповідач: ' +
    defendantName +
    '\r\n'
  if (marriagePlace) prompt += 'Місце реєстрації шлюбу: ' + marriagePlace + '\r\n'
  if (childrenLine) prompt += 'Діти: ' + childrenLine + '\r\n'

  prompt +=
    '\r\nПоверни JSON з 6 полями:\r\n- plaintiff_instrumental: ПІБ позивача в орудному відмінку\r\n- plaintiff_genitive: ПІБ позивача в родовому відмінку\r\n- defendant_instrumental: ПІБ відповідача в орудному відмінку (уклали шлюб з ким? або стосунки з ким?)\r\n- defendant_genitive: ПІБ відповідача в родовому відмінку (стягнути з кого?)\r\n- marriage_place_locative: назва установи в місцевому відмінку — null якщо немає\r\n- children_genitive: ПІБ дітей в родовому відмінку з датами "ПІБ, дата р.н." через "; " — null якщо немає\r\n\r\nПриклад:\r\nВхід: Іванова Інна Петрівна / Іванов Іван Іванович / Шевченківський відділ РАЦС у м. Києві / Іванов Олег Іванович, 15.05.2018\r\nВихід: {"plaintiff_instrumental":"Іванову Інну Петрівну","plaintiff_genitive":"Іванової Інни Петрівни","defendant_instrumental":"Івановим Іваном Івановичем","defendant_genitive":"Іванова Івана Івановича","marriage_place_locative":"Шевченківському відділі РАЦС у м. Києві","children_genitive":"Іванова Олега Івановича, 15.05.2018 р.н."}\r\n'

  return {
    model: 'llama-3.3-70b-versatile',
    max_tokens: 400,
    temperature: 0,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: 'Відміни вказані дані. Поверни ТІЛЬКИ JSON.' },
    ],
  }
}

/**
 * Fetches the 6 Ukrainian declension keys from Groq. On ANY failure returns {}
 * (→ nominative fallback inside buildContext). Never throws.
 */
export async function fetchDeclensions(
  answers: Answers,
  apiKey: string,
  slug?: string,
): Promise<Record<string, string>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const request = buildGroqRequest(answers, slug)
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
    if (!res.ok) {
      console.error(`[declension] Groq HTTP ${res.status} — falling back to nominative case`)
      return {}
    }

    const data = (await res.json()) as GroqResponse
    // Mirror of the n8n "Build Document" parse (markdown-fence stripping).
    const raw = data.choices?.[0]?.message?.content || '{}'
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/`/g, '').trim()
    const parsed: unknown = JSON.parse(cleaned)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.error('[declension] Groq returned non-object JSON — falling back to nominative case')
      return {}
    }

    // Keep string values only: null/absent keys make buildContext fall back
    // per-field, and each kept value still faces guardDeclension there.
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') out[key] = value
    }
    return out
  } catch (error) {
    // PII rule: error class only — never field values, never response bodies.
    const reason = error instanceof Error ? error.name : 'unknown error'
    console.error(`[declension] ${reason} — falling back to nominative case`)
    return {}
  } finally {
    clearTimeout(timer)
  }
}
