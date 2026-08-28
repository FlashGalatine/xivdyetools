# [DEAD-013]: bot-logic — dead runtime work in `/mixer` (`MixerResult.matches`), uncalled `Translator.getMeta()`, redundant core-type re-exports, unused test-utils devDep

## Category
Dead Code Path / Unused Export / Unused Dependency

## Location
- `packages/bot-logic/src/commands/mixer.ts:69` (`matches` "legacy shape, still returned") and 135-154 — per `/mixer` call, `count` extra nearest-dye searches populate `MixerResult.matches`, `blendedHex`, `inputDyes`, `sweep`; discord-worker `handlers/commands/mixer-v4.ts` reads only `svgString` and `embed`; only `mixer.test.ts` asserts the rest. `MixerInput.count` exists solely to size this loop (discord-worker still resolves and passes it). ~30 lines incl. `MixerMatch` type
- `packages/bot-logic/src/i18n/translator.ts:94-96` — `Translator.getMeta()`; 0 callers anywhere; the `meta.flag` / `meta.nativeName` locale keys exist only to feed it (4 lines + 2 keys ×6)
- `packages/bot-logic/src/index.ts` — re-exports of `MatchingMethod`, `BlendingMode`, `HarmonyColorSpace` (core types; every consumer imports them from `@xivdyetools/core`; `commands/harmony.ts:347` is a pure pass-through) — 3 lines
- `packages/bot-logic/package.json` — devDependency `@xivdyetools/test-utils` (0 imports under `packages/bot-logic/src`; svg's is live)

## Evidence
`grep -rn "\.matches\b\|\.blendedHex\|\.inputDyes\|\.sweep" apps/discord-worker/src/handlers/commands/mixer-v4.ts` → 0. `git grep -nw getMeta` → definition + 0 callers. `git grep -n "test-utils" packages/bot-logic/src` → 0.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW — `MixerResult` shape change is a semver-minor for the published package; the only consumers (discord-worker, stoat-worker) do not read the removed fields |
| **Reversibility** | EASY |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE** — the mixer item is the one with a runtime payoff (fewer nearest-dye searches per `/mixer`).

### If Removing
1. Drop the `matches`/`count` plumbing from `executeMixer` + `MixerInput`/`MixerResult`; adjust `mixer.test.ts` and discord-worker's `count` resolution (or keep `count` if the sweep needs it — verify).
2. Delete `getMeta()` and the two `meta.*` keys ×6 (fold into DEAD-011).
3. Remove the 3 barrel type re-exports and the devDep; `pnpm install`.
