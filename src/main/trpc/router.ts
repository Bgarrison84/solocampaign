import { t } from './_base'
import { aiRouter } from './routers/ai'
import { appPrefsRouter } from './routers/appPrefs'
import { campaignDocsRouter } from './routers/campaignDocs'
import { campaignsRouter } from './routers/campaigns'
import { charactersRouter } from './routers/characters'
import { combatRouter } from './routers/combat'
import { contentRouter } from './routers/content'
import { featsRouter } from './routers/feats'
import { libraryRouter } from './routers/library'
import { npcsRouter } from './routers/npcs'
import { prefsRouter } from './routers/prefs'
import { questsRouter } from './routers/quests'
import { secretsRouter } from './routers/secrets'
import { sessionsRouter } from './routers/sessions'
import { spellsRouter } from './routers/spells'
import { windowRouter } from './routers/window'
import { worldStateRouter, factionsRouter } from './routers/worldState'

export const router = t.router({
  ai: aiRouter,
  appPrefs: appPrefsRouter,
  campaignDocs: campaignDocsRouter,
  campaigns: campaignsRouter,
  characters: charactersRouter,
  combat: combatRouter,
  content: contentRouter,
  factions: factionsRouter,
  feats: featsRouter,
  library: libraryRouter,
  npcs: npcsRouter,
  prefs: prefsRouter,
  quests: questsRouter,
  secrets: secretsRouter,
  sessions: sessionsRouter,
  spells: spellsRouter,
  window: windowRouter,
  worldState: worldStateRouter,
})

export type AppRouter = typeof router
