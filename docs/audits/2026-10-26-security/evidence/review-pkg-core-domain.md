# review-pkg-core-domain (deploy unit: core, 5.15.0)

Scope: packages/core/src excluding services/chara and chara.ts. HEAD 13c386e5.

## Module table (no HTTP routes; library surface only)

| Module | Untrusted input | Handling | Verdict |
|---|---|---|---|
| services/APIService.ts | dataCenterID/worldID/itemIDs from callers; Universalis JSON | `sanitizeDataCenterId` keeps `\p{L}\p{N}` only (:974) then `encodeURIComponent` (:984); batch IDs validated integer >0, max 100 (:946); response: content-type check, content-length check, 5 MB text check, JSON.parse in try (:750-790); AbortController timeout; typed-error retry predicate | clean |
| APIService cache keys | dc name | type-prefixed `id:dc:<sanitized>` (:1001) | clean |
| services/dye/DyeDatabase.ts | bundled dyes.json only | `safeClone` drops `__proto__/constructor/prototype` into `Object.create(null)` (:70-90), hex regex `^#[A-Fa-f0-9]{6}$` (:137, :225), stainID range 1-254 | clean |
| services/localization/* | locale code, keys | static bundled imports, no dynamic import by user value (LocaleLoader.ts:11-26); every lookup `Object.hasOwn`-guarded (TranslationProvider.ts:67-497) | clean |
| services/PresetService.ts | none (bundled presets.json) | Map by id | clean |
| services/PaletteService.ts | pixel arrays from callers | sampling cap (default 10000), maxIterations, k clamp | clean |
| services/color/*, blending/* | hex strings | strict hex regexes, anchored, linear (blending/conversions.ts:316, utils/index.ts:226) | clean |
| utils/index.ts | LRUCache, retry, foldForSearch, generateChecksum | checksum is non-crypto and documented as such (:570-575); only guards accidental cache corruption | clean |
| config/product-links, learn-links | none | hard-coded https URLs, no interpolation | clean |
| CharacterColorService | none | dynamic `import()` of fixed bundled JSON paths (:182, :209) | clean |

Authz matrix: not applicable (library, no routes or principals).

Dynamic-code sweep over tracked non-test, non-chara sources: no `eval`, `new Function`, no `new RegExp` (only literal regexes, all anchored or linear), no `__proto__` writes outside the denylist, no `Object.assign`/deep-merge of untrusted input, no `JSON.parse` other than APIService.ts:783. No localStorage/sessionStorage use in code (only comments).

## POSITIVE controls
- Universalis URL construction cannot traverse or inject: sanitize-then-encode order documented and correct (UTF-8 never emits ASCII bytes for non-ASCII chars).
- Response handling is bounded (5 MB, timeout, content-type, JSON in try) and 4xx fails fast.
- Prototype-pollution safe data loading (`safeClone`) and `Object.hasOwn` on all locale lookups (BUG-105).
- All hex/colour parsers use anchored fixed-length regexes; no catastrophic backtracking shapes.
- Locale files are static imports, so the locale code can never select a file path.
- Logger calls in APIService carry item IDs and data-center names only; no personal data.
- `xivcharakit` is an exact-pinned dependency (0.1.0-beta.4) with no postinstall/prepublish hooks on core beyond `prepublishOnly: npm run build`.

## REJECTED
- `response.text()` read fully before the 5 MB check when no content-length: upstream is the first-party proxy / Universalis, consumer is a browser tab; no attacker-controlled response path.
- `MemoryCacheBackend` unbounded and never sweeps expired entries: only consumer is web-app, whose DC comes from a fixed picker; no unauthenticated remote key-growth path.
- `getPriceData` single-item path does not validate `itemID` as integer: typed number, interpolation yields at worst `NaN` in a path segment on a fixed host; no injection.
- Cache entry with missing `checksum`/`ttl` accepted (APIService.ts:446-481): requires write access to the cache backend, which already implies control of the data.
- `generateChecksum` is a 32-bit non-crypto hash: documented, integrity-of-accident only; not a security boundary.
- `xivcharakit` beta dependency in core `dependencies`: chara/ci-supply-chain reviewers own it.

## FILES COVERED
~38 source files read or grepped (count: 38) across packages/core/src/{services,services/color,services/dye,services/dye/wheels,services/localization,utils,config,blending,constants,types}; data JSON inspected only for loader paths. Not opened line-by-line: services/dye/wheels/*, HarmonyGenerator, ColorAccessibility/Blindness simulators (pure arithmetic on typed numbers; regex/dynamic-code sweep covered them).
