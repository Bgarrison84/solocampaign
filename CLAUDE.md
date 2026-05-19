<!-- GSD:project-start source:PROJECT.md -->
## Project

**SoloCampaign**

SoloCampaign is a local desktop application (Electron, Win/Mac/Linux) for playing solo D&D 5e campaigns powered by a pluggable AI Dungeon Master. Players connect any AI provider — Gemini API, LM Studio, Jan AI, or any OpenAI-compatible local LLM — and the AI runs the world, NPCs, combat, and story while the player manages their character and party. It ships as a public release with a proper installer and GitHub-based update notifications.

**Core Value:** A player with no group and no DM can sit down, load SoloCampaign, and play a full D&D 5e campaign — from character creation to level 20+ — with a competent AI DM that remembers everything, follows the rules (or bends them on command), and keeps the world alive.

### Constraints

- **Platform**: Electron + Node.js — cross-platform desktop, ships as native installer
- **Storage**: Local SQLite for campaign data; no cloud backend
- **AI**: Any OpenAI-compatible API (local or cloud) — app must not be locked to one provider
- **Rules content**: Only D&D 5e SRD can be bundled; proprietary sourcebooks must be imported by the user
- **Offline**: Core gameplay must work fully offline when a local LLM is configured
- **Distribution**: GitHub Releases for public distribution; auto-update notifications only (no silent install)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Executive Summary
## Recommended Stack
### Core Runtime
| Technology         | Version          | Purpose                                    | Confidence |
| ------------------ | ---------------- | ------------------------------------------ | ---------- |
| Electron           | **41.x** (stable LTS-ish window) | Chromium + Node runtime, cross-platform shell | HIGH       |
| Node.js (bundled)  | 24.15 (shipped with Electron 41) | Main process runtime                       | HIGH       |
| TypeScript         | **5.6+**         | Type safety across main/preload/renderer   | HIGH       |
### Build Tooling & Boilerplate
| Technology                      | Version | Purpose                            | Confidence |
| ------------------------------- | ------- | ---------------------------------- | ---------- |
| **electron-vite**               | 3.x     | Vite-based build for main/preload/renderer | HIGH |
| Vite                            | 6.x     | Dev server, HMR, renderer bundling | HIGH       |
| **electron-builder**            | 26.x    | Cross-platform installers + auto-update artifacts | HIGH |
- **Electron Forge with Webpack template** — Webpack-Electron tooling is the slow path now; HMR and cold-start are noticeably worse than Vite.
- **electron-react-boilerplate** — Still on Webpack, slower iteration, heavier defaults.
- **Create React App-style setups** — CRA is deprecated; do not start a 2026 project on it.
### Frontend Framework
| Technology       | Version | Purpose                       | Confidence |
| ---------------- | ------- | ----------------------------- | ---------- |
| **React**        | **19.x** | UI rendering                  | HIGH       |
| react-dom        | 19.x    | DOM bindings                  | HIGH       |
| react-router-dom | 7.x     | In-app navigation (campaign list, settings, etc.) | MEDIUM |
| Criterion                    | React 19                                        | Vue 3                          | Svelte 5                            |
| ---------------------------- | ----------------------------------------------- | ------------------------------ | ----------------------------------- |
| shadcn/ui + Radix availability | First-class, the reference port               | Ports exist, smaller surface   | shadcn-svelte exists but lags React |
| Vercel AI SDK UI hooks (`useChat`) | First-class (`ai/react`)                  | Available via community wrappers | Available, less idiomatic           |
| Electron boilerplate quality | The default — most boilerplates ship React only | Available, smaller             | Available, smaller still            |
| LLM/dev tooling familiarity  | Maximum (Claude, Copilot, etc.)                 | High                           | Medium                              |
| Bundle size                  | Largest                                         | Smaller                        | Smallest                            |
- **Solid, Qwik, Preact** — Each works in Electron, but you lose shadcn/ui, the Vercel AI SDK React hooks, and most boilerplate. Pay the framework tax later if needed; don't pay it on day one.
- **Angular** — Too heavy for a desktop app with no enterprise scaffolding requirements.
### UI Component Library & Styling
| Technology              | Version | Purpose                                            | Confidence |
| ----------------------- | ------- | -------------------------------------------------- | ---------- |
| **Tailwind CSS**        | **v4.x**  | Utility-first styling, design tokens via `@theme` | HIGH       |
| **shadcn/ui**           | latest CLI | Copy-in component primitives (button, dialog, tabs, sheet) | HIGH |
| Radix UI                | 1.x (transitive via shadcn) | Headless accessible primitives | HIGH |
| **react-resizable-panels** | **v4.x**  | The split-panel layout (left=chat, right=tabs)  | HIGH       |
| lucide-react            | latest  | Icon set used by shadcn                            | HIGH       |
| Geist Mono or JetBrains Mono | -  | Monospace for dice rolls, mechanical text          | LOW (taste) |
- **shadcn/ui copy-in model** is uniquely well-suited to a desktop app. You own the source, you can re-theme aggressively for the "subtle fantasy" dark UI, and there is no runtime vendor dependency to age out. The CLI now scaffolds React 19 + Tailwind v4 out of the box.
- **react-resizable-panels** is the library shadcn's `Resizable` component wraps. It is the de facto React equivalent of VS Code's split layout and is exactly the primitive PROJECT.md's right-panel-with-tabs design requires. v4 changed export names — pin the version and follow shadcn's current `Resizable` docs.
- **Tailwind v4** + shadcn's OKLCH-based theme tokens make the dark fantasy theme work cleanly: a single `.dark` selector flips the whole palette, and high-contrast mode is a second token set.
- **MUI / Chakra / Ant Design** — Their visual identity fights any custom "fantasy" theme. Lots of override work for a result shadcn gives you for free.
- **CSS-in-JS (styled-components, Emotion)** — Tailwind v4 + CSS variables is the modern answer; CSS-in-JS adds runtime cost and complicates SSR/build that you don't need.
### State Management
| Technology         | Version | Purpose                                | Confidence |
| ------------------ | ------- | -------------------------------------- | ---------- |
| **Zustand**        | **5.x** | UI state (active campaign, panel sizes, modals, settings) | HIGH |
| **TanStack Query** | **5.x** | Async state for IPC calls into SQLite (loading, errors, cache invalidation) | HIGH |
| Immer (optional)   | 10.x    | Ergonomic deep updates inside Zustand stores when needed | MEDIUM |
- **Zustand** for client/UI state — modal open/close, which campaign is loaded, panel sizes, theme, current right-panel tab. Tiny, no provider boilerplate, perfect for a single-user desktop app. The 2025 consensus is unambiguous: Zustand wins for solo/MVP scope.
- **TanStack Query** wraps every IPC call to the main process the same way it wraps HTTP requests on the web. You get loading/error states, automatic refetch on focus, query invalidation when the AI writes to the DB, and dev tools. Treat the main process as a "local server" and IPC as "the network."
- **Redux / Redux Toolkit** — Overkill. The boilerplate, actions, reducers, and selectors are the wrong shape for a single-user app with no team-collaboration needs.
- **Recoil** — Effectively unmaintained.
- **MobX** — Imperative model fights React 19 patterns; smaller community than Zustand now.
- **React Context as primary store** — Fine for theme and a couple of globals; rerender semantics make it a poor fit for the dozens of mutable game-state values in a character sheet.
### Local Storage (SQLite)
| Technology         | Version | Purpose                                        | Confidence |
| ------------------ | ------- | ---------------------------------------------- | ---------- |
| **better-sqlite3** | **11.x**  | Native synchronous SQLite driver (in main process) | HIGH    |
| **Drizzle ORM**    | **0.36+** | Type-safe query builder + migrations            | HIGH       |
| **Drizzle Kit**    | latest  | Schema generation + migration authoring CLI    | HIGH       |
| @electron/rebuild  | 4.x     | Rebuild better-sqlite3 native binding against Electron's Node ABI | HIGH |
- **Synchronous API** is the right shape for SQLite on local disk. Async wrappers around SQLite are theatre; the underlying I/O is fast enough that you don't need to yield, and synchronous code is dramatically simpler in the main process.
- **30ms average latency** in benchmarks vs ~450ms for Prisma. Real Electron migrations from Prisma to Drizzle+better-sqlite3 have reported app size dropping from 523 MB → ~300 MB.
- It is the SQLite driver that the entire Electron ecosystem standardizes on.
| Criterion                  | Drizzle             | Prisma                                   | Knex             | Raw SQL          |
| -------------------------- | ------------------- | ---------------------------------------- | ---------------- | ---------------- |
| Type inference             | Excellent (from schema)  | Excellent (codegen)                 | Minimal          | None             |
| Bundle / install footprint | Tiny                | Large (query engine binary)              | Small            | None             |
| Electron ASAR friendliness | Good (one footgun, see below) | Painful — engine binary handling | Good             | Good             |
| Migration tooling          | drizzle-kit         | prisma migrate (heavyweight)             | knex migrate     | Hand-roll        |
| Performance                | ~30ms               | ~450ms (overhead of query engine)        | Driver speed     | Driver speed     |
- **node-sqlite3** — Async API, slower, smaller community now; better-sqlite3 has won.
- **Prisma** — Heavy, large binary, painful in Electron packaging.
- **TypeORM / Sequelize** — Decorator/class-based ORMs are heavy and slow; not idiomatic for new 2026 projects.
- **libsql** — Excellent if you ever want cloud sync, but PROJECT.md explicitly rules out cloud sync. Don't pay the async API tax for a feature you've decided not to ship.
### AI Provider Abstraction
| Technology                       | Version | Purpose                                       | Confidence |
| -------------------------------- | ------- | --------------------------------------------- | ---------- |
| **Vercel AI SDK (`ai`)**         | **4.x**   | Unified streaming + tool-calling abstraction | HIGH       |
| **`@ai-sdk/google`**             | latest  | Gemini provider                               | HIGH       |
| **`@ai-sdk/openai-compatible`**  | latest  | LM Studio, Jan AI, vLLM, Ollama, any OpenAI-compatible endpoint | HIGH |
| **`@ai-sdk/openai`** (optional)  | latest  | If you ever want first-party OpenAI as a configured provider | HIGH |
| Zod                              | 3.x     | Schema validation for AI tool calls and structured outputs | HIGH |
- It is the only major TypeScript SDK that genuinely treats provider-switching as a first-class concern. Two-line provider swaps; same streaming protocol; same tool-calling shape.
- `@ai-sdk/openai-compatible` is purpose-built for the LM Studio / Jan AI / Ollama use case — both vendors document the `baseURL` swap on their own docs pages.
- Tool calling is unified across providers, which matters when the DM-AI needs to call `awardXP({amount: 100})` or `applyCondition({target, condition})` regardless of which model the user picked.
- It is provider-agnostic on purpose — exactly the constraint PROJECT.md sets: "AI: Any OpenAI-compatible API (local or cloud) — app must not be locked to one provider."
- **`@google/generative-ai`** (the old JS SDK) — Legacy. Support ended August 2025. The replacement is `@google/genai`, but you should prefer Vercel AI SDK's `@ai-sdk/google` for the unified abstraction.
- **LangChain.js** — Heavy, opinionated, churns its APIs frequently. Overkill for "stream tokens + call a few tools." Use only if you later need an agentic framework.
- **Direct fetch() against each provider** — You'll re-invent streaming SSE parsing, tool-call schemas, and provider differences. The SDK pays for itself in week one.
### IPC (Main ↔ Renderer)
| Technology              | Version | Purpose                                 | Confidence |
| ----------------------- | ------- | --------------------------------------- | ---------- |
| Electron `contextBridge` | (built-in) | Expose narrow typed surface to renderer | HIGH    |
| Electron `ipcRenderer.invoke` / `ipcMain.handle` | (built-in) | Request/response IPC | HIGH |
| Custom typed wrapper (in-repo, ~50 LOC) | -    | Compile-time channel typing             | HIGH       |
- Expose `ipcRenderer.on` directly to the renderer (full IPC event surface = full main-process attack surface).
- Use the older `remote` module (removed) or `nodeIntegrationInWorker`.
- Skip Zod validation on IPC input. The renderer is your single biggest attack surface in Electron; treat it as untrusted.
### PDF Generation (Character Sheet Export)
| Technology              | Version | Purpose                          | Confidence |
| ----------------------- | ------- | -------------------------------- | ---------- |
| **`@react-pdf/renderer`** | **4.x** | Character sheet → PDF via React components | HIGH |
- You already have a React-based character sheet component tree. `@react-pdf/renderer` lets you reuse the data model and re-render to PDF with PDF-flavored components (`<Page>`, `<Text>`, `<View>`), without spinning up a headless browser.
- Bundle stays small. No Chromium-on-top-of-Chromium.
- Fast — sub-400ms for typical documents.
- Runs entirely in main or renderer; no system dependencies.
- **Puppeteer / Playwright** — Adds ~200 MB and a second browser to the installer. The convenience of "render the screen to PDF" isn't worth that for a document this structured.
- **Electron's built-in `webContents.printToPDF`** — Tempting because it's free, but it locks the PDF to whatever the screen looks like and re-uses your dark theme styling unless you build a print stylesheet. Worse output for more code.
- **pdfkit / pdf-lib** — Lower level, you'd hand-draw the character sheet. Only worth it if you want to fill an existing PDF template (e.g., the official WotC sheet); revisit if a user requests that.
### Packaging & Distribution
| Technology                | Version | Purpose                                  | Confidence |
| ------------------------- | ------- | ---------------------------------------- | ---------- |
| **electron-builder**      | **26.x** | NSIS (Win), DMG (Mac), AppImage+deb (Linux) | HIGH    |
| **electron-updater**      | **6.x** | Auto-update via GitHub Releases provider | HIGH       |
| GitHub Actions            | -       | Matrix build (windows-latest / macos-latest / ubuntu-latest) | HIGH |
| `@electron/notarize`      | 2.x     | macOS notarization (called by electron-builder) | HIGH  |
- `electron-builder` is the only Electron packaging tool that handles all three platforms' installer formats well and integrates with `electron-updater` for the differential updates.
- `electron-updater` has a first-class GitHub Releases provider — no extra hosting, no S3 bucket. PROJECT.md explicitly chose "GitHub release update notifications," so this is the exact match.
- The build matrix must run on each native OS — you cannot cross-build `.dmg` on Linux or `.exe` (signed) on macOS reliably.
| Platform | Required? | Cost (2026) | Notes |
|----------|-----------|-------------|-------|
| Windows  | Strongly recommended (SmartScreen warning without it) | **Azure Trusted Signing ~$10/month** for individuals (US/Canada) or ~$300+/yr for EV certificate from DigiCert/SSL.com | EV certs cost $300–600/yr. Azure Trusted Signing is the new cheap path. |
| macOS    | Yes for notarization | **$99/yr Apple Developer Program** | Without it, users get a "developer cannot be verified" Gatekeeper warning. |
| Linux    | Not required | $0 | AppImage / .deb just work. |
- Use `electron-packager` directly — `electron-builder` does everything packager does plus the installer + auto-update glue.
- Skip notarization on macOS. Gatekeeper will block the app.
- Self-sign on Windows. SmartScreen treats it as worse than unsigned for the first few thousand downloads.
### Supporting Libraries
| Library                  | Version | Purpose                                                     | When to use |
| ------------------------ | ------- | ----------------------------------------------------------- | ----------- |
| **Zod**                  | 3.x     | Schema validation for IPC payloads, AI tool args, settings  | Everywhere a boundary is crossed |
| **electron-store**       | 10.x    | Small JSON-backed settings store (theme, last opened campaign) | App-level preferences only — NOT campaign data |
| **dayjs**                | 1.x     | Lightweight date math for in-world calendar                 | Throughout |
| **dice-typescript** or **rpg-dice-roller** | latest | Parse and roll dice notation like `2d6+3`     | Dice roller feature |
| **vitest**               | 2.x     | Unit testing                                                | Always |
| **@playwright/test**     | 1.x     | End-to-end testing of the Electron app                      | Smoke tests pre-release |
| **electron-log**         | 5.x     | Structured logging to file in userData                      | Always (debugging public releases) |
| **react-markdown** + **remark-gfm** | latest | Render AI's markdown narration (bold names, italic atmosphere) | Chat panel |
| **react-hotkeys-hook**   | 4.x     | Keyboard shortcuts (`Ctrl+Enter` send, `Ctrl+1..5` tab nav) | UI polish |
| **fuse.js** or **minisearch** | latest | Local full-text search across journal/NPCs/sessions    | Search feature later |
## Alternatives Considered & Rejected
| Category               | Recommended          | Alternative              | Why rejected |
| ---------------------- | -------------------- | ------------------------ | ------------ |
| Desktop shell          | Electron             | Tauri                    | Smaller bundle, but PROJECT.md says "Electron + Node.js"; Tauri's Rust backend would be a substantial learning curve and weaker AI SDK ecosystem. |
| Build tool             | electron-vite        | Electron Forge (Vite)    | Forge's Vite plugin is still experimental; revisit in 6 months. |
| Framework              | React 19             | Svelte 5                 | Smaller bundle, but shadcn-svelte lags React port and Vercel AI SDK React hooks are best-in-class. |
| ORM                    | Drizzle              | Prisma                   | Adds ~200 MB to installer; the Electron community is leaving it for Drizzle. |
| ORM                    | Drizzle              | Kysely                   | Excellent type-safe query builder but no migration story; you'd bolt on something else. Drizzle is the complete package. |
| AI abstraction         | Vercel AI SDK        | LangChain.js             | Too heavy and too opinionated for a 1-app, 2-provider use case; churns its API too often. |
| AI abstraction         | Vercel AI SDK        | Roll your own            | Re-invents SSE parsing, tool-call normalization, and streaming reconnect. Real engineering cost, no benefit. |
| State (UI)             | Zustand              | Redux Toolkit            | RTK is for teams and large enterprise apps. Solo dev / desktop / single-user = Zustand wins clearly. |
| State (server-ish)     | TanStack Query       | Manual loading flags     | Manual loading state for ~30 different IPC calls is a forever-bug factory. |
| PDF                    | `@react-pdf/renderer`| Puppeteer                | +200 MB and a second Chromium for a structured document doesn't make sense. |
| Updater                | electron-updater     | Squirrel direct          | electron-updater wraps Squirrel + Mac + AppImage in one API; no reason to drop down. |
## Installation (greenfield project)
# Scaffold from electron-vite's React + TS template, then layer everything else.
# Easier: clone daltonmenezes/electron-app (React 19 + TS + Tailwind 4 + shadcn + electron-vite + CI),
# rename the project, and delete what you don't need.
# Core UI
# State
# SQLite + ORM
# AI
# PDF
# Updates
# Quality of life
# Rebuild native modules against Electron's Node ABI (one-time + after every electron upgrade)
## Confidence Assessment by Domain
| Domain                         | Confidence | Notes |
| ------------------------------ | ---------- | ----- |
| Electron + electron-vite + electron-builder pipeline | HIGH  | Battle-tested in 2025–2026 boilerplates; releases.electronjs.org confirms version targets. |
| React 19 + Tailwind v4 + shadcn/ui | HIGH | Official shadcn docs cover this exact combo; multiple production guides published 2025–2026. |
| Zustand + TanStack Query split | HIGH       | Universal 2025 consensus for client + async state in single-user apps. |
| better-sqlite3 + Drizzle       | HIGH       | Slight footnote: the ASAR migration journal issue is real, but the workaround is well-documented. |
| Vercel AI SDK multi-provider   | HIGH       | LM Studio docs explicitly target the SDK's openai-compatible provider; `@ai-sdk/google` is GA. |
| IPC pattern (contextBridge + invoke + typed wrapper) | HIGH | This is the Electron-team-recommended pattern; no controversy. |
| react-pdf for character sheet  | MEDIUM     | The right call for a structured document, but if the user wants pixel-exact "looks like the screen" output, revisit. |
| electron-updater + GitHub Releases | HIGH   | Direct match to PROJECT.md's distribution constraint. |
| Code signing strategy          | MEDIUM     | Costs change; verify Azure Trusted Signing pricing closer to release. |
| Electron 41 as the pin         | MEDIUM     | Defensible (one major behind tip), but the call could easily be "41 on day one, move to 42 in 4 weeks." |
## Sources
- [Electron Releases (Stable)](https://releases.electronjs.org/releases/stable)
- [Electron — Boilerplates and CLIs](https://www.electronjs.org/docs/latest/tutorial/boilerplates-and-clis)
- [Electron — Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron — Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron — contextBridge API](https://www.electronjs.org/docs/latest/api/context-bridge)
- [Electron — Code Signing Overview](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [electron-vite — Next Generation Electron Build Tooling](https://electron-vite.org/)
- [Electron Forge — Why Forge?](https://www.electronforge.io/core-concepts/why-electron-forge)
- [electron-builder — Auto Update](https://www.electron.build/auto-update.html)
- [daltonmenezes/electron-app — boilerplate](https://github.com/daltonmenezes/electron-app)
- [cawa-93/vite-electron-builder — secure boilerplate](https://github.com/cawa-93/vite-electron-builder)
- [renqiankun/electron-vite-template — electron-vite + Drizzle + better-sqlite3 reference](https://github.com/renqiankun/electron-vite-template)
- [Drizzle ORM — SQLite getting started](https://orm.drizzle.team/docs/get-started-sqlite)
- [Drizzle ORM — Migrations](https://orm.drizzle.team/docs/migrations)
- [Drizzle ORM — Electron migrations discussion #1891](https://github.com/drizzle-team/drizzle-orm/discussions/1891)
- [Drizzle ORM — `migrate` CLI](https://orm.drizzle.team/docs/drizzle-kit-migrate)
- [better-sqlite3 — Electron integration issue #1171](https://github.com/WiseLibs/better-sqlite3/issues/1171)
- [Vercel AI SDK — Introduction](https://ai-sdk.dev/docs/introduction)
- [Vercel AI SDK — LM Studio (OpenAI-compatible) provider](https://ai-sdk.dev/providers/openai-compatible-providers/lmstudio)
- [LM Studio — OpenAI Compatibility API](https://lmstudio.ai/docs/app/api/endpoints/openai)
- [LM Studio — Server docs](https://lmstudio.ai/docs/developer/core/server)
- [Google Gen AI SDK (`@google/genai`) — npm](https://www.npmjs.com/package/@google/genai)
- [shadcn/ui — Tailwind v4 guide](https://ui.shadcn.com/docs/tailwind-v4)
- [shadcn/ui — Resizable component](https://ui.shadcn.com/docs/components/radix/resizable)
- [react-resizable-panels — npm](https://www.npmjs.com/package/react-resizable-panels)
- [Zustand — docs comparison](https://zustand.docs.pmnd.rs/learn/getting-started/comparison)
- [TanStack DB — SQLite persistence & Electron](https://tanstack.com/blog/tanstack-db-0.6-app-ready-with-persistence-and-includes)
- [@react-pdf/renderer — npm](https://www.npmjs.com/package/@react-pdf/renderer)
- [Type-safe IPC in Electron — Heckmann](https://heckmann.app/en/blog/electron-ipc-architecture/)
- [Electron — Publishing and Updating tutorial](https://www.electronjs.org/docs/latest/tutorial/tutorial-publishing-updating)
- [2025 Setup Guide: Electron-Vite + Tailwind + shadcn/ui — Mohit Nagaraj](https://blog.mohitnagaraj.in/blog/202505/Electron_Shadcn_Guide)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
