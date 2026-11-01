# Review r2-xivcharakit-source: xivcharakit@0.1.0-beta.4 (deploy unit: core, xivcharakit dependency)

Reviewer key `r2-xivcharakit-source`. Checkout HEAD 13c386e5. Read-only; probes ran under the session scratchpad only.

Installed source: `node_modules/.pnpm/xivcharakit@0.1.0-beta.4/node_modules/xivcharakit` (symlinked from `packages/core/node_modules/xivcharakit`). All dist paths below are relative to that package root.

## Package and provenance facts

| Item | Value | Evidence |
|---|---|---|
| Pin | exact `"xivcharakit": "0.1.0-beta.4"` | `packages/core/package.json:78` |
| Lockfile integrity | `sha512-fIW3xEd3…Rg0Mw==` = registry `dist.integrity` | `pnpm-lock.yaml:4049`, `npm view xivcharakit@0.1.0-beta.4 --json` |
| Files / size | 43 files, 414,848 B unpacked: local `find … -type f` matches registry `fileCount` 43 and `unpackedSize` 414848 | `npm view` |
| Scripts | `test`, `type-check`, `build` only; **no** `preinstall`/`install`/`postinstall`/`prepare` | `package.json` |
| Runtime dependencies | none (`dependencies` absent); lockfile entry `xivcharakit@0.1.0-beta.4: {}` | `pnpm-lock.yaml:7149` |
| License | MIT, `dist/LICENSE` + `dist/THIRD_PARTY_NOTICES.md` (MIT XIV Dye Tools data, MIT Vite helpers, game-derived data, CIEDE2000 note) | `dist/` |
| Maintainer | `flashgalatine` (the project owner's own npm account) | `npm view` |
| Dist-tags | `latest` = 0.1.0-beta.1, `next` = 0.1.0-beta.4 | `npm view` |
| Provenance | SLSA v1 attestation; workflow `FlashGalatine/XIVCharaKit/.github/workflows/publish.yml` @ `refs/heads/main`, gitCommit `18a91afee6d29ea89d456c33a145e5a2ee4c3710` | registry attestations endpoint |
| Git tags upstream | **none** (`gh api repos/FlashGalatine/XIVCharaKit/tags` returns `[]`) | see candidate 02 |
| Source vs dist | every dist module maps to a source file under `packages/chara/src/` at 18a91afe (`read.ts`, `inspect.ts`, `issues.ts`, `field-spec.ts`, `models.ts`, `realm.ts`, `errors.ts`, `appearance/*`, `palettes/*` + 4 data JSON, `xivapi/*`, `dyes/index.ts`); `scripts/build.ts` = esbuild bundle + copy of root `LICENSE` and `THIRD_PARTY_NOTICES.md`, which explains the two non-source dist files. Upstream `read.ts` limits/`Object.create(null)`/`base64image` lines match the dist. No dist file without a source counterpart. A byte-for-byte rebuild was not done. | `gh api …/git/trees/18a91afe?recursive=1`, `…/contents/packages/chara/{src/read.ts,scripts/build.ts}` |

## Module table (what core and the apps reach)

| Module (dist) | Reached by | Role | Untrusted input |
|---|---|---|---|
| `index.js` → `chunks/chunk-I7NJZCWD.js` `readChara` | core `chara-library.ts:142-144` (`inspectCharaForTools`, `maxBytes: MAX_CHARA_FILE_BYTES` = 8 KiB, `chara-parser.ts:81`) | hand-written bounded JSON tokenizer | whole `.chara` file (web drop, Discord attachment) |
| `index.js` `inspectChara` | same | field typing, enumerations, vectors, equipment lanes | reader output |
| `appearance.js` `resolveAppearance` | core `chara-library.ts:214` | palette requests, slot construction, eye pairing, lip composite | inspection + host provider replies |
| `palettes.js` | **types only** in production (`chara-library-types.ts:34`, `chara-palette-provider.ts:9`); runtime import only in core tests | default provider with 4 lazy data chunks | none in prod |
| `xivapi.js`, `dyes.js`, `chunks/chunk-E6OKMXQN.js` | **no workspace imports them** (`git grep -nE "from ['\"]xivcharakit" -- '*.ts' '*.js' '*.mjs'`) | XIVAPI client + memory cache | not reachable |

Consumers of the facade: web-app `src/workers/chara-inspection.worker.ts:24,82,88` (posts only the projection, `:89`); bot-logic `src/commands/chara-identity.ts:51` (`resolveCharaForTools(inspectCharaForTools(source), …)`, inspection discarded). api-worker does not import the reader (`/v1/chara/resolve` takes model keys).

No routes in this unit, so no authz matrix.

## Library limits (chunk-I7NJZCWD.js)

| Limit | Default (`:81-88`) | Ceiling (`:89-96`) | Host value |
|---|---|---|---|
| maxBytes | 16 MiB | 64 MiB | 8 KiB (core) — strings measured in UTF-8 bytes, lone surrogate = 3 B (`:125-136`); Uint8Array decoded with `TextDecoder(fatal:true)` (`:118`) |
| maxDepth | 32 | 128 | default |
| maxNodes | 100,000 (keys count as nodes, `:269`) | 1,000,000 | default |
| maxKeyLength | 1,024 | 4,096 | default |
| maxStringLength | 65,536 (Infinity for `base64image` values, which are scanned and discarded, `:209`) | 1 MiB | default |
| maxIssues | 64 | 64 | default; issue paths `boundedPath` 256 chars (`chunk-TCBT3LBA.js:2-18`), message 256 chars (`:37`) |

## Hostile-input probes (through core's built facade `inspectCharaForTools` → `resolveCharaWithProvider`)

Script `scratchpad/probe/xck-probe.mjs`, output `scratchpad/probe/xck-probe.out.txt`; Node 22.21.0, Windows. All refusals are `CharaInputError` with a fixed code; worst wall-clock 8.51 ms.

| Probe | Result | ms |
|---|---|---|
| 4,000 nested arrays (~8 KiB) | MAX_DEPTH | 1.36 |
| 31 nested objects / 33 nested objects | OK / MAX_DEPTH | 2.12 / 0.27 |
| 2,000 nested arrays inside `Base64Image` | MAX_DEPTH (discard path still depth-bounded) | 0.17 |
| 8,100-digit integer | INVALID_NUMBER | 0.71 |
| `0.000…(8000)…1`, `1e-999`, `1e000…(8000)…1` | OK (finite) | ≤1.07 |
| `1e999`, `9007199254740993` | INVALID_NUMBER | 0.06 |
| `-0` as Race | UNSUPPORTED_VALUE (enumeration index −1 → undefined) | 0.29 |
| `"1e999,0,0"` color string; 64-char non-numeric part | INVALID_FIELD (regex `^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$`, linear, part ≤64 chars, `index.js:69-77`) | ≤0.51 |
| `__proto__`/`constructor`/`prototype` at top level, inside a gear slot, `__proto__` escaped, inherited `ModelBase` via `__proto__` | stored as own keys of a null-prototype object; `Object.prototype` unchanged; slot reads via `Object.hasOwn` so `__proto__.ModelBase` gives INCOMPLETE_MODEL | ≤0.20 |
| Race/Tribe/Gender = `"__proto__"`/`"constructor"`/`"toString"` | UNSUPPORTED_VALUE ×3 | 0.11 |
| Glasses `{"__proto__":{"GlassesId":3}}` | INVALID_FIELD | 0.13 |
| duplicate key, and duplicate via `a` escape | DUPLICATE_KEY (keys decoded by `JSON.parse` before the Set check, `:181,270`) | ≤0.04 |
| lone surrogate (escaped and raw) in Nickname | **accepted**, projected nickname not well-formed | 0.10 |
| CESU-8 surrogate bytes (Uint8Array) | INVALID_UTF8 | 0.10 |
| 255 × `a` + U+1F600 in Nickname | **projection cut at 256 code units splits the pair** (`isWellFormed()` false) | 0.13 |
| 4,090 × `é` string (8,180 UTF-8 bytes + JSON) | INPUT_TOO_LARGE | 0.25 |
| BOM; raw U+0000 inside a string | OK; INVALID_JSON | 0.06 / 0.04 |
| gear slot as array; top-level array | INVALID_FIELD; NOT_CHARACTER | ≤0.08 |
| 700 unknown keys; 4,000-element array | OK, issues collapse to `unknown` + ISSUES_TRUNCATED | 4.44 / 8.51 |
| 1,025-char key; 8,200-char body | MAX_KEY_LENGTH; INPUT_TOO_LARGE | ≤0.08 |
| `"${process.exit(1)}"` Nickname, `<img onerror>` TypeName | carried as inert strings into `nickname`/`producer` (sink escaping is the web/bot reviewers' scope) | 0.08 |

## POSITIVE controls

- No `eval`, `new Function`, `fs`, `process`, `require`, `importScripts`, `postMessage`, storage or DOM use in any dist file (`grep -nE "eval\(|new Function|Function\(|import\(|fetch\(|require\(|process\.|globalThis|…"`). The only dynamic `import()`s are the four fixed palette data chunks (`palettes.js:256-266`), which contain pure JSON literals; the only `fetch`/`globalThis` use is the unreached XIVAPI client (`chunk-E6OKMXQN.js:513`), which itself pins `https:`, refuses credentials/redirects (`:498, 541-547, 552-558`) and caps requests/bytes/rows (`:525-527`).
- Every parsed object is `Object.create(null)` (`chunk-I7NJZCWD.js:255`); inspector maps are null-prototype (`index.js:226,234,260,283`); field reads use `Object.hasOwn` (`index.js:93,80-81,287`). Prototype pollution is not reachable (probe: `({}).polluted` undefined).
- Recursion depth ≤ maxDepth before any child is parsed (`:203`), so no stack exhaustion; node, key, string and byte caps all fail closed with fixed-code errors whose messages carry no input text (`:13-27`).
- Numbers: grammar-checked by hand, then `Number()`; non-finite and unsafe integers refused (`:244-246`); no regex on the JSON path at all.
- Duplicate keys are refused rather than last-wins (`:270`), so a file cannot show one value to one consumer and another to a second parser.
- Embedded `Base64Image` values are scanned and dropped, never materialized (`:275-290`).
- core projection drops `document`, `fields`, `raw`, `storedExtended`, Author and Description (`chara-library.ts:216-228, 264-278`); diagnostic paths keep only schema field names and become `unknown` otherwise (`chara-library.ts:151-160`); labels capped at 256 units (`:146-149`).
- Host palette provider re-validates table/palette/index/tribe/gender before indexing host data (`chara-palette-provider.ts:105-140`); the library then re-checks every reply's association and hex format (`appearance.js:132-153`).
- Web worker chunk `apps/web-app/dist/assets/chara-inspection.worker-KKr8djVW.js` is 30,486 B with no `import(`, `fetch(`, `eval(` or `importScripts` (local build of 2026-10-26).
- License notice: `apps/web-app/public/licenses/xivcharakit.txt` reproduces `dist/LICENSE` and `dist/THIRD_PARTY_NOTICES.md` verbatim, gated by `apps/web-app/scripts/copy-chara-notices.test.js:77-90` and `e2e/reader-license.spec.ts:15-25`. Workers run the code server-side and do not distribute it, so MIT imposes no notice there.
- Exact pin + lockfile integrity + SLSA provenance + no install hooks + zero dependencies.

## Candidates

- **r2-xivcharakit-source-01 (INFO)**: `boundedLabel` (`packages/core/src/services/chara/chara-library.ts:146-149`) cuts at 256 UTF-16 units with `slice`, which can leave half a surrogate pair, and the library accepts lone surrogates from `\ud800` escapes or raw string input. Probes `nickname-split-pair` and `lone-surrogate-*` return `nickname.isWellFormed() === false`; the effect is a U+FFFD at the end of a displayed name, with no security impact found.
- **r2-xivcharakit-source-02 (INFO)**: The upstream repository has no git tags, and `package.json` `repository` names no ref, so a reviewer has to trace 0.1.0-beta.4 through the npm provenance attestation (main@18a91afe) rather than a release tag. The provenance is intact and matches. This is a release-traceability gap only.

## REJECTED

- `base64image` strings have no string-length cap (`chunk-I7NJZCWD.js:209`): the scan is linear and bounded by maxBytes (8 KiB in host); value discarded.
- `maxNodes` 100,000 vs 8 KiB: unreachable at the host cap (8 KiB yields < 4,100 nodes); 4,000-node array took 8.5 ms.
- `READ_DEFAULTS.maxBytes` 16 MiB: the host always passes 8 KiB (`chara-library.ts:143`); the worker and bot also cap the bytes before reading.
- Dynamic `RegExp` in `missingRowIn` (`chunk-E6OKMXQN.js:382`): `sheet` is an internal constant, the message is ≤256 chars, and the XIVAPI client is unreachable from any workspace.
- npm `latest` dist-tag (beta.1) lags `next` (beta.4): the dependency is an exact pin with lockfile integrity, so a fresh install cannot drift to beta.1.
- Prototype keys / duplicate keys / NaN-Infinity numbers / arrays-for-objects: all refused or neutralized (probe table).
- Regex backtracking: the only regex applied to file content is the vector `numericToken`, which is linear and applied to parts ≤64 chars.
- MIT notice missing from Worker bundles: Workers do not distribute the code to users; the web-app ships the notice.

## FILES COVERED (38)

- `node_modules/.pnpm/xivcharakit@0.1.0-beta.4/node_modules/xivcharakit/`: `package.json`, `dist/index.js`, `dist/appearance.js`, `dist/palettes.js`, `dist/dyes.js`, `dist/chunks/chunk-I7NJZCWD.js`, `chunk-E6OKMXQN.js` (lines 1-560 read, the rest grepped), `chunk-TCBT3LBA.js`, `chunk-KTJ6EXDJ.js`, the 4 palette data chunks (grepped: data only), `dist/THIRD_PARTY_NOTICES.md` (headings) — 13 files
- Upstream at 18a91afe: tree listing, `packages/chara/src/read.ts`, `scripts/build.ts` — 3
- `packages/core/src/services/chara/`: `chara-library.ts`, `chara-library-resolve.ts`, `chara-palette-provider.ts` (40-143), `chara-parser.ts` (cap line); `packages/core/package.json` — 5
- `apps/web-app/src/workers/chara-inspection.worker.ts` (20-110), `apps/web-app/public/licenses/xivcharakit.txt` (head), built `apps/web-app/dist/assets/chara-inspection.worker-*.js` (grepped) — 3
- `pnpm-lock.yaml` (xivcharakit entries); `git grep` sweeps over `apps/*/src`, `packages/*/src` for import sites and nickname/producer consumers (14 hits opened as lines) — 14

Not covered: a byte-for-byte rebuild of dist from 18a91afe; `chunk-E6OKMXQN.js` beyond line 560 (unreached XIVAPI client); the discord-worker wrangler bundle (not built here).
