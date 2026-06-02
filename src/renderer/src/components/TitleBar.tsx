import React, { useState, useEffect } from 'react'
import { Minus, Square, Copy, X, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { trpc } from '../lib/trpc'
import { useWindowStore } from '../stores/windowStore'

/**
 * Custom frameless title bar (D-12, D-13, UI-SPEC S4).
 *
 * - Drag region covers the full bar; button and text zones are no-drag.
 * - macOS: 32px height, 80px left inset to clear native traffic lights.
 * - Windows/Linux: 36px height, 16px left padding.
 * - Custom controls (Minimize / Maximize-Restore / Close) always visible.
 *   TODO: 01-05 — hide Win/Linux controls on macOS via platform IPC if desired in a later polish pass.
 *
 * Window control calls go through tRPC window procedures — never raw Electron APIs
 * from the renderer (sandbox: true means no direct electron access anyway).
 */
export function TitleBar() {
  const navigate = useNavigate()
  const campaignName = useWindowStore((s) => s.campaignName)
  const [isMaximized, setIsMaximized] = useState(false)

  // Detect platform via navigator.platform (sandbox: true — no process.platform in renderer)
  const isMac = navigator.platform.startsWith('Mac')
  const tbHeight = isMac ? '32px' : '36px'

  // Check maximize state on mount and keep in sync via resize events
  const checkMaximized = () => {
    trpc.window.isMaximized.query().then((val) => setIsMaximized(val)).catch(() => {})
  }

  useEffect(() => {
    checkMaximized()
    window.addEventListener('resize', checkMaximized)
    return () => {
      window.removeEventListener('resize', checkMaximized)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="flex items-center justify-between bg-card border-b border-border select-none shrink-0"
      style={{ height: tbHeight, WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left zone — app name + campaign name.
          macOS: 80px left inset clears native traffic lights.
          Windows/Linux: 16px standard padding. */}
      <div
        className={`flex items-center truncate ${isMac ? 'pl-[80px]' : 'px-4'}`}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <span className="text-sm font-semibold text-foreground">SoloCampaign</span>
        {campaignName && (
          <span className="text-sm font-normal text-muted-foreground ml-1 truncate">
            {' — '}{campaignName}
          </span>
        )}
      </div>

      {/* Settings gear icon — immediately left of window controls */}
      <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={() => navigate('/settings')}
          aria-label="Open Settings"
          title="Settings"
          className={`flex items-center justify-center w-[46px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors`}
          style={{ height: tbHeight }}
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Right zone — window controls (Minimize / Maximize-Restore / Close) */}
      <div className="flex" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* Minimize */}
        <button
          onClick={() => trpc.window.minimize.mutate()}
          className={`flex items-center justify-center w-[46px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors`}
          style={{ height: tbHeight }}
          aria-label="Minimize window"
          title="Minimize"
        >
          <Minus size={10} />
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={() => trpc.window.maximize.mutate()}
          className={`flex items-center justify-center w-[46px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors`}
          style={{ height: tbHeight }}
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Copy size={10} /> : <Square size={10} />}
        </button>

        {/* Close */}
        <button
          onClick={() => trpc.window.close.mutate()}
          className={`flex items-center justify-center w-[46px] text-muted-foreground hover:bg-destructive hover:text-primary-foreground transition-colors`}
          style={{ height: tbHeight }}
          aria-label="Close window"
          title="Close"
        >
          <X size={10} />
        </button>
      </div>
    </div>
  )
}
