# [DEAD-016]: Orphaned / detached JSDoc blocks in `index.ts` and `og-data-generator.ts`

## Category
Stale Code (comments)

## Location
- `src/index.ts:160-169` — two JSDoc blocks ("Tool route handler factory…", "Resolve the locale for an OG request… Priority: ?lang= …") stacked directly above `isOgImageHost()`, which they do not describe; the functions they *do* describe (`createToolHandler`, `resolveLocale`) sit further down with no doc.
- `src/og-data-generator.ts:43-47` — "Map og-worker's kebab-case HarmonyType to core's camelCase HarmonyTypeKey…" is followed by `withLang()`, not `harmonyToKey()`.
- `src/og-data-generator.ts:352-363` — the `generateOGHTML` doc block is followed by `withFrameX()`; `generateOGHTML` itself (369) is undocumented.

## Evidence
Read the files: each block was left in place when a helper was inserted beneath it (BUG-069, ?lang=, ?frame=x work). Tooling that renders JSDoc on hover now shows the wrong description for three functions.

## Recommendation
**REMOVE / re-attach** (pure comment move, ~20 lines). Do it in the same commit as DEAD-007 so `index.ts` is touched once.
