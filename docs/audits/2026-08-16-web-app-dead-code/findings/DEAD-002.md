# [DEAD-002]: `src/public/` — 408 KB of icons in a directory Vite never serves

## Category
Orphaned File

## Location
- Dir: `apps/web-app/src/public/assets/icons/` — `apple-touch-icon.png`, `favicon.ico`, `icon-192x192.png`, `icon-512x512.png` (408 KB)

## Evidence
- Vite's default publicDir would be `<root>/public` = `src/public`, **but** `vite.config.ts:22` overrides it to `'../public'`. So `src/public/` is neither served in dev nor copied to `dist/`.
- `grep -rn "src/public" src scripts vite*.ts` → 0 references (the two `scripts/generate-*.mjs` hits point at `../public/`, i.e. the real dir).
- All four files exist under the same names in `public/assets/icons/`, which is what `src/index.html` links.
- Git: only the migration commit `79e945a` touches it.

## Why It Exists
Likely created before `publicDir` was pointed at the top-level `public/` — a leftover of the default Vite layout.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |
| **Hidden Consumers** | None — the only mechanism that could serve it (Vite publicDir) is explicitly pointed elsewhere. |

## Recommendation
**REMOVE**

### If Removing
1. `git rm -r apps/web-app/src/public`
2. `pnpm --filter xivdyetools-web-app run build && ls dist/assets/icons` — unchanged
