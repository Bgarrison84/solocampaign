import React, { useState } from 'react'
import type { CharacterWithResources } from '../../../../main/db/charactersRepo'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

interface TraitsSectionProps {
  character: CharacterWithResources
}

export function TraitsSection({ character }: TraitsSectionProps) {
  const [collapsed, setCollapsed] = useState(true)

  const hasRacialTraits = Boolean(character.racialTraitsText?.trim())
  const hasClassFeatures = Boolean(character.classFeatureText?.trim())
  const hasBackgroundFeature = Boolean(character.backgroundFeatureText?.trim())
  const hasAnyContent = hasRacialTraits || hasClassFeatures || hasBackgroundFeature

  return (
    <section>
      <div className="flex flex-row items-center justify-between mb-2">
        <h2 className="text-xl font-semibold">Traits &amp; Features</h2>
        {hasAnyContent && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            className="text-sm text-muted-foreground"
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </Button>
        )}
      </div>

      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          collapsed ? 'max-h-0' : 'max-h-[9999px]',
        )}
      >
        {!hasAnyContent ? (
          <p className="text-sm text-muted-foreground">No traits or features recorded.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {hasRacialTraits && (
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Racial Traits
                </p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {character.racialTraitsText}
                </p>
              </div>
            )}

            {hasClassFeatures && (
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Class Features (Level 1)
                </p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {character.classFeatureText}
                </p>
              </div>
            )}

            {hasBackgroundFeature && (
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Background Feature
                </p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {character.backgroundFeatureText}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
