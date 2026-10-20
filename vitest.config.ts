import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: [
      // `import 'server-only'` throws outside a React Server Component bundle.
      { find: /^server-only$/, replacement: path.resolve(__dirname, 'tests/stubs/server-only.ts') },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, '$1') },
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
    unstubEnvs: true,
  },
})
