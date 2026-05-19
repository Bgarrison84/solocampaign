---
phase: 1
slug: foundation-secure-shell
status: draft
shadcn_initialized: true
preset: custom-subtle-fantasy-dark
created: 2026-05-19
---

# Phase 1 — UI Design Contract

> Visual and interaction contract for the Foundation & Secure Shell phase. Ships the dark "subtle fantasy" desktop chrome: campaign list, create-campaign modal, split-panel campaign view (chat left + 5-tab right), and custom frameless title bar. No real domain content lands in this phase — design the container, not the content.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (via `daltonmenezes/electron-app` boilerplate fork — D-01) |
| Preset | Custom "Subtle Fantasy Dark" OKLCH theme (single `.dark` palette only — no light mode in v1) |
| Component library | Radix UI (transitive via shadcn/ui) |
| Icon library | `lucide-react` (RESEARCH.md / STACK.md) |
| Font (UI / Body) | Inter (system-installed via `font-sans` Tailwind v4 default in the boilerplate; falls back to OS sans) |
| Font (Mono) | JetBrains Mono (for future dice/mechanical readouts; loaded but unused in Phase 1) |
| Display mode | **Dark only** (`.dark` class force-applied on `<html>`); light theme is a v2 polish concern |
| Window chrome | Custom frameless title bar (D-12, D-13); no native OS title bar |

---

## Spacing Scale

Declared values (multiples of 4 only — Tailwind v4 default scale):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-text gaps, tight inline pads (e.g. badge interior) |
| sm | 8px | Title bar control gutters, tab list item padding, modal field row spacing |
| md | 16px | Card interior padding, modal body padding, default element spacing |
| lg | 24px | Card grid column gap, modal outer padding, panel content padding |
| xl | 32px | Campaign list page outer padding, top-of-page section break |
| 2xl | 48px | Empty-state CTA vertical breathing room (above CTA button) |
| 3xl | 64px | Reserved (not used in Phase 1; declared for downstream phases) |

**Exceptions for Phase 1:**

- Title bar height: **32px** on macOS / **36px** on Windows+Linux (matches OS expectations for traffic-light vs custom controls — measured, not a token).
- Title-bar custom controls (close/minimize/maximize) hit target: **46×32px** each (Windows native window control parity); the icons themselves are 10–12px inside.
- Resize handle width between split panels: **4px** (react-resizable-panels v4 default; user-grabbable but non-intrusive).
- Card cover-image slot aspect ratio: **16:9** with a fixed 160px height (slot is present in Phase 1 with placeholder; Phase 2 fills with real images).

---

## Typography

Exactly 4 type roles, 2 weights (Regular 400 + Semibold 600):

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Body | 14px | 400 | 1.5 (21px) | Tab placeholder copy, modal label text, card "Created X days ago" metadata, helper text |
| Label | 14px | 600 | 1.4 (~20px) | Modal field labels, tab triggers, button labels, title-bar app name |
| Heading | 20px | 600 | 1.3 (26px) | Campaign card title (campaign name), modal title ("Create New Campaign"), tab content placeholder heading |
| Display | 28px | 600 | 1.2 (~34px) | Campaign list page H1 ("Your Campaigns"), empty-state primary line ("Start your first campaign") |

**Rules:**

- No italics in Phase 1 chrome.
- No additional sizes (12px, 16px, 24px are explicitly OFF the contract — request a UI-SPEC amendment if a phase needs them).
- All numbers (dates, future stats) use `font-variant-numeric: tabular-nums` so digits don't reflow.

---

## Color

OKLCH-based dark palette, mapped to shadcn/ui theme tokens. The "subtle fantasy" theme = neutral cool-dark base + restrained muted gold/amber accent. No neon, no saturated jewel tones, no purple.

| Role | Token | OKLCH | Approx hex | Usage |
|------|-------|-------|------------|-------|
| Dominant (60%) | `--background` | `oklch(0.16 0.005 260)` | `#1f2126` | App window background, left chat panel surface, right panel surface |
| Secondary (30%) | `--card` / `--muted` | `oklch(0.21 0.006 260)` | `#2a2d33` | Campaign cards, modal surface, title bar background, tab list strip, resize handle |
| Tertiary surface | `--popover` / `--secondary` | `oklch(0.25 0.007 260)` | `#33363d` | Hover state on cards/tabs, modal field input background |
| Border | `--border` | `oklch(0.30 0.006 260)` | `#42454c` | Card outline, modal outline, tab list bottom border, resize handle hairline |
| Foreground (primary text) | `--foreground` | `oklch(0.95 0.003 260)` | `#ececef` | Headings, primary labels, card titles |
| Foreground (muted text) | `--muted-foreground` | `oklch(0.70 0.005 260)` | `#a8a9ad` | "Created X days ago", placeholder body copy, inactive tab triggers |
| **Accent (10%)** | `--primary` / `--accent` | `oklch(0.78 0.10 78)` | `#cba24a` | Muted antique gold |
| Accent foreground | `--primary-foreground` | `oklch(0.18 0.01 70)` | `#28231a` | Text on gold (e.g. CTA button label) |
| Destructive | `--destructive` | `oklch(0.55 0.18 27)` | `#b94840` | Restrained brick-red, reserved (no Phase 1 destructive actions — declared for the rotting-roadmap rule) |
| Focus ring | `--ring` | `oklch(0.78 0.10 78 / 0.6)` | `#cba24a99` | Keyboard focus ring (same gold, 60% alpha, 2px outline + 2px offset) |

**Accent (muted gold) reserved EXCLUSIVELY for:**

1. **Primary CTA button background** — "Create Campaign" (modal submit) and "Start your first campaign" (empty-state CTA).
2. **Active tab trigger** — bottom border (2px) + label color shift to gold on the active tab in the 5-tab strip.
3. **Active campaign card hover** — 1px gold border on hover (not on default state — cards are bordered with `--border` until hovered).
4. **Focus rings** — keyboard focus indication on all interactive elements.

**Accent is FORBIDDEN on:**

- Secondary buttons (modal "Cancel" uses `--secondary` surface, foreground text only).
- Title bar controls (close/minimize/maximize use `--muted-foreground` icons; close gets `--destructive` surface ONLY on hover).
- Card title text (uses `--foreground`, not gold — keeps the grid quiet).
- Tab strip background (only the active-tab underline + label use gold).

**Destructive use in Phase 1:** None. The destructive color is declared so Phase 2+ inherits a locked value; the title-bar close button uses `--destructive` as a hover background only, which is a system-window convention, not a user-mutating action.

---

## Component Inventory (Phase 1)

The shadcn components that land in this phase. All copied via `npx shadcn add` into the forked boilerplate.

| Component | shadcn name | Used by |
|-----------|-------------|---------|
| Button | `button` | Empty-state CTA, modal Create/Cancel, title-bar controls (icon variant) |
| Dialog | `dialog` | Create New Campaign modal |
| Input | `input` | Campaign name field |
| Label | `label` | Modal field label |
| Card | `card` | Campaign list grid cells |
| Tabs | `tabs` | Right-panel 5-tab strip (Character Sheet / Combat Tracker / NPC Tracker / Session Journal / Inventory) |
| Resizable | `resizable` (wraps `react-resizable-panels` v4) | Split-panel chat-left / tabs-right layout |
| Tooltip | `tooltip` | Title-bar control tooltips ("Minimize", "Maximize", "Close") + tab tooltips (when label is icon-only on narrow widths — not in Phase 1 default, but declared) |
| Skeleton | `skeleton` | NOT used in Phase 1 (D-10 explicitly forbids skeleton bubbles in the chat panel) — declared as off-contract |

**No third-party shadcn registries.** Only shadcn official is used.

---

## Screen-by-Screen Spec

### S1. Campaign List (route: `/`)

**Layout:**
- Outer page padding: 32px (xl) on all sides below the title bar.
- Page header row: Display-size H1 "Your Campaigns" left-aligned. No subtitle. No actions in the header row (the create action lives as a card in the grid — see below).
- Grid: CSS grid, **`repeat(auto-fill, minmax(280px, 1fr))`**, column gap 24px (lg), row gap 24px (lg). Naturally produces 2–3 columns at the 1280px default width (D-04, D-14).

**Campaign Card:**
- Surface: `--card` background, 1px `--border`, 12px corner radius.
- Cover slot: 16:9, 160px tall, full card width, top-aligned. In Phase 1: a generic fantasy placeholder image (a low-saturation muted-amber-on-dark vector illustration — bundled in `/assets/placeholder-cover.svg`). Phase 2 replaces with imported images.
- Body: 16px (md) padding.
  - Campaign name: Heading style (20px / 600), single line, truncate with ellipsis.
  - "Created X days ago": Body style (14px / 400), `--muted-foreground`. Uses `dayjs.fromNow()` per RESEARCH.md. "Created today" if <24h; "Created yesterday" if 1 day; "Created N days ago" otherwise.
- Hover: 1px `--primary` (gold) border replaces `--border`; cursor pointer; no scale/translate transform (subtle = no bounce).
- Focus (keyboard): 2px gold focus ring with 2px offset; same hover treatment otherwise.
- Click: navigates to `/campaign/:id`.

**"+ New Campaign" Card (first cell of the grid):**
- Same dimensions as a campaign card.
- Surface: `--card` with a 2px DASHED `--border` (visually signals "add").
- Center vertical+horizontal stack: Plus icon (lucide `Plus`, 24px, `--muted-foreground`) + Label-style "New Campaign" text below (14px / 600, `--muted-foreground`).
- Hover: border becomes 2px dashed `--primary`; icon + label shift to `--foreground`.
- Click: opens Create modal.

**Empty State (no campaigns exist):**
- Per D-07: card grid renders with the "+ New Campaign" card visible AND a separate large CTA below the grid (or instead of the grid if zero cards).
- Centered column, 480px max width, 48px (2xl) above the CTA.
- Display-style line: "Start your first campaign" (28px / 600, `--foreground`).
- Body sub-line: "Your campaigns appear here. Create one to begin." (14px / 400, `--muted-foreground`, 8px below the heading).
- Primary CTA button: 16px (md) above sub-line.
- **Do NOT auto-open the modal** (D-07).

### S2. Create New Campaign Modal

**Trigger:** Click "+ New Campaign" card OR empty-state CTA button.

**Layout:**
- shadcn `Dialog`, max-width 480px, centered.
- Surface: `--card`, 12px corner radius, 1px `--border`, soft dark backdrop (Radix overlay at `oklch(0 0 0 / 0.6)`).
- Outer padding: 24px (lg).
- Stack vertical, 16px (md) row gap:
  1. Heading: "Create New Campaign" (Heading style 20px / 600).
  2. Label "Campaign name" (Label 14px / 600) above the input.
  3. Input: full width, 40px tall, `--secondary` surface, 1px `--border`, 8px (sm) horizontal padding, Body-size text. Placeholder: "e.g. The Lost Mines of Phandelver".
     - Autofocus on open.
     - Validation: trim + required. Min 1 char, max 80 chars.
  4. Helper / error slot (14px / 400, `--muted-foreground` normal; `--destructive` on error).
  5. Action row, right-aligned, 8px (sm) gap:
     - **Cancel** — `--secondary` surface button, `--foreground` text, no border.
     - **Create Campaign** — primary CTA: `--primary` (gold) surface, `--primary-foreground` text (deep brown), Label style. Disabled if input is empty/whitespace-only.

**Interactions:**
- Enter key in input submits if valid.
- Esc key cancels.
- On successful create: modal closes, list refreshes via TanStack Query invalidation, new card appears in the grid; route stays at `/`.

### S3. Campaign View — Split Panel (route: `/campaign/:id`)

**Layout (below the title bar, fills remaining viewport):**
- shadcn `Resizable` horizontal panel group (D-11).
  - Left panel (chat): default 60%, min 30%.
  - Right panel (tabs): default 40%, min 25%.
  - Resize handle: 4px wide, `--border` color, hover/drag shows `--primary` 1px center line; cursor `col-resize`.
  - Resized sizes persist in `electron-store` per-campaign.

**Left Panel (Chat shell):**
- Surface: `--background`.
- Per D-10: centered placeholder text — "AI narration appears here." Body style (14px / 400), `--muted-foreground`. Horizontally + vertically centered in the panel.
- No skeleton bubbles, no input box yet (Phase 3 adds both).

**Right Panel (Tab shell):**
- Surface: `--background`.
- Tab strip at top: shadcn `Tabs` `TabsList`, full width, `--card` background, 1px `--border` bottom only (no top/side borders).
- Tab order (left to right, D-08): **Character Sheet** (default, D-09), **Combat Tracker**, **NPC Tracker**, **Session Journal**, **Inventory**.
- Each `TabsTrigger`:
  - Padding: 8px (sm) vertical, 16px (md) horizontal.
  - Label style (14px / 600).
  - Inactive: `--muted-foreground` text, no underline.
  - Active: `--foreground` text, 2px solid `--primary` (gold) bottom border (overlaps the strip's bottom border), `--card` matched background.
  - Hover (inactive only): `--foreground` text, no underline.
  - Focus: 2px gold focus ring with 2px offset.
- Tab content area (`TabsContent`):
  - 24px (lg) padding all sides.
  - Empty-shell content for each tab (see Copywriting Contract below). Heading-size title + Body-size single sentence; horizontally centered column, max width 400px, 30% from the top of the panel.

### S4. Title Bar (always present, above all routes)

**Layout (per D-12 / D-13):**
- Frameless window. Title bar height 32px (macOS) / 36px (Windows + Linux).
- Background: `--card`. Bottom 1px `--border` separating it from the content area.
- macOS: native traffic lights at the left (Electron renders them automatically when `titleBarStyle: 'hidden'`); the title area is themed flush so the lights sit on `--card`.
- Windows / Linux: custom controls at the right (close, maximize/restore, minimize).

**Title bar content:**
- **Left zone** (with 16px / md padding inset, or 80px inset on macOS to clear traffic lights):
  - App name **"SoloCampaign"** — Label style (14px / 600), `--foreground`.
  - When inside a campaign route, append: ` — {campaign name}` — Body style (14px / 400), `--muted-foreground`. Truncate with ellipsis if total title exceeds available width.
  - On the home route (`/`), only "SoloCampaign" appears.
- **Center zone**: empty (no breadcrumb in Phase 1; Phase 6 may add a location breadcrumb here or in the panel — out of scope).
- **Right zone** (Windows / Linux only):
  - Three icon buttons in order: **Minimize**, **Maximize / Restore**, **Close**.
  - Each 46×32px (46×36px on Linux to match height). Icons centered, 10px lucide-react: `Minus`, `Square` (or `Copy` for restore-state), `X`.
  - Default icon color: `--muted-foreground`.
  - Hover: surface becomes `--secondary` (or `--destructive` for the Close button); icon becomes `--foreground` (or `--primary-foreground` on close hover, which is the brown-on-red contrast).
  - Tooltip: shadcn `Tooltip` after 600ms hover delay — "Minimize" / "Maximize" / "Restore" / "Close".
- The entire title bar **except the control buttons** is draggable: apply CSS `-webkit-app-region: drag;` to the bar and `-webkit-app-region: no-drag;` to each button + the app name span (so text isn't draggable but the gutter is).

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| App name (title bar) | `SoloCampaign` |
| Campaign list page H1 | `Your Campaigns` |
| Empty-state heading | `Start your first campaign` |
| Empty-state body | `Your campaigns appear here. Create one to begin.` |
| Empty-state primary CTA | `Create Campaign` (verb + noun) |
| "+ New Campaign" card label | `New Campaign` |
| Create modal title | `Create New Campaign` |
| Create modal field label | `Campaign name` |
| Create modal input placeholder | `e.g. The Lost Mines of Phandelver` |
| Create modal primary button | `Create Campaign` |
| Create modal secondary button | `Cancel` |
| Create modal validation error (empty) | `Give your campaign a name to continue.` |
| Card date (today) | `Created today` |
| Card date (yesterday) | `Created yesterday` |
| Card date (older) | `Created {N} days ago` |
| Chat panel placeholder | `AI narration appears here.` |
| Tab — Character Sheet (label) | `Character Sheet` |
| Tab — Character Sheet (body) | `Your character sheet will appear here after character creation (Phase 2).` |
| Tab — Combat Tracker (label) | `Combat Tracker` |
| Tab — Combat Tracker (body) | `Initiative, HP, and conditions will appear here once combat lands in Phase 5.` |
| Tab — NPC Tracker (label) | `NPC Tracker` |
| Tab — NPC Tracker (body) | `NPCs you meet will be tracked here once the AI starts populating them in Phase 6.` |
| Tab — Session Journal (label) | `Session Journal` |
| Tab — Session Journal (body) | `Your session recaps and notes will live here once session memory ships in Phase 4.` |
| Tab — Inventory (label) | `Inventory` |
| Tab — Inventory (body) | `Items, currency, and attunement will appear here once your character has belongings in Phase 2.` |
| Title bar control — Minimize tooltip | `Minimize` |
| Title bar control — Maximize tooltip | `Maximize` |
| Title bar control — Restore tooltip | `Restore` |
| Title bar control — Close tooltip | `Close` |
| Generic error (failed to load campaigns) | `Couldn't load your campaigns. Restart SoloCampaign and try again.` |
| Generic error (failed to create) | `Couldn't create the campaign. Check that the name isn't already in use and try again.` |

**Voice rules:**

- Honest, minimal, lowercase-y but properly punctuated. No exclamation points anywhere in Phase 1.
- No fantasy flavor in chrome copy. Save the flavor for in-game AI narration. (E.g. don't write "Forge a new saga" — write "Create Campaign".)
- Empty-state copy names the phase the content lands in (per D-08 / `<specifics>`). This is honest scaffolding, not a feature tease.
- Destructive copy: **none in Phase 1**. There is no delete-campaign action in this phase. If a Phase 1 plan introduces one, halt and amend this spec.

---

## Interaction Contract

| Surface | Keyboard | Pointer |
|---------|----------|---------|
| Campaign card | Enter / Space activates; Tab navigation in DOM order | Click anywhere on card opens campaign |
| "+ New Campaign" card | Enter / Space opens modal | Click opens modal |
| Modal | Esc cancels; Enter submits if valid; Tab cycles within modal (focus trap) | Click outside backdrop cancels |
| Tab triggers | Left/Right arrow moves between tabs; Home/End jumps to first/last; Tab moves focus out of the tab list | Click activates tab |
| Resize handle | Left/Right arrow nudges 16px; Home/End snaps to min/max | Click-drag resizes |
| Title bar controls | Tab to reach; Enter / Space activates | Click activates |
| Window drag | n/a | Drag any non-control area of the title bar |

**Focus order on `/` (campaign list):**
1. Title bar app name (skipped — non-focusable static label).
2. Title bar controls (right zone, Windows/Linux only).
3. Page H1 (skipped — non-focusable).
4. Each campaign card in DOM order, then the "+ New Campaign" card last (so the create action is reachable but the existing campaigns get focus priority).
5. Empty-state CTA (when grid is empty).

**Focus order on `/campaign/:id`:**
1. Title bar controls.
2. First tab trigger (Character Sheet by default).
3. Tab content (skipped in Phase 1 — placeholders are static).
4. Resize handle.
5. Left chat panel (skipped — placeholder is static).

**Loading state for campaign list:** While TanStack Query is fetching campaigns on first mount, render 3 ghost cards (`--card` background, 1px `--border`, NO content, NO animation — per D-10 the project avoids skeleton bubbles; we extend that to "no shimmer animations" globally in Phase 1). Hold for ≤200ms typically; if it exceeds 1s, swap to the generic error copy above.

**Error state:** Inline at the top of the campaign list page (above the grid), `--destructive` foreground text on `--card` surface with 1px `--destructive` border, 16px padding, 24px below the H1. No toast system in Phase 1.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `button`, `dialog`, `input`, `label`, `card`, `tabs`, `resizable`, `tooltip` | not required (first-party) |

**No third-party registries declared.** If a planner discovers a third-party block is needed, halt and amend this spec via the registry vetting gate.

---

## Out of Scope for Phase 1 (Explicit)

These are NOT part of the design contract for Phase 1 — even though the UI may touch them visually:

- Character sheet content / live HP / spell slots (Phase 2).
- Cover image import + display (Phase 2 — Phase 1 ships a single bundled placeholder SVG).
- Chat panel input box, streaming messages, markdown rendering (Phase 3).
- Right-panel tab content beyond the single-sentence placeholders (each tab's content phase).
- Light theme, font-scaling, high-contrast mode, ARIA polish beyond per-control labels (Phase 8).
- Toasts, notification surfaces (Phase 3+).
- Delete-campaign action (no plan for Phase 1 — destructive contract is declared but unused).

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
