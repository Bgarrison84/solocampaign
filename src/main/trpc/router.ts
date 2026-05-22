import { t } from './_base'
import { campaignsRouter } from './routers/campaigns'
import { prefsRouter } from './routers/prefs'
import { secretsRouter } from './routers/secrets'
import { windowRouter } from './routers/window'

export const router = t.router({
  campaigns: campaignsRouter,
  prefs: prefsRouter,
  secrets: secretsRouter,
  window: windowRouter,
})

export type AppRouter = typeof router
