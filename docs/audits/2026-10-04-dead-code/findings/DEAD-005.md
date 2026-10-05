# DEAD-005: BaseLitComponent.baseStyles utility classes and two preset-detail selectors have no markup (~31 lines)
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Dead CSS · **Origin:** MAIN

## Location
- `apps/web-app/src/components/v4/base-lit-component.ts:59` — .text-primary/.text-secondary/.text-accent/.glass-panel; preset-detail .badge-community/.dyes-grid

## Evidence
- baseStyles is composed into 14 components (not 9). No template, className or classList anywhere uses text-primary/-secondary/-accent or glass-panel; the only hits are --theme-text-secondary and --v4-text-secondary custom properties. preset-detail's badges use badge-category/curated/votes and no dyes-grid.
  - Commands: git grep with a word boundary on text-primary|text-secondary|text-accent|glass-panel over apps/web-app: only base-lit-component.ts:60,64,68,73.; git grep badge-community|dyes-grid: only preset-detail.ts:235,286; the markup at 948-969 uses other badge classes.; There is no dynamic `text-${}` or `badge-${}` class construction.
- Origin: git diff --stat 8ecb878f..HEAD -- apps/web-app/src/components/v4 is empty, so both files are identical at main.

## Fix
**REMOVE.**

Steps: 1) base-lit-component.ts: delete lines 58-79 (the theme-aware text colors and glassmorphism rules), keeping the :host and box-sizing rules.
2) preset-detail.ts: delete 235-239 (.badge-community plus blank) and 286-291 (.dyes-grid plus blank).
3) pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app && pnpm dead-code:check

## Status
OPEN
