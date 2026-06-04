/**
 * UpdateBanner — dismissible new-version notification (DIST-05 / D-05)
 *
 * Renders inline above main content (not a modal or toast) as a narrow Alert
 * strip between TitleBar and the main routed area. Returns null when no newer
 * version is available or when the available version matches the dismissed version.
 *
 * Security (T-09-07): Download opens only the validated GitHub release URL via
 * window.shellBridge.openExternal, which enforces the https://github.com/ allow-list
 * in the preload before the URL reaches the OS protocol handler.
 */

import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Alert, AlertDescription } from './ui/alert'
import { Button } from './ui/button'
import { trpc } from '../lib/trpc'

export function UpdateBanner() {
  const queryClient = useQueryClient()

  // Poll GitHub Releases API via tRPC (staleTime 10 min — rate-limit guard, RESEARCH Pitfall 4)
  const { data } = useQuery({
    queryKey: ['appPrefs', 'checkForUpdate'],
    queryFn: () => trpc.appPrefs.checkForUpdate.query(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  })

  // Read persisted dismissedUpdateVersion from appPrefs store
  const { data: prefs } = useQuery({
    queryKey: ['appPrefs'],
    queryFn: () => trpc.appPrefs.get.query(),
  })

  // Persist dismissed version so the banner does not reappear for the same version
  const dismissMutation = useMutation({
    mutationFn: (version: string) => trpc.appPrefs.dismissUpdate.mutate({ version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appPrefs'] })
    },
  })

  // No update available — render nothing
  if (!data?.available) return null

  // Version already dismissed — render nothing (RESEARCH Pitfall 7)
  if (prefs !== undefined && data.version === prefs.dismissedUpdateVersion) return null

  const handleDownload = () => {
    if (data.releaseUrl) {
      window.shellBridge.openExternal(data.releaseUrl)
    }
  }

  const handleDismiss = () => {
    if (data.version) {
      dismissMutation.mutate(data.version)
    }
  }

  return (
    <Alert className="rounded-none border-x-0 border-t-0 py-2">
      <AlertDescription className="flex items-center justify-between">
        <span>
          {'SoloCampaign '}
          {data.version}
          {' is available — '}
          <button
            onClick={handleDownload}
            className="underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Download SoloCampaign ${data.version}`}
          >
            Download
          </button>
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss update notification"
          onClick={handleDismiss}
          className="h-6 w-6 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  )
}
