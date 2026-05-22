import React from 'react'
import { Button } from './ui/button'

interface EmptyStateProps {
  onCreateCampaign: () => void
}

export function EmptyState({ onCreateCampaign }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center flex-1 py-24 px-8 text-center"
      data-testid="empty-state"
    >
      <div className="mb-4">
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto opacity-40"
        >
          <path
            d="M32 8L8 24V48H56V24L32 8Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M24 48V32H40V48"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h2 className="text-2xl font-semibold text-foreground mb-2">
        Start your first campaign
      </h2>

      <p className="text-muted-foreground text-base mb-8 max-w-sm">
        Your campaigns appear here. Create one to begin.
      </p>

      <Button
        size="lg"
        onClick={onCreateCampaign}
        className="font-semibold"
      >
        Create Campaign
      </Button>
    </div>
  )
}
