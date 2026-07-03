import { defineConfig } from '@playwright/test'

// E2E for the ADMIN app (specs/features/template-editor/validation.md).
// Requires a signed-in admin → real Supabase creds via env (E2E_ADMIN_EMAIL /
// E2E_ADMIN_PASSWORD + the app's VITE_SUPABASE_* in .env.local). Specs guard
// themselves with test.skip() when creds are absent, so `npx playwright test`
// is always safe to run. Files are named *.e2e.ts so vitest never picks them up.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5174',
  },
  webServer: {
    command: 'npm run dev:admin',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
