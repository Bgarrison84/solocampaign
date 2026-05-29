import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import reactPlugin from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['electron-store'] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
        },
        // Explicitly externalize better-sqlite3 for native module support
        external: ['better-sqlite3'],
      },
    },
  },

  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['electron-trpc'] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
        },
      },
    },
  },

  renderer: {
    root: resolve('src/renderer'),

    plugins: [tailwindcss(), reactPlugin()],

    resolve: {
      alias: {
        // shadcn/ui components use `import { cn } from "src/renderer/src/lib/utils"` (absolute
        // path from project root matching tsconfig baseUrl). Add an explicit Rollup alias so the
        // production build resolves the same path that tsconfig's baseUrl="." resolves at typecheck.
        'src/renderer/src': resolve('src/renderer/src'),
      },
    },

    server: {
      port: 5173,
    },

    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
        },
      },
    },
  },
})
