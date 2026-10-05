# Review: core-chara (packages/core .chara parser / resolver / twins / GPOSERS / shader colours)

Branch preview/integration-2026-10-04 @80262a2f. Read-only review; no tests run (all hypotheses settled by reading code and JSON data).

## Map

| Module | Role |
|---|---|
| `services/chara/chara-parser.ts` (514) | JSON -> `ParsedCharaFile`: key-presence rule, float sqrt decode, flags gating, gear dyes/models, glasses |
| `services/chara/chara-models.ts` (112) | Model-lane packing (`gearModelKey`, `weaponModelKey`), worn-slot test |
| `services/chara/chara-resolver.ts` (453) | Index vs float arbitration, dark/light split, OFF GRID, eye uncross, lip blend |
| `services/chara/chara-shader-colors.ts` (71) | Lazy shader-half palette loader (shared + race tables) |
| `services/chara/chara-game-rules.ts` (152) | Wear mask, twin rule grouping, per-twin problems |
| `services/chara/chara-twins.ts` (165) | Twin list, default pick, tone, chips |
| `services/chara/chara-gposers.ts` (130) | GPOSERS form as data |
| `services/CharacterColorService.ts` (427) | Sheets + dye matching |

Origin: parser, resolver, shader, twins, game-rules, gposers changed since 79a69d1f (see changed-src list); all candidates below are MAIN.

## Candidates

### core-chara-01 BUG LOW/MEDIUM - chara-models.ts / chara-parser.ts:497-502
`readModelLane` accepts any positive finite number, so a lane above 65535 survives into `gearModels`. api-worker rejects the whole resolve body when any one lane is out of range (`apps/api-worker/src/chara/router.test.ts:234`: "base must be an integer between 0 and 65535"). Input: a hand-edited or buggy-producer file with `Body.ModelBase = 70000` (or a 1e300 value) -> one 400 for the entire batch, so every other worn piece also loses its item name/acquisition line. Locally `gearModelKey(65536,0) === gearModelKey(0,1)` collide, and `String(1e300)` = "1e+300" is not a decimal key.
Tests: `chara-parser.test.ts` has no out-of-range lane case. Covered: no. Origin MAIN.
```ts
function readModelLane(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
```
Fix: clamp-to-empty (treat >65535 as 0/skip the slot, as with a non-number) or surface it as a per-slot "unreadable model" so one junk lane cannot sink the batch.

### core-chara-02 BUG LOW - chara-parser.ts:237-238
`value.split(',').map(p => Number(p.trim()))` treats an empty segment as 0 (`Number('') === 0`) and `Infinity` passes the NaN check. `"0.2,0.3,0.4,"` (trailing comma) parses as 4 parts with alpha 0, so for `MouthColor` the lip slot becomes `inert/noLip` (chara-resolver.ts:345). `"1,,2"` decodes as a plausible colour. The doc comment promises a loud failure on malformed values.
Tests: no case for empty segments. Covered: no. Origin MAIN. Reachable only by hand edits.
Fix: reject empty segments and non-finite numbers (`p.trim() === '' || !Number.isFinite(n)`).

### core-chara-03 BUG LOW - chara-resolver.ts:401-404 / chara-shader-colors.ts:317-335
`charaShaderHex` re-throws a failed dynamic `import()` (by design, so the next call retries), but `resolveCharaColors` does not catch it: the `?? entry.hex` fallback only covers a null result. One flaky chunk load while a file has a live float on hair/skin/eyes/etc. rejects the entire resolve, and the Glamour Reader shows no slots at all instead of the index-wins answer (or a degraded note).
Tests: `chara-shader-colors.test.ts:62,74` assert the loader rejects and retries; no resolver-level test of the rejection. Covered: partly. Origin MAIN.
Fix: wrap the shader lookup in try/catch in the resolver and fall back to `entry.hex` (optionally flag the slot), keeping the loader's retry behaviour.

### core-chara-04 BUG LOW - chara-parser.ts:475
Gear dye channel accepts any positive finite number: `DyeId: 1.5` or `1e9` is emitted as `stainId` unfloored/unbounded (the model lanes are floored, the dyes are not). Resolver lookup returns null -> UI prints `#1.5`; the GPOSERS `dye1` placeholder carries that into an exported submission line. Real Anamnesis 254/255 on a *worn* slot gets the same `#255` treatment.
Tests: none for non-integer dye. Covered: no. Origin MAIN.
Fix: `Math.floor` and require 1..255 (or keep unknown ids but as integers).

### core-chara-05 BUG LOW - CharacterColorService.ts:335
BUG-056 guard `count <= 0` does not cover `NaN` or a non-number (corrupted `v3_character_max_results` read via `StorageService.getItem<number>` at `swatch-tool.ts:330-331` and passed as `count` at `swatch-tool.ts:2811`). `NaN <= 0` is false, `best.length < NaN` is false, so the first dye reaches `best[best.length - 1].distance` on an empty array -> TypeError. Fractional counts also over-return (`2.5` -> 3 matches).
Tests: BUG-056 test covers 0/negative only. Covered: no. Origin MAIN.
Fix: `if (!(count >= 1)) return []; const k = Math.floor(count);`.

### core-chara-06 UNTESTED LOW - chara-twins.ts:424-443
`charaTwinsOf` builds `[family, ...family.alternates]` with no de-dup; if api-worker ever lists the named item among its own alternates the picker shows it twice and `charaPieceTone` reads `twins.length > 1` as `choice`. I did not find api-worker doing this today (alternates come from rows other than the named one), so this is a latent guard gap only; no test pins it.
Origin MAIN.

## POSITIVE
- Own-property lookups for tribe/gender/race (`Object.hasOwn`, parser :301,:320) with `chara-parser-proto.test.ts` guarding the FINDING-027 pattern.
- `Base64Image` is never read and `Nickname` is carried only as an on-device field; no name path to the resolver output other than the documented `nickname` passthrough.
- Float decode is sqrt of the squared channel with the zero-block "never read" rule gated on all seven floats (parser :399-403).
- Shader table indices verified against data: eyes/highlights/features 192, lipsDark 96, skin/hair keyed by all 16 tribes x Male/Female, matching resolver's in-sheet index math (light lip subtracts 128 and maps to lipsDark).
- Eye uncross only swaps when both floats land on the other eye's entry and neither on its own (resolver :191-193).
- Twin default ranking and `charaTwinProblems` are pure and well covered (`chara-twins.test.ts` 265 lines); wear-mask bit order fits in 16 bits so `1 << n` cannot overflow.
- Shader loaders reset cached rejections (BUG-013 pattern, no regression).

## REJECTED
- Lip blend picking the swatch (`indexHex`) for an `index` verdict while the float stores the dark entry: blend over swatch is the intended display; no wrong result.
- `isWornCharaModel` weapon `set > 0 || base > 0` vs header "`ModelBase == 0` (weapons: `ModelSet == 0` too)": reads as AND-empty, i.e. worn if either is set; consistent with the code.
- `FacePaint` non-number throws via `readIndex`: loud failure is the documented policy.
- `CharacterColorService.findDyesWithinDistance` always RGB Euclidean and the dead `category === 'Facewear'` skips: dead-code audit owns the latter; Euclidean is a documented simple API.
- `gposersSameRings` using the right ring's acquisition only: same name implies same item.
- `text()` not stripping U+2028/2029: item names come from XIVAPI; no injection path demonstrated.
- Highlights inert while float live gives `inert` (no float display): consistent with the "flag gates live-looking data" rule.

## COVERED (8 non-test files read in full; 8 test files skimmed by grep/wc)
packages/core/src/services/CharacterColorService.ts, chara/chara-game-rules.ts, chara-gposers.ts, chara-models.ts, chara-parser.ts, chara-resolver.ts, chara-shader-colors.ts, chara-twins.ts. Also read: shader/shared.json and race_specific.json structure, `apps/api-worker/src/chara/resolver.ts` + router tests (lane validation), `apps/web-app/src/components/swatch-tool.ts:2811`.
