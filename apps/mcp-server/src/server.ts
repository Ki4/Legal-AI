/**
 * MCP wiring over the transport-agnostic registry.
 *
 * Deliberately the LOW-LEVEL Server + setRequestHandler (not McpServer.registerTool):
 * our tool schemas are raw JSON Schema generated at runtime from DB form_config,
 * and SDK-side Zod argument validation must NOT run — the validate engine owns
 * validation and answers with structured Ukrainian payloads the LLM self-corrects
 * from (plan D1; conscious deviation from the mcp-builder default guidance).
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { RegisteredTool } from './types.js'

export const SERVER_NAME = 'legal-docs-mcp-server'
export const SERVER_VERSION = '0.1.0'

export function createMcpServer(tools: RegisteredTool[]): Server {
  const byName = new Map(tools.map((t) => [t.name, t]))

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Tool['inputSchema'],
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = byName.get(request.params.name)
    if (!tool) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: `Unknown tool: ${request.params.name}` }],
      }
    }
    try {
      const result = await tool.execute((request.params.arguments ?? {}) as Record<string, unknown>)
      return { isError: result.isError, content: result.content }
    } catch (error) {
      // Belt-and-braces: execute() implementations already catch their own errors.
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error'
      console.error(`[server] ${request.params.name}: unhandled — ${reason}`)
      return {
        isError: true,
        content: [{ type: 'text' as const, text: `Internal server error in ${request.params.name}: ${reason}` }],
      }
    }
  })

  return server
}
