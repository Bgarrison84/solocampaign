/**
 * SettingsScreen — Global app settings at /settings (D-06, A11Y-01, DIST-04).
 *
 * Scaffold only: layout and section headers established here.
 * - Appearance section: font size picker + high contrast toggle (filled by plan 08-02)
 * - Data section: data folder UI (filled by plan 08-06)
 *
 * Navigation: reachable via gear icon in TitleBar.tsx.
 * Back button uses navigate(-1) to return to the previous screen.
 * D-10: This screen holds only app-global prefs. Per-campaign AI settings remain
 * in AiSettingsModal.tsx.
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'

export function SettingsScreen() {
  const navigate = useNavigate()

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

        {/* Appearance section — font size picker and high contrast toggle added by plan 08-02 */}
        <section className="mb-8">
          <h2 className="text-base font-semibold text-foreground mb-4">Appearance</h2>
          {/* placeholder: font size segmented control (08-02) */}
          {/* placeholder: high contrast toggle (08-02) */}
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
