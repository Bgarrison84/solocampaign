---
phase: 1
slug: foundation-secure-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1 |
| **Config file** | `vitest.config.ts` (Wave 0 task — verify boilerplate ships one; if not, create it) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && npm run smoke` |
| **Estimated runtime** | ~15 seconds (unit) / ~90 seconds (unit + packaged smoke on local OS) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && npx electronegativity -i .`
- **Before `/gsd:verify-work`:** Full CI matrix smoke must pass on windows-latest / macos-latest / ubuntu-latest
- **Max feedback latency:** ~15 seconds (unit suite)

---

## Per-Task Verification Map

| Task | Wave | Requirement | Threat | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|--------|-----------------|-----------|-------------------|-------------|--------|
| Fork + strip boilerplate | 1 | FOUND-01 | — | `npm run dev` opens a blank window | manual | `npm run dev` (visual) | n/a | ⬜ pending |
| Secure BrowserWindow config | 1 | FOUND-01 | T-RCE-01 | contextIsolation/sandbox true, nodeIntegration false present in main/index.ts | unit | `vitest run src/main/trpc/schemas.test.ts` | ❌ W0 | ⬜ pending |
| SQLite + WAL + integrity_check | 1 | FOUND-02 | T-DB-01 | WAL pragmas set; integrity_check returns 'ok' on fresh DB | unit | `vitest run src/main/db/migrate.test.ts` | ❌ W0 | ⬜ pending |
| Drizzle schema + migrate() | 1 | FOUND-02 | T-DB-01 | migrate() runs without error; campaigns table exists after | unit | `vitest run src/main/db/migrate.test.ts` | ❌ W0 | ⬜ pending |
| campaigns.list tRPC procedure | 1 | FOUND-02 | T-IPC-01 | returns [] on empty DB; Zod schema rejects invalid input | unit | `vitest run src/main/trpc/schemas.test.ts` | ❌ W0 | ⬜ pending |
| campaigns.create tRPC mutation | 1 | FOUND-02 | T-IPC-01 | campaign persists after create; survives DB close+reopen | unit | `vitest run src/main/db/campaignsRepo.test.ts` | ❌ W0 | ⬜ pending |
| React Router + campaign list screen | 1 | SESS-01 | — | `/` renders campaign list; `/campaign/:id` renders split view | unit (jsdom) | `vitest run src/renderer/src/screens/CampaignView.test.tsx` | ❌ W0 | ⬜ pending |
| Split-panel shell (60/40 default) | 2 | SESS-01 | — | 5 tabs render; CharSheet default; 60/40 default sizes | unit (jsdom) | `vitest run src/renderer/src/components/TabPanel.test.tsx` | ❌ W0 | ⬜ pending |
| Custom frameless title bar | 2 | SESS-01 | — | drag region present; platform-appropriate controls | manual | visual inspection on Win/Mac/Linux | n/a | ⬜ pending |
| Window size persist (electron-store) | 2 | SESS-01 | — | size+position restored after restart | manual | restart app, verify size persists | n/a | ⬜ pending |
| SecretStorageService | 2 | FOUND-04 | T-KEY-01 | encrypt/decrypt round-trip; base64 fallback on headless Linux; no plaintext in logs | unit (mocked safeStorage) | `vitest run src/main/secrets/secretStorageService.test.ts` | ❌ W0 | ⬜ pending |
| secrets tRPC IPC surface | 2 | FOUND-04 | T-KEY-01 | no `get` procedure returns plaintext over IPC | unit | `vitest run src/main/trpc/secrets.contract.test.ts` | ❌ W0 | ⬜ pending |
| Single-instance lock | 2 | FOUND-01 | T-DB-01 | second launch focuses first window; no DB corruption | manual | open two instances | n/a | ⬜ pending |
| Backup rotation | 2 | FOUND-02 | T-DB-01 | backup files created; count ≤ 10; oldest deleted | unit | `vitest run src/main/db/migrate.test.ts -t "backup"` | ❌ W0 | ⬜ pending |
| All Zod IPC schemas | 2 | FOUND-01,02,04 | T-IPC-01 | valid inputs parse; invalid inputs throw ZodError | unit | `vitest run src/main/trpc/schemas.test.ts` | ❌ W0 | ⬜ pending |
| electronegativity CI | 3 | FOUND-01 | T-RCE-01 | no HIGH severity findings in built output | CI | `npx electronegativity -i dist/ -s` | ❌ W0 | ⬜ pending |
| Packaged smoke — Windows | 3 | FOUND-01 | — | app launches; solocampaign.db created in userData | smoke (packaged) | `pwsh scripts/smoke/smoke.win.ps1` | ❌ W0 | ⬜ pending |
| Packaged smoke — macOS | 3 | FOUND-01 | — | app launches; solocampaign.db created in userData | smoke (packaged) | `bash scripts/smoke/smoke.mac.sh` | ❌ W0 | ⬜ pending |
| Packaged smoke — Linux | 3 | FOUND-01 | — | app launches; solocampaign.db created in userData | smoke (packaged) | `bash scripts/smoke/smoke.linux.sh` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — verify boilerplate ships one; extend for main/preload/renderer test environments
- [ ] `src/main/db/campaignsRepo.test.ts` — CRUD round-trip (FOUND-02)
- [ ] `src/main/db/migrate.test.ts` — migration run, idempotent, backup rotation (FOUND-02)
- [ ] `src/main/secrets/secretStorageService.test.ts` — encrypt/decrypt round-trip, fallback, key normalization (FOUND-04)
- [ ] `src/main/trpc/schemas.test.ts` — all IPC Zod schemas valid+reject
- [ ] `src/main/trpc/secrets.contract.test.ts` — no plaintext get over IPC (FOUND-04)
- [ ] `src/renderer/src/screens/CampaignView.test.tsx` — split layout renders (SESS-01)
- [ ] `src/renderer/src/components/TabPanel.test.tsx` — 5 tabs, CharSheet default (SESS-01)
- [ ] `__mocks__/electron.ts` OR `vi.mock` setup — safeStorage mock for unit tests
- [ ] `scripts/smoke/smoke.win.ps1` — packaged smoke, Windows (FOUND-01)
- [ ] `scripts/smoke/smoke.mac.sh` — packaged smoke, macOS (FOUND-01)
- [ ] `scripts/smoke/smoke.linux.sh` — packaged smoke, Linux (FOUND-01)
- [ ] `.github/workflows/smoke.yml` — CI matrix smoke on windows-latest/macos-latest/ubuntu-latest

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Single-instance lock focuses existing window | FOUND-01 | Requires two OS-level processes interacting | Launch app, open second instance, verify first is focused; check no DB error in electron-log |
| Custom title bar drag on Windows/Linux | SESS-01 | Requires mouse interaction | Drag the title bar area; verify window moves. Verify min/max/close buttons work. |
| Custom title bar on macOS | SESS-01 | Requires macOS hardware or VM | Verify native traffic lights visible at top-left; title bar area is dark-themed |
| Frameless window size/position persist | SESS-01 | Requires restart | Resize window, quit, relaunch; verify size and position restored |
| Gatekeeper bypass instructions (macOS) | FOUND-01 | User-facing README docs | Verify README contains `xattr -cr` bypass steps per D-03 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
