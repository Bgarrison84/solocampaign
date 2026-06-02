/**
 * SettingsScreen — Global app settings at /settings (D-06, A11Y-01, DIST-04).
 *
 * Appearance section (plan 08-02): font size segmented control + high contrast toggle.
 * Data section (plan 08-06): data folder path display + Change Folder button + restart banner.
 *
 * Navigation: reachable via gear icon in TitleBar.tsx.
 * Back button uses navigate(-1) to return to the previous screen.
 * D-10: This screen holds only app-global prefs. Per-campaign AI settings remain
 * in AiSettingsModal.tsx.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert'
import { trpc } from '../lib/trpc'

/** Font scale map: maps fontSize pref to --font-scale CSS value (D-07, A11Y-01). */
const FONT_SCALE_MAP: Record<string, string> = {
  small: '0.875',
  normal: '1',
  large: '1.125',
}

type FontSize = 'small' | 'normal' | 'large'

export function SettingsScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Local state for restart-required banner (DIST-04, D-09)
  const [pendingRestart, setPendingRestart] = useState(false)

  // Read current prefs — powers initial state of segmented control and switch
  const prefsQuery = useQuery({
    queryKey: ['appPrefs'],
    queryFn: () => trpc.appPrefs.get.query(),
  })

  const currentFontSize = prefsQuery.data?.fontSize ?? 'normal'
  const currentHighContrast = prefsQuery.data?.highContrast ?? false

  // Read current data folder path (DIST-04)
  const dataFolderQuery = useQuery({
    queryKey: ['appPrefs', 'dataFolder'],
    queryFn: () => trpc.appPrefs.getCurrentDataFolder.query(),
  })

  const currentPath = dataFolderQuery.data?.path ?? ''
  const isCustomPath = dataFolderQuery.data?.isCustom ?? false

  // Persist font size selection + apply CSS immediately (no reload required)
  const setFontSizeMutation = useMutation({
    mutationFn: (fontSize: FontSize) => trpc.appPrefs.setFontSize.mutate({ fontSize }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appPrefs'] })
    },
  })

  // Persist high contrast selection + apply class immediately (no reload required)
  const setHighContrastMutation = useMutation({
    mutationFn: (highContrast: boolean) =>
      trpc.appPrefs.setHighContrast.mutate({ highContrast }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appPrefs'] })
    },
  })

  // Pick a folder via OS dialog (returns folder path or canceled)
  const pickDataFolderMutation = useMutation({
    mutationFn: () => trpc.appPrefs.pickDataFolder.mutate(),
  })

  // Migrate the DB to the picked folder (WAL-safe backup + integrity check)
  const changeDataFolderMutation = useMutation({
    mutationFn: (folderPath: string) =>
      trpc.appPrefs.changeDataFolder.mutate({ folderPath }),
    onSuccess: () => {
      setPendingRestart(true)
      queryClient.invalidateQueries({ queryKey: ['appPrefs', 'dataFolder'] })
    },
  })

  /**
   * Handle font size change: apply --font-scale immediately to documentElement
   * then persist via tRPC so the value survives app restart.
   * T-08-04 (Tampering): value is a fixed enum from the segmented control;
   * FONT_SCALE_MAP lookup prevents arbitrary strings from reaching setProperty.
   */
  const handleFontChange = (value: FontSize) => {
    document.documentElement.style.setProperty(
      '--font-scale',
      FONT_SCALE_MAP[value] ?? '1',
    )
    setFontSizeMutation.mutate(value)
  }

  /**
   * Handle high contrast change: toggle .high-contrast class on documentElement
   * immediately then persist via tRPC.
   */
  const handleHighContrastChange = (checked: boolean) => {
    document.documentElement.classList.toggle('high-contrast', checked)
    setHighContrastMutation.mutate(checked)
  }

  /**
   * Handle "Change Folder..." button click.
   * Step 1: Open OS folder picker via pickDataFolder tRPC mutation.
   * Step 2: If user confirmed a folder, call changeDataFolder (backup + integrity check).
   * Step 3: On success, set pendingRestart=true and invalidate the data folder query.
   * On changeDataFolder error, the error message surfaces via changeDataFolderMutation.error.
   *
   * DIST-04, T-08-17: changeDataFolder uses sqlite.backup() NOT fs.copyFile.
   */
  const handleChangeFolderClick = async () => {
    const pickResult = await pickDataFolderMutation.mutateAsync()
    if (pickResult.canceled || !('folderPath' in pickResult)) {
      return
    }
    changeDataFolderMutation.mutate(pickResult.folderPath)
  }

  const isChangingFolder =
    pickDataFolderMutation.isPending || changeDataFolderMutation.isPending

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-sm px-2 h-8"
          aria-label="Go back"
        >
          ← Back
        </Button>
        <span className="text-sm font-semibold text-foreground">Settings</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-[600px]">

        {/* Appearance section — font size picker and high contrast toggle (A11Y-01, D-07, D-08) */}
        <section className="mb-8">
          <h2 className="text-base font-semibold text-foreground mb-4">Appearance</h2>

          {/* Font size segmented control */}
          <div className="mb-6">
            <p className="text-sm font-medium text-foreground mb-2">Text Size</p>
            <div className="flex gap-2" role="group" aria-label="Text Size">
              {(['small', 'normal', 'large'] as const).map((size) => (
                <Button
                  key={size}
                  variant={currentFontSize === size ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleFontChange(size)}
                  className="capitalize min-h-[44px] px-4"
                >
                  {size === 'small' ? 'Small' : size === 'normal' ? 'Normal' : 'Large'}
                </Button>
              ))}
            </div>
          </div>

          {/* High contrast toggle — label left, switch right (D-08, A11Y-01) */}
          <div className="flex items-center justify-between min-h-[44px] py-1">
            <div className="flex flex-col gap-0.5">
              <Label
                htmlFor="high-contrast"
                className="text-sm font-medium text-foreground cursor-pointer"
              >
                High Contrast
              </Label>
              <p className="text-xs text-muted-foreground">
                Increases text and border contrast for low-vision use
              </p>
            </div>
            <Switch
              id="high-contrast"
              checked={currentHighContrast}
              onCheckedChange={handleHighContrastChange}
              aria-label="High contrast mode"
              className="ml-4 shrink-0"
            />
          </div>
        </section>

        {/* Data section — data folder path display, Change Folder button, restart banner (DIST-04) */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-4">Data</h2>

          {/* Campaign Data Folder */}
          <div className="mb-4">
            <p className="text-sm font-medium text-foreground mb-1">Campaign Data Folder</p>
            <p className="text-xs text-muted-foreground mb-3">
              Location where your campaigns and save data are stored
            </p>

            {/* Current path display — monospace, truncated with ellipsis */}
            <p
              className="text-sm font-mono text-muted-foreground mb-3"
              style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
              title={currentPath}
            >
              {currentPath}
              {!isCustomPath && (
                <span className="ml-1 text-xs text-muted-foreground">(default)</span>
              )}
            </p>

            {/* Change Folder button */}
            <Button
              variant="default"
              onClick={handleChangeFolderClick}
              disabled={isChangingFolder}
              className="min-h-[44px]"
            >
              {isChangingFolder ? 'Working...' : 'Change Folder...'}
            </Button>

            {/* Inline error display for integrity check failure */}
            {changeDataFolderMutation.error && (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {changeDataFolderMutation.error instanceof Error
                  ? changeDataFolderMutation.error.message
                  : 'Failed to change data folder.'}
              </p>
            )}
          </div>

          {/* Restart Required banner — shown only after a successful folder change (DIST-04) */}
          {pendingRestart && (
            <Alert variant="default" className="mt-4">
              <Info className="h-4 w-4" />
              <AlertTitle>Restart Required</AlertTitle>
              <AlertDescription>
                The data folder change takes effect after you restart SoloCampaign.
              </AlertDescription>
            </Alert>
          )}
        </section>

      </div>
    </div>
  )
}
