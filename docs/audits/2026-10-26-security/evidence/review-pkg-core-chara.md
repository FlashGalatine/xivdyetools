# review-pkg-core-chara: @xivdyetools/core `.chara` reader + xivcharakit@0.1.0-beta.4

Audit 2026-10-26, HEAD 13c386e5, deploy unit `core` (5.15.0). Read-only; probes ran under the session scratchpad
(`chara-probe.mts`, run with core's `tsx` against `packages/core/src`).

## Module table

No routes: core is a library. Its `.chara` surface, and who reaches each part in production:

| Module / export | What it does | Production caller | Untrusted input |
|---|---|---|---|
| `src/chara.ts` (`./chara` subpath) | Re-exports `inspectCharaForTools`, `resolveCharaWithProvider` + 4 types | web-app `workers/chara-inspection.worker.ts:24` | .chara bytes |
| `chara-library.ts:142` `inspectCharaForTools` | `readChara(input, {maxBytes: 8192})` then `inspectChara` | web worker (Uint8Array), bot-logic `chara-identity.ts:51` (bytes or text) | .chara bytes/text |
| `chara-library.ts:209` `resolveCharaWithProvider` | `resolveAppearance` + projection (bounded labels, sanitized issue paths, no `document`) | web worker, bot via `resolveCharaForTools` | inspection |
| `chara-library-resolve.ts:33` `resolveCharaForTools` | Picks provider (service bridge or given) | bot-logic | inspection |
| `chara-palette-provider.ts:93` `createCharaPaletteProvider` | Validates table/palette/index/tribe/gender before any lookup | bot-logic (via resolve) | library requests |
| `chara-shader-colors.ts:58` `charaShaderHex` | Lazy JSON tables, `?.` lookups | provider, legacy resolver | validated index |
| `chara-parser.ts:442` `parseCharaFile` (legacy) | Native `JSON.parse`, own-property maps | **none in-repo** (barrel export `index.ts:184` only) | text |
| `chara-resolver.ts` (legacy) | Palette resolution for `ParsedCharaFile` | none for file input (legacy path) | parsed file |
| `chara-models.ts` | Pure model-key packing (`BigInt` for weapons) | api-worker, web, bot | integers already validated |
| `chara-gposers.ts` | GPOSERS list text (`text()` regex, line 120) | web-app `glamour-markdown.ts:84`, bot-logic `glamour.ts:409` | XIVAPI names (via api-worker), user textarea (web) |
| `chara-twins.ts`, `chara-game-rules.ts` | Twin grouping over api-worker answers | web, bot | api-worker data |

xivcharakit subpaths core imports: `xivcharakit` (reader/inspector), `xivcharakit/appearance`, type-only
`xivcharakit/palettes`. Core never imports `xivcharakit/xivapi` or `/dyes`, the only modules with network code
(`chunks/chunk-E6OKMXQN.js:494-540`, https-only, `credentials:'omit'`, `redirect:'manual'`, 10 MiB / 40-request budget).

## Probe results (39 hostile inputs, facade = inspect+resolve, legacy = parseCharaFile)

| Input | Facade | Legacy |
|---|---|---|
| depth 40 object / 4000 nested arrays (8 KiB) | `MAX_DEPTH` 0.3-0.5 ms | accepted (V8 JSON.parse) |
| `1e308`/`1e999`, 9007199254740993, `1e300` index | `INVALID_NUMBER` (whole file) | `Infinity` refused; unsafe int accepted |
| `__proto__` at root and inside `Body` | parsed into null-proto records; `({}).polluted` stays undefined; issue path `unknown` | no pollution |
| Tribe `constructor`, Gender `__proto__`, Race `toString`, ints | `UNSUPPORTED_VALUE`, tribe/gender null | refused, message quotes value (<=64 chars) |
| duplicate key | `DUPLICATE_KEY` | last wins |
| 7000-char Nickname | projected to 256 units | 7000 |
| key 1025 / 2000 chars | `MAX_KEY_LENGTH` | accepted |
| 900 unknown keys | 64 issues, last `ISSUES_TRUNCATED`, 5.9 ms | accepted |
| `NaN`, control char, trailing garbage | `INVALID_JSON` | not valid JSON |
| float `Infinity`, 6000-digit float, 7000 commas | `INVALID_FIELD` per field, file still reads | refused, bounded message |
| float as array / {R,G,B} | accepted (library vector) | refused |
| BOM | accepted | refused |
| lone surrogate / bidi Nickname, HTML TypeName | passed through as data (display layer escapes) | same |
| Base64Image number / 7.8 KB string / depth-40 | `INVALID_IMAGE_TYPE` / `IMAGE_OMITTED` (value discarded) / `MAX_DEPTH` | accepted, never read |
| 8193 B, 4100x U+00E9 (8,2xx B) | `INPUT_TOO_LARGE` | accepted (caller must cap) |
| MainHand lanes 65535, DyeId2 70000, GlassesId 1e9 | model kept, DyeId2 + Glasses `INVALID_FIELD` | accepted |

All facade refusals throw `CharaInputError` with one of 13 fixed messages (`chunk-I7NJZCWD.js:13-27`, 30-66
chars, no input echo). Every case ran in under 6 ms after the first call's palette load (96 ms).

## Positive controls

- 8 KiB cap enforced inside the library for both string (UTF-8 counted, `chunk-I7NJZCWD.js:121-136`) and bytes
  (`:113-120`), so it holds even if a caller forgets (`chara-library.ts:142-144`).
- Custom recursive-descent reader: depth 32, 100k nodes, 1024-char keys, 64 KiB strings, duplicate-key refusal,
  safe-integer-only numbers, `Object.create(null)` records (`chunk-I7NJZCWD.js:93-100,252-299`).
- `Base64Image` (any case) is discarded during the scan and never stored (`chunk-I7NJZCWD.js:269-286`).
- Inspector uses `Object.hasOwn` field reads, array/Map enum lookups, `isUint` lane bounds (`index.js:84-130`).
- Projection drops `document`, `storedIndex`, `storedExtended`, issue messages; maps unknown path segments to
  `unknown`, caps issues at 64, labels at 256 units (`chara-library.ts:146-176,217-226`).
- Library rejects provider answers that do not echo table/palette/index/tribe/gender or are not `#RRGGBB`
  (`appearance.js:132-150`); core's provider validates every request first (`chara-palette-provider.ts:95-121`).
- No logger, console or fetch anywhere in `packages/core/src/services/chara/` or `src/chara.ts` (git grep empty).
- Downstream PII handling read: bot strips nickname at projection (`bot-logic swatch.ts:264-266`), prints only
  allowlisted producer tokens (`chara-identity.ts:81-85`); web telemetry buckets producer (`telemetry-service.ts:177-184`).
- Supply chain: exact pin `0.1.0-beta.4` (`packages/core/package.json:78`); lockfile integrity `sha512-fIW3xEd3...`
  equals the registry tarball; SLSA v1 provenance from `FlashGalatine/XIVCharaKit` `.github/workflows/publish.yml`
  on `refs/heads/main`, digest 7c85b7c4... (same tarball); sole maintainer is the project owner; no
  install/preinstall/postinstall scripts, `sideEffects:false`, zero runtime dependencies, no `eval`/`Function`/
  `require`/`process`; dynamic `import()` only of its own palette chunks (`palettes.js:256-266`); MIT LICENSE +
  THIRD_PARTY_NOTICES ship in `dist/` and core's `NOTICE:28-30` credits it.
- The 2026-10-15 web audit's FINDING-002 fix (legacy `MAX_FLOAT_COLOR_LENGTH`, `describeValue`) is still in place
  (`chara-parser.ts:212,233-245,291`): no regression.

## Candidates

- **pkg-core-chara-01 (INFO, INTERNAL):** `chara-gposers.ts:120` `/\s*[\r\n]+\s*/g` is quadratic on a long run of
  non-newline whitespace (8 KiB 64 ms, 64 KiB 4.2 s, measured with node 22). Inputs are XIVAPI item names relayed
  by api-worker (bot `/glamour` on Worker CPU, `glamour.ts:405-409`) and the web user's own uncapped Acquisition
  textarea (`glamour-sheet.ts:266-284`, self-only). An attacker needs control of the upstream XIVAPI answer, which I
  could not confirm is possible.
- **pkg-core-chara-02 (INFO, LOCAL):** legacy `parseCharaFile` stays a published barrel export (`index.ts:184`) with
  none of the facade's bounds (no byte cap, unbounded `JSON.parse` depth, last-wins duplicates), and its errors quote
  up to 64 characters of file input (`chara-parser.ts:233-245,343-347`). No in-repo production caller, so only an
  external npm consumer passing untrusted text is exposed.

## Rejected

- Prototype pollution through `__proto__`/`constructor` keys: null-proto records and own-property lookups; probe showed no pollution.
- Stack overflow or a huge message from nesting: depth 32 refusal with a fixed message.
- `boundedLabel` can cut a surrogate pair at unit 256 (`chara-library.ts:146-149`; probe: a lone high surrogate at the end). On-device display only, renders as U+FFFD.
- HTML or bidi in TypeName/Nickname: passed as data. Escaping is the renderer's job; the bot prints only producer tokens.
- Projection still carries raw values (`alpha`, `nickname`): `alpha` is a finite number under 2^53; `nickname` is documented on-device only and the bot strips it.
- `/chara` subpath pulls in `chara-parser.js` → `utils/index.js` + `@xivdyetools/types` runtime (`chara-library.ts:24`): bundle size only.
- Library refuses a whole file for one unsafe integer anywhere: an availability quirk with no security effect.
- npm `latest` dist-tag still points at beta.1 (beta.4 is `next`): no effect, because the pin is exact.
- Publish age (2026-10-25T11:31Z) against `minimumReleaseAge: 1440`: belongs to the ci-supply-chain reviewer.

## Files covered: 27

- `packages/core/src/chara.ts`, `packages/core/src/index.ts` (chara rows), `packages/core/package.json`, `packages/core/NOTICE`
- `packages/core/src/services/chara/` (11 non-test modules)
- `node_modules/.pnpm/xivcharakit@0.1.0-beta.4/node_modules/xivcharakit/`: `package.json`, `dist/index.js`,
  `dist/appearance.js`, `dist/palettes.js`, `dist/chunks/chunk-{I7NJZCWD,KTJ6EXDJ,TCBT3LBA,E6OKMXQN}.js`,
  `dist/appearance/types.d.ts`, `dist/types.d.ts`, `dist/THIRD_PARTY_NOTICES.md`
- consumer spot-reads: `apps/web-app/src/workers/chara-inspection.worker.ts`,
  `packages/bot-logic/src/commands/chara-identity.ts`, `apps/web-app/src/components/glamour-sheet.ts`
- `pnpm-lock.yaml`, `pnpm-workspace.yaml` (xivcharakit and release-age rows)
