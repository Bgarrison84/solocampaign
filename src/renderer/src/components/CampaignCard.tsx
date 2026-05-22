import React from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { Campaign } from '../../../main/db/schema'

dayjs.extend(relativeTime)

interface CampaignCardProps {
  campaign: Campaign
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/campaign/${campaign.id}`)
  }

  const relativeDate = campaign.createdAt
    ? dayjs(campaign.createdAt).fromNow()
    : 'Created today'

  return (
    <button
      onClick={handleClick}
      className="group w-full text-left rounded-lg border border-border bg-card overflow-hidden hover:border-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Cover image slot */}
      <div className="w-full h-40 overflow-hidden bg-muted">
        <img
          src="/placeholder-cover.svg"
          alt=""
          className="w-full h-full object-cover"
        />
      </div>

      {/* Card body */}
      <div className="p-4">
        <h3 className="text-base font-semibold text-card-foreground truncate mb-1">
          {campaign.name}
        </h3>
        <p className="text-sm text-muted-foreground capitalize">{relativeDate}</p>
      </div>
    </button>
  )
}
