/**
 * content tRPC router.
 * Serves bundled D&D 5e content from the module-level cache in contentLoader.
 * All queries hit in-memory cache (no disk I/O per request).
 *
 * Content files: races.json, classes.json, backgrounds.json, equipment.json,
 * spells-by-class.json — loaded once at startup via loadContent().
 */

import { z } from 'zod'
import { t } from '../_base'
import { loadContent } from '../../db/contentLoader'

export const contentRouter = t.router({
  races: t.router({
    /**
     * List all available races/species from bundled content.
     * Returns Race[] — each entry has full stat block text for wizard display (D-06).
     */
    list: t.procedure.query(() => loadContent().races),
  }),

  classes: t.router({
    /**
     * List all available classes from bundled content.
     * Returns DndClass[] with level-1 features, equipment packages, and subclasses.
     */
    list: t.procedure.query(() => loadContent().classes),
  }),

  backgrounds: t.router({
    /**
     * List all available backgrounds from bundled content.
     * Returns Background[] with skill proficiencies, features, and starting equipment.
     */
    list: t.procedure.query(() => loadContent().backgrounds),
  }),

  equipment: t.router({
    /**
     * List equipment packages for a given class name.
     * Returns EquipmentPackageOption[] (2–3 options per class, D-12).
     * Returns empty array if class has no equipment data.
     */
    listForClass: t.procedure
      .input(z.object({ className: z.string() }))
      .query(({ input }) => loadContent().equipment[input.className] ?? []),
  }),

  spellSlots: t.router({
    /**
     * Get the spell slot table for a given class name.
     * Returns SpellSlotsByClass entry keyed by level, or null if class is not a spellcaster.
     */
    forClass: t.procedure
      .input(z.object({ className: z.string() }))
      .query(({ input }) => loadContent().spellSlotsByClass[input.className] ?? null),
  }),
})
