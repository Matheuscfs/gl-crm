import { defineConfig } from 'vitest/config'

// Kept apart from vite.config.ts so the PWA plugin does not run during tests.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'supabase/functions/_shared/**/*.ts'],
      reporter: ['text-summary', 'html'],
    },
  },
})
