# DEAD-006: themes.css dead Tailwind-override selectors (lines 153-224) — 23 lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Dead CSS · **Origin:** MAIN

## Location
- `apps/web-app/src/styles/themes.css:153` — .bg-gray-100 .bg-gray-900 .dark\:bg-gray-700\/50 .text-blue-600/.text-blue-500 .hover\:bg-gray-200 .dark\:hover\:bg-gray-700\/50 .text-yellow-600/.dark\:text-yellow-400 .dark\:text-red-400 .dark\:text-blue-400

## Evidence
- No tracked web-app file (TS, HTML, JSON, tests, e2e, public) emits these exact class tokens. Every hit is a prefixed variant such as hover:text-blue-500, hover:text-yellow-600 or dark:bg-gray-900. Template and string concatenation greps found nothing.
  - Commands: git grep -n -E 'bg-gray-100|...|text-red-600' -- apps/web-app ':!*.css': only prefixed variants, plus text-red-600 at fatal-error.ts:60; git grep -E '(text|bg|gray|blue|yellow|red)-\$\{' and the quoted-prefix concat grep both return empty
- Origin: The same token grep at 8ecb878f gives only the same prefixed variants (dye-grid.ts, dye-search-box.ts, dye-selector.ts, market-board.ts). The PRs do not touch themes.css (`git diff --stat 8ecb878f HEAD` is empty).

## Fix
**REMOVE.** The count of 23 includes the comment and blank lines that go with each deleted rule. .text-red-600 (fatal-error.ts:60) and the other selectors in the shared lists stay live. themes.css is global (main.ts:10), so the shadow-root scope question does not arise.

Steps: apps/web-app/src/styles/themes.css: delete lines 153, 154 and 156 (155 keeps its comma). Delete rule 194-198. Delete line 200. Delete line 204 and remove the trailing comma from 203. Delete 209-214 (comment and yellow rule). Delete line 216 and make 215 `.text-red-600 {`. Delete 220-225 (comment and blue rule). Add a web-app CHANGELOG entry. Run `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app` (font-contract.test.ts reads themes.css), then `pnpm --filter xivdyetools-web-app run build:check && pnpm dead-code:check`.

## Status
REMOVED, NOT DEPLOYED — `9dc5f75d` (branch `fix/remediation-2026-10-04-sprint23`, web-app 5.14.7; PR #253, open, stacked on #252).
