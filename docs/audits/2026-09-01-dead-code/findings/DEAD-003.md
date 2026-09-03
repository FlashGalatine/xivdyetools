# DEAD-003: web-app `announcer-service.ts` — the v2.1 screen-reader announcer, never mounted; five live components carry their own `aria-live` regions instead — 195 lines + 221-line test

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/web-app · **Semver:** NONE (app-internal) · **Category:** Orphaned File

## Location
- `apps/web-app/src/services/announcer-service.ts:1-195` — `AnnouncerService`, `AnnouncementPriority`
- `apps/web-app/src/services/__tests__/announcer-service.test.ts` — 221 lines

## Evidence
- `evidence/test-only-modules.sh` → `prodImporters=0 testImporters=1`. Not re-exported from `services/index.ts`.
- Announcements are handled without it: `aria-live` appears in `components/base-component.ts`, `toast-container.ts`, `offline-banner.ts`, `export-sheet.ts`, `tutorial-spotlight.ts` — five live components, none importing this service.
- Header still reads "XIV Dye Tools v2.1.0 - Screen Reader Announcer Service (A3)"; the app is 5.0.

## Fix
**REMOVE** — but read it once before deleting: it queues and de-duplicates announcements, which the per-component `aria-live` regions do not. If the open 5.0 a11y work wants a single announcer, adopting this file is the cheaper path than rewriting it; that is a product call, and it should be made in the same sprint rather than left implicit. Absent that decision: `git rm` both files, web-app CHANGELOG `### Removed`.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app`.

## Status
FIXED 2026-09-01 `c89a822c` — module and test removed. The a11y decision is recorded in the web-app CHANGELOG: it queued and de-duplicated announcements, so recover it from git rather than rewriting if the open 5.0 a11y work wants one announcer.

