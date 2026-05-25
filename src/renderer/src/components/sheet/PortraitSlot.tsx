import React from 'react'
import { User, Camera, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface PortraitSlotProps {
  dataUrl: string | null
  characterName: string
  onImportClick: () => void
  isLoading?: boolean
}

export function PortraitSlot({
  dataUrl,
  characterName,
  onImportClick,
  isLoading = false,
}: PortraitSlotProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Import character portrait"
      className="w-20 h-20 rounded-lg overflow-hidden border-2 border-border relative cursor-pointer group flex-shrink-0"
      onClick={onImportClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onImportClick()
        }
      }}
      title={dataUrl ? 'Change portrait' : 'Add portrait'}
    >
      {/* Portrait image or fallback icon */}
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={characterName}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-surface/50 flex items-center justify-center">
          <User className="w-8 h-8 text-muted-foreground" />
        </div>
      )}

      {/* Hover overlay with camera icon */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center transition-opacity',
          isLoading ? 'bg-black/50 opacity-100' : 'bg-black/50 opacity-0 group-hover:opacity-100',
        )}
      >
        {isLoading ? (
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        ) : (
          <Camera className="w-6 h-6 text-white" />
        )}
      </div>
    </div>
  )
}
