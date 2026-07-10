# legal-docs-mcp-server (PoC)

Deterministic legal-document generation over MCP. The LLM interviews the user and collects **raw form answers**; this server validates every parameter (structured Ukrainian errors → the LLM re-asks) and renders the document via the existing doc-engine (`n8n/templates/render-document.js`). The LLM never writes legal text.

Spec: `specs/features/mcp-document-service/` · Issue: #96

_Full README (tools, demo script, PII notes) lands with T7._

## Quick start

```bash
npm install
npm run typecheck && npm test   # offline
npm run inspect                 # MCP Inspector against live Supabase (needs apps/client/.env.local)
```
