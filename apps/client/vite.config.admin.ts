import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Repo root (apps/client → apps → repo) — used to alias the doc-engine SSoT renderer.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

// Redirect all HTML requests to admin.html in dev mode
function adminSpaFallback(): Plugin {
  return {
    name: 'admin-spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        // Rewrite root and all non-asset requests to admin.html
        if (req.url && !req.url.startsWith('/@') && !req.url.startsWith('/src') && !req.url.startsWith('/node_modules') && !req.url.includes('.')) {
          req.url = '/admin.html'
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), adminSpaFallback()],
  resolve: {
    // Import the REAL doc-engine (n8n/templates/render-document.js, pure JS) — no copy,
    // no drift. See DECISIONS #66 (deferred browser-render slice, revisited session 47).
    alias: { '@doc-engine': resolve(repoRoot, 'n8n/templates/render-document.js') },
  },
  server: {
    // Let the dev server read the aliased engine that lives outside apps/client.
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: 'dist-admin',
    emptyOutDir: true,
    commonjsOptions: {
      // render-document.js is CJS (shared with n8n) and lives outside node_modules,
      // so the commonjs plugin skips it by default → its module.exports is invisible.
      // Opt it in so the aliased engine transforms correctly.
      include: [/node_modules/, /render-document\.js$/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      input: 'admin.html',
    },
  },
})
