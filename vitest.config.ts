import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    server: {
      deps: {
        // unpdf is ESM-only; inline it so Vite transforms it rather than loading CJS
        inline: ['unpdf'],
      },
    },
  },
})
