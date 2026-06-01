# Dev Mockups Summary

## Overview
- **Total Findings:** 1 (DEAD-112)
- **Action:** RELOCATE (not delete) — **executed this pass** per user decision.
- **Lines:** ~4,443 across 14 `.ts` + 1 `.css`.

## What & why
`src/mockups/` are dev-only design scratchpads loaded by `main.ts:65-72` behind `import.meta.env.DEV && ?mockup=true`. In a
production build `import.meta.env.DEV` is `false`, so the branch and its dynamic `import('@mockups/index')` are tree-shaken away
— the mockups **never ship**. They are not "dead" (they have a dev purpose) but they live in application source, inflate the
tree, and skew analysis.

## Findings
| ID | Item | Recommendation |
|----|------|----------------|
| DEAD-112 | `src/mockups/**` (14 ts + 1 css) | RELOCATE → `docs/historical/web-app/20260531-Mockups/` |

## Files relocated
```
mockups/index.ts, MockupShell.ts, MockupNav.ts, IconRail.ts, MobileDrawer.ts, CollapsiblePanel.ts,
mockups/tools/{Accessibility,Budget,Comparison,Harmony,Matcher,Mixer,Presets}Mockup.ts,
mockups/mockup-gradient-themes.css
```

## Coupled changes (so the build stays green)
1. Removed the DEV mockup-loader block from `src/main.ts`.
2. Removed `@mockups` alias from `vite.config.ts` and the `"@mockups/*"` path from `tsconfig.json`.
3. Verified `pnpm --filter xivdyetools-web-app run type-check && run build`.

## Notes
Target follows the existing `docs/historical/` naming convention (`YYYYMMDD-Name`, e.g. `20251207-DeepDive`).
