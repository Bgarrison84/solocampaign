---
phase: 8
slug: polish-export-accessibility
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-01
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x |
| **Config file** | vitest.config.ts (inherited from electron-vite; uses default vitest discovery) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green + manual ARIA audit passed
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 0 | DIST-01 | N/A | unit stub | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 0 | DIST-02 | N/A | unit stub | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 08-01-03 | 01 | 0 | DIST-04, A11Y-01 | N/A | unit stub | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | DIST-01 | exportCampaign excludes API keys | unit | `npm run test -- --run --reporter=verbose exportImport` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 1 | DIST-01 | importCampaign remaps all UUIDs; rolls back on FK violation | unit | same | ❌ W0 | ⬜ pending |
| 08-02-03 | 02 | 1 | DIST-01 | Version mismatch throws clear error | unit | same | ❌ W0 | ⬜ pending |
| 08-02-04 | 02 | 1 | DIST-03 | exportStarterTemplate excludes save state | unit | same | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 1 | DIST-04 | changeDataFolder uses .backup() not copyFile | unit (mock) | `npm run test -- --run --reporter=verbose appPrefs` | ❌ W0 | ⬜ pending |
| 08-03-02 | 03 | 1 | DIST-04, A11Y-01 | appPrefs stores/retrieves fontSize + highContrast + dataFolder | unit | same | ❌ W0 | ⬜ pending |
| 08-04-01 | 04 | 2 | DIST-02 | exportPdf() returns non-empty Buffer | unit | `npm run test -- --run --reporter=verbose pdfService` | ❌ W0 | ⬜ pending |
| 08-04-02 | 04 | 2 | DIST-02 | Spellcaster PDF = 2 pages; martial = 1 page | unit | same | ❌ W0 | ⬜ pending |
| 08-05-01 | 05 | 3 | A11Y-02 | All icon-only buttons have aria-label | manual + axe-core | — | manual | ⬜ pending |
| 08-05-02 | 05 | 3 | A11Y-03 | Screen reader announces at paragraph boundaries, not per-token | manual (NVDA/VoiceOver) | — | manual | ⬜ pending |
| 08-05-03 | 05 | 3 | A11Y-01 | Font scale CSS custom property applied before first paint | manual (visual) | — | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/main/db/exportImport.test.ts` — stubs for DIST-01 (export serialization, UUID remapping, FK ordering, transaction rollback, version validation)
- [ ] `src/main/services/pdfService.test.ts` — stubs for DIST-02 (renderToBuffer returns Buffer; spellcaster=2 pages; martial=1 page)
- [ ] `src/main/trpc/routers/appPrefs.test.ts` — stubs for DIST-04, A11Y-01 (store get/set, data folder change uses .backup(), fontSize persistence)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All icon-only buttons have aria-label | A11Y-02 | Requires accessibility tree inspection | Run axe-core DevTools in packaged app; check all interactive elements |
| Screen reader announces streaming narration at paragraph boundaries | A11Y-03 | Requires NVDA (Windows) or VoiceOver (macOS) | Start a session, send a message, verify announcements on paragraph completion not per-token |
| High contrast theme achieves WCAG AA (4.5:1 normal text, 3:1 large text) | A11Y-01 | Requires color contrast checker | Use WebAIM Contrast Checker on OKLCH overrides in `.high-contrast` CSS block |
| Font scale applied before first React paint (no FOUC) | A11Y-01 | Visual inspection | Slow launch via DevTools CPU throttle; verify no flash of default size |
| Data folder migration preserves all data after restart | DIST-04 | E2E behavior requiring restart | Change data folder, restart app, verify campaigns and characters still accessible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 test files: exportImport, pdfService, appPrefs)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
