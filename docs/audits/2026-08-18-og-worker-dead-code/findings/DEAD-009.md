# [DEAD-009]: `types.ts` dead members — `Env.OG_CACHE`, `ShareParams`, `HarmonyParams.perceptual`, `SwatchParams.index`

## Category
Unused Type

## Location
- `src/types.ts:21-22` `OG_CACHE?: KVNamespace` — "optional, for future use"
- `src/types.ts:140-146` `ShareParams` union
- `src/types.ts:84` `HarmonyParams.perceptual` (+ its parse at `og-data-generator.ts:504`)
- `src/types.ts:128` `SwatchParams.index`

## Evidence
- `OG_CACHE`: no KV binding in either env of `wrangler.toml`; zero readers (`symrefs prod=1`, the declaration). CLAUDE.md documents it as "Reserved for future caching — **not currently bound**".
- `ShareParams`: knip `Unused exported types`; nothing narrows on it (web-app has its own, different `ShareParams` in share-service).
- `perceptual`: set from `?perceptual=1` at og-data-generator.ts:504 and never read again. web-app's share-service still declares `perceptual?: boolean` (`share-service.ts:63`), so the URL param exists — but og-worker does nothing with it, and the 5.0 matching vocabulary has no "perceptual" flag.
- `index`: zero readers.

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |

## Recommendation
**REMOVE** all four (~12 lines). If a KV cache is ever added it will come with a wrangler binding; a phantom type only misleads. Update the CLAUDE.md bindings table row for `OG_CACHE`.
