# DEAD-040: Unused '@' path alias in apps/og-worker vitest.config.ts and tsconfig.json: 10 config lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/og-worker · **Semver:** NONE · **Category:** Legacy · **Origin:** MAIN

## Location
- `apps/og-worker/vitest.config.ts:32` — resolve.alias '@' and tsconfig baseUrl/paths '@/*'

## Evidence
- No tracked og-worker file uses an '@/' specifier (import, dynamic import or vi.mock); the only hit is the tsconfig paths entry itself. No og-worker import is non-relative in a way that depends on baseUrl '.'.
  - Commands: git ls-files apps/og-worker | xargs grep -n -E "['\"]@/": only tsconfig.json:10 (plus binary TTF matches); Checked for non-relative src/ or services/-style imports that baseUrl would resolve: none; 'path' in vitest.config.ts is used only at :33 (the alias)
- Origin: git grep -n -E "'@'|\"@/|@/\*" 8ecb878f -- apps/og-worker hits only tsconfig.json:10 and vitest.config.ts:33 (plus binary TTF false matches). The alias already existed with no users at main.

## Fix
**REMOVE.** No runtime effect. The only thing to confirm is that type-check and vitest still resolve after the change, which the gate run covers.

Steps: 1) apps/og-worker/vitest.config.ts: delete line 2 ('import path from 'path';') and lines 31-35 (the resolve/alias block); line 30 '  },' then closes the config. 2) apps/og-worker/tsconfig.json: delete lines 8-11 (baseUrl and paths) and remove the trailing comma from line 7 ('types'). 3) pnpm turbo run build type-check lint test --filter=...xivdyetools-og-worker && pnpm dead-code:check

## Status
OPEN
