import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

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
  build: {
    outDir: 'dist-admin',
    emptyOutDir: true,
    rollupOptions: {
      input: 'admin.html',
    },
  },
})
