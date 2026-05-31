import React, { useState } from 'react'
import { Sparkles, PenLine, FileText, TriangleAlert } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { cn } from '../../lib/utils'
import { trpc } from '../../lib/trpc'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'

// World setup mode type
export type WorldSetupMode = 'ai' | 'brief' | 'import'

/** Minimum wizard state shape required by this step. */
export interface WorldSetupState {
  worldSetupMode: WorldSetupMode
  worldBrief: string
  worldDocument: string | null
  worldDocumentFilename: string | null
}

export interface StepWorldSetupProps {
  wizardState: WorldSetupState
  onChange: (partial: Partial<WorldSetupState>) => void
}

/**
 * StepWorldSetup is always valid — no hard blocking.
 * 'ai' and 'brief' always proceed; 'import' proceeds even without a doc (optional).
 */
export function isStepWorldSetupValid(_state: WorldSetupState): boolean {
  return true
}

/** Threshold above which the truncation warning is shown. */
const LARGE_DOC_THRESHOLD = 12_000

const MODE_OPTIONS: Array<{
  value: WorldSetupMode
  icon: React.ElementType
  title: string
  subtitle: string
}> = [
  {
    value: 'ai',
    icon: Sparkles,
    title: 'AI Generates',
    subtitle: 'The AI creates a world brief when you start.',
  },
  {
    value: 'brief',
    icon: PenLine,
    title: 'Write a Brief',
    subtitle: "I'll describe the world myself.",
  },
  {
    value: 'import',
    icon: FileText,
    title: 'Import a Document',
    subtitle: 'I have a PDF or text file.',
  },
]

export function StepWorldSetup({ wizardState, onChange }: StepWorldSetupProps) {
  const { worldSetupMode, worldBrief, worldDocument, worldDocumentFilename } = wizardState

  // Local error state for file import failures
  const [importError, setImportError] = useState<string | null>(null)

  const importMutation = useMutation({
    mutationFn: () => trpc.campaigns.importWorldDoc.mutate(),
    onSuccess: (result) => {
      if (result === null) {
        // User cancelled dialog — no-op
        return
      }
      setImportError(null)
      onChange({
        worldDocument: result.content,
        worldDocumentFilename: result.filename,
      })
    },
    onError: () => {
      setImportError('Could not read that file. Try a different PDF or use a text file instead.')
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        value={worldSetupMode}
        onValueChange={(v: string) => {
          onChange({ worldSetupMode: v as WorldSetupMode })
          setImportError(null)
        }}
        className="flex flex-col gap-3"
      >
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon
          const isSelected = worldSetupMode === option.value

          return (
            <div key={option.value} className="flex flex-col gap-2">
              <label
                className={cn(
                  'flex items-start gap-3 bg-secondary rounded-lg p-4 border cursor-pointer transition-colors',
                  isSelected
                    ? 'border-accent-gold bg-secondary/80'
                    : 'border-border hover:border-muted-foreground',
                )}
              >
                <RadioGroupItem value={option.value} className="mt-0.5 shrink-0" />
                <Icon
                  className={cn(
                    'h-5 w-5 shrink-0 mt-0.5',
                    isSelected ? 'text-accent-gold' : 'text-muted-foreground',
                  )}
                />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-semibold leading-snug">{option.title}</span>
                  <span className="text-xs text-muted-foreground leading-snug">
                    {option.subtitle}
                  </span>
                </div>
              </label>

              {/* Conditional content for selected mode */}
              {isSelected && option.value === 'brief' && (
                <Textarea
                  rows={6}
                  value={worldBrief}
                  onChange={(e) => onChange({ worldBrief: e.target.value })}
                  placeholder="Describe your world: setting, tone, factions, key locations, and the hook for your first session…"
                  className="resize-none"
                />
              )}

              {isSelected && option.value === 'import' && (
                <div className="flex flex-col gap-2 pl-4">
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImportError(null)
                        importMutation.mutate()
                      }}
                      disabled={importMutation.isPending}
                    >
                      {importMutation.isPending ? 'Importing…' : 'Choose file…'}
                    </Button>
                    {worldDocumentFilename && (
                      <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {worldDocumentFilename}
                      </span>
                    )}
                  </div>

                  {/* Truncation warning for large documents */}
                  {worldDocument && worldDocument.length > LARGE_DOC_THRESHOLD && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-amber-950/60 border border-amber-800">
                      <TriangleAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-400">
                        This document is large and will be truncated. For better results, use a
                        concise world brief instead.
                      </p>
                    </div>
                  )}

                  {importError && (
                    <p className="text-sm text-destructive">{importError}</p>
                  )}
                </div>
              )}

              {isSelected && option.value === 'ai' && (
                <p className="text-sm text-muted-foreground pl-4">
                  The AI will generate a world brief tailored to your campaign when you start.
                  Nothing more to do here.
                </p>
              )}
            </div>
          )
        })}
      </RadioGroup>
    </div>
  )
}
