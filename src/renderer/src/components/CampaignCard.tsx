import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Loader2, MoreHorizontal } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { Campaign } from '../../../main/db/schema'
import { trpc } from '../lib/trpc'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

dayjs.extend(relativeTime)

interface CampaignCardProps {
  campaign: Campaign
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [coverError, setCoverError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

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

  const exportMutation = useMutation({
    mutationFn: () => trpc.campaigns.export.mutate({ campaignId: campaign.id }),
  })

  const exportTemplateMutation = useMutation({
    mutationFn: () => trpc.campaigns.exportTemplate.mutate({ campaignId: campaign.id }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => trpc.campaigns.delete.mutate({ id: campaign.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] })
      setDeleteDialogOpen(false)
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
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="group relative w-full text-left rounded-lg border border-border bg-card overflow-hidden hover:border-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      >
        {/* 3-dot context menu — top-right, revealed on card hover */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity duration-150 focus-visible:opacity-100"
              aria-label="Campaign options"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-[180px]" align="end">
            <DropdownMenuItem
              onSelect={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            >
              Export Campaign (JSON)
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => exportTemplateMutation.mutate()}
              disabled={exportTemplateMutation.isPending}
            >
              Export as Starter Template
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault()
                setDeleteDialogOpen(true)
              }}
            >
              Delete Campaign
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>
              This will permanently delete {campaign.name} and all its data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
