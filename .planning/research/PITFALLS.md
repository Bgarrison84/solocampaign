# Domain Pitfalls

**Domain:** Solo D&D 5e AI-powered Electron desktop application
**Researched:** 2026-05-19
**Overall confidence:** HIGH (cross-referenced Electron official docs, SQLite docs, electron-builder issues, LLM ops literature)

---

## Critical Pitfalls

These cause rewrites, data loss, security breaches, or app store rejection. Each must be designed against from day one — retrofitting after the fact is expensive or impossible.

---

### Pitfall 1: Insecure Electron renderer configuration (nodeIntegration + contextIsolation)

**What goes wrong:** Renderer windows are created with `nodeIntegration: true` and/or `contextIsolation: false`, often "temporarily" to get something working, then never fixed. Any HTML rendered in that window (imported PDF text, AI-generated content, user-pasted homebrew) can call Node APIs — meaning `require('child_process').exec(...)` is one XSS away from RCE on the user's machine.

**Why it happens:**
- Tutorials and Stack Overflow snippets still default to insecure configs
- `contextBridge` requires more upfront wiring than `nodeIntegration: true`
- Boilerplates (including some `electron-vite` templates) disable isolation to "make HMR work"
- Devs assume "it's a local app, no attackers" — but SoloCampaign imports PDFs, parses AI output, and renders user-supplied homebrew text. All are XSS vectors.

**Consequences:**
- Malicious PDF or AI-generated content executes arbitrary code
- Stolen API keys (Gemini), filesystem access, persistence backdoors
- Cannot fix post-release without forcing all users to re-validate trust
- Public release on GitHub means a single CVE will follow the project forever

**Prevention:**
1. Lock baseline in `BrowserWindow` config from Phase 1:
   ```js
   webPreferences: {
     contextIsolation: true,      // MUST be true
     nodeIntegration: false,      // MUST be false
     sandbox: true,               // MUST be true
     webSecurity: true,
     allowRunningInsecureContent: false,
     preload: path.join(__dirname, 'preload.js')
   }
   ```
2. Expose ONLY narrow, schema-validated APIs through `contextBridge.exposeInMainWorld`. Never expose `ipcRenderer.on` or `ipcRenderer.invoke` directly — wrap each channel.
3. Add CSP meta tag forbidding `unsafe-inline`, `unsafe-eval`, and remote sources.
4. Add `@electron/lint-roller` or `electronegativity` to CI to fail builds with insecure configs.

**Detection / warning signs:**
- Any file in repo containing `nodeIntegration: true` or `contextIsolation: false` (grep on every CI run)
- `require()` working from DevTools console in renderer
- Preload script using `window.electron = require('electron')` instead of `contextBridge.exposeInMainWorld`

**Phase to address:** **Phase 1 (Foundation/Shell)** — non-negotiable. Set the secure config before writing a single feature.

---

### Pitfall 2: AI context window collapse over long campaigns

**What goes wrong:** Campaign at session 30 hits the AI context limit. Either (a) the app silently truncates old context and the DM forgets the central NPC, (b) the API returns a 400 token-limit error mid-session, or (c) costs balloon because every session sends full history. Players lose months of campaign continuity.

**Why it happens:**
- Naive implementations append every message to a growing history array
- Summarization is added late, after the structural assumption "we just send everything" is baked in
- Devs underestimate how fast tokens accumulate: a 3-hour session can produce 30k+ tokens of chat
- Local LLMs (LM Studio default) often have 4k–8k context windows, far smaller than Gemini/Claude
- Test campaigns are short — the bug only appears for real users at session 20+

**Consequences:**
- Campaign feels broken; NPCs forget the player; quests evaporate
- Costs spiral on cloud APIs (one user reported $40/session at scale)
- Users abandon long campaigns; the core value prop ("level 1 to 20+ over months") fails
- Trajectory elongation: summarizer smooths over critical plot beats, losing severity of past events
- Hallucinated continuity: AI invents "facts" because real context is gone

**Prevention:**
1. **Tiered memory architecture from day one** (not as an afterthought):
   - **Hot context:** Current session's recent N turns (verbatim)
   - **Warm context:** Current session's earlier turns (rolling summary, regenerated periodically)
   - **Cold context:** Prior sessions (one persistent summary per session, stored in DB)
   - **Structured state:** Character sheet, quest log, NPC registry, location, time — *passed as data, not narrative* (always present, never summarized away)
2. Track token budget per request. Use `tiktoken` (OpenAI), `@google/generative-ai` counter (Gemini), or model-specific counters. Pre-flight every request: if projected > 80% of context window, summarize before sending.
3. Insert summaries as `system` role messages, NOT `assistant` — assistant-role summaries cause the model to hallucinate them as past dialogue (documented failure mode).
4. Keep "load-bearing" facts (PC name, party composition, current location, active quest) in a structured block ALWAYS appended verbatim, never summarized.
5. Per-campaign configurable context window (since local LLMs vary: 4k for tiny models, 128k for Llama 3.1).
6. Telemetry (opt-in local logs only): token count per turn, warn user when approaching limit.

**Detection / warning signs:**
- AI forgets a major NPC introduced in the same session → hot context is too small
- AI describes a location the party left two sessions ago as "current" → cold summary lost time data
- API returns `context_length_exceeded` → no pre-flight check
- Costs growing linearly with session count → no summarization happening

**Phase to address:** **Phase 2 (AI Engine core)** — architecture decision, not a feature. Must be in place before any session UI exists.

---

### Pitfall 3: better-sqlite3 native module rebuild failures

**What goes wrong:** App works in development. Packaged installer crashes immediately on launch with `NODE_MODULE_VERSION mismatch` or `Cannot find module './build/Release/better_sqlite3.node'`. Users see a blank window or instant crash. You get one-star reviews before you can diagnose.

**Why it happens:**
- `better-sqlite3` is a native module compiled against a specific Node ABI. Electron ships a different Node ABI than your system Node.
- `electron-rebuild` not configured, or runs against wrong Electron version
- Vite/Webpack tries to bundle the `.node` binary (it can't — `.node` files must be `require()`d at runtime)
- `app.asar` packs the `.node` file inside the archive; Node can't `dlopen()` from inside asar
- Spaces in the project path break `node-gyp` on Windows
- Different machines used for build (Windows build server) than the target arch

**Consequences:**
- Packaged app is completely broken; dev build works fine, so bug isn't found until release
- Cross-platform builds fail differently on each OS (macOS arm64 vs x64 vs Windows vs Linux)
- "DLL not found" errors confuse non-technical users
- Auto-updater can ship a broken native binary, bricking everyone's install simultaneously

**Prevention:**
1. **Pin and rebuild explicitly:**
   ```json
   "scripts": {
     "postinstall": "electron-builder install-app-deps"
   }
   ```
   Or use `@electron/rebuild` directly. Run on every `npm install` and in CI.
2. **Mark better-sqlite3 as external in bundler config** (Vite: `build.rollupOptions.external`, Webpack: `externals`). Do not bundle it.
3. **Unpack from asar** in `electron-builder.yml`:
   ```yaml
   asarUnpack:
     - "**/node_modules/better-sqlite3/**/*"
     - "**/*.node"
   ```
   Or use Electron Forge's `@electron-forge/plugin-auto-unpack-natives`.
4. **Test packaged builds in CI** on all three target platforms (Windows, macOS x64+arm64, Linux). Never trust "works in dev."
5. **Avoid paths with spaces** in CI builders (GitHub Actions defaults are safe; self-hosted may not be).
6. **Build per-architecture** for macOS — universal binaries hide arm64-specific rebuild failures until an M-series user installs.

**Detection / warning signs:**
- `npm install` warnings about node-gyp or Python missing
- `better_sqlite3.node` not present in `app.asar.unpacked/node_modules/better-sqlite3/build/Release/`
- App opens DevTools and shows `Error: The module ... was compiled against a different Node.js version`
- Works in `npm start` but crashes in packaged `.exe`/`.dmg`/`.AppImage`

**Phase to address:** **Phase 1 (Foundation/Shell)** — set up packaging and CI smoke test on packaged builds before adding features. Catch the bug on day one, not day 100.

---

### Pitfall 4: SQLite WAL mode corruption from concurrent processes

**What goes wrong:** Electron app crashes during a save, or user opens two windows, and SQLite database becomes corrupt. Campaign data — months of play — is unreadable. No backup exists because the dev assumed "SQLite is bulletproof."

**Why it happens:**
- WAL mode requires all connections to live on the same filesystem and see the same `.shm` (shared memory) file
- If main process and a worker/utility process both open the same DB and write simultaneously, corruption is possible (CVE-class WAL-reset bug existed up through 3.51.2)
- Database file synced to Dropbox/iCloud — sync clients clobber the WAL file mid-write
- App killed mid-checkpoint (user force-quits during save)
- Migration runs without setting `journal_mode=WAL` consistently; mode flips between connections

**Consequences:**
- Total campaign loss. The single feature most likely to make users rage-quit and leave a one-star review.
- Recovery requires SQLite `.recover` CLI most users can't run
- Cloud-sync users especially affected (Dropbox of `app data` folder is a common user pattern)

**Prevention:**
1. **Single-writer architecture:** Open the SQLite connection exactly once in the main process. Renderer never touches the DB directly — all data access via IPC.
2. **Single-instance lock:** Use `app.requestSingleInstanceLock()` at startup. Refuse to launch a second window pointing at the same DB.
3. **Set pragmas on every connection consistently:**
   ```sql
   PRAGMA journal_mode = WAL;
   PRAGMA synchronous = NORMAL;
   PRAGMA foreign_keys = ON;
   PRAGMA busy_timeout = 5000;
   ```
4. **Warn against cloud-sync folders.** When the user chooses a custom data folder, detect known sync paths (`Dropbox`, `iCloud Drive`, `OneDrive`, `Google Drive`) and warn — or refuse — with a clear message.
5. **Automatic backups before every session:** Copy DB file to `backups/campaign-{name}-{timestamp}.db`. Rotate, keep last 10. Free insurance against any corruption cause.
6. **Run `PRAGMA integrity_check` on launch.** If it fails, refuse to open, point to backup, log loudly.
7. **Use `better-sqlite3`** (synchronous, single-threaded by design) over `node-sqlite3` (async, easier to misuse with parallel writes).

**Detection / warning signs:**
- `database disk image is malformed` error
- `.shm` or `.wal` file present after clean shutdown (should be merged and gone)
- Second app instance opens without single-instance check
- User reports campaign data missing after a crash

**Phase to address:** **Phase 1 (Foundation/Shell)** — DB architecture and backup strategy must precede any data writes. The "single-writer + IPC" pattern is hard to retrofit.

---

### Pitfall 5: API keys leaked through process inspection, logs, or sync

**What goes wrong:** User configures their Gemini API key. App stores it in plaintext in `config.json` in app data folder, or in localStorage. User syncs their `app data` folder to Dropbox. Key is exposed. Or: app logs the full HTTP request including `Authorization` header. Or: user reports a bug and pastes the log file to GitHub.

**Why it happens:**
- "It's a local app" thinking — but Electron renderers are network-exposed via XSS, and local files leak via sync, backup tools, accidental sharing
- Plaintext config files are the path of least resistance
- Devs forget Electron has `safeStorage` API
- Logging libraries (winston, electron-log) capture full request/response objects including headers

**Consequences:**
- User's Gemini account abused; thousands of dollars in API charges
- Key compromise blamed on SoloCampaign in public forums
- Loss of trust = death for a public Electron app

**Prevention:**
1. **Use `safeStorage` (Electron built-in)** for all API keys. Falls back to OS keychain (Keychain on macOS, DPAPI on Windows, libsecret/kwallet on Linux).
   ```js
   const encrypted = safeStorage.encryptString(apiKey);  // store this blob
   const plain = safeStorage.decryptString(encrypted);   // retrieve at runtime
   ```
2. **Never store keys in renderer.** Main process holds keys, makes API calls. Renderer sends prompts, receives streamed responses — never sees the key.
3. **Scrub logs.** Wrap your logger with a redaction pass: regex out anything matching `sk-`, `AIza`, `Bearer`, `Authorization:` headers, URL query params named `key=` or `token=`.
4. **Warn before key entry if data folder is in a sync location.** Same check as Pitfall 4.
5. **No key in the asar.** Never bundle an API key in the app — even for testing. Use environment variables at dev time.
6. **Check `safeStorage.isEncryptionAvailable()`** on Linux — some headless/CI Linux environments lack a secret store. Fall back to a user-passphrase-encrypted blob, not plaintext.

**Detection / warning signs:**
- Grep for `Authorization` or `apiKey` in log files
- `config.json` contains the actual key as a string
- Renderer console reveals key via `window.electron.config.get('apiKey')` or similar

**Phase to address:** **Phase 2 (AI Engine core)** — alongside the provider configuration UI. Must NOT ship a v0 with plaintext keys "to fix later."

---

### Pitfall 6: Game state inconsistency from AI-driven mutations

**What goes wrong:** The AI awards 50 XP for an encounter. UI shows 50 XP. DB shows 0 XP. Or: AI says "the longsword breaks," but inventory still has it. Over a long campaign, the player's reported state and the AI's understood state diverge until nothing makes sense.

**Why it happens:**
- Two sources of truth: the AI's narrative + the app's structured state
- AI tool calls fail silently (network blip, parse error, schema mismatch)
- AI narrates an effect without invoking the corresponding tool ("you take 5 damage" but no `applyDamage` call)
- Player edits state manually; AI is not informed and continues from stale context
- Free-form narrative ("the bartender frowns" — is that hostility? a quest flag? noise?) has no formal mapping to state

**Consequences:**
- Combat balance breaks (HP drift accumulates)
- Quest log lies about completion status
- Player can't trust the app or the AI; immersion dies
- Bug reports of form "the app says X but the AI says Y" are unresolvable without a transactional model

**Prevention:**
1. **AI uses tool-calling / structured output for ALL state mutations.** Never parse mutations from prose. If a state change happens, it MUST come through a typed function call (`applyDamage(target, amount)`, `addItem(...)`, `awardXP(...)`, `setQuestStatus(...)`).
2. **Validate every tool call against a JSON schema** before execution. Reject malformed calls; ask the AI to retry. Log the rejection.
3. **State as the single source of truth.** When sending context to the AI on next turn, always include the current authoritative state. Don't trust the AI's memory of state.
4. **Event-log pattern** — append every state change (player-initiated or AI-initiated) to a `campaign_events` table with `timestamp, source (player|ai|system), kind, payload`. Reconstructible, debuggable, and the foundation for undo.
5. **Reconciliation prompt at session start:** "Last session you ended with HP 23/45, in Forest > Crypt. Confirm? [yes / fix it]." Catches drift before it propagates.
6. **Undo / soft delete.** Every AI action reversible for at least one turn. Builds user trust against AI mistakes.
7. **Forbid free-form numeric edits in narration.** Use placeholders the AI must fill via tool calls — e.g., the AI can SAY "you take {damage} damage" only after calling `applyDamage`. Server-side template enforcement.

**Detection / warning signs:**
- Player reports "AI says I have item X but inventory shows otherwise"
- Combat HP doesn't match damage rolls when manually checked
- Quest log shows quests not mentioned in any session journal
- AI tool-call failures > 5% rate in logs

**Phase to address:** **Phase 3 (Game State / Character system)** — design the state mutation contract *before* writing the first combat tracker. Retrofitting tool-calling onto a prose-driven system is a rewrite.

---

## Moderate Pitfalls

These cause user friction, support burden, or feature loss but are recoverable.

---

### Pitfall 7: Local LLM streaming cancellation orphans

**What goes wrong:** Player clicks "stop generating" or closes the session mid-AI-response. App stops listening, but the local LLM keeps generating — consuming CPU/GPU, holding the model busy, and producing output that's then lost. On cloud APIs, billing continues for the full generated response even though it's discarded.

**Why it happens:**
- `AbortController.abort()` cancels the fetch on the client side but doesn't necessarily propagate to the server (LM Studio, Jan, Ollama all vary in how they handle stream cancellation)
- Devs assume closing the stream closes the upstream — it often doesn't
- `abort` and stream `resume` features conflict in some SDKs (AI SDK docs warn explicitly)

**Consequences:**
- Local LLM appears "stuck" for 30+ seconds after a cancel
- Cloud API costs higher than expected
- Concurrent sessions or rapid retry buttons pile up orphaned generations

**Prevention:**
1. Pass `AbortSignal` through every layer of the AI client
2. For local LLMs, explicitly issue a `POST /v1/cancel` or equivalent if the endpoint supports it; many do (vLLM, Ollama via `Cancel-Request` header in newer builds)
3. Throttle UI — disable "send" button until prior stream completes OR is fully cancelled (acknowledged by server, not just client-side abort fired)
4. Use `onAbort` callback (when SDK supports it) to clean up partial state, not `onFinish`
5. Test cancellation against every supported provider during integration

**Phase to address:** **Phase 2 (AI Engine)** — during streaming UI integration.

---

### Pitfall 8: PDF generation hanging or producing blank output

**What goes wrong:** User clicks "Export character sheet to PDF." App hangs forever, or produces a blank PDF, or crashes the renderer. Repeatable for some character configurations (long backstories, custom feats with rich HTML).

**Why it happens:**
- `webContents.printToPDF()` is documented to hang on certain URLs with no error
- Sandboxed renderer (Electron 20+) restricts what `printToPDF` can access
- Hidden BrowserWindow approach must wait for `did-finish-load` AND custom assets (fonts, images); racing produces blank pages
- Page size / margin issues with portraits / long content
- Character portrait images loaded asynchronously after print fires

**Consequences:**
- Feature appears broken; user-visible failure
- Workarounds (using `window.print()` then saving) lose styling

**Prevention:**
1. Use a **hidden BrowserWindow** dedicated to PDF rendering. Don't print the active UI window.
2. Wait for `did-finish-load`, then `webContents.executeJavaScript('document.fonts.ready')`, then a frame, then call `printToPDF`.
3. Set explicit `pageSize`, `margins`, `printBackground: true`. Don't rely on defaults.
4. **Consider PDFKit (pure JS)** for the character sheet — deterministic, no sandbox surprises, scriptable. Use `printToPDF` only for "print what's on screen" scenarios.
5. Hard timeout: 30s. If `printToPDF` doesn't resolve, kill the hidden window and report failure.
6. Inline all images as data URIs or pre-cache them; never let the PDF process do a network fetch.

**Phase to address:** **Phase 5 (Export / polish)** — late phase. Choose PDFKit vs printToPDF early in this phase based on character sheet complexity.

---

### Pitfall 9: Auto-updater silent breakage on differential updates

**What goes wrong:** v1.2 installs fine. v1.3 ships, differential update fails with "operation overlaps previous operation," falls back silently to a full download — or doesn't update at all. Users on v1.2 stay there forever, never see the bug fix.

**Why it happens:**
- Missing `latest-mac.yml` / `latest.yml` / `.blockmap` files in GitHub release (forgot to upload)
- macOS requires `zip` target alongside `dmg` for Squirrel.Mac
- `updaterCacheDirName` not configured; cache directory collides with prior install
- Code signing certificate changed between versions — old version can't verify new
- `app-update.yml` not present in production build

**Consequences:**
- Users stuck on old buggy versions
- Support burden: "the update notification never appears for me"
- Differential downloads quietly become full downloads (10–100MB)

**Prevention:**
1. **Use `notify-only` autoUpdate flow** (matches the project's "manual download" requirement) — sidesteps most differential bugs entirely. Just check GitHub Releases API for newer tag, open browser to release page.
2. If full auto-update is added later: ensure `electron-builder` publishes ALL artifacts (`latest.yml`, `.blockmap`, `dmg`, `zip` for macOS; `nsis`, `latest.yml`, `.blockmap` for Windows).
3. Don't call `autoUpdater.checkForUpdates()` twice — guard with state.
4. Test the update path end-to-end before every release: install v(N-1), publish v(N), verify update.
5. Keep code signing identities stable across versions; document the renewal process.

**Phase to address:** **Phase 6 (Distribution)** — after the app is stable. PROJECT.md scopes this as "notify only, manual download," which is the lower-risk path.

---

### Pitfall 10: Code signing rejection / Apple notarization failure

**What goes wrong:** Build pipeline works for months. One day a notarization fails with cryptic Apple error. Or Windows SmartScreen flags the unsigned `.exe` and 90% of users abandon the download. Or the cert expires silently.

**Why it happens:**
- Choosing the wrong Apple cert type (`Developer ID Installer` for Mac App Store vs `Developer ID Application` for direct distribution — SoloCampaign needs the latter)
- Apple's 75-notarization-per-day limit hit during a tagging frenzy
- Hardened runtime entitlements not configured for native modules (better-sqlite3 specifically needs `com.apple.security.cs.allow-unsigned-executable-memory` or similar in some setups)
- Windows: no EV cert OR Azure Trusted Signing not set up → SmartScreen blocks for new users
- Notarization tool changed (`altool` → `notarytool`) and CI scripts not updated
- Apple Developer ID / Microsoft cert expires; nothing alerts you

**Consequences:**
- Cannot release until resolved
- Existing users on macOS get "app is damaged" Gatekeeper errors
- Windows install conversion drops 50%+ on first download due to SmartScreen warning

**Prevention:**
1. Use `notarytool` (current Apple tool); avoid `altool` (deprecated).
2. **Use `@electron/notarize`** integrated into electron-builder's afterSign hook.
3. **Choose `Developer ID Application` cert** for non-App Store distribution.
4. Add `entitlements.mac.plist` with the minimum entitlements native deps need — and test packaged build, not just signed build.
5. **Windows: budget for Azure Trusted Signing** (~$10/month, US/Canada only as of 2025) OR an EV cert (~$300/year). DO NOT ship unsigned to public.
6. Calendar alerts for cert expiry 60 days out. Document the renewal in `RUNBOOK.md`.
7. CI job runs a "fake release" weekly that signs and notarizes a test build — catches credential expiry before release day.

**Phase to address:** **Phase 6 (Distribution)** — but begin certificate procurement in Phase 1 (lead time on Apple Developer account, Azure Trusted Signing onboarding can be weeks).

---

### Pitfall 11: IPC channels without sender or schema validation

**What goes wrong:** Renderer asks main process to read a file via `ipcMain.handle('read-file', (e, path) => fs.readFileSync(path))`. XSS in any rendered content sends `..\..\Windows\System32\config\SAM`. Or a child iframe (PDF preview) sends arbitrary IPC.

**Why it happens:**
- Tutorials show `ipcMain.handle` taking arbitrary args without validation
- Renderer is treated as trusted because "it's the same app"
- All Web Frames (iframes, child windows) can send IPC by default

**Consequences:**
- Local file read/write from injected content
- Arbitrary command execution if `exec`-style channels exist
- Linked to Pitfall 1 — even with `contextIsolation`, unsafe handlers still leak

**Prevention:**
1. Validate every IPC handler argument with a schema (Zod, Valibot, ArkType). Reject and log invalid input.
2. Validate `event.senderFrame.url` — only accept from your own `file://` origin or `app://`.
3. Use `ipcMain.handle` (invoke/reply) over `ipcMain.on` (fire-and-forget) so misuse fails loudly.
4. Never accept arbitrary file paths from the renderer. The renderer asks "save this campaign" (typed payload); main process decides the path.
5. Audit-listable IPC surface: a single `ipc-channels.ts` file enumerating every channel; CI fails if `ipcMain.handle` appears outside it.

**Phase to address:** **Phase 1 (Foundation)** — pattern established before any feature handlers exist.

---

### Pitfall 12: Migration failures on user databases

**What goes wrong:** v1.5 adds a `quest_log` table. User has been on v1.0 since launch — their schema is missing 4 intermediate migrations. App crashes on launch, "no such column."

**Why it happens:**
- Migrations applied as one-off scripts during dev, never versioned
- Migration tool runs at startup but doesn't handle "user skipped 3 versions"
- Migration is written assuming current schema; doesn't run from scratch
- WAL mode + migration: schema changes in a transaction sometimes don't propagate to other connections (Pitfall 4 territory)

**Consequences:**
- Mass user data loss on update
- Cannot recover without manual SQL surgery

**Prevention:**
1. **Versioned migrations** in a folder, named `001_init.sql`, `002_add_quests.sql`, etc. Tracked via `PRAGMA user_version`.
2. Run ALL pending migrations in a transaction at startup. Rollback on any failure.
3. **Auto-backup before migration** — copy DB to `backups/pre-migration-{version}.db` before applying.
4. Test forward migrations on a fixture DB representing each prior released version (CI matrix).
5. Never edit a committed migration. Always add a new one.
6. Migration scripts must be idempotent where possible (`CREATE TABLE IF NOT EXISTS`, `ALTER ... IF NOT EXISTS` via try/catch).

**Phase to address:** **Phase 1 (Foundation)** — schema and migration framework before any data exists.

---

## Minor Pitfalls

These cause polish issues, edge-case bugs, or accumulate as tech debt.

---

### Pitfall 13: SRD content licensing missteps

**What goes wrong:** Project bundles content from the non-SRD portion of the DMG ("Epic Boons" rules, specific monster stat blocks, proprietary spell descriptions). Wizards of the Coast issues a takedown.

**Prevention:**
- Use ONLY the SRD 5.1 (CC-BY-4.0) or SRD 5.2 (newer release; verify exact license).
- Attribution file shipped with the app (`SRD-CREDITS.md`).
- Epic Boons system: verify exact rules wording is in SRD or paraphrase mechanics without quoting the book.
- User-imported content stays user-side; never re-share imports as templates without user consent.

**Phase to address:** **Phase 3 (Rules content bundling)** — and again at release review.

---

### Pitfall 14: Dice roller predictability / RNG complaints

**What goes wrong:** `Math.random()` produces a streak; users notice, accuse the app of being rigged. Or the AI's "behind-the-scenes" rolls aren't shown, eroding trust.

**Prevention:**
- Use `crypto.randomInt()` (Node built-in) — not `Math.random()` — for dice.
- Show every enemy roll the AI makes in chat (PROJECT.md already specifies this).
- Provide a "roll log" / dice history panel for transparency.
- Seedable RNG with seed shown — players can verify fairness if they want.

**Phase to address:** **Phase 4 (Combat / dice)**.

---

### Pitfall 15: Cross-platform file path bugs

**What goes wrong:** Hardcoded `\` or `/`, hardcoded `C:\Users\...`, hardcoded `~` expansion. Works on dev's machine. Crashes on someone else's.

**Prevention:**
- Always use `path.join` / `path.resolve` (never string concatenation)
- Always derive paths from `app.getPath('userData')`, never assume locations
- Test on all three platforms in CI from Phase 1
- Be aware: macOS sandbox / hardened runtime may restrict paths outside `~/Library/Application Support/{app}/`

**Phase to address:** **Phase 1 (Foundation)** — CI matrix from day one.

---

### Pitfall 16: Accessibility regressions in AI-streamed content

**What goes wrong:** Screen readers don't re-announce mid-stream text. Streaming AI responses arrive token-by-token; ARIA live regions either announce each token (annoying) or never settle (silent).

**Prevention:**
- Use `aria-live="polite"` and update the text node only when a logical "paragraph" completes, not per token
- Provide a "final message" pass that re-announces the whole response when streaming ends
- Tab order: respect DOM order; never use positive `tabindex`
- Test with NVDA (Windows) and VoiceOver (macOS) — not just dev's eyes

**Phase to address:** **Phase 5 (UI polish)** — but design ARIA live region semantics in Phase 2 when streaming UI is first built.

---

### Pitfall 17: Local LLM provider quirks (LM Studio vs Jan vs Ollama)

**What goes wrong:** App claims "OpenAI-compatible" support, but Jan's quirks (different streaming format, no tool calling, smaller default context) break the AI engine in production.

**Prevention:**
- Per-provider capability matrix: tool calling supported? streaming format? max context?
- Auto-detect capabilities on first connection (`GET /v1/models`, probe with a small tool call)
- Graceful degradation: if no tool calling, fall back to JSON-in-prose with strict parser
- Document the tested-provider list explicitly; warn for untested endpoints

**Phase to address:** **Phase 2 (AI Engine)** — capability detection from the first integration.

---

### Pitfall 18: Auto-save loss on crash

**What goes wrong:** User plays for 2 hours. App crashes mid-session. Session log lost because saves only happen "at session end."

**Prevention:**
- Persist every AI turn to DB as it streams (append to `campaign_events` per Pitfall 6)
- Session "end" is just a flag; data is durable per-turn
- On launch, detect interrupted sessions; offer "resume" with last persisted turn

**Phase to address:** **Phase 3 (Session flow)**.

---

## Phase-Specific Warnings

| Phase | Likely Pitfall(s) | Critical Mitigation |
|-------|-------------------|---------------------|
| **Phase 1 — Foundation / Shell** | #1 Insecure renderer; #3 Native module rebuild; #4 SQLite WAL corruption; #11 IPC validation; #12 Migrations; #15 Cross-platform paths | Lock secure baseline; CI on packaged builds across 3 OSes; backups + single-instance + schema versioning before any data writes |
| **Phase 2 — AI Engine core** | #2 Context collapse; #5 API key leaks; #7 Stream cancellation; #17 Provider quirks | Tiered memory architecture from day one; `safeStorage` for keys; AbortController plumbing; capability detection |
| **Phase 3 — Game State / Character / Sessions** | #6 State inconsistency; #18 Auto-save loss; #13 SRD licensing | Tool-calling for ALL mutations; event-log persistence; SRD-only content audit |
| **Phase 4 — Combat / Dice** | #14 RNG fairness | crypto.randomInt + visible roll log |
| **Phase 5 — Export / Polish / Accessibility** | #8 PDF generation; #16 Accessibility | Hidden BrowserWindow + PDFKit fallback; ARIA live region design |
| **Phase 6 — Distribution / Updates** | #9 Auto-updater; #10 Code signing | Notify-only updater; Azure Trusted Signing + Apple notarytool; cert expiry alerts |

---

## Why These Are Domain-Specific (Not Generic Advice)

These pitfalls are sharpened by SoloCampaign's specific constraints:

- **Long campaigns (level 1–20+ over months)** make context window collapse (#2) a near-certain bug rather than an edge case.
- **Pluggable AI providers (cloud + local)** force capability detection (#17) and stream cancellation (#7) to handle quirks across LM Studio, Jan, Ollama, Gemini.
- **AI-driven state mutations** (XP, HP, quests, inventory) demand tool-calling discipline (#6) that pure chat apps don't need.
- **Public GitHub release with installer** elevates code signing (#10), auto-updater (#9), and API key safety (#5) from "nice to have" to "must have."
- **Bundled SRD + user homebrew imports (PDF / text)** create XSS vectors that pure data-only Electron apps avoid (#1, #11).
- **SQLite + better-sqlite3 + asar** is a specific stack with known native-module landmines (#3, #4) that pure-JS Electron apps don't hit.
- **Months-long single-user campaigns** make any data loss catastrophic — backup, migration, and WAL discipline (#4, #12, #18) get weighted higher than typical apps.

---

## Sources

### Electron Security
- [Electron Security Tutorial (official)](https://www.electronjs.org/docs/latest/tutorial/security) — HIGH confidence
- [Context Isolation (official)](https://www.electronjs.org/docs/latest/tutorial/context-isolation) — HIGH
- [Electron IPC Tutorial (official)](https://www.electronjs.org/docs/latest/tutorial/ipc) — HIGH
- [Subverting Electron Apps via Insecure Preload — Doyensec](https://blog.doyensec.com/2019/04/03/subverting-electron-apps-via-insecure-preload.html) — HIGH (security research)
- [Penetration Testing of Electron-based Applications — DeepStrike](https://deepstrike.io/blog/penetration-testing-of-electron-based-applications) — MEDIUM

### Native Modules & Packaging
- [electron/rebuild Issue #1179 — better-sqlite3 rebuild](https://github.com/electron/rebuild/issues/1179) — HIGH (official issue tracker)
- [WiseLibs/better-sqlite3 Issue #1163](https://github.com/WiseLibs/better-sqlite3/issues/1163) — HIGH
- [electron-builder asarUnpack Issue #1285](https://github.com/electron-userland/electron-builder/issues/1285) — HIGH
- [Electron Forge Auto Unpack Natives Plugin](https://www.electronforge.io/config/plugins/auto-unpack-natives) — HIGH
- [Application Packaging (Electron docs)](https://www.electronjs.org/docs/latest/tutorial/asar-archives) — HIGH

### SQLite WAL & Corruption
- [SQLite WAL documentation (official)](https://sqlite.org/wal.html) — HIGH
- [How To Corrupt An SQLite Database File (official)](https://sqlite.org/howtocorrupt.html) — HIGH
- [SQLite Forum — WAL with multiple processes](https://sqlite.org/forum/forumpost/c4dbf6ca17) — HIGH

### Code Signing & Auto-Update
- [Electron Code Signing (official)](https://www.electronjs.org/docs/latest/tutorial/code-signing) — HIGH
- [electron-builder Auto Update](https://www.electron.build/auto-update.html) — HIGH
- [electron-builder Issue #3485 — differential update overlap](https://github.com/electron-userland/electron-builder/issues/3485) — HIGH
- [How to code-sign an Electron app for macOS — BigBinary](https://www.bigbinary.com/blog/code-sign-notorize-mac-desktop-app) — MEDIUM
- [Code Signing Electron for macOS — Security Boulevard 2025](https://securityboulevard.com/2025/12/how-to-code-signing-an-electron-js-app-for-macos/) — MEDIUM

### LLM Context & Cost Management
- [Recursively Summarizing Enables Long-Term Dialogue Memory (arXiv 2308.15022)](https://arxiv.org/pdf/2308.15022) — HIGH (academic)
- [Context Window Overflow in 2026 — Redis](https://redis.io/blog/context-window-overflow/) — MEDIUM
- [LLM API Rate Limiting Best Practices — ClawPulse](https://www.clawpulse.org/blog/llm-api-rate-limiting-best-practices-avoid-429-errors-and-save-40-on-costs) — MEDIUM
- [Handle Token & Rate Limits in LLM Inference — TypeDef](https://www.typedef.ai/resources/handle-token-limits-rate-limits-large-scale-llm-inference) — MEDIUM
- [Managing Context and Memory for Safety — APXML](https://apxml.com/courses/llm-alignment-safety/chapter-7-building-safer-llm-systems/managing-context-memory-safety) — MEDIUM

### Structured Output & Tool Calling
- [Structured outputs and function calling with LLMs — Agenta](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms) — MEDIUM
- [LLM evaluation techniques for JSON outputs — Promptfoo](https://www.promptfoo.dev/docs/guides/evaluate-json/) — MEDIUM

### Storage of Secrets
- [Electron safeStorage API (official)](https://www.electronjs.org/docs/latest/api/safe-storage) — HIGH
- [Replacing Keytar with safeStorage — Freek Van der Herten](https://freek.dev/2103-replacing-keytar-with-electrons-safestorage-in-ray) — MEDIUM

### Streaming & Cancellation
- [AI SDK Stopping Streams docs](https://ai-sdk.dev/docs/advanced/stopping-streams) — MEDIUM
- [vLLM Issue #20798 — request abortion](https://github.com/vllm-project/vllm/issues/20798) — MEDIUM

### Game State / Event Sourcing
- [Snapshots in Event Sourcing — Kurrent](https://www.kurrent.io/blog/snapshots-in-event-sourcing) — MEDIUM
- [Microservices Pattern: Event Sourcing](https://microservices.io/patterns/data/event-sourcing.html) — HIGH

### PDF Generation
- [Electron webContents.printToPDF Issue #20634 — hangs](https://github.com/electron/electron/issues/20634) — HIGH
- [electron-pdf npm package](https://www.npmjs.com/package/electron-pdf) — MEDIUM
