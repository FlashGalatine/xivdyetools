# DEAD-112: Relocate dev-only mockups out of src/ (ACTION TAKEN this pass)

## Category
Dev-Only Code (relocation, not deletion)

## Location
- File(s): `src/mockups/` — 14 `.ts` files + `mockup-gradient-themes.css` (~4,443 lines)
- Loader: `src/main.ts:65-72`
- Alias: `vite.config.ts:58` (`@mockups`), `tsconfig.json:24` (`"@mockups/*"`)

## Evidence
The mockups are design scratchpads loaded only in dev:
```typescript
// main.ts:66
if (import.meta.env.DEV && window.location.search.includes('mockup=true')) {
  const { loadMockupSystem } = await import('@mockups/index');
  loadMockupSystem(appContainer);
  return;
}
```
`import.meta.env.DEV` is replaced with `false` in production builds, so this branch + the dynamic `import('@mockups/index')` are
dead-code-eliminated — the mockups **never ship** in the production bundle. But they live inside `src/`, inflate the source tree
(~4,443 lines), and skew analysis. They are not reachable from any production path and are not referenced by any test.

## Why It Exists
Static HTML/TS mockups built during the v4 redesign to prototype layouts (`MockupShell`, `IconRail`, per-tool mockups). They
remain useful as historical design references but no longer belong in the application source.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — dev-only, DEV-guarded, never in prod bundle, no test refs |
| **Blast Radius** | LOW — must also remove the dev loader + `@mockups` alias/path or the build will fail on the dangling import |
| **Reversibility** | EASY — the files are moved (preserved) under docs/historical, not deleted |
| **Hidden Consumers** | Only the `main.ts` DEV branch + the `@mockups` alias |

## Recommendation
**RELOCATE** to `docs/historical/web-app/20260531-Mockups/` (per user decision; matches the existing `YYYYMMDD-Name` convention,
e.g. `20251207-DeepDive`).

### Rationale
- Removes ~4,443 lines of dev-only code from the application source while preserving the design references.

### Action taken this pass (executed)
1. Moved `apps/web-app/src/mockups/**` → `docs/historical/web-app/20260531-Mockups/`.
2. Removed the DEV mockup-loader block from `src/main.ts` (the `if (import.meta.env.DEV && …mockup=true)` branch).
3. Removed the `@mockups` alias from `vite.config.ts` and the `"@mockups/*"` path from `tsconfig.json`.
4. Verified with `pnpm --filter xivdyetools-web-app run type-check && run build`.

> All other findings (DEAD-086–111) are **documented only**; this relocation is the single action approved for this engagement.
