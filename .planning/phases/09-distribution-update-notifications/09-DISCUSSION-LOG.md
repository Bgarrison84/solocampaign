# Phase 9: Distribution & Update Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 09-distribution-update-notifications
**Areas discussed:** Code signing & notarization, Update notification design, Linux targets, Release workflow & versioning

---

## Code Signing & Notarization

| Option | Description | Selected |
|--------|-------------|----------|
| Ship unsigned v1.0 | Keep D-03. SmartScreen warning on Windows; Gatekeeper block on macOS. Include bypass docs in release notes. | ✓ |
| Sign Windows only | Azure Trusted Signing (~$10/mo) for Windows SmartScreen. macOS stays unsigned. | |
| Full signing + notarization | Azure Trusted Signing + Apple Developer ($99/yr) for notarized macOS. No warnings. | |

**User's choice:** Ship unsigned v1.0 — D-03 from Phase 1 upheld.
**Notes:** None.

---

## macOS Installer Format

| Option | Description | Selected |
|--------|-------------|----------|
| .dmg | Standard macOS installer. Right-click → Open to bypass Gatekeeper. Most familiar. | |
| .zip (app bundle) | No installer, drag to Applications. Same Gatekeeper bypass. Lighter. | ✓ |

**User's choice:** .zip app bundle.
**Notes:** None.

---

## Update Check Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub API poll (startup) | Fetch latest release via public API. Compare tag version to app version. No electron-updater needed. | ✓ |
| electron-updater (notify-only) | Install electron-updater, configure GitHub provider, disable autoInstallOnAppQuit. | |
| Skip update checks | No in-app notification. Users check GitHub manually. | |

**User's choice:** GitHub API poll on startup — no electron-updater.
**Notes:** None.

---

## Update Notification UI

| Option | Description | Selected |
|--------|-------------|----------|
| In-app banner at top on startup | Dismissible banner: "SoloCampaign X.Y.Z is available — [Download]". Download opens GitHub Release in browser. | ✓ |
| In settings screen only | No automatic banner. Settings has "Check for updates" button. | |
| TitleBar badge + dropdown | Badge on gear icon with "Update available" item. | |

**User's choice:** In-app banner at top of screen on startup.
**Notes:** Banner dismissed state persists in appPrefs so same version doesn't repeat on next launch.

---

## GitHub Repository

| Option | Description | Selected |
|--------|-------------|----------|
| Not set up yet | Repo doesn't exist publicly. Planner includes creating GitHub repo as a task. | ✓ |
| Already exists | Repo is public; URL provided. | |

**User's choice:** Not set up yet — creating repo is part of the phase.
**Notes:** None.

---

## Linux Targets

| Option | Description | Selected |
|--------|-------------|----------|
| AppImage only | Self-contained, runs on any modern Linux without install. Simplest. | ✓ |
| AppImage + .deb | AppImage + Debian/Ubuntu package. Adds CI complexity. | |

**User's choice:** AppImage only.
**Notes:** Matches current electron-builder.yml config — no changes needed for Linux target.

---

## Release Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Git tag push (v*) | Separate release.yml triggered by `push: tags: ['v*']`. Clean GitHub convention. | ✓ |
| Manual workflow_dispatch | Trigger from GitHub Actions UI manually. | |
| Merge to release branch | Dedicated release branch triggers build on merge. | |

**User's choice:** Git tag push (`v*`).
**Notes:** Separate release.yml alongside existing smoke.yml.

---

## Version Number

| Option | Description | Selected |
|--------|-------------|----------|
| 1.0.0 | Signals stable, intentional v1 milestone. | |
| 0.1.0 (keep current) | Stay at 0.1.0 for initial release — signals early/beta. | ✓ |

**User's choice:** Keep 0.1.0. First tag: `v0.1.0`.
**Notes:** None.

---

## Release CI Gate

| Option | Description | Selected |
|--------|-------------|----------|
| Build and publish directly | Tag pushes are intentional; prior smoke tests already ran. Fast release workflow. | ✓ |
| Run smoke tests first as gate | Smoke test dependency adds 15-20min to release time. | |

**User's choice:** Build and publish directly — no smoke test gate in release workflow.
**Notes:** None.

---

## Claude's Discretion

- Exact GitHub API call implementation (main process fetch vs. renderer, timeout, caching)
- Banner component placement in React tree (above router outlet, below TitleBar)
- `appPrefs` key name for dismissed version
- Release workflow upload mechanism (softprops/action-gh-release vs. gh CLI)
- Draft-release vs. pre-release flag strategy

## Deferred Ideas

- Full code signing + notarization — deferred until certs procured (post-v1.0)
- macOS hardened runtime entitlements for better-sqlite3 — only needed with notarization
- .deb Linux package — deferred from v1.0
- electron-updater with delta updates — requires signed builds
- Snap / Flatpak distribution — no plans
