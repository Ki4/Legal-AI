import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { repoRoot, serverRoot, outDir } from '../env.js'

describe('env paths (cwd-independent)', () => {
  it('resolves repoRoot to the monorepo root', () => {
    expect(existsSync(path.join(repoRoot, 'CLAUDE.md'))).toBe(true)
    expect(existsSync(path.join(repoRoot, 'n8n', 'templates', 'render-document.js'))).toBe(true)
  })

  it('resolves serverRoot to apps/mcp-server', () => {
    expect(existsSync(path.join(serverRoot, 'package.json'))).toBe(true)
    expect(outDir.startsWith(serverRoot)).toBe(true)
  })
})
