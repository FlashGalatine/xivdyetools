# FINDING-031: vitepress>vite override floor '>=6.4.3 <7' leaves vite locked at 6.4.3; 5 open Dependabot alerts (1 high), dev-server only
**Severity:** LOW · **Exposure:** LOCAL · **Deploy unit:** CI + repo settings (api-worker docs dev tree: vitepress devDependency) · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-1395
**Related:** 2026-10-03-security/FINDING-025 (dev-tree advisories; the override floor was the fix)

## Location
- `pnpm-workspace.yaml:26` — vitepress>vite override floor '>=6.4.3 <7' leaves vite locked at 6.4.3; 5 open Dependabot alerts (1 high), dev-server only

## Evidence
- pnpm-workspace.yaml:26 'vitepress>vite': '>=6.4.3 <7' | pnpm-lock.yaml:3839 vite@6.4.3: | dependabot alert #14 GHSA-587h-7wmj-h5pm high vite <= 6.4.3 patched 6.4.4
- Reach: The maintainer runs `pnpm --filter xivdyetools-api-worker run docs:dev` (vitepress dev → vite 6.4.3 dev server with the launch-editor /__open-in-editor middleware) on Windows. A malicious page or local process then reaches that dev server; the deployed docs are static `vitepress build` output with no vite at runtime.
- pnpm-workspace.yaml:26 sets 'vitepress>vite': '>=6.4.3 <7', and pnpm-lock.yaml:3839/6972 resolve exactly vite@6.4.3, while patched 6.4.4 (2026-10-06) and 6.4.5 (2026-10-21) are both past the 1440-minute minimumReleaseAge. gh api shows open alerts #13-#17 (GHSA-587h high, r825/698v/rq7h medium, 9jrq low), all with range <= 6.4.3 and first patched 6.4.4. Dependabot PR #323 (to 8.3.4, outside the <7 cap) was closed 2026-10-26. The CI full-tree audit is report-only by design (ci.yml:94-96 continue-on-error), and vitepress is a devDependency, so `pnpm audit --prod` never sees it. Minor correction: alerts #13-#15 date from 2026-10-20, bu… Preconditions: The maintainer must be running `vitepress dev` (or `vitepress preview`) locally. The launch-editor advisories (587h, r825, 698v) are Windows-specific, which matches the maintainer's OS; rq7h is non-Windows only, so it does not apply on that machine. Production is not affected.
- Live state the repo cannot show: Dependabot alert state on GitHub, read via a GET-only gh api call on 2026-10-26.

## Fix
- Raise the override to 'vitepress>vite': '>=6.4.5 <7', run pnpm install so the lockfile moves off 6.4.3, and confirm alerts #13-#17 auto-close.
- Update the FINDING-036 comment, whose "Drop this when vitepress ships on Vite >= 6.4.3" is now stale.

## Status
OPEN
