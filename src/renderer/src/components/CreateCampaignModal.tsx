import React, { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { trpc } from '../lib/trpc'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

interface CreateCampaignModalProps {
  open: boolean
  onClose: () => void
}

export function CreateCampaignModal({ open, onClose }: CreateCampaignModalProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) => trpc.campaigns.create.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] })
      setName('')
      setError(null)
      onClose()
    },
    onError: () => {
      setError("Couldn't create the campaign. Check that the name isn't already in use and try again.")
    },
  })

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setName('')
      setError(null)
      // Focus input after transition
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [open])

  const trimmedName = name.trim()
  const isValid = trimmedName.length >= 1 && trimmedName.length <= 80

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || createMutation.isPending) return
    createMutation.mutate({ name: trimmedName })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid && !createMutation.isPending) {
      createMutation.mutate({ name: trimmedName })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="campaign-name">Campaign name</Label>
              <Input
                id="campaign-name"
                ref={inputRef}
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
                onKeyDown={handleKeyDown}
                placeholder="e.g. The Lost Mines of Phandelver"
                maxLength={80}
                disabled={createMutation.isPending}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
