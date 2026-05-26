---
phase: 03
plan: 04
subsystem: renderer-story-scroll
tags: [renderer, ai, streaming, react, ipc, story-scroll, chat-input, error-block, wave-3]
dependency_graph:
  requires:
    - 03-03 (window.aiStream contextBridge surface, ai:send-message IPC, trpc.ai.getMessages)
  provides:
    - StoryScrollPanel — continuous story scroll with react-markdown (completed) + raw-text streaming + blinking cursor
    - ChatInputArea — auto-growing textarea + Ctrl+Enter + Send button
    - ChatErrorBlock — inline fallback/retry error block
    - useAiStream — isStreaming/streamingContent/error state + IPC listener lifecycle
    - Window.aiStream + Window.platform TypeScript type augmentation
    - CampaignViewScreen left panel wired to live chat (replaces "AI narration appears here." placeholder)
  affects:
    - src/renderer/src/components/StoryScrollPanel.tsx
    - src/renderer/src/components/ChatInputArea.tsx
    - src/renderer/src/components/ChatErrorBlock.tsx
    - src/renderer/src/hooks/useAiStream.ts
    - src/renderer/src/types/aiStream.d.ts
    - src/renderer/src/styles/globals.css
    - src/renderer/src/screens/CampaignViewScreen.tsx
tech_stack:
  added: []
  patterns:
    - react-markdown + remark-gfm for completed assistant messages only (constraint #8 — no markdown on streaming content)
    - react-hotkeys-hook useHotkeys('ctrl+enter') with enableOnFormTags: ['TEXTAREA']
    - useRef + scrollHeight for auto-growing textarea height without controlled component
    - isUserScrolledUpRef (non-state ref) for auto-scroll suspend — avoids re-render on scroll
    - scrollToBottomRef as imperative handle passed into StoryScrollPanel from CampaignViewScreen
    - useEffect cleanup with window.aiStream.removeAllListeners() (constraint #7 / T-03-04-02)
    - queryClient.invalidateQueries on ai:finish to trigger react-markdown re-render of completed messages
    - lastUserContentRef in CampaignViewScreen for retry/fallback without needing StoryScrollPanel to track it
key_files:
  created:
    - src/renderer/src/hooks/useAiStream.ts
    - src/renderer/src/components/StoryScrollPanel.tsx
    - src/renderer/src/components/ChatInputArea.tsx
    - src/renderer/src/components/ChatErrorBlock.tsx
    - src/renderer/src/types/aiStream.d.ts
  modified:
    - src/renderer/src/styles/globals.css (@keyframes blink added)
    - src/renderer/src/screens/CampaignViewScreen.tsx (left panel replaced, useAiStream wired)
decisions:
  - isEmpty tracked as useState (not ref read) in ChatInputArea so Send button disables/enables reactively on every keystroke
  - scrollToBottomRef passed as a MutableRefObject from CampaignViewScreen into StoryScrollPanel so the parent can trigger scroll after ChatInputArea's onSend
  - lastUserContentRef lives in CampaignViewScreen (not StoryScrollPanel) — clean separation: StoryScrollPanel renders; CampaignViewScreen orchestrates send/retry
  - onOpenSettings wired as a stub (_setShowAiSettings(true)) for plan 03-05 to connect the AiSettingsModal
  - Window.platform type consolidated in aiStream.d.ts alongside Window.aiStream — avoids a separate one-line file
  - streamingContent rendered as whitespace-pre-wrap raw text; ReactMarkdown only wraps completed message content (msg.content)
metrics:
  duration: ~7 minutes
  completed: 2026-05-26
  tasks_completed: 2
  files_created: 5
  files_modified: 2
---

# Phase 03 Plan 04: Renderer Story Scroll, Chat Input, useAiStream Hook, Inline Error Block Summary

**One-liner:** React chat panel with continuous story scroll (react-markdown for completed messages, raw-text streaming with blinking cursor), auto-growing Ctrl+Enter input, and inline ChatErrorBlock with fallback/retry buttons — wired to the window.aiStream IPC bridge from Plan 03-03.

## What Was Built

### aiStream.d.ts
- Global `Window` interface augmentation declaring `aiStream: { sendMessage, onToken, onFinish, onError, removeAllListeners }` with correct TypeScript types matching the preload implementation
- Also declares `platform: NodeJS.Platform` — consolidates the previously untyped `window.platform` reference into one file
- Placed in `src/renderer/src/types/` which is within `"include": ["./src"]` in tsconfig.json

### useAiStream.ts
- `isStreaming`, `streamingContent`, `error` state
- `send(content, opts?)` — sets isStreaming true, clears state, calls `window.aiStream.sendMessage`
- `clearError()` — resets error for retry/fallback flows
- `useEffect` registers `onToken` (appends to streamingContent), `onFinish` (clears streaming state + `queryClient.invalidateQueries` on `['ai', 'getMessages', campaignId]`), `onError` (sets error)
- Cleanup returns `window.aiStream.removeAllListeners()` — prevents listener stacking across campaign switches (constraint #7 / T-03-04-02)
- `sendMessage` invoke errors are caught and surfaced as `error` state

### StoryScrollPanel.tsx
- Fetches completed history via `trpc.ai.getMessages.query({ campaignId })` with `queryKey: ['ai', 'getMessages', campaignId]` and `staleTime: Infinity` (only invalidated by useAiStream onFinish)
- Renders completed assistant messages through `<ReactMarkdown remarkPlugins={[remarkGfm]}>` with constrained heading sizes (max text-base) per UI-SPEC Typography
- Renders completed player messages as `<hr border-t border-border my-6> + "You:" prefix (italic text-primary/80) + content`
- Renders streaming content as raw `whitespace-pre-wrap` text (NOT markdown — constraint #8) with `animate-[blink_1s_ease-in-out_infinite] aria-hidden` cursor
- Empty state: "Begin your adventure. / Type a message below to start the story." (muted, centered)
- Auto-scroll: `isUserScrolledUpRef` tracks position via onScroll; auto-scrolls on token if within 100px of bottom; force-scrolls on finish; force-scrolls on history load; exposed `scrollToBottomRef` handle for CampaignViewScreen
- `ChatErrorBlock` rendered below messages when `error` is set
- `aria-live="polite" aria-atomic="false"` on the scroll container

### ChatInputArea.tsx
- shadcn `Textarea` with `min-h-[56px] max-h-[112px] resize-none` — auto-grows via `scrollHeight` on `onInput`
- `isEmpty` tracked as `useState` so Send button disables/enables reactively
- `useHotkeys('ctrl+enter', handler, { enableOnFormTags: ['TEXTAREA'] })` for keyboard submit
- Plain Enter inserts newline (no override)
- Send `Button variant="default"` disabled when `isStreaming || disabled || isEmpty`; shows `<Loader2 animate-spin /> Sending…` while streaming
- Disabled state (no provider): textarea + Send disabled; amber `"Configure an AI provider to start playing. Open settings."` notice instead of Ctrl+Enter hint
- `sr-only` `<Label htmlFor="chat-input">` for screen reader accessibility

### ChatErrorBlock.tsx
- `role="alert" aria-live="assertive"` — announces immediately to AT
- `border-l-4 border-l-destructive` left stripe on `bg-card` background (the error signal without a sea of red)
- With fallback: `Button variant="default"` "Switch to fallback" + `Button variant="outline"` "Retry"
- Without fallback: `Button variant="outline"` "Retry" + link-style "Configure fallback in AI settings"
- Timeout message detection via message content for correct body text (provider failure vs. 15s timeout variants)
- Only renders the generic `message` string — no stack traces, keys, or provider bodies (T-03-04-01)

### globals.css
- `@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }` added above `@layer base`
- Used by StoryScrollPanel streaming cursor as `animate-[blink_1s_ease-in-out_infinite]`

### CampaignViewScreen.tsx wiring
- `useAiStream(id ?? '')` instantiated at component level
- `scrollToBottomRef` ref passed to StoryScrollPanel; called in `ChatInputArea.onSend` callback
- `lastUserContentRef` tracks last player content for retry/fallback re-send
- `hasFallback` from `!!campaignQuery.data?.fallbackEndpointUrl`
- `disabled` from `!campaignQuery.data?.providerType`
- Left panel placeholder ("AI narration appears here.") fully replaced
- `handleOpenSettings` stub sets `_showAiSettings(true)` — plan 03-05 connects the AiSettingsModal
- Existing right panel, action bar, and delete dialog unchanged

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | c14e676 | feat(03-04): useAiStream hook + Window.aiStream type augmentation + blink keyframe |
| Task 2 | b9d6f9b | feat(03-04): StoryScrollPanel, ChatInputArea, ChatErrorBlock + CampaignViewScreen wiring |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] isEmpty tracked as useState, not ref read**
- **Found during:** Task 2 — reviewing ChatInputArea implementation
- **Issue:** Initial plan description implied checking `textareaRef.current?.value?.trim()` inline in the render, which is a ref read during render. This would always return the empty value from the last render cycle, not the current textarea content — the Send button would stay disabled until the next re-render triggered by something else.
- **Fix:** Added `useState(true)` for `isEmpty`; updated `handleInput` to call `setIsEmpty(!textarea.value.trim())` on every keystroke; `handleSend` resets to `setIsEmpty(true)` after clearing the textarea.
- **Files modified:** `src/renderer/src/components/ChatInputArea.tsx`
- **Commit:** b9d6f9b

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `handleOpenSettings` sets `_showAiSettings(true)` but no modal renders | `src/renderer/src/screens/CampaignViewScreen.tsx` | Intentional per plan: "for now stub onOpenSettings to a no-op or a state setter that plan 03-05 will connect; do not block on it." Plan 03-05 (AiSettingsModal) wires the actual modal. |

## Threat Surface Scan

All mitigations in the plan's threat register are implemented:

| Threat | Mitigation Implemented |
|--------|----------------------|
| T-03-04-01 (info disclosure) | ChatErrorBlock renders only the generic `message` string; no stack trace, provider body, or key visible in renderer |
| T-03-04-02 (listener leak) | `window.aiStream.removeAllListeners()` in `useAiStream` useEffect cleanup — prevents duplicate handlers on campaign switches |
| T-03-04-03 (markdown injection) | react-markdown default sanitization; streaming content rendered as raw text via `whitespace-pre-wrap` (no ReactMarkdown wrapper); no `dangerouslySetInnerHTML` anywhere |

No new network endpoints, auth paths, file access patterns, or schema changes beyond those in the plan's threat model.

## Verification Results

- `npm run typecheck` → exit 0 (all 5 new files + 2 modified files type-check clean)
- `npm test` → 159 tests passed, 0 failed, 0 skipped (pre-existing test suite unaffected)
- `StoryScrollPanel` imports ReactMarkdown + remarkGfm; contains aria-live="polite" + trpc.ai.getMessages; streamingContent rendered as raw text
- `ChatInputArea` contains min-h-[56px], useHotkeys('ctrl+enter'), "Ctrl+Enter to send"
- `ChatErrorBlock` contains role="alert", "The AI DM stopped responding", conditional "Switch to fallback"
- `CampaignViewScreen` contains StoryScrollPanel + ChatInputArea; "AI narration appears here." removed
- Checkpoint (Task 3): auto-approved per `<checkpoint_auto_approve>` — typecheck exits 0 + StoryScrollPanel present

## Self-Check: PASSED

- [x] `src/renderer/src/types/aiStream.d.ts` — FOUND
- [x] `src/renderer/src/hooks/useAiStream.ts` — FOUND
- [x] `src/renderer/src/hooks/useAiStream.ts` contains `window.aiStream.removeAllListeners` in useEffect cleanup — FOUND
- [x] `src/renderer/src/hooks/useAiStream.ts` contains `invalidateQueries` — FOUND
- [x] `src/renderer/src/components/StoryScrollPanel.tsx` exports `StoryScrollPanel` — FOUND
- [x] `src/renderer/src/components/StoryScrollPanel.tsx` imports ReactMarkdown + remarkGfm — FOUND
- [x] `src/renderer/src/components/StoryScrollPanel.tsx` contains aria-live="polite" — FOUND
- [x] `src/renderer/src/components/StoryScrollPanel.tsx` contains trpc.ai.getMessages — FOUND
- [x] `src/renderer/src/components/StoryScrollPanel.tsx` streamingContent NOT wrapped in ReactMarkdown — VERIFIED
- [x] `src/renderer/src/components/ChatInputArea.tsx` exports `ChatInputArea` — FOUND
- [x] `src/renderer/src/components/ChatInputArea.tsx` contains min-h-[56px] — FOUND
- [x] `src/renderer/src/components/ChatInputArea.tsx` contains useHotkeys('ctrl+enter' — FOUND
- [x] `src/renderer/src/components/ChatInputArea.tsx` contains "Ctrl+Enter to send" — FOUND
- [x] `src/renderer/src/components/ChatErrorBlock.tsx` exports `ChatErrorBlock` — FOUND
- [x] `src/renderer/src/components/ChatErrorBlock.tsx` contains role="alert" — FOUND
- [x] `src/renderer/src/components/ChatErrorBlock.tsx` contains "The AI DM stopped responding" — FOUND
- [x] `src/renderer/src/components/ChatErrorBlock.tsx` contains conditional "Switch to fallback" — FOUND
- [x] `src/renderer/src/screens/CampaignViewScreen.tsx` contains StoryScrollPanel — FOUND
- [x] `src/renderer/src/screens/CampaignViewScreen.tsx` contains ChatInputArea — FOUND
- [x] `src/renderer/src/screens/CampaignViewScreen.tsx` does NOT contain "AI narration appears here." — VERIFIED
- [x] `src/renderer/src/styles/globals.css` contains @keyframes blink — FOUND
- [x] Commit c14e676 — FOUND
- [x] Commit b9d6f9b — FOUND
