/**
 * LevelUpBanner — Amber banner shown at top of CharacterSheetTab when XP crosses
 * the next level threshold (D-30, PROG-01, UI-SPEC §S7a).
 *
 * Persists until the level-up is confirmed. Selecting "Not Now" in the modal
 * leaves the banner visible.
 */

import React from 'react'
import { Star } from 'lucide-react'
import { Button } from '../ui/button'

interface LevelUpBannerProps {
  nextLevel: number
  onLevelUp: () => void
}

export function LevelUpBanner({ nextLevel, onLevelUp }: LevelUpBannerProps) {
  return (
    <div
      className="bg-amber-950/30 border border-amber-900/40 rounded-lg px-4 py-3 flex items-center gap-3"
      role="status"
      aria-live="polite"
    >
      <Star className="h-4 w-4 text-amber-400 shrink-0" />
      <p className="text-sm text-amber-400 flex-1">
        Level up available — reach Level {nextLevel}!
      </p>
      <Button
        size="sm"
        variant="default"
        className="h-7 shrink-0"
        onClick={onLevelUp}
      >
        Level Up
      </Button>
    </div>
  )
}
