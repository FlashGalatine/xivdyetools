# DEAD-107: services/index.ts — barrel-only over-exports (continuation of DEAD-016)

## Category
Unused Export (over-export via barrel)

## Location
- File(s): `src/services/index.ts` (the barrel) + the originating service files
- Symbol(s): ~40 types re-exported by the barrel but never imported-by-name anywhere (full list in
  `evidence/symbol-sweep.txt`), e.g. `ToastOptions`, `ModalType`, `ShareResult`, `ParsedShareUrl`, the `*ShareParams` family,
  the `*Event` family (`PricesUpdatedEvent`, `ServerChangedEvent`, …), `FiltersPanelConfig`, `FiltersPanelRefs`, `RouteDefinition`,
  `BASE_URL`, `SHARE_URL_VERSION`, …

## Evidence
**Continuation of 2026-02-28 DEAD-016** ("Dead Barrel Re-exports in services/index.ts"). The sweep marks these `BARREL-ONLY`:
their only production reference is the `export … from` line in `services/index.ts`; no module imports them by name. Most are
*types* used only inside their own service file. They are over-exported, not necessarily dead code paths.

⚠️ Heuristic — a type re-exported by the barrel and used via `import type` elsewhere would appear at the import site, so a true
`BARREL-ONLY` flag means genuinely no external consumer. Still, confirm with `tsc --noEmit` after editing the barrel.

## Why It Exists
`services/index.ts` re-exports nearly everything for ergonomic single-import access. Many re-exported types never gained an
external consumer, so the barrel surface drifted larger than the actual usage.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM — confirm each against tsc; some may be intentional public API for tests |
| **Blast Radius** | LOW — editing the barrel only; the underlying service code is unchanged |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | Tests sometimes import types directly from the source file, not the barrel — those are unaffected by trimming the barrel |

## Recommendation
**REFACTOR (de-export from barrel)** — low priority

### Rationale
- Shrinks the barrel's public surface to what is actually consumed; reduces accidental coupling.
- Cosmetic; batch with DEAD-106. Do **after** the higher-value file removals.

### If Refactoring
1. For each `BARREL-ONLY` symbol in `evidence/symbol-sweep.txt`, remove its `export … from` line in `services/index.ts` (and the
   `export` keyword in the source if it has no other consumer).
2. `pnpm --filter xivdyetools-web-app run type-check` — restore any symbol the compiler reports as needed.
