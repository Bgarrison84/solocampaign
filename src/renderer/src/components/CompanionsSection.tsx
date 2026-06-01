/**
 * CompanionsSection — stub placeholder created in Task 1 (07-08).
 * Full implementation is in Task 2.
 *
 * Exported with the correct props interface so CharacterSheetTab.tsx compiles cleanly
 * before the full implementation is written.
 */
import React from 'react'
import type { CharacterWithResources } from '../../../main/db/charactersRepo'

export interface CompanionsSectionProps {
  campaignId: string
  companions: CharacterWithResources[]
  onUpdateHp: (companionId: string, delta: number) => void
  onRemove: (companionId: string) => void
  onAdd: () => void
}

export function CompanionsSection(_props: CompanionsSectionProps) {
  return null
}
