import { createTRPCProxyClient } from '@trpc/client'
import { ipcLink } from 'electron-trpc/renderer'
import superjson from 'superjson'
import type { AppRouter } from '../../../main/trpc/router'

// Proxy client — use trpc.campaigns.list.query() etc.
// Pairs with React Query v5 useQuery({ queryKey, queryFn: () => trpc.X.query() })
export const trpc = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
  transformer: superjson,
})
