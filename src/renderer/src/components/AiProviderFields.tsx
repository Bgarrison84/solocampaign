import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { trpc } from '../lib/trpc'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from './ui/collapsible'
import { ReferenceDocSelect } from './ReferenceDocSelect'

export type ProviderType = 'openai-compatible' | 'gemini'

export interface AiProviderValue {
  providerType: ProviderType
  endpointUrl: string
  modelName: string
  /** Empty = no key supplied (keep existing in gear modal; skip for wizard) */
  apiKey: string
  referenceDocs: string[]
  fallbackEndpointUrl: string
  fallbackModelName: string
  fallbackApiKey: string
}

export const defaultAiProviderValue: AiProviderValue = {
  providerType: 'openai-compatible',
  endpointUrl: '',
  modelName: '',
  apiKey: '',
  referenceDocs: [],
  fallbackEndpointUrl: '',
  fallbackModelName: '',
  fallbackApiKey: '',
}

interface AiProviderFieldsProps {
  value: AiProviderValue
  onChange: (next: AiProviderValue) => void
  /**
   * When true, API key fields show a "(leave blank to keep current key)" placeholder
   * instead of the wizard placeholder. Use for the gear modal (D-23).
   */
  keepExistingKeyMode?: boolean
  /** Per-field validation errors, shown below the relevant input */
  errors?: Partial<Record<keyof AiProviderValue, string>>
}

function EncryptionWarning() {
  return (
    <div className="bg-amber-950/40 border border-amber-800 rounded-md p-3 flex gap-2 items-start">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-400">Reduced key security</p>
        <p className="text-sm text-amber-300/80">
          Encrypted key storage is unavailable on this system. Your API key will be stored
          with reduced security. See documentation.
        </p>
      </div>
    </div>
  )
}

/**
 * Validates the required fields of an AiProviderValue, returning an errors object.
 * An empty errors object means the form is valid.
 */
export function validateAiProviderFields(
  value: AiProviderValue,
): Partial<Record<keyof AiProviderValue, string>> {
  const errors: Partial<Record<keyof AiProviderValue, string>> = {}
  if (value.providerType === 'openai-compatible') {
    if (!value.endpointUrl.trim()) {
      errors.endpointUrl = 'Enter the API endpoint URL (e.g. http://localhost:1234/v1).'
    } else if (
      !value.endpointUrl.trim().startsWith('http://') &&
      !value.endpointUrl.trim().startsWith('https://')
    ) {
      errors.endpointUrl = 'Enter the API endpoint URL (e.g. http://localhost:1234/v1).'
    }
    if (!value.modelName.trim()) {
      errors.modelName = 'Enter the model name exactly as your provider expects it.'
    }
  } else {
    // gemini
    if (!value.apiKey.trim()) {
      errors.apiKey = 'Enter your Gemini API key from Google AI Studio.'
    }
    if (!value.modelName.trim()) {
      errors.modelName = 'Enter the Gemini model name (e.g. gemini-2.0-flash).'
    }
  }
  return errors
}

/**
 * Returns true when the form is valid for the given provider type.
 */
export function isAiProviderFieldsValid(value: AiProviderValue): boolean {
  return Object.keys(validateAiProviderFields(value)).length === 0
}

export function AiProviderFields({
  value,
  onChange,
  keepExistingKeyMode = false,
  errors = {},
}: AiProviderFieldsProps) {
  const [fallbackOpen, setFallbackOpen] = useState(false)

  const encryptionQuery = useQuery({
    queryKey: ['prefs', 'isEncryptionAvailable'],
    queryFn: () => trpc.prefs.isEncryptionAvailable.query(),
    staleTime: Infinity,
  })

  const isSecure = encryptionQuery.data !== false // default true; show warning only when known false

  function set(patch: Partial<AiProviderValue>) {
    onChange({ ...value, ...patch })
  }

  const apiKeyPlaceholder =
    keepExistingKeyMode
      ? '(leave blank to keep current key)'
      : value.providerType === 'openai-compatible'
        ? 'sk-… (leave blank for local LLMs)'
        : 'AIza…'

  const fallbackApiKeyPlaceholder = keepExistingKeyMode
    ? '(leave blank to keep current key)'
    : 'sk-… (leave blank for local LLMs)'

  return (
    <div className="flex flex-col gap-4">
      {/* Provider Type */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold">Provider Type</Label>
        <Select
          value={value.providerType}
          onValueChange={(v) => set({ providerType: v as ProviderType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai-compatible">OpenAI-compatible</SelectItem>
            <SelectItem value="gemini">Gemini</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* OpenAI-compatible fields */}
      {value.providerType === 'openai-compatible' && (
        <fieldset className="flex flex-col gap-4 border-none p-0">
          <legend className="sr-only">OpenAI-compatible provider fields</legend>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-endpoint-url" className="text-sm font-semibold">
              Endpoint URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ai-endpoint-url"
              type="url"
              value={value.endpointUrl}
              onChange={(e) => set({ endpointUrl: e.target.value })}
              placeholder="http://localhost:1234/v1"
            />
            {errors.endpointUrl && (
              <p className="text-sm text-destructive">{errors.endpointUrl}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-model-name" className="text-sm font-semibold">
              Model name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ai-model-name"
              type="text"
              value={value.modelName}
              onChange={(e) => set({ modelName: e.target.value })}
              placeholder="mistral-7b-instruct"
            />
            {errors.modelName && (
              <p className="text-sm text-destructive">{errors.modelName}</p>
            )}
          </div>

          {!isSecure && <EncryptionWarning />}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-api-key" className="text-sm font-semibold">
              API key{' '}
              <span className="font-normal text-muted-foreground">
                (optional — not needed for local LLMs)
              </span>
            </Label>
            <Input
              id="ai-api-key"
              type="password"
              value={value.apiKey}
              onChange={(e) => set({ apiKey: e.target.value })}
              placeholder={apiKeyPlaceholder}
            />
          </div>
        </fieldset>
      )}

      {/* Gemini fields */}
      {value.providerType === 'gemini' && (
        <fieldset className="flex flex-col gap-4 border-none p-0">
          <legend className="sr-only">Gemini provider fields</legend>

          {!isSecure && <EncryptionWarning />}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-gemini-key" className="text-sm font-semibold">
              API key <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ai-gemini-key"
              type="password"
              value={value.apiKey}
              onChange={(e) => set({ apiKey: e.target.value })}
              placeholder={apiKeyPlaceholder}
            />
            {errors.apiKey && (
              <p className="text-sm text-destructive">{errors.apiKey}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-gemini-model" className="text-sm font-semibold">
              Model name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ai-gemini-model"
              type="text"
              value={value.modelName}
              onChange={(e) => set({ modelName: e.target.value })}
              placeholder="gemini-2.0-flash"
            />
            {errors.modelName && (
              <p className="text-sm text-destructive">{errors.modelName}</p>
            )}
          </div>
        </fieldset>
      )}

      {/* Reference Documents */}
      <ReferenceDocSelect
        selected={value.referenceDocs}
        onChange={(next) => set({ referenceDocs: next })}
      />

      {/* Collapsible Fallback Provider */}
      <Collapsible open={fallbackOpen} onOpenChange={setFallbackOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer w-full py-2 border-t border-border mt-2">
          <ChevronRight
            className={`h-4 w-4 transition-transform duration-150 ${fallbackOpen ? 'rotate-90' : ''}`}
          />
          Add fallback provider (optional)
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pl-4 flex flex-col gap-4 mt-2">
            <p className="text-sm text-muted-foreground mb-1">
              If the primary provider fails after 3 retries, the app will automatically try
              this endpoint.
            </p>

            {value.providerType === 'openai-compatible' && (
              <fieldset className="flex flex-col gap-4 border-none p-0">
                <legend className="sr-only">Fallback OpenAI-compatible provider fields</legend>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-fallback-endpoint" className="text-sm font-semibold">
                    Fallback Endpoint URL
                  </Label>
                  <Input
                    id="ai-fallback-endpoint"
                    type="url"
                    value={value.fallbackEndpointUrl}
                    onChange={(e) => set({ fallbackEndpointUrl: e.target.value })}
                    placeholder="http://localhost:1234/v1"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-fallback-model" className="text-sm font-semibold">
                    Fallback Model name
                  </Label>
                  <Input
                    id="ai-fallback-model"
                    type="text"
                    value={value.fallbackModelName}
                    onChange={(e) => set({ fallbackModelName: e.target.value })}
                    placeholder="mistral-7b-instruct"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-fallback-key" className="text-sm font-semibold">
                    Fallback API key{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="ai-fallback-key"
                    type="password"
                    value={value.fallbackApiKey}
                    onChange={(e) => set({ fallbackApiKey: e.target.value })}
                    placeholder={fallbackApiKeyPlaceholder}
                  />
                </div>
              </fieldset>
            )}

            {value.providerType === 'gemini' && (
              <fieldset className="flex flex-col gap-4 border-none p-0">
                <legend className="sr-only">Fallback Gemini provider fields</legend>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-fallback-gemini-key" className="text-sm font-semibold">
                    Fallback API key{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="ai-fallback-gemini-key"
                    type="password"
                    value={value.fallbackApiKey}
                    onChange={(e) => set({ fallbackApiKey: e.target.value })}
                    placeholder={fallbackApiKeyPlaceholder}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-fallback-gemini-model" className="text-sm font-semibold">
                    Fallback Model name
                  </Label>
                  <Input
                    id="ai-fallback-gemini-model"
                    type="text"
                    value={value.fallbackModelName}
                    onChange={(e) => set({ fallbackModelName: e.target.value })}
                    placeholder="gemini-2.0-flash"
                  />
                </div>
              </fieldset>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
