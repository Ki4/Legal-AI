/**
 * E2E driver: speaks real MCP JSON-RPC over stdio to the server against LIVE
 * Supabase (needs apps/client/.env.local). Run: npx tsx e2e/stdio-e2e.mts
 *
 * Beats (validation.md): initialize → tools/list (4 tools) → list_services →
 * validate_params (partial) → generate alimony with broken ІПН (structured 400)
 * → generate alimony with valid answers (watermarked draft saved) → generate
 * divorce (needs_review kill-switch refusal).
 *
 * Uses the fictional SAMPLE_ANSWERS persona — no real PII.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { SAMPLE_ANSWERS } from '../../client/src/admin/lib/sampleAnswers'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const validAnswers: Record<string, unknown> = {
  ...(SAMPLE_ANSWERS.alimony as Record<string, unknown>),
  // sampleAnswers ships a checksum-invalid ІПН (client never validated samples);
  // patched the same way generate.test.ts does. Fix tracked separately.
  defendant_tax_number: '2845678905',
}
const brokenAnswers = { ...validAnswers, tax_number: '1234567890' } // broken checksum

interface Pending {
  resolve: (v: Record<string, unknown>) => void
  reject: (e: Error) => void
  timer: NodeJS.Timeout
}

const child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'src/index.ts'], {
  cwd: serverRoot,
  stdio: ['pipe', 'pipe', 'pipe'],
})
child.stderr.on('data', (d: Buffer) => process.stderr.write(`[server] ${d}`))

const pending = new Map<number, Pending>()
let buffer = ''
child.stdout.on('data', (d: Buffer) => {
  buffer += d.toString('utf8')
  let nl: number
  while ((nl = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, nl).trim()
    buffer = buffer.slice(nl + 1)
    if (!line) continue
    const msg = JSON.parse(line) as Record<string, unknown>
    const id = msg.id as number | undefined
    if (id !== undefined && pending.has(id)) {
      const p = pending.get(id)!
      pending.delete(id)
      clearTimeout(p.timer)
      p.resolve(msg)
    }
  }
})

let nextId = 0
function request(method: string, params: Record<string, unknown>, timeoutMs = 45_000): Promise<Record<string, unknown>> {
  const id = ++nextId
  const frame = JSON.stringify({ jsonrpc: '2.0', id, method, params })
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`timeout waiting for ${method} (id ${id})`))
    }, timeoutMs)
    pending.set(id, { resolve, reject, timer })
    child.stdin.write(frame + '\n')
  })
}
function notify(method: string): void {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n')
}

function result(msg: Record<string, unknown>): Record<string, unknown> {
  if (msg.error) throw new Error(`JSON-RPC error: ${JSON.stringify(msg.error)}`)
  return msg.result as Record<string, unknown>
}
function toolJson(res: Record<string, unknown>): Record<string, unknown> {
  const content = res.content as Array<{ type: string; text: string }>
  return JSON.parse(content[0].text) as Record<string, unknown>
}

let failures = 0
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

try {
  const init = result(
    await request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'stdio-e2e', version: '0.0.1' },
    }),
  )
  check('initialize', (init.serverInfo as { name?: string })?.name === 'legal-docs-mcp-server')
  notify('notifications/initialized')

  const list = result(await request('tools/list', {}))
  const toolNames = (list.tools as Array<{ name: string }>).map((t) => t.name)
  console.log(`   tools: ${toolNames.join(', ')}`)
  check(
    'tools/list — 4 expected tools',
    ['list_services', 'validate_params', 'generate_alimony_document', 'generate_divorce_document'].every((n) =>
      toolNames.includes(n),
    ),
    `${toolNames.length} tools`,
  )

  const services = toolJson(result(await request('tools/call', { name: 'list_services', arguments: {} }))) as unknown as Array<
    Record<string, unknown>
  >
  const alimony = services.find((s) => s.slug === 'alimony')
  const divorce = services.find((s) => s.slug === 'divorce')
  console.log(`   statuses: ${services.map((s) => `${s.slug}=${s.status}`).join(', ')}`)
  check('list_services — alimony present', Boolean(alimony), String(alimony?.status))
  check('list_services — divorce needs_review (kill-switch demo precondition)', divorce?.status === 'needs_review')

  const vp = result(
    await request('tools/call', {
      name: 'validate_params',
      arguments: { service: 'alimony', params: { last_name: 'Іванова', birth_date: '15.03.1990' } },
    }),
  )
  const vpReport = toolJson(vp) as { ok: boolean; errors: Array<{ field: string }>; missing_required: unknown[] }
  check(
    'validate_params — catches bad date format, lists missing required',
    vp.isError !== true && vpReport.ok === false && vpReport.errors.some((e) => e.field === 'birth_date') && vpReport.missing_required.length > 0,
    `${vpReport.errors.length} errors, ${vpReport.missing_required.length} missing`,
  )

  const bad = result(
    await request('tools/call', { name: 'generate_alimony_document', arguments: brokenAnswers }),
  )
  const badPayload = toolJson(bad) as { error_type?: string; errors?: Array<{ field: string; message: string }> }
  const innError = badPayload.errors?.find((e) => e.field === 'tax_number')
  check(
    'generate alimony (broken ІПН) — structured 400 loop',
    bad.isError === true && badPayload.error_type === 'validation' && Boolean(innError),
    innError?.message ?? JSON.stringify(badPayload).slice(0, 120),
  )

  const good = result(
    await request('tools/call', { name: 'generate_alimony_document', arguments: validAnswers }, 90_000),
  )
  const meta = toolJson(good) as {
    ok?: boolean
    saved_to?: string
    excerpt?: string
    checklist?: { ok: boolean }
    declension?: { used_ai: boolean }
  }
  const fullText = (good.content as Array<{ text: string }>)[1]?.text ?? ''
  check(
    'generate alimony (valid) — draft generated',
    good.isError !== true && meta.ok === true && meta.checklist?.ok === true,
    `declension.used_ai=${meta.declension?.used_ai}`,
  )
  check('   watermark top+bottom', fullText.startsWith('═') && fullText.endsWith('═'.repeat(66)))
  check('   saved file path returned', Boolean(meta.saved_to), meta.saved_to)
  console.log(`   excerpt: ${meta.excerpt?.slice(0, 90)}…`)

  const refusal = result(await request('tools/call', { name: 'generate_divorce_document', arguments: {} }))
  const refusalPayload = toolJson(refusal) as { error_type?: string }
  check(
    'generate divorce — kill-switch refusal (needs_review)',
    refusal.isError === true && refusalPayload.error_type === 'service_unavailable',
    refusalPayload.error_type,
  )

  console.log(failures === 0 ? '\nE2E: ALL PASS' : `\nE2E: ${failures} FAILURES`)
} finally {
  child.kill()
}
process.exit(failures === 0 ? 0 : 1)
