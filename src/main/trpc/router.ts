import { t } from './_base'
import { aiRouter } from './routers/ai'
import { campaignsRouter } from './routers/campaigns'
import { charactersRouter } from './routers/characters'
import { combatRouter } from './routers/combat'
import { contentRouter } from './routers/content'
import { prefsRouter } from './routers/prefs'
import { secretsRouter } from './routers/secrets'
import { sessionsRouter } from './routers/sessions'
import { windowRouter } from './routers/window'

export const router = t.router({
  ai: aiRouter,
  campaigns: campaignsRouter,
  characters: charactersRouter,
  combat: combatRouter,
  content: contentRouter,
  prefs: prefsRouter,
  secrets: secretsRouter,
  sessions: sessionsRouter,
  window: windowRouter,
})

export type AppRouter = typeof router
