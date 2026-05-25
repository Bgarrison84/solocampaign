/**
 * Content loader for bundled D&D 5e JSON files.
 * Reads from resources/ directory using the same two-branch path resolution
 * as migrate.ts (Pitfall #2: ASAR + extraResources).
 *
 * Module-level singleton cache — loaded once at startup, never reloaded.
 */

import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import log from 'electron-log'
import type { Race, DndClass, Background, EquipmentPackageOption, SpellSlotsByClass } from './contentTypes'

export interface ContentCache {
  races: Race[]
  classes: DndClass[]
  backgrounds: Background[]
  equipment: Record<string, EquipmentPackageOption[]>
  spellSlotsByClass: SpellSlotsByClass
}

let _content: ContentCache | null = null

/**
 * Resolve the resources directory path.
 * Dev: path.join(__dirname, '../../resources')
 * Packaged: process.resourcesPath
 */
function getResourcesPath(): string {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, '../../resources')
}

/**
 * Load all bundled content JSON files and return a cached ContentCache.
 * Subsequent calls return the cached object without re-reading disk.
 */
export function loadContent(): ContentCache {
  if (_content) return _content

  const rp = getResourcesPath()

  try {
    _content = {
      races: JSON.parse(fs.readFileSync(path.join(rp, 'races.json'), 'utf-8')) as Race[],
      classes: JSON.parse(fs.readFileSync(path.join(rp, 'classes.json'), 'utf-8')) as DndClass[],
      backgrounds: JSON.parse(
        fs.readFileSync(path.join(rp, 'backgrounds.json'), 'utf-8'),
      ) as Background[],
      equipment: JSON.parse(
        fs.readFileSync(path.join(rp, 'equipment.json'), 'utf-8'),
      ) as Record<string, EquipmentPackageOption[]>,
      spellSlotsByClass: JSON.parse(
        fs.readFileSync(path.join(rp, 'spells-by-class.json'), 'utf-8'),
      ) as SpellSlotsByClass,
    }
  } catch (err) {
    log.error('[contentLoader] failed to load content JSON:', err)
    throw err
  }

  return _content
}

/**
 * Reset the content cache (for testing only).
 */
export function _resetContentCache(): void {
  _content = null
}
