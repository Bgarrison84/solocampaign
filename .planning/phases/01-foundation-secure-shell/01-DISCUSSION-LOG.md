# Phase 1: Foundation & Secure Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 1-Foundation & Secure Shell
**Areas discussed:** Scaffold approach, Campaign home screen, Split-panel tab structure, Window chrome, safeStorage wrapper scope, First-launch empty state, SQLite WAL + backup config, App icon, Migration runner behavior, Unit testing scope, Single-instance lock behavior

---

## Scaffold Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Fork daltonmenezes/electron-app | Pre-wired: React 19 + Tailwind v4 + shadcn + electron-vite + GitHub Actions CI | ✓ |
| Fresh electron-vite create | Clean slate, wire all dependencies from scratch | |
| You decide | Claude picks the path | |

**User's choice:** Fork daltonmenezes/electron-app

---

| Option | Description | Selected |
|--------|-------------|----------|
| Strip immediately | Delete all demo content in first task. Clean baseline. | ✓ |
| Leave and build alongside | Keep demo pages as reference, remove before phase exits | |

**User's choice:** Strip immediately

---

| Option | Description | Selected |
|--------|-------------|----------|
| Include as Phase 1 task (non-blocking) | Planner creates a cert-procurement task | |
| Document only — I'll action manually | Just noted in CONTEXT.md | |
| User freeform | Remove cert requirement entirely | ✓ |

**User's choice:** Free text — "Let's change it so that the Apple Developer ID and Azure Trusted Signing won't be required ever"
**Notes:** Unsigned installers. README documents bypass steps: Windows SmartScreen "More info > Run anyway"; macOS Gatekeeper "right-click > Open".

---

| Option | Description | Selected |
|--------|-------------|----------|
| Ship unsigned — document bypass steps in README | Common for open-source tools | ✓ |
| Ship unsigned now, add signing later if users complain | Defer the decision | |

**User's choice:** Ship unsigned — document bypass steps in README

---

## Campaign Home Screen

| Option | Description | Selected |
|--------|-------------|----------|
| Card grid — placeholder art + name + date | 2-3 column grid, scales when covers arrive in Phase 2 | ✓ |
| Simple list — name + date rows | Compact vertical list | |
| You decide | Claude picks | |

**User's choice:** Card grid

---

| Option | Description | Selected |
|--------|-------------|----------|
| Modal dialog — just a name field + Create button | Quick overlay | ✓ |
| Dedicated create screen | Full screen with name + placeholders | |
| You decide | Claude picks | |

**User's choice:** Modal dialog

---

| Option | Description | Selected |
|--------|-------------|----------|
| React Router 7 with named routes | /, /campaign/:id. Locks react-router-dom 7.x | ✓ |
| State-based navigation (no router) | activeCampaignId in Zustand | |
| You decide | Claude picks | |

**User's choice:** React Router 7

---

## Split-Panel Tab Structure

| Option | Description | Selected |
|--------|-------------|----------|
| All 5 tabs visible, empty shells | All tabs render from day one with placeholders | ✓ |
| Tab container only — no tab labels yet | Right panel is blank; tabs added as phases ship | |

**User's choice:** All 5 tabs visible, empty shells

---

| Option | Description | Selected |
|--------|-------------|----------|
| Character Sheet | Most natural first view | ✓ |
| Session Journal | Narrative-first | |
| You decide | Claude picks | |

**User's choice:** Character Sheet (default active tab)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Simple placeholder — "AI narration appears here" | Minimal centered text | ✓ |
| Skeleton / placeholder chat bubbles | Greyed-out fake messages | |

**User's choice:** Simple placeholder

---

| Option | Description | Selected |
|--------|-------------|----------|
| 60/40 — chat dominant | Chat gets more space | ✓ |
| 50/50 — equal split | Even split | |
| You decide | Claude picks | |

**User's choice:** 60/40

---

## Window Chrome

| Option | Description | Selected |
|--------|-------------|----------|
| Custom frameless with app-rendered header | titleBarStyle: hidden (Mac) / frame: false (Win/Linux). Dark theme extends edge-to-edge | ✓ |
| Native title bar | Default Electron behavior. Simpler. White/grey bar breaks dark theme on Win/Linux. | |

**User's choice:** Custom frameless

---

| Option | Description | Selected |
|--------|-------------|----------|
| App name + campaign name + window controls | "SoloCampaign — [Campaign Name]" left, controls right | ✓ |
| App icon + app name only | Minimal, no campaign name | |
| You decide | Claude picks | |

**User's choice:** App name + campaign name + window controls

---

| Option | Description | Selected |
|--------|-------------|----------|
| 1280x800 | Standard developer default, fits 13" laptop | ✓ |
| 1440x900 | More spacious, may letterbox on 1280 displays | |
| You decide | Claude picks | |

**User's choice:** 1280x800

---

## safeStorage Wrapper Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full service — encrypt/decrypt/exists wrapper + unit tests | Phase 3 imports and adds UI | ✓ |
| Stub module only — signatures, no implementation | Phase 3 implements when needed | |
| You decide | Claude picks | |

**User's choice:** Full service with unit tests

---

## First-Launch Empty State

| Option | Description | Selected |
|--------|-------------|----------|
| Empty card grid + large "Start your first campaign" button | User learns the pattern | ✓ |
| Auto-open "New Campaign" modal immediately | Skip home screen on first launch | |

**User's choice:** Empty card grid with CTA button

---

## SQLite WAL + Backup Config

| Option | Description | Selected |
|--------|-------------|----------|
| Full safety stack now | WAL + integrity_check + last-10-copy backup rotation | ✓ |
| WAL + integrity_check only, backup deferred | Backup rotation in Phase 2 | |
| You decide | Claude picks | |

**User's choice:** Full safety stack in Phase 1

---

## App Icon

| Option | Description | Selected |
|--------|-------------|----------|
| Generate placeholder — simple dark fantasy icon | electron-icon-builder generates .icns/.ico/.png | ✓ |
| I'll provide icon files manually | Planner documents expected filenames | |
| You decide | Claude picks | |

**User's choice:** Generate placeholder icon set

---

## Migration Runner Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-run at startup | Main process runs all pending migrations at app start; SQL files in asarUnpack | ✓ |
| Run as part of db-open, separate from app startup | DatabaseService.open() runs migrations | |
| You decide | Claude picks | |

**User's choice:** Auto-run at startup

---

## Unit Testing Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Unit tests for key infrastructure | SQLite repos, safeStorage, Zod IPC schemas + packaged smoke builds on 3 platforms | ✓ |
| Manual verification + smoke builds only | No automated unit tests in Phase 1 | |
| You decide | Claude picks | |

**User's choice:** Unit tests for key infrastructure

---

## Single-Instance Lock Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Focus + bring existing window to front | Standard behavior | ✓ |
| Show brief notification + close second instance | More explicit | |

**User's choice:** Focus existing window to front

---

## Claude's Discretion

None — user made explicit choices on all questions.

## Deferred Ideas

None — discussion stayed within phase scope.
