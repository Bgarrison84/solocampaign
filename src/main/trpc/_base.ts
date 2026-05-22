import { initTRPC } from '@trpc/server'
import superjson from 'superjson'

// Context type for all procedures
export type Context = Record<string, never>

// Create root tRPC instance with superjson transformer
export const t = initTRPC.context<Context>().create({
  transformer: superjson,
})
