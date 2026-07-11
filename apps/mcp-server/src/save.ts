/**
 * save.ts — persists a watermarked draft to disk (plan D5, task T5).
 * Filename carries only the slug + timestamp — NEVER user data (PII rule).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Writes `DRAFT-<slug>-<YYYYMMDD>-<HHMMSS>.txt` (UTF-8, local time) into
 * `outDir` (created if missing) and returns the absolute file path.
 */
export function saveDraft(outDir: string, slug: string, text: string, now: Date): string {
  mkdirSync(outDir, { recursive: true })
  const stamp =
    `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}` +
    `-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
  const filePath = path.resolve(outDir, `DRAFT-${slug}-${stamp}.txt`)
  writeFileSync(filePath, text, 'utf8')
  return filePath
}
