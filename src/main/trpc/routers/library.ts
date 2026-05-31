/**
 * Library tRPC router (RULES-01, RULES-02).
 *
 * Exposes SRD reference content from bundled JSON files via sub-routers:
 *   library.feats.list     → resources/feats.json
 *   library.epicBoons.list → resources/epic-boons.json
 *   library.magicItems.list → resources/magic-items.json
 *   library.rules.list     → resources/rules.json
 *   library.monsters.list  → resources/monsters.json
 *
 * Each endpoint uses a per-file module-level cache (loaded once at first call)
 * following the static content cache pattern from spells.ts. Search/filter is
 * client-side — each list returns the full JSON array.
 *
 * Security:
 * - T-07-03-SC: No network access; all content is bundled at build time.
 * - All files are static SRD content with no user input path.
 */

import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import log from 'electron-log'
import { t } from '../_base'

// ─── Type Definitions ─────────────────────────────────────────────────────────

export interface FeatEntry {
  id: string
  name: string
  description: string
  prerequisites: string
}

export interface EpicBoonEntry {
  id: string
  name: string
  description: string
}

export interface MagicItemEntry {
  id: string
  name: string
  rarity: string
  attunement: string
  description: string
}

export interface RuleEntry {
  id: string
  title: string
  category: string
  content: string
}

export interface MonsterEntry {
  id: string
  name: string
  type: string
  cr: string
  ac: number
  hp: number
  speed: string
  abilities: Record<string, number>
  actions: Array<{ name: string; description: string }>
}

// ─── Resource path resolution (mirrors spells.ts) ─────────────────────────────

function getResourcesPath(): string {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, '../../resources')
}

// ─── Module-level caches (loaded once at first call) ──────────────────────────

let _feats: FeatEntry[] | null = null
let _epicBoons: EpicBoonEntry[] | null = null
let _magicItems: MagicItemEntry[] | null = null
let _rules: RuleEntry[] | null = null
let _monsters: MonsterEntry[] | null = null

export function getFeats(): FeatEntry[] {
  if (_feats) return _feats
  const rp = getResourcesPath()
  try {
    _feats = JSON.parse(fs.readFileSync(path.join(rp, 'feats.json'), 'utf-8')) as FeatEntry[]
  } catch (err) {
    log.error('[library] failed to load feats.json:', err)
    throw err
  }
  return _feats
}

export function getEpicBoons(): EpicBoonEntry[] {
  if (_epicBoons) return _epicBoons
  const rp = getResourcesPath()
  try {
    _epicBoons = JSON.parse(
      fs.readFileSync(path.join(rp, 'epic-boons.json'), 'utf-8'),
    ) as EpicBoonEntry[]
  } catch (err) {
    log.error('[library] failed to load epic-boons.json:', err)
    throw err
  }
  return _epicBoons
}

function getMagicItems(): MagicItemEntry[] {
  if (_magicItems) return _magicItems
  const rp = getResourcesPath()
  try {
    _magicItems = JSON.parse(
      fs.readFileSync(path.join(rp, 'magic-items.json'), 'utf-8'),
    ) as MagicItemEntry[]
  } catch (err) {
    log.error('[library] failed to load magic-items.json:', err)
    throw err
  }
  return _magicItems
}

function getRules(): RuleEntry[] {
  if (_rules) return _rules
  const rp = getResourcesPath()
  try {
    _rules = JSON.parse(fs.readFileSync(path.join(rp, 'rules.json'), 'utf-8')) as RuleEntry[]
  } catch (err) {
    log.error('[library] failed to load rules.json:', err)
    throw err
  }
  return _rules
}

function getMonsters(): MonsterEntry[] {
  if (_monsters) return _monsters
  const rp = getResourcesPath()
  try {
    _monsters = JSON.parse(
      fs.readFileSync(path.join(rp, 'monsters.json'), 'utf-8'),
    ) as MonsterEntry[]
  } catch (err) {
    log.error('[library] failed to load monsters.json:', err)
    throw err
  }
  return _monsters
}

// ─── Sub-routers ──────────────────────────────────────────────────────────────

const featsSubRouter = t.router({
  list: t.procedure.query(() => getFeats()),
})

const epicBoonsSubRouter = t.router({
  list: t.procedure.query(() => getEpicBoons()),
})

const magicItemsSubRouter = t.router({
  list: t.procedure.query(() => getMagicItems()),
})

const rulesSubRouter = t.router({
  list: t.procedure.query(() => getRules()),
})

const monstersSubRouter = t.router({
  list: t.procedure.query(() => getMonsters()),
})

// ─── Router ───────────────────────────────────────────────────────────────────

export const libraryRouter = t.router({
  epicBoons: epicBoonsSubRouter,
  feats: featsSubRouter,
  magicItems: magicItemsSubRouter,
  monsters: monstersSubRouter,
  rules: rulesSubRouter,
})
