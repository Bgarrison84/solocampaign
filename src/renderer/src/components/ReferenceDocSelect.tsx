import React, { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, User } from 'lucide-react'
import { trpc } from '../lib/trpc'
import { Checkbox } from './ui/checkbox'
import { Button } from './ui/button'
import { Label } from './ui/label'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from './ui/tooltip'

interface ReferenceDocSelectProps {
  selected: string[]
  onChange: (next: string[]) => void
  /** Optional: when provided, merges campaign-imported docs into the list */
  campaignId?: string
}

/** Combined doc entry with source discriminator */
interface DocEntry {
  id: string           // selection key: relative path for bundled, UUID for imported
  displayTitle: string
  isLarge: boolean
  source: 'bundled' | 'imported'
}

/**
 * Clean a raw reference doc filename/title into a human-readable title.
 * Strips "OceanofPDF.com" prefix, leading underscores, and author suffix after the last " - ".
 * Decodes URL-encoded characters (e.g. x27 -> ').
 */
function cleanTitle(raw: string): string {
  // Remove file extension
  let title = raw.replace(/\.(md|txt)$/i, '')
  // Strip OceanofPDF.com prefix
  title = title.replace(/^_?OceanofPDF\.com_/, '')
  // Strip author suffix after last " - "
  const dashIdx = title.lastIndexOf(' - ')
  if (dashIdx > 0) {
    title = title.slice(0, dashIdx)
  }
  // Replace underscores with spaces
  title = title.replace(/_/g, ' ')
  // Decode HTML/URL entities like x27 -> '
  title = title.replace(/x([0-9a-fA-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  )
  // Trim
  title = title.trim()
  // Title-case: capitalize each word
  title = title.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1))
  return title || raw
}

export function ReferenceDocSelect({ selected, onChange, campaignId }: ReferenceDocSelectProps) {
  const instanceId = useId()

  // Bundled reference docs query
  const docsQuery = useQuery({
    queryKey: ['ai', 'listReferenceDocs'],
    queryFn: () => trpc.ai.listReferenceDocs.query(),
    staleTime: 5 * 60 * 1000, // 5 min — reference docs don't change during a session
  })

  // Campaign-imported docs query (only when campaignId is provided)
  const importedDocsQuery = useQuery({
    queryKey: ['campaignDocs', 'list', campaignId],
    queryFn: () => trpc.campaignDocs.list.query({ campaignId: campaignId! }),
    enabled: !!campaignId,
    staleTime: 30 * 1000, // 30 sec — imported docs may be added during session
  })

  // Merge bundled + imported into a unified list
  const bundledDocs = docsQuery.data ?? []
  const importedDocs = importedDocsQuery.data ?? []

  const mergedDocs: DocEntry[] = [
    ...bundledDocs.map((d) => ({
      id: d.relativePath,
      displayTitle: cleanTitle(d.title || d.relativePath),
      isLarge: d.isLarge,
      source: 'bundled' as const,
    })),
    ...importedDocs.map((d) => ({
      id: d.id,
      displayTitle: d.filename.replace(/\.[^/.]+$/, '') || d.filename,
      isLarge: false,
      source: 'imported' as const,
    })),
  ]

  const isLoading = docsQuery.isLoading || (!!campaignId && importedDocsQuery.isLoading)
  const isError = docsQuery.isError

  const allSelected = mergedDocs.length > 0 && mergedDocs.every((d) => selected.includes(d.id))
  const selectedCount = selected.length

  function handleToggleAll() {
    if (allSelected) {
      onChange([])
    } else {
      onChange(mergedDocs.map((d) => d.id))
    }
  }

  function handleToggleDoc(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((p) => p !== id))
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">
          Reference Documents{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToggleAll}
            disabled={mergedDocs.length === 0}
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-md overflow-hidden max-h-[240px] overflow-y-auto bg-card">
        {isLoading && (
          <p className="px-3 py-4 text-sm text-muted-foreground text-center">
            Loading reference documents…
          </p>
        )}
        {isError && (
          <p className="px-3 py-4 text-sm text-destructive text-center">
            Failed to load reference documents.
          </p>
        )}
        {!isLoading && !isError && mergedDocs.length === 0 && (
          <p className="px-3 py-4 text-sm text-muted-foreground text-center">
            No reference documents found.
          </p>
        )}
        <TooltipProvider>
          {mergedDocs.map((doc) => {
            const checkboxId = `${instanceId}-doc-${doc.id}`
            const isChecked = selected.includes(doc.id)

            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-secondary cursor-pointer"
                onClick={() => handleToggleDoc(doc.id)}
                role="row"
              >
                <Checkbox
                  id={checkboxId}
                  checked={isChecked}
                  onCheckedChange={() => handleToggleDoc(doc.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={doc.displayTitle}
                />
                <Label
                  htmlFor={checkboxId}
                  className="flex-1 cursor-pointer font-normal text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  {doc.displayTitle}
                </Label>
                {doc.source === 'imported' && (
                  <Tooltip delayDuration={400}>
                    <TooltipTrigger asChild>
                      <span>
                        <User className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
                        <span className="sr-only">Imported document</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Imported document</TooltipContent>
                  </Tooltip>
                )}
                {doc.source === 'bundled' && doc.isLarge && (
                  <Tooltip delayDuration={400}>
                    <TooltipTrigger asChild>
                      <span>
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 ml-auto shrink-0" />
                        <span className="sr-only">
                          Large document — may exceed model context window
                        </span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Large document — ensure your model's context window is sufficient
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )
          })}
        </TooltipProvider>
      </div>

      <p className="text-sm text-muted-foreground">
        Documents are injected into the AI's context window. Choose only what your model can fit.
      </p>
    </div>
  )
}
