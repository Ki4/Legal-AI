#!/usr/bin/env node
/**
 * legal-docs-mcp-server — stdio entry point.
 *
 * STDOUT IS THE PROTOCOL CHANNEL: every diagnostic goes to stderr (console.error).
 * A single console.log here corrupts MCP framing.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { supabaseCatalogSource } from './catalog.js'
import { loadConfig, outDir } from './env.js'
import { buildRegistry } from './registry.js'
import { createMcpServer, SERVER_NAME } from './server.js'

async function main(): Promise<void> {
  let config
  try {
    config = loadConfig()
  } catch (error) {
    console.error(`[${SERVER_NAME}] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  const source = supabaseCatalogSource(config)
  const tools = await buildRegistry({ source, groqApiKey: config.groqApiKey, outDir })
  console.error(
    `[${SERVER_NAME}] ${tools.length} tools registered: ${tools.map((t) => t.name).join(', ')}` +
      (config.groqApiKey ? '' : ' (GROQ_API_KEY відсутній — відмінки ПІБ будуть у називному)'),
  )

  const server = createMcpServer(tools)
  await server.connect(new StdioServerTransport())
  console.error(`[${SERVER_NAME}] running on stdio`)
}

main().catch((error) => {
  console.error(`[${SERVER_NAME}] fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
  process.exit(1)
})
