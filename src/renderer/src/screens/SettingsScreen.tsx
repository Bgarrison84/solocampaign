/**
 * SettingsScreen — Global app settings at /settings (D-06, A11Y-01, DIST-04).
 *
 * Appearance section (plan 08-02): font size segmented control + high contrast toggle.
 * Data section: data folder UI (filled by plan 08-06).
 *
 * Navigation: reachable via gear icon in TitleBar.tsx.
 * Back button uses navigate(-1) to return to the previous screen.
 * D-10: This screen holds only app-global prefs. Per-campaign AI settings remain
 * in AiSettingsModal.tsx.
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '../components/ui/button'
import { Switch } from '../components/ui/switch'
import { Label } from '../components/ui/label'
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

  // Read current prefs — powers initial state of segmented control and switch
  const prefsQuery = useQuery({
    queryKey: ['appPrefs'],
    queryFn: () => trpc.appPrefs.get.query(),
  })

  const currentFontSize = prefsQuery.data?.fontSize ?? 'normal'
  const currentHighContrast = prefsQuery.data?.highContrast ?? false

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

        {/* Data section — data folder path display and Change button added by plan 08-06 */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-4">Data</h2>
          {/* placeholder: data folder path + Change button (08-06) */}
        </section>

      </div>
    </div>
  )
}
