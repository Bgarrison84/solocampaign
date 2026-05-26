import { t } from './_base'
import { aiRouter } from './routers/ai'
import { campaignsRouter } from './routers/campaigns'
import { charactersRouter } from './routers/characters'
import { contentRouter } from './routers/content'
import { prefsRouter } from './routers/prefs'
import { secretsRouter } from './routers/secrets'
import { windowRouter } from './routers/window'

export const router = t.router({
  ai: aiRouter,
  campaigns: campaignsRouter,
  characters: charactersRouter,
  content: contentRouter,
  prefs: prefsRouter,
  secrets: secretsRouter,
  window: windowRouter,
})

export type AppRouter = typeof router
