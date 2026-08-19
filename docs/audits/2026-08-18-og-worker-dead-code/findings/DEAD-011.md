# [DEAD-011]: `og-data-generator.ts` re-implements three helpers that `services/translator.ts` already exports

## Category
Legacy Code (duplication)

## Location
- `src/og-data-generator.ts:59-73` private `harmonyToKey`, `getHarmonyName`, `getVisionName`
- `src/services/translator.ts:37-52` exported `harmonyToKey`, `getLocalizedHarmonyName`, `getLocalizedVisionName`

## Evidence
Byte-for-byte the same regex (`h.replace(/-([a-z])/g, …)`) and the same `ogTranslator.getHarmonyType(...)` / `getVisionShort(...)` calls. translator.ts's doc comment says the point of its versions is that "the embed text and the picture inside it cannot disagree" — but the embed text (og-data-generator) uses its own private copies, so the guarantee is only by coincidence. `harmonyToKey` in translator.ts has **no** external prod importer (`symrefs prod=4`, all self/og-data-generator's private one). The detached JSDoc at og-data-generator.ts:43-47 ("Map og-worker's kebab-case HarmonyType…") documents the private copy but is separated from it by `withLang` — see DEAD-016.

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH |
| **Blast Radius** | LOW (one file) |
| **Reversibility** | EASY |

## Recommendation
**REFACTOR** — delete the three private helpers (~15 lines) and import `getLocalizedHarmonyName`, `getLocalizedVisionName` from `./services/translator` (keep `getToolName` / `getSheetName` local or move them next to their siblings in translator.ts). This is what makes the "cannot disagree" claim true.
