import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror the tsconfig `@/*` → app-root alias. vite-tsconfig-paths is
    // ESM-only and cannot load in this config (see APP_CONTEXT gotchas), so
    // the alias is declared explicitly.
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
