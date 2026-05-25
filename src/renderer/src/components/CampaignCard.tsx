import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Loader2 } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { Campaign } from '../../../main/db/schema'
import { trpc } from '../lib/trpc'

dayjs.extend(relativeTime)

interface CampaignCardProps {
  campaign: Campaign
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [coverError, setCoverError] = useState<string | null>(null)

  const coverQuery = useQuery({
    queryKey: ['campaigns', 'getCoverDataUrl', campaign.id],
    queryFn: () => trpc.campaigns.getCoverDataUrl.query({ campaignId: campaign.id }),
  })

  const importMutation = useMutation({
    mutationFn: () => trpc.campaigns.importCoverImage.mutate({ campaignId: campaign.id }),
    onSuccess: () => {
      setCoverError(null)
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'getCoverDataUrl', campaign.id] })
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] })
    },
    onError: () => {
      setCoverError('Could not import image. Please try a different file.')
    },
  })

  const handleClick = () => {
    navigate(`/campaign/${campaign.id}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick()
    }
  }

  const handleCoverClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    importMutation.mutate()
  }

  const relativeDate = campaign.createdAt
    ? dayjs(campaign.createdAt).fromNow()
    : 'Created today'

  const dataUrl = coverQuery.data ?? null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group w-full text-left rounded-lg border border-border bg-card overflow-hidden hover:border-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
    >
      {/* Cover image slot */}
      <div className="relative w-full h-40 overflow-hidden">
        {dataUrl ? (
          <>
            <img
              src={dataUrl}
              alt=""
              className="w-full h-full object-cover"
            />
            {/* Hover overlay when cover exists — "Change cover image" */}
            <button
              type="button"
              title="Change cover image"
              aria-label="Change cover image"
              onClick={handleCoverClick}
              disabled={importMutation.isPending}
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <span className="text-sm font-semibold text-white">Change cover image</span>
            </button>
          </>
        ) : (
          /* Gradient placeholder — "Add cover image" tooltip on hover */
          <button
            type="button"
            title="Add cover image"
            aria-label="Add cover image"
            onClick={handleCoverClick}
            disabled={importMutation.isPending}
            className="w-full h-full bg-gradient-to-br from-surface to-muted flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <Camera className="w-8 h-8 text-muted-foreground" />
          </button>
        )}

        {/* Loading spinner overlay during import */}
        {importMutation.isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        <h3 className="text-base font-semibold text-card-foreground truncate mb-1">
          {campaign.name}
        </h3>
        <p className="text-sm text-muted-foreground capitalize">{relativeDate}</p>
        {coverError && (
          <p className="text-sm text-destructive mt-1">{coverError}</p>
        )}
      </div>
    </div>
  )
}
