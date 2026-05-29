/**
 * RestPickerDialog — Short/Long rest picker dialog (D-34, PROG-02, UI-SPEC §S8a).
 *
 * Opens via the "Rest" button in the campaign header.
 * Selecting a rest type: closes dialog, sends the context message to the AI
 * via the onSelectRest callback. The caller (CampaignViewScreen) handles
 * the actual message send and AI polling.
 *
 * The dialog does NOT apply any recovery — D-35: only the AI's processRest grants it.
 */

import React from 'react'
import { Moon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'

interface RestPickerDialogProps {
  open: boolean
  onClose: () => void
  onSelectRest: (type: 'short' | 'long') => void
}

export function RestPickerDialog({ open, onClose, onSelectRest }: RestPickerDialogProps) {
  const handleSelect = (type: 'short' | 'long') => {
    onSelectRest(type)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-w-[400px] w-full">
        <DialogHeader>
          <DialogTitle>Take a Rest</DialogTitle>
        </DialogHeader>

        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Choose the type of rest:</p>

          {/* Short Rest option */}
          <button
            type="button"
            className="w-full flex flex-col items-start gap-1 p-4 bg-secondary border border-border
                       rounded-lg hover:bg-card hover:border-border/80 cursor-pointer transition-colors text-left"
            onClick={() => handleSelect('short')}
          >
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Short Rest</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Roll hit dice to regain HP. Recharges certain class abilities.
            </p>
          </button>

          {/* Long Rest option */}
          <button
            type="button"
            className="w-full flex flex-col items-start gap-1 p-4 bg-secondary border border-border
                       rounded-lg hover:bg-card hover:border-border/80 cursor-pointer transition-colors text-left"
            onClick={() => handleSelect('long')}
          >
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Long Rest</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Regain all HP, spell slots, and half your hit dice. Requires ~8 hours.
            </p>
          </button>

          <p className="text-xs text-muted-foreground">
            The DM will narrate whether the rest is possible.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
