# DEAD-004: v4-layout-shell.ts static styles: pre-5.0 Accessibility CSS block is unreachable (337 lines)
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Dead CSS · **Origin:** MAIN

## Location
- `apps/web-app/src/components/v4/v4-layout-shell.ts:447` — static styles .contrast-table*/.pairwise-*/.matrix-*/.vision-*/.wcag-badge*/.dye-indicator/.dye-cell-content/.contrast-*/.warning-callout*/.warning-icon

## Evidence
- No markup anywhere in apps/ produces any of the 27 class names in the shadow-root CSS block at 447-783, and no class is built dynamically. Only two CHANGELOG mentions exist. .section-header/.section-title at 428-445 stay.
  - Commands: git grep -o of all 27 block classes over apps (excluding the shell file): only CHANGELOG.md:1469,1523.; The shell file has no hits outside 447-783, and there is no `${...}`-built matrix-/vision-/wcag- class.; Every modifier (.aa/.aaa/.fail/.good/.ok/.critical/.warning/.diagonal) is compounded with a dead class.
- Origin: git show 8ecb878f:apps/web-app/src/components/v4/v4-layout-shell.ts contains vision-card 3 times. git grep vision-card|wcag-badge at 8ecb878f finds no other src file. The PR delta does not touch this file.

## Fix
**REMOVE.** Rename the 425-427 section header to drop 'Accessibility Tool Styles'.

Steps: 1) v4-layout-shell.ts: delete lines 446-783 (the blank line plus .contrast-table-container through the .warning-callout strong rule), keeping the closing backtick at 784. 2) Update the comment header at 425-427 (line 424 closes the mobile @media block). 3) pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app && pnpm dead-code:check.

## Status
REMOVED, NOT DEPLOYED — `07c8a22e` (branch `fix/remediation-2026-10-04-sprint5`, web-app 5.14.3; PR #247, open). Pulled forward from Sprint 23: Sprint 5's keyboard-accessible palette drawer (BUG-028) put the layout shell 665 B over its 218 KB budget. Re-verified dead on that tree.
