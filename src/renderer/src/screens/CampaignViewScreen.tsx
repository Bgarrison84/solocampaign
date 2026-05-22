import React from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '../lib/trpc'

export function CampaignViewScreen() {
  const { id } = useParams<{ id: string }>()

  const campaignQuery = useQuery({
    queryKey: ['campaigns', 'get', id],
    queryFn: () => trpc.campaigns.get.query({ id: id! }),
    enabled: !!id,
  })

  if (!id) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-muted-foreground">No campaign selected.</p>
      </div>
    )
  }

  if (campaignQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-muted-foreground">Loading campaign...</p>
      </div>
    )
  }

  if (!campaignQuery.data) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-muted-foreground">Campaign not found.</p>
      </div>
    )
  }

  // Stub — 01-04 replaces with the split-panel + 5-tab shell
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Campaign loaded: {campaignQuery.data.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          Full campaign view coming in Plan 01-04.
        </p>
      </div>
    </div>
  )
}
