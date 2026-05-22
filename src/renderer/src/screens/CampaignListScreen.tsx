import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '../lib/trpc'
import { CampaignCard } from '../components/CampaignCard'
import { NewCampaignCard } from '../components/NewCampaignCard'
import { EmptyState } from '../components/EmptyState'
import { CreateCampaignModal } from '../components/CreateCampaignModal'

export function CampaignListScreen() {
  // Modal state — NOT defaulting to true (per D-07: no auto-open on first launch)
  const [modalOpen, setModalOpen] = useState(false)

  const campaignsQuery = useQuery({
    queryKey: ['campaigns', 'list'],
    queryFn: () => trpc.campaigns.list.query(),
  })

  const openModal = () => setModalOpen(true)
  const closeModal = () => setModalOpen(false)

  if (campaignsQuery.isError) {
    return (
      <div className="flex flex-col min-h-screen bg-background p-8">
        <h1 className="text-2xl font-semibold text-foreground mb-8">Your Campaigns</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Couldn't load your campaigns. Restart SoloCampaign and try again.
        </div>
      </div>
    )
  }

  const campaigns = campaignsQuery.data ?? []
  const isLoading = campaignsQuery.isLoading

  return (
    <div className="flex flex-col min-h-screen bg-background p-8">
      <h1 className="text-2xl font-semibold text-foreground mb-8">Your Campaigns</h1>

      {isLoading ? (
        // Ghost loading cards — same grid dimensions, no shimmer per plan
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '24px',
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-card h-[200px] opacity-50"
            />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState onCreateCampaign={openModal} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '24px',
          }}
        >
          {/* New campaign card is always the first cell */}
          <NewCampaignCard onOpen={openModal} />

          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}

      <CreateCampaignModal open={modalOpen} onClose={closeModal} />
    </div>
  )
}
