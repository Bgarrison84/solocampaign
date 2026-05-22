import React from 'react'
import { Plus } from 'lucide-react'

interface NewCampaignCardProps {
  onOpen: () => void
}

export function NewCampaignCard({ onOpen }: NewCampaignCardProps) {
  return (
    <button
      onClick={onOpen}
      className="w-full h-full min-h-[200px] rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors duration-150 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group"
    >
      <Plus className="w-6 h-6 group-hover:text-primary transition-colors" />
      <span className="text-sm font-medium">New Campaign</span>
    </button>
  )
}
