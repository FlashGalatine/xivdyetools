# Review: supply-harness (core + web-app + CI)

Reviewer key `supply-harness`. HEAD 88189ee8. Read-only; nothing removed. Advisor not consulted (the
user's global rule gates Fable use behind a usage check this worker did not run).

## Module map (scope)

| Area | Files | State |
|---|---|---|
| Supply / licence | `packages/core/NOTICE` (xivcharakit section :28-35), `packages/core/package.json` `files` incl. NOTICE, `apps/web-app/public/licenses/xivcharakit.txt` (97 lines, generated), `apps/web-app/scripts/copy-chara-notices.mjs` + `.test.js` | live |
| Package surface | `packages/core/package.json` exports `./chara` -> `dist/chara.{js,d.ts}`; `packages/core/src/chara.ts`; barrel block `packages/core/src/index.ts:272-284` | live |
| Build config | core builds with `tsc -p tsconfig.build.json` (no tsup config exists); `apps/web-app/vite.config.ts:53-61` worker `format: 'es'` + `rolldownOptions.output.minify` | live |
| Bundle budget | `apps/web-app/scripts/check-bundle-size.js:80-180`, `apps/web-app/src/__tests__/bundle-budget.test.ts` | 3 dead rows (not chara) |
| Harness | `packages/core/src/__tests__/chara-entry.test.ts`, `services/chara/__tests__/import-graph.ts`, `chara-library-parity.test.ts` (8,186 lines, 261 cases), `chara-palette-provider.test.ts`, 5 `fixtures/*.chara`, bot-logic `__fixtures__/chara-fixtures.ts` | live; host half of parity tied to legacy |
| Corpus tooling | CharaSamples referenced only in `docs/research/chara-equipment-resolution/` (frozen tier) | no live tooling |
| Workspace config | `pnpm-workspace.yaml`: no xivcharakit override / allowBuilds / minimumReleaseAgeExclude row | clean |

## Reference tables

### xivcharakit import sites (`git grep -n "from 'xivcharakit" -- . ':!docs'`)
Production: `chara-library.ts:11-22` (readChara, inspectChara, EQUIPMENT_SLOTS, resolveAppearance),
type-only in `chara-library-resolve.ts:13`, `chara-library-types.ts:6-7,34`, `chara-palette-provider.ts:9`.
Tests: parity test (`readChara`, `inspectChara`, `createDefaultPaletteProvider`, `resolveAppearance`),
`chara-library.test.ts:14-15` (types), `chara-palette-provider.test.ts:2`. Only core declares the dep
(`grep -rn xivcharakit pnpm-workspace.yaml package.json packages/*/package.json apps/*/package.json` -> `packages/core/package.json:78` only).
Unused library subpaths `xivcharakit/dyes`, `xivcharakit/xivapi` (npm view exports) are never imported: nothing to drop on our side.

### Dependencies changed by the adoption
`git diff 07fb6d3a HEAD -- packages/core/package.json packages/bot-logic/package.json apps/web-app/package.json apps/discord-worker/package.json`:
only `+xivcharakit` (core), `+./chara` exports row, web-app `build`/`copy-chara-notices` scripts, version bumps. No dependency was
removed and none became unused: the legacy parser/resolver had no third-party dependency.

### Facade barrel exports tagged `/** @public */` vs production consumers (tests, mocks excluded)
`git grep -l -w <sym> -- 'apps/*/src/*' 'packages/bot-logic/src/*' 'packages/svg/src/*' | grep -v -E '__tests__|\.test\.|/mocks/'`

| Symbol (index.ts line) | Production consumer via `@xivdyetools/core` barrel |
|---|---|
| inspectCharaForTools (274) | bot-logic `chara-identity.ts:12`, `swatch.ts` |
| resolveCharaWithProvider (275) | NONE via barrel; web-app worker imports it from `@xivdyetools/core/chara` (`chara-inspection.worker.ts:24`) |
| resolveCharaForTools (277) | bot-logic `chara-identity.ts:13`, `swatch.ts` |
| createCharaPaletteProvider (278) | web-app `chara-inspection-service.ts:29` |
| ImportedCharaCharacter (280) | 8 web-app files + bot-logic chara-identity/swatch |
| ImportedCharaSlot (281) | web-app chara-sheet/chara-ui/chara-inspection-protocol, bot-logic swatch |
| CharaImportIssue (282) | web-app chara-sheet/chara-ui/glamour-block, bot-logic glamour |
| CharaPaletteProvider (283) | web-app `chara-inspection-service.ts:30` |

### Legacy parser reachability (from evidence/symrefs-core-chara.txt, confirmed)
`parseCharaFile prod=4 (index.ts + own file) tests=72`; `resolveCharaColors prod=2 tests=25`. Test importers outside
core: bot-logic `swatch.test.ts:8-9,33,226,386,410,454`. Not bundled by the web app:
`grep -l "is not a JSON object" apps/web-app/dist/assets/*.js` -> none (string from `chara-parser.ts:450`).
First shipped: `git log -S parseCharaFile -- packages/core/src/index.ts` -> 3fe098c1 2026-08-07; npm has core 4.2.0 (2026-09-03) onward,
local 5.15.0 == npm 5.15.0, so removal is MAJOR.

### Bundle budget rows vs emitted chunks
`apps/web-app/dist/assets` (built 2026-10-26 14:47, contains `chara-inspection.worker-KKr8djVW.js`, the same hash the
budget test pins at `bundle-budget.test.ts:55`). Count of non-map files matching each row pattern:
`^vendor-spectral-` 0, `^vendor-(?!core|lit|spectral)` 0 (only `vendor-core`, `vendor-lit` exist), `^dye-selector-` 0;
every other row 1 (index 2: js + css). `chara-file-card-BSOrwVHs.js` (26,563 B) and `collapsible-panel-*.js` fall to the 60 KB default.

### Vendored fixtures
Node scratch compare: bot-logic `DUSKWIGHT_HETEROCHROMIA` / `HROTHGAR_HELIONS` === core `fixtures/*.chara` (true, true). In sync.

## Candidates

### supply-harness-01 Legacy parser never marked deprecated (Legacy, REFACTOR FIRST, core)
`git grep -n -i deprecated -- packages/core/src/services/chara/ packages/core/src/index.ts | grep -i chara` -> empty;
`DEPRECATIONS.md` sections (:8-384) have no `.chara` entry; `packages/core/CLAUDE.md:191` "the legacy parser/resolver stay for now".
No production consumer remains (table above). Fix: `@deprecated` JSDoc on `parseCharaFile`, `resolveCharaColors`,
`OFF_GRID_DELTA_E2000` and the parser/resolver types in `index.ts:184-207`, plus a DEPRECATIONS.md entry naming core 6.0.0;
ship in the Unreleased core MINOR. Cascade: precondition for core-legacy's removal; removal also needs `MAX_CHARA_FILE_BYTES`
moved out of `chara-parser.ts` (imported by `chara-library.ts:24`) and `StainIdLookup`/`ResolvedGearDye` types out of
`chara-resolver.ts` (`chara-library.ts:26`). Semver now MINOR-neutral (doc tag); removal MAJOR.

### supply-harness-02 Parity harness host half exists only for the legacy parser (Test-only, KEEP)
`chara-library-parity.test.ts:339-343` `[host] legacy parseCharaFile + resolveCharaColors`; 261 cases carry `host:` blocks
(`grep -c "^\s*host:"` -> 262 incl. the type). Library half (`:518`) tests xivcharakit directly and is the regression contract
for the exact pin. Stale now: header `:11-12` "the application bridge is Task 2" (the bridge shipped as
`createCharaPaletteProvider`, core 5.15.0). KEEP until legacy removal; then strip host half (`HostExpect`, `runHost`,
`assertHost`, `registerHostTests`, every `host:` block, `[register]` "both sides" check `:328-333`) and keep the library half.
Trigger: supply-harness-01 / core 6.0.0.

### supply-harness-03 bot-logic swatch.test uses the legacy resolver as oracle (Stale Test, REFACTOR FIRST)
`packages/bot-logic/src/commands/swatch.test.ts:8-9,33,226,386,410,454`; production `swatch.ts` reads through
`resolveCharaForTools` (symrefs). Comment `:27-28` admits "the legacy resolver stays wrapped for the tests that compute
expectations with it". Fix: derive expectations from `resolveCharaForTools` or literals. Blocks supply-harness-01 removal.

### supply-harness-04 Seven stale `/** @public */` tags on consumed facade exports (Legacy, REMOVE tags)
`packages/core/src/index.ts:274,277,278,280-283`. Tagged when "Nothing in the apps consumes the new entry points yet"
(`CHANGELOG.md:17`); web-app 5.16.0 and bot-logic 4.11.0 now import all seven through the barrel (table). `@public`
means "no in-repo consumer" (root CLAUDE.md knip rule), so the tags would hide a future loss of consumers. Keep the tag on
`resolveCharaWithProvider` (`:275`). Comment-only, semver NONE. Lines: 0 (inline edits).

### supply-harness-05 Barrel `resolveCharaWithProvider` duplicates the `./chara` subpath (Redundant Re-export, KEEP)
Only consumer is the subpath (`chara-inspection.worker.ts:24`); barrel copy pinned by `chara-entry.test.ts:26-30` and
`chara-library.test.ts:49-51`. Published in 5.15.0 -> removal MAJOR. Trigger: next core major.

### supply-harness-06 Inert / stale `@entrypoint` tags (Legacy, REFACTOR text)
`packages/core/src/chara.ts:9-12` says the first consumer "lands in the web-app change stacked on this one" (landed, #330).
The gate never reads it: `scripts/check-dead-code.ts:750` `if (prodRefs.has(file)) continue;` precedes the tag lookup and
`evidence/dead-code-check.txt` lists 7 entrypoint exemptions without `chara.ts`. `copy-chara-notices.mjs:26` tag is unseen too:
both scans filter `/\.(ts|tsx)$/` (`check-dead-code.ts:747,827`). Fix: rewrite chara.ts reason to name the worker as the consumer
(keep the tag as a guard against the basename fallback changing); leave the .mjs tag as documentation.

### supply-harness-07 Bundle-budget rows that match no emitted chunk (Dead Path, REMOVE WITH CAUTION, web-app)
`check-bundle-size.js:127` `vendor-spectral`, `:128` `other vendor`, `:158` `dye selector`; `bundle-budget.test.ts:54`
fixture `dye-selector-B6HfW2Vr.js` keeps the dead row looking covered; `vite.config.ts:42-43` manualChunks
`vendor-spectral` / `vendor` returns are ignored by Rolldown (spectral merged into `modals`, `check-bundle-size.js:96-99`);
`apps/web-app/CLAUDE.md:221-222` documents the two chunks. Not caused by xivcharakit. MEDIUM: shared-chunk names follow the
module graph, so `dye-selector-` could reappear; better fix is a check that every named row matched at least one file.
Lines ~7.

### supply-harness-08 Core dependency docs omit xivcharakit and `/chara` (Legacy, REFACTOR text)
`packages/core/CLAUDE.md:282` "External: `spectral.js`" only; `:67` `chara/` line omits the library facade;
`docs/architecture/dependency-graph.md:20,125` (deps "types, logger, spectral.js", "incl. /blending"); `CLAUDE.md:41`,
`README.md:73`, `docs/index.md:49` "incl. /blending". Add xivcharakit and `/chara`.

### supply-harness-09 Published core README credits/NOTICE line omit xivcharakit (Legacy, REFACTOR text)
`packages/core/README.md:466-471` credits list spectral.js etc., not xivcharakit; `:490` "Third-party data attributions
(the Munsell hue wheel) are in NOTICE" but NOTICE `:28-35` now also carries xivcharakit. README ships to npm (`files`).

### supply-harness-10 Core docs present the legacy pair as the `.chara` API (Legacy, REFACTOR text)
`packages/core/CLAUDE.md:191` lists `parseCharaFile`/`resolveCharaColors` first and says the cap is enforced by "the web app and
the bot ... the parser does not" (now `inspectCharaForTools` enforces it, `chara-library.test.ts:55-62`);
`docs/projects/core/services.md:309-311` same pair with no "no in-repo consumer" note. Reword to: library facade is the reader,
legacy pair kept for npm consumers until 6.0.0.

## KEEP (with triggers)
- `packages/core/NOTICE:28-35`, `package.json` `files: NOTICE` - licence obligation. Trigger: xivcharakit dropped.
- `public/licenses/xivcharakit.txt` + `copy-chara-notices.mjs` + test - linked by `about-modal.ts:80`, served-body checks in
  `e2e/reader-license.spec.ts`, `smoke-test-pages.js:58`, `_headers:119`. Trigger: pin change regenerates.
- `./chara` exports row + `chara.ts` + `chara-entry.test.ts` + `import-graph.ts` - worker consumer; the test is the bundle boundary.
- `chara-inspection.worker` budget row (`check-bundle-size.js:155`) matches 1 chunk; vite worker config live.
- Five `fixtures/*.chara` - used by web-app worker/service tests and bot-logic, not just legacy tests.
- `chara-palette-provider.test.ts` vs `createDefaultPaletteProvider` - parity guard of our bridge vs the bundled corpus.
- `docs/versions.md:73` "Nothing consumes it yet" and `CHANGELOG.md:17` - accurate at release; release notes are not rewritten.
- `docs/research/2026-10-22-xivcharakit-integration.md` (register) - frozen-body tier.

## Positives
No skipped/only/todo tests or snapshots in the chara harness; vendored bot-logic fixtures byte-identical to core's;
no workspace override/allowBuilds/release-age exclusion for xivcharakit; adoption made no dependency unused;
legacy parser tree-shaken out of the web bundle; every chara budget row matches a real chunk.

## FILES COVERED (24)
packages/core/{NOTICE,package.json,tsconfig.build.json,CLAUDE.md,README.md,CHANGELOG.md(head)}, packages/core/src/chara.ts,
packages/core/src/index.ts(170-290), packages/core/src/__tests__/chara-entry.test.ts,
packages/core/src/services/chara/__tests__/{chara-library-parity.test.ts(1-140,300-345,6900-6960),chara-library.test.ts(1-70),import-graph.ts(1-30)},
packages/core/src/services/chara/chara-library.ts(1-30), packages/bot-logic/src/commands/swatch.test.ts(1-40,375-460),
packages/bot-logic/src/commands/__fixtures__/chara-fixtures.ts, apps/web-app/{scripts/copy-chara-notices.mjs,scripts/copy-chara-notices.test.js(1-80),
scripts/check-bundle-size.js(1-220),src/__tests__/bundle-budget.test.ts(20-120),vite.config.ts,knip.jsonc,CLAUDE.md},
pnpm-workspace.yaml, DEPRECATIONS.md(headings), docs/projects/core/{services.md,overview.md}(chara rows), scripts/check-dead-code.ts(728-880).

## Not covered
- No fresh `vite build` was run (read-only); budget-row results use the 14:47 dist, which already carries the 5.16.0 worker.
- discord-worker bundle licence notice for xivcharakit (shipping obligation, not dead code).
- tsup: core has no tsup config, so there is no tsup entry to check.
