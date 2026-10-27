# Dead-code audit — the XIVCharaKit-facing code (2026-10-26)

- **Branch/commit:** `claude/xivcharakit-dead-code-audit` @ `88189ee8` (stacked on the security-audit branch of PR #333; no source file differs from `main` beyond what that PR already carries). **Scope:** the code where the monorepo interacts with `xivcharakit@0.1.0-beta.4` and the older `.chara` code it displaced — core 5.15.0, bot-logic 4.11.0, web-app 5.16.0, discord-worker 5.9.0, api-worker 0.21.0, og-worker 2.12.0. **Depth:** exhaustive for the slice (tool evidence, symbol / member / asset / i18n sweeps, npm consumer check).
- **Method:** Step 2 evidence ([knip](evidence/knip-packages-core.txt) clean in all six workspaces, `tsc --noUnusedLocals` clean, `i18n:unused` clean, `pnpm dead-code:check` passes ([output](evidence/dead-code-check.txt)), baseline gates green: 26 turbo tasks and every test file in the six units); six slice reviewers (Opus-high workers) → 66 candidates → 50 groups ([candidate-groups.json](evidence/candidate-groups.json)); every removal group judged by an independent confirming **and** an independent refuting Opus verifier (none split), every KEEP by one auditor; one calibration pass (merged 3 groups, normalized grades, fixed the removal order); npm consumer check ([npm-state.txt](evidence/npm-state.txt)). **No Fable agent and no advisor call was used.**
- **Totals:** **47 findings — 24 actionable (12 REMOVE, 5 REMOVE WITH CAUTION, 7 REFACTOR FIRST) and 23 KEEP.** About **4,211 lines** are removable, 3,561 of them in one MAJOR-gated change. No group was rejected on verification; two reviewer "removals" were narrowed to KEEP.
- **Source changes:** none. Only `docs/audits/2026-10-26-xivcharakit-dead-code/` was written.

## What this audit found

The migration to xivcharakit is **complete at runtime**: no production code in any app or package still calls the legacy `parseCharaFile` / `resolveCharaColors`. Web-app parses inside the inspection worker through `@xivdyetools/core/chara`; the bots read through `inspectCharaForTools` → `resolveCharaForTools`. What keeps the legacy pair alive is **three things only**: the published barrel (`@public` tags), its own tests (about 1,050 lines), and the 8,186-line parity harness's `[host]` half. That is why knip, `tsc` and the reachability gate are all clean.

It cannot simply be deleted:

- `@xivdyetools/core` 5.15.0 and `@xivdyetools/bot-logic` 4.11.0 are **already on npm**, so removing or narrowing any public export is **MAJOR**, and the legacy exports have never been `@deprecated`. The first step is a deprecation (MINOR), then a coordinated core 6.0.0 + bot-logic 5.0.0.
- The legacy files still hold **live code**: `MAX_CHARA_FILE_BYTES` (imported by the live facade) and the slot and result types that web-app, bot-logic and the facade use. Those must move first ([DEAD-020](findings/DEAD-020.md), [DEAD-021](findings/DEAD-021.md)).
- The core CLAUDE.md revisit trigger ("legacy parser/resolver stay for now") is still open: beta acceptance of the xivcharakit path is owed.

Everything else is small: 15 internal cleanups (a 245-line protocol validator for dye objects the worker can never send, dead guards, redundant exports, a test fixture that ships in the published bot-logic tarball, bundle-budget rows that match no chunk) and 5 findings about stale comments, docs and `@public`/`@entrypoint` tags that still describe the legacy parser as the live path.

## Catalog

| ID | Title | Conf | Blast | Semver | Deploy unit | Rec |
|---|---|---|---|---|---|---|
| [DEAD-001](findings/DEAD-001.md) | Comments and docs describing behavior that no longer exists (web-app) — ~5 lines | HIGH | NONE | NONE | web-app | REMOVE |
| [DEAD-002](findings/DEAD-002.md) | Stale comments and docs around the xivcharakit facade still describe the legacy parser as the live path, and two @entrypoint tags are inert | HIGH | NONE | NONE | core (comments + npm README/NOTICE text… | REMOVE |
| [DEAD-003](findings/DEAD-003.md) | Seven stale @public tags on core barrel chara-facade exports that now have production in-repo consumers | HIGH | NONE | NONE | core (packages/core; comment-only, no r… | REMOVE |
| [DEAD-004](findings/DEAD-004.md) | Stale api-worker chara docs/comments: icon caching, resolve consumer, /api/version, misplaced OPT-004 note — ~4 lines | HIGH | NONE | NONE | api-worker (docs + comments only; hub d… | REMOVE |
| [DEAD-005](findings/DEAD-005.md) | Comments and README describe the legacy parser's errors and value echoes | HIGH | NONE | NONE | bot-logic + discord-worker (comment/REA… | REMOVE WITH CAUTION |
| [DEAD-006](findings/DEAD-006.md) | The ISSUE_KEY entry for EYE_PAIRING_UNCONFIRMED cannot be reached and duplicates the default — ~2 lines | HIGH | LOW | NONE | web-app | REMOVE |
| [DEAD-007](findings/DEAD-007.md) | The facewear-era `dye.itemID <= 0` guard in the swatch matching loops is always false — ~1 lines | HIGH | LOW | NONE | web-app | REMOVE |
| [DEAD-008](findings/DEAD-008.md) | swatch-tool redefines MONO and SANS, which chara-ui already exports — ~3 lines | HIGH | LOW | NONE | web-app (unpublished app, ships with th… | REFACTOR FIRST |
| [DEAD-009](findings/DEAD-009.md) | CharaResolveUnavailableError.status is never read and no caller checks the error type — ~7 lines | HIGH | LOW | NONE | web-app | REMOVE WITH CAUTION |
| [DEAD-010](findings/DEAD-010.md) | CharaResolveResult.version is stored but never read — ~25 lines | HIGH | LOW | NONE | web-app | REMOVE WITH CAUTION |
| [DEAD-011](findings/DEAD-011.md) | Protocol validates non-null dye objects that the worker can never send — ~245 lines | HIGH | LOW | NONE | web-app | REMOVE WITH CAUTION |
| [DEAD-012](findings/DEAD-012.md) | GlamourBlock code paths for a missing host (no actionsHost or onSubmitPalette) — ~7 lines | HIGH | LOW | NONE | web-app | REFACTOR FIRST |
| [DEAD-013](findings/DEAD-013.md) | Bundle-budget rows match no emitted chunk (vendor-spectral, other vendor, dye selector) — ~8 lines | MEDIUM | LOW | NONE | web-app (check-bundle-size.js gates dep… | REMOVE WITH CAUTION |
| [DEAD-014](findings/DEAD-014.md) | downloadCharaAttachment text-only shape and adapters' fileText pass-through are dead in production — ~15 lines | HIGH | LOW | NONE | discord-worker | REMOVE |
| [DEAD-015](findings/DEAD-015.md) | Unreachable ?? 'card.slotSkin' fallback for the slot label | HIGH | LOW | NONE | bot-logic (ships to discord-worker; int… | REMOVE |
| [DEAD-016](findings/DEAD-016.md) | Redundant export on module-internal getCharacterColors and CharaFileSource | HIGH | LOW | NONE | bot-logic | REMOVE |
| [DEAD-017](findings/DEAD-017.md) | Test fixture module __fixtures__/chara-fixtures ships in the published bot-logic tarball | HIGH | NONE | NONE | bot-logic (packaging only; ships with t… | REMOVE |
| [DEAD-018](findings/DEAD-018.md) | Redundant status === 503 test in XivapiClient.get | HIGH | LOW | NONE | api-worker (app, unpublished; 0.21.0) | REMOVE |
| [DEAD-019](findings/DEAD-019.md) | types.ts re-exports CharaTwinRules, which nothing imports through it | HIGH | LOW | NONE | api-worker | REMOVE |
| [DEAD-020](findings/DEAD-020.md) | Move MAX_CHARA_FILE_BYTES out of the legacy parser (only runtime edge from the live facade into chara-parser.ts) | HIGH | LOW | NONE | core | REFACTOR FIRST |
| [DEAD-021](findings/DEAD-021.md) | Relocate live type contracts declared in chara-parser.ts / chara-resolver.ts | HIGH | MEDIUM | NONE | core | REFACTOR FIRST |
| [DEAD-022](findings/DEAD-022.md) | bot-logic swatch.test.ts uses the legacy parseCharaFile/resolveCharaColors as an oracle for facade output, and keeps a vi.fn wrapper on resolveCharaC… | HIGH | NONE | NONE | bot-logic (test file only; tsconfig.bui… | REFACTOR FIRST |
| [DEAD-023](findings/DEAD-023.md) | SwatchResult.character and its legacy ResolvedCharaSlot back-mapping are read by no adapter — ~324 lines | HIGH | MEDIUM | MAJOR | bot-logic (published @xivdyetools/bot-l… | REFACTOR FIRST |
| [DEAD-024](findings/DEAD-024.md) | Legacy parseCharaFile / resolveCharaColors pair, its legacy-only public types and the parity harness [host] half are reachable only from tests: depre… | HIGH | HIGH | MAJOR | core (6.0.0); bot-logic test-only edit… | REFACTOR FIRST |
| [DEAD-025](findings/DEAD-025.md) | Chara row cache's stale-while-revalidate window never revalidates | HIGH | LOW | NONE | api-worker | KEEP |
| [DEAD-026](findings/DEAD-026.md) | Eight api-worker chara exports referenced only in their own file (live symbols, redundant export keyword) | HIGH | NONE | NONE | api-worker | KEEP |
| [DEAD-027](findings/DEAD-027.md) | ImportedCharaCharacter.extendedValid / extendedDeclared are filled but no production code reads them (KEEP: published type contract) | HIGH | MEDIUM | MAJOR | core + bot-logic (+ web-app follow-on) | KEEP |
| [DEAD-028](findings/DEAD-028.md) | Provider arm of resolveCharaForTools (isPaletteProvider) is test-only in-repo but is published, documented 5.15.0 API: KEEP until core 6.0.0 | HIGH | HIGH | MAJOR | core | KEEP |
| [DEAD-029](findings/DEAD-029.md) | Barrel re-export of resolveCharaWithProvider duplicates the ./chara subpath; in-repo barrel use is test-only | HIGH | HIGH | MAJOR | core | KEEP |
| [DEAD-030](findings/DEAD-030.md) | CHARA_WEAPON_SLOTS exported @public with no consumer outside its own module | HIGH | HIGH | MAJOR | core | KEEP |
| [DEAD-031](findings/DEAD-031.md) | FIXED_KEYS.noItem entry cannot be reached | HIGH | LOW | NONE | bot-logic (ships to discord-worker) | KEEP |
| [DEAD-032](findings/DEAD-032.md) | KEEP shader tables + chara-shader-colors.ts (live via palette bridge; deliberate duplicate of xivcharakit corpus) | HIGH | HIGH | NONE | core | KEEP |
| [DEAD-033](findings/DEAD-033.md) | KEEP CharacterColorService, interface sheets, build-character-colors script, .chara fixtures, chara-models helpers | HIGH | HIGH | MAJOR | core | KEEP |
| [DEAD-034](findings/DEAD-034.md) | matchHexFor's interpretation==='inactive' arm is unreachable under xivcharakit 0.1.0-beta.4 | HIGH | LOW | NONE | core | KEEP |
| [DEAD-035](findings/DEAD-035.md) | Palette provider guards (table, palette type, shader lipsLight/facePaint) the library never trips | HIGH | HIGH | NONE | core | KEEP |
| [DEAD-036](findings/DEAD-036.md) | Exports used in their own file that exist only as test seams (web-app-09): KEEP | HIGH | LOW | NONE | web-app | KEEP |
| [DEAD-037](findings/DEAD-037.md) | config-controller scrub of the retired swatch.fileProvided key | HIGH | LOW | NONE | web-app | KEEP |
| [DEAD-038](findings/DEAD-038.md) | Published SwatchInput/GlamourInput.fileText and the NO_INPUT guard: KEEP until bot-logic 5.0.0 | HIGH | MEDIUM | MAJOR | bot-logic (+ discord-worker call sites… | KEEP |
| [DEAD-039](findings/DEAD-039.md) | familySize ?? twins.length fallback is dead for this repo's api-worker | HIGH | MEDIUM | MAJOR | bot-logic | KEEP |
| [DEAD-040](findings/DEAD-040.md) | Unreachable guard for a 304 with no retained ETag in loadIcon | HIGH | LOW | NONE | api-worker | KEEP |
| [DEAD-041](findings/DEAD-041.md) | Empty-lookup guards in searchItems and loadRows are reached only by tests | HIGH | LOW | NONE | api-worker (0.21.0, unpublished app) | KEEP |
| [DEAD-042](findings/DEAD-042.md) | Resolve response field 'version' is read by no in-repo client | HIGH | MEDIUM | NONE | api-worker | KEEP |
| [DEAD-043](findings/DEAD-043.md) | Icon ?version= branch has no in-repo caller | HIGH | MEDIUM | NONE | api-worker | KEEP |
| [DEAD-044](findings/DEAD-044.md) | Exported unit-test seams in the chara resolver | HIGH | LOW | NONE | api-worker | KEEP |
| [DEAD-045](findings/DEAD-045.md) | chara-concurrency.test.mjs is run by no CI job or turbo task (manual workerd check, deliberately kept) | HIGH | NONE | NONE | api-worker | KEEP |
| [DEAD-046](findings/DEAD-046.md) | facewear-unlocks.json maps 12 Glasses rows (709-720) to unlock item 52447, which has no acquisition line | HIGH | LOW | NONE | api-worker | KEEP |
| [DEAD-047](findings/DEAD-047.md) | acquisition.meta.json provenance keys read by no code | HIGH | NONE | NONE | api-worker | KEEP |

## Quick wins

HIGH confidence, blast NONE or LOW, REMOVE — safe to do first:

- [DEAD-001](findings/DEAD-001.md) — Comments and docs describing behavior that no longer exists (web-app) — ~5 lines (~5 lines)
- [DEAD-002](findings/DEAD-002.md) — Stale comments and docs around the xivcharakit facade still describe the legacy parser as the live path, and two @entrypoint tags are inert
- [DEAD-003](findings/DEAD-003.md) — Seven stale @public tags on core barrel chara-facade exports that now have production in-repo consumers
- [DEAD-004](findings/DEAD-004.md) — Stale api-worker chara docs/comments: icon caching, resolve consumer, /api/version, misplaced OPT-004 note — ~4 lines (~4 lines)
- [DEAD-006](findings/DEAD-006.md) — The ISSUE_KEY entry for EYE_PAIRING_UNCONFIRMED cannot be reached and duplicates the default — ~2 lines (~2 lines)
- [DEAD-007](findings/DEAD-007.md) — The facewear-era `dye.itemID <= 0` guard in the swatch matching loops is always false — ~1 lines (~1 lines)
- [DEAD-014](findings/DEAD-014.md) — downloadCharaAttachment text-only shape and adapters' fileText pass-through are dead in production — ~15 lines (~15 lines)
- [DEAD-015](findings/DEAD-015.md) — Unreachable ?? 'card.slotSkin' fallback for the slot label
- [DEAD-016](findings/DEAD-016.md) — Redundant export on module-internal getCharacterColors and CharaFileSource
- [DEAD-017](findings/DEAD-017.md) — Test fixture module __fixtures__/chara-fixtures ships in the published bot-logic tarball
- [DEAD-018](findings/DEAD-018.md) — Redundant status === 503 test in XivapiClient.get
- [DEAD-019](findings/DEAD-019.md) — types.ts re-exports CharaTwinRules, which nothing imports through it

## KEEP register

Every row has a concrete revisit trigger; nothing here is scheduled.

| ID | Item | Revisit trigger |
|---|---|---|
| [DEAD-025](findings/DEAD-025.md) | Chara row cache's stale-while-revalidate window never revalidates | The next change to CHARA_CACHE_CONFIG or CHARA_ROW_SHAPE_VERSION, a maintainer decision to add real background revalidation or a strict 7-day TTL, or a report of stale item names that outlived a game patch. |
| [DEAD-026](findings/DEAD-026.md) | Eight api-worker chara exports referenced only in their own file (live symbols, redundant export keyword) | Revisit if knip.jsonc ignoreExportsUsedInFile is changed to false, or if knip starts flagging these exports in api-worker's lint:dead. At that point, un-export only the four constants. |
| [DEAD-027](findings/DEAD-027.md) | ImportedCharaCharacter.extendedValid / extendedDeclared are filled but no production code reads them (KEEP: p… | Release planning for @xivdyetools/core 6.0.0 together with @xivdyetools/bot-logic 5.0.0 (e.g. the major that removes the legacy chara-parser/chara-resolver). Remove both fields in that release pair. Optionally add @deprecated in the next core/bot-logic minor. |
| [DEAD-028](findings/DEAD-028.md) | Provider arm of resolveCharaForTools (isPaletteProvider) is test-only in-repo but is published, documented 5.… | Revisit when core 6.0.0 (the next MAJOR) is being planned. Narrow it then only if git grep -n -w resolveCharaForTools still shows every non-test caller passing a CharacterColorService. Optionally, tag it @deprecated in a 5.x MINOR first, pointing provider use… |
| [DEAD-029](findings/DEAD-029.md) | Barrel re-export of resolveCharaWithProvider duplicates the ./chara subpath; in-repo barrel use is test-only | When packages/core/package.json is bumped to 6.0.0 (the next core MAJOR release prep): decide then whether the barrel keeps resolveCharaWithProvider, or earlier mark it @deprecated in a MINOR if the subpath is declared the sole supported route. |
| [DEAD-030](findings/DEAD-030.md) | CHARA_WEAPON_SLOTS exported @public with no consumer outside its own module | Revisit when the core 6.0.0 major-bump PR is opened (packages/core/package.json version goes to 6.x). Fold this into that PR's removals of @public exports that have no consumer. |
| [DEAD-031](findings/DEAD-031.md) | FIXED_KEYS.noItem entry cannot be reached | A core release changes the CharaPieceProblem union (chara-game-rules.ts:132), OR git grep "push('noItem')" packages/core/src/services/chara returns a hit. |
| [DEAD-032](findings/DEAD-032.md) | KEEP shader tables + chara-shader-colors.ts (live via palette bridge; deliberate duplicate of xivcharakit cor… | Re-audit when either of two conditions holds. (a) An xivcharakit release after 0.1.0-beta.4 exports a lazy, shader-only PaletteProvider entry, and switching core to it keeps web-app `run build:check` within budget. (b) A core MAJOR removes both createCharaPal… |
| [DEAD-033](findings/DEAD-033.md) | KEEP CharacterColorService, interface sheets, build-character-colors script, .chara fixtures, chara-models he… | Fixtures: revisit when the core 6.0.0 release that removes parseCharaFile/resolveCharaColors (core-legacy-03) lands AND `git ls-files \| xargs grep -l 'fixtures/.*\.chara\\|lalafell-dunesfolk'` returns no test in packages/core, packages/bot-logic, apps/web-ap… |
| [DEAD-034](findings/DEAD-034.md) | matchHexFor's interpretation==='inactive' arm is unreachable under xivcharakit 0.1.0-beta.4 | When core's exact xivcharakit pin (packages/core/package.json:78) moves off 0.1.0-beta.4: re-grep dist/appearance.js for "inactive". Simplify only if that release's appearance/types.d.ts encodes the invariant, for example as a discriminated union where interp… |
| [DEAD-035](findings/DEAD-035.md) | Palette provider guards (table, palette type, shader lipsLight/facePaint) the library never trips | Revisit :109/:110 only at a core MAJOR that removes createCharaPaletteProvider from the published barrel (drops the @public export at index.ts:278), and only if every remaining caller validates the request first (web-app parsePaletteRequestMessage does). Keep… |
| [DEAD-036](findings/DEAD-036.md) | Exports used in their own file that exist only as test seams (web-app-09): KEEP | Re-audit a symbol when symrefs.sh apps/web-app <sym> shows prod<=1 (its in-file caller was deleted, so the body is dead) or tests=0 (no test imports it, so the export can be dropped), or when knip.jsonc ignoreExportsUsedInFile is set to false. |
| [DEAD-037](findings/DEAD-037.md) | config-controller scrub of the retired swatch.fileProvided key | Remove it when either of these becomes true: (a) loadFromStorage passes stored values through sanitizeConfigPartial, so undeclared keys are dropped as importConfigs already does at :426, which makes the delete redundant; or (b) CONFIG_STORAGE_PREFIX changes f… |
| [DEAD-038](findings/DEAD-038.md) | Published SwatchInput/GlamourInput.fileText and the NO_INPUT guard: KEEP until bot-logic 5.0.0 | When packages/bot-logic/package.json is bumped to 5.0.0, the first MAJOR after 4.11.0 (for example, the release that removes SwatchCharacter under bot-discord-01): make fileBytes required and drop fileText and NO_INPUT in that same release. |
| [DEAD-039](findings/DEAD-039.md) | familySize ?? twins.length fallback is dead for this repo's api-worker | The release of @xivdyetools/bot-logic 5.0.0 (bundle it with the bot-discord-08 fileText removal), or GlamourResolvedItem losing its @public tag or export in index.ts:117. Whichever comes first, make familySize required and drop the `?? twins.length` fallback. |
| [DEAD-040](findings/DEAD-040.md) | Unreachable guard for a 304 with no retained ETag in loadIcon | Revisit when any of these happens: apps/api-worker/src/chara/xivapi.ts get() stops refusing a 304 without allowNotModified (lines 395-397); fetchIcon gets a caller other than icons.ts:25; or fetchIcon's allowNotModified is no longer Boolean(ifNoneMatch). If o… |
| [DEAD-041](findings/DEAD-041.md) | Empty-lookup guards in searchItems and loadRows are reached only by tests | Re-check when either of these happens. (1) router.ts drops its `misses.length > 0` check at line 225: the loadRows guard then becomes the live path and must stay. (2) A caller other than lookup-loader.ts:55 starts calling searchItems, or one other than router… |
| [DEAD-042](findings/DEAD-042.md) | Resolve response field 'version' is read by no in-repo client | Revisit when either of these happens. (a) api-worker adds a /v2/chara/resolve route, or meta.apiVersion moves past 'v1' (apps/api-worker/src/index.ts and docs/reference/chara.md). (b) chara.md's field table marks `version` as deprecated. Until then, removing… |
| [DEAD-043](findings/DEAD-043.md) | Icon ?version= branch has no in-repo caller | Revisit in either of two cases. (1) web-app's charaIconUrl (chara-resolve-service.ts:124) starts appending the resolve result's version: the branch is then live in-repo, so close the item. (2) The api-worker CHANGELOG and docs/reference/chara.md announce a de… |
| [DEAD-044](findings/DEAD-044.md) | Exported unit-test seams in the chara resolver | Re-audit when the CI `pnpm dead-code:check` step (ci.yml:244) reports any of these nine symbols under apps/api-worker/src/chara, or when a PR removes one of the production call sites: router.ts:193, router.ts:216, lookup-loader.ts:56, resolver.ts:135, resolve… |
| [DEAD-045](findings/DEAD-045.md) | chara-concurrency.test.mjs is run by no CI job or turbo task (manual workerd check, deliberately kept) | The next commit that touches apps/api-worker/src/chara/lookup-loader.ts or the POST /resolve handler in apps/api-worker/src/chara/router.ts, or the next wrangler major bump in apps/api-worker/package.json. When that happens, run pnpm --filter xivdyetools-api-… |
| [DEAD-046](findings/DEAD-046.md) | facewear-unlocks.json maps 12 Glasses rows (709-720) to unlock item 52447, which has no acquisition line | acquisition.en.json gains key "52447" (Thick-rimmed Goggles gets a confirmed source) on a build-acquisition.ts run. acquisition.test.ts:38 (known === 720) and :57 (undefined for the 12 variants) then fail, so update those expectations. |
| [DEAD-047](findings/DEAD-047.md) | acquisition.meta.json provenance keys read by no code | Revisit only if a commit to build-acquisition.ts removes the human review pause: its printReview call, or the user-approval step in the 2026-09-27 plan. Also revisit if regeneration moves to an unattended CI job that nobody reads. Either change would be visib… |

## Dependency cleanup

None. The xivcharakit adoption made no dependency unused: the `package.json` diff since the adoption adds only `xivcharakit` and the `./chara` exports row, knip's unused-dependency section is empty in all six workspaces, and `pnpm-workspace.yaml` carries no xivcharakit override or build-script entry. `@xivdyetools/core` builds with `tsc`, so it has no tsup entries to prune.

## Totals

- Removable: **~4,211 lines** across 24 actionable findings; **3 test files** go outright (`chara-parser.test.ts`, `chara-parser-proto.test.ts`, `chara-resolver.test.ts`) and the `[host]` half of the parity harness (about 1,650 lines) with them.
- Bundle-before: not measured. Nothing is removed by the audit, the web inspection worker does not carry the legacy parser (it is tree-shaken out), and the web-app bundle budget is re-run in the cleanup sprint that touches it ([DEAD-013](findings/DEAD-013.md)).
- Coverage ratchet: removing fully-covered legacy code can move the aggregate coverage numbers; report the effect when the removal lands and never lower web-app's thresholds.

## Positive controls

- **No main-thread parse path remains** in web-app: `git grep` for `parseCharaFile`, `resolveCharaColors` and `resolveCharaForTools` over web-app `src`, `e2e` and `scripts` finds nothing, and the worker imports only `@xivdyetools/core/chara`.
- **The facade is cleanly layered:** `chara-library.ts` has no runtime path to the palette bridge, shader tables or `CharacterColorService`; import-graph tests (`chara-library.test.ts`, `chara-entry.test.ts`) hold that line, and the host palette bridge is pinned equal to xivcharakit's bundled corpus on every request, so the deliberate data duplication is verified.
- **No orphan locale keys** in the dynamic families the gate cannot see: 147 `swatch.*` and 67 `glamour.*` web keys were traced one by one; no key survives from the removed `/swatch color|grid` subcommands in the bot locales.
- **No dead CSS, no skipped / `.only` / todo tests, no snapshots, no commented-out code** in the slice; every e2e selector and every mock is used.
- **No migration code for superseded cache shapes** in api-worker (shape 5 is only a key component), and every class member of `XivapiClient`, `CharaRowCache`, `CharaLookupLoader` and `CharaIconCache` has a production reference.
- **The legacy slot shape is isolated** to one documented adapter (`toLegacySlot` in bot-logic), and the 261-case parity register with written notes makes the removal decision auditable.

## Rejected suspicions

No group was rejected on verification. Two were narrowed: [DEAD-025](findings/DEAD-025.md) (the chara row cache's stale-while-revalidate window) and [DEAD-026](findings/DEAD-026.md) (eight api-worker exports used only in their own file) turned out to be live and are kept; their comment corrections ride [DEAD-004](findings/DEAD-004.md).

## Recommendations

1. **Make deprecation a step of every replacement.** The legacy pair was never marked `@deprecated` and has no `DEPRECATIONS.md` entry; add both in the same change that ships a replacement, so the MAJOR is a scheduled event and not a surprise.
2. **Make `@public` carry a reason.** Seven `@public` tags on facade exports were stale the day their in-repo consumers landed ([DEAD-003](findings/DEAD-003.md)); require a reason after the tag (as `@testonly` and `@entrypoint` already do) and list each `@public` symbol with its first-published version in the gate's output.
3. **Pin the facade's runtime import graph** to exclude `chara-parser` and `chara-resolver` in `chara-entry.test.ts` once [DEAD-020](findings/DEAD-020.md) lands, so the legacy files cannot creep back into the web worker bundle.
4. **Gate the published tarball's file list** (`npm pack --dry-run`) so a test fixture cannot ship again ([DEAD-017](findings/DEAD-017.md)); exclude `__fixtures__/` in `tsconfig.build.json`.
5. **Check that every bundle-budget row matches an emitted chunk** ([DEAD-013](findings/DEAD-013.md)).
6. **Keep the parity harness's library half** as the case-level regression pin for each `xivcharakit` beta bump; drop only the legacy half.
7. **Re-run `symrefs.sh` on the KEEP register** when the 6.0.0 / 5.0.0 pair is planned: five KEEP rows (the `extended*` fields, the provider arm, the barrel duplicate, `CHARA_WEAPON_SLOTS`, `fileText`) resolve in that release.
8. **Re-audit this slice after xivcharakit leaves beta** — its palette provider guards and `inactive` arm are KEEP only because the beta's behavior is not yet frozen ([DEAD-034](findings/DEAD-034.md), [DEAD-035](findings/DEAD-035.md)).

## Limits

Source / configuration audit; read-only. No build, bundle measurement or workerd run was made, and npm consumers of the published `@public` exports are unknowable from the repo (that is exactly why their removal is MAJOR). Reviewers read the largest files (`glamour-block.ts`, the 8,186-line parity harness) by structure and targeted sections, not line by line; the verifiers re-ran the reference counts for every removal candidate. `knip --production` (the test-only tier) was not run for web-app. The other five locale files rely on the existing key-parity gate.

## Remediation status

| ID | Status | Commit |
|---|---|---|
| DEAD-001 | OPEN | — |
| DEAD-002 | OPEN — source prepared; release pending | [A-CORE evidence](evidence/remediation-core-2026-10-27.md) |
| DEAD-003 | OPEN — source prepared; release pending | [A-CORE evidence](evidence/remediation-core-2026-10-27.md) |
| DEAD-004 | OPEN — API docs prepared; release and A-WEB comment cascade pending | [API evidence](../2026-10-26-security/evidence/remediation-api-2026-10-27.md) |
| DEAD-005 | OPEN — source prepared; release pending | [A-BOT-LOGIC evidence](../2026-10-26-security/evidence/remediation-bot-logic-2026-10-27.md) |
| DEAD-006 | OPEN | — |
| DEAD-007 | OPEN | — |
| DEAD-008 | OPEN | — |
| DEAD-009 | OPEN | — |
| DEAD-010 | OPEN | — |
| DEAD-011 | OPEN | — |
| DEAD-012 | OPEN | — |
| DEAD-013 | OPEN | — |
| DEAD-014 | OPEN | — |
| DEAD-015 | OPEN — source prepared; release pending | [A-BOT-LOGIC evidence](../2026-10-26-security/evidence/remediation-bot-logic-2026-10-27.md) |
| DEAD-016 | OPEN — source prepared; release pending | [A-BOT-LOGIC evidence](../2026-10-26-security/evidence/remediation-bot-logic-2026-10-27.md) |
| DEAD-017 | OPEN — source prepared; release pending | [A-BOT-LOGIC evidence](../2026-10-26-security/evidence/remediation-bot-logic-2026-10-27.md) |
| DEAD-018 | OPEN — redundant disjunct removed in source; release pending | [API evidence](../2026-10-26-security/evidence/remediation-api-2026-10-27.md) |
| DEAD-019 | OPEN — internal re-export removed in source; release pending | [API evidence](../2026-10-26-security/evidence/remediation-api-2026-10-27.md) |
| DEAD-020 | OPEN — source prepared; release pending | [A-CORE evidence](evidence/remediation-core-2026-10-27.md) |
| DEAD-021 | OPEN — source prepared; release pending | [A-CORE evidence](evidence/remediation-core-2026-10-27.md) |
| DEAD-022 | OPEN — source prepared; release pending | [A-BOT-LOGIC evidence](../2026-10-26-security/evidence/remediation-bot-logic-2026-10-27.md) |
| DEAD-023 | OPEN — 4.12.0 deprecation phase prepared; publication and 5.0.0 removal pending | [A-BOT-LOGIC evidence](../2026-10-26-security/evidence/remediation-bot-logic-2026-10-27.md) |
| DEAD-024 | OPEN — phase 1 prepared; core 6 removal gated | [A-CORE evidence](evidence/remediation-core-2026-10-27.md) |
| DEAD-025 | KEEP (no action) | — |
| DEAD-026 | KEEP (no action) | — |
| DEAD-027 | KEEP (no action) | — |
| DEAD-028 | KEEP (no action) | — |
| DEAD-029 | KEEP (no action) | — |
| DEAD-030 | KEEP (no action) | — |
| DEAD-031 | KEEP (no action) | — |
| DEAD-032 | KEEP (no action) | — |
| DEAD-033 | KEEP (no action) | — |
| DEAD-034 | KEEP (no action) | — |
| DEAD-035 | KEEP (no action) | — |
| DEAD-036 | KEEP (no action) | — |
| DEAD-037 | KEEP (no action) | — |
| DEAD-038 | KEEP (no action) | — |
| DEAD-039 | KEEP (no action) | — |
| DEAD-040 | KEEP (no action) | — |
| DEAD-041 | KEEP (no action) | — |
| DEAD-042 | KEEP (no action) | — |
| DEAD-043 | KEEP (no action) | — |
| DEAD-044 | KEEP (no action) | — |
| DEAD-045 | KEEP (no action) | — |
| DEAD-046 | KEEP (no action) | — |
| DEAD-047 | KEEP (no action) | — |

## Next steps

Follow [CLEANUP_PLAN.md](CLEANUP_PLAN.md), which also lists where its sprints meet the security audit's ([REMEDIATION_PLAN.md](../2026-10-26-security/REMEDIATION_PLAN.md)). Nothing is deleted before the maintainer's explicit yes at the §8 gate.

**§8 decisions (2026-10-26):** the legacy pair leaves by deprecation (core 5.16.0) and then the core 6.0.0 + bot-logic 5.0.0 MAJOR pair once beta acceptance closes; the parity harness drops its legacy `[host]` half and keeps the `[library]` half; this folder goes out as a stacked docs-only PR. **Remediation has not started.**
