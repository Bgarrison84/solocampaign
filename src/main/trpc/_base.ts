import { initTRPC } from '@trpc/server'
import superjson from 'superjson'
import log from 'electron-log/main'

// Context type for all procedures
export type Context = Record<string, never>

// Create root tRPC instance with superjson transformer
export const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error, path }) => {
    // Log all tRPC procedure errors to main.log for diagnosability
    log.error(`[tRPC] ${path ?? 'unknown'}:`, error.message, error.cause ?? '')
    return shape
  },
})
