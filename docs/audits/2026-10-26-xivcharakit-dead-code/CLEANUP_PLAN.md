# Cleanup Plan — XIVCharaKit-facing code (2026-10-26)
> **Status note (2026-10-31):** statuses and version numbers here are as of main `13c386e5` (audit tree `6da3ff5b`). The October 2026 release-cut queue (#369–#411) carries parts of this plan: core 5.16.0 (#373), bot-logic 4.12.0 (#377), core 6.0.0 and bot-logic 5.0.0 (#391, #394). Treat the versions as provisional. Per-finding status is restated in the audit-docs companion after the queue lands.

**Sources:** [2026-10-26-xivcharakit-dead-code](DEAD_CODE_REPORT.md) — 47 findings · **Status basis:** 47 total — 0 fixed, 24 scheduled, 0 superseded (one conditional, see *Conflicts*), 23 KEEP, 0 need rotation
**Ordering:** 1. one deploy unit per sprint (a package change is one publish sprint, then the consumer deploys) 2. Confidence × Blast first — comments and internal app edits before anything published 3. cascades after their trigger (relocate live code, deprecate, then remove) 4. the MAJOR pair isolated and last

No P0: nothing here is an emergency. **Merging to `main` is the deploy**; bare `wrangler deploy` is production on `oauth` and the live beta on `og-worker` / `discord-worker`. Each sprint ends with the unit gate and, before a merge, `pnpm turbo run build type-check lint test` and `pnpm dead-code:check`. Re-grep every symbol immediately before `git rm`, stage only your own paths, and report the coverage ratchet effect of removing fully-covered code.

## Interlocks with the security remediation plan

This plan accompanies [the security plan](../2026-10-26-security/REMEDIATION_PLAN.md) and keeps its sprint numbers. The shared files and releases:

| This plan | Security plan | Overlap | Rule |
|---|---|---|---|
| Sprint 1 web-app | Sprint 8 web-app | `chara-inspection-protocol.ts` (FINDING-045 vs DEAD-011), `chara-resolve-service.ts` (FINDING-048 vs DEAD-010 / DEAD-009) | Sprint 1 first, or one release |
| Sprint 2 discord-worker | Sprint 5 discord-worker | the swatch / glamour adapters | independent; may share a release; must precede Sprint 7 |
| Sprint 3 api-worker | Sprint 7 api-worker | `xivapi.ts` (FINDING-002 vs DEAD-018) | same PR |
| Sprint 4 core 5.16.0 | Sprint 12 core + svg | the quadratic-sink hardening (FINDING-002) | one core 5.16.0 bump |
| Sprint 5 bot-logic | Sprint 2 bot-logic | sanitizers (FINDING-021, -014) and `SwatchResult.character` (FINDING-043) | one bot-logic MINOR; needs core ^5.16.0, so Security Sprint 2 either waits for core 5.16.0 or ships first and this becomes the next MINOR |
| Sprints 6 and 7 (MAJOR pair) | all | redeploys every production worker | after the security sprints 1–8 have merged |

## Conflicts

| Conflict | Resolution |
|---|---|
| [FINDING-043](../2026-10-26-security/findings/FINDING-043.md) (fix) vs [DEAD-023](findings/DEAD-023.md) (remove the same field) | Removal wins **only if** the bot-logic 5.0.0 MAJOR is approved: FINDING-043 is then superseded by DEAD-023. If not, FINDING-043 stands and ships in Sprint 5. |
| FINDING-045 / -048 (fix) vs DEAD-011 / DEAD-010 (remove) in the same web-app files | Fix stands; sequence per the interlock table. |

## Decisions needed at the §8 gate

| # | Item | Decision |
|---|---|---|
| 1 | Legacy removal path ([DEAD-024](findings/DEAD-024.md), [DEAD-023](findings/DEAD-023.md)) | **DECIDED 2026-10-26:** deprecate now, then cut the core 6.0.0 + bot-logic 5.0.0 pair once beta acceptance closes (Sprints 4–7). This supersedes security FINDING-043. |
| 2 | Parity harness | **DECIDED 2026-10-26:** drop the legacy `[host]` half with the legacy pair; keep the `[library]` half as the regression pin for each xivcharakit beta bump. |
| 3 | `@public` KEEP rows resolved by the MAJOR ([DEAD-027](findings/DEAD-027.md)–[030](findings/DEAD-030.md)) | **Open:** take them in 6.0.0 or keep the published surface. Decide when Sprint 6 is planned. DEAD-038 and DEAD-039 (bot-logic `@public`) are already scheduled in Sprint 7 with bot-logic 5.0.0 and need no separate decision. |
| 4 | Starting work | Nothing starts until the maintainer names a sprint; no removal, version bump, publish or deploy happens before that explicit yes. |

## Sprint 1 — web-app (PATCH): protocol, resolve service and glamour cleanups
Eight small app-level edits plus the budget rows. Merging redeploys the web app and its beta. **Interlock:** the security plan's Sprint 8 edits the same files (`chara-inspection-protocol.ts`, `chara-resolve-service.ts`) — land this sprint first, it shrinks them, or fold both into one web-app release.

| ID | Source | Conf / Blast · Semver · Rec | Item |
|---|---|---|---|
| [DEAD-001](findings/DEAD-001.md) | dead-code | HIGH / NONE · NONE · REMOVE | Comments only: `swatch-tool.ts:1103`, `glamour-block.ts:244-247,302-304`, `chara-resolve-service.ts:3`, the app `CLAUDE.md:136`. |
| [DEAD-006](findings/DEAD-006.md) | dead-code | HIGH / LOW · NONE · REMOVE | Drop the unreachable `ISSUE_KEY` entry for `EYE_PAIRING_UNCONFIRMED` (it falls to the default). |
| [DEAD-007](findings/DEAD-007.md) | dead-code | HIGH / LOW · NONE · REMOVE | Remove the facewear-era `dye.itemID <= 0` guard in the swatch matching loops (always false since schema v2). |
| [DEAD-008](findings/DEAD-008.md) | dead-code | HIGH / LOW · NONE · REFACTOR FIRST | Import `MONO` / `SANS` from `chara-ui` instead of redefining them in `swatch-tool.ts`. |
| [DEAD-009](findings/DEAD-009.md) | dead-code | HIGH / LOW · NONE · REMOVE WITH CAUTION | Remove `CharaResolveUnavailableError.status` (never read, no caller checks the error type). |
| [DEAD-010](findings/DEAD-010.md) | dead-code | HIGH / LOW · NONE · REMOVE WITH CAUTION | Remove `CharaResolveResult.version` (stored, never read). First confirm no planned client use of the XIVAPI version key. |
| [DEAD-011](findings/DEAD-011.md) | dead-code | HIGH / LOW · NONE · REMOVE WITH CAUTION | Remove the non-null dye-object validators from the inspection protocol (~245 lines); keep the worker's dye-null assertions green — they become the guard. |
| [DEAD-012](findings/DEAD-012.md) | dead-code | HIGH / LOW · NONE · REFACTOR FIRST | Make `actionsHost` / `onSubmitPalette` required and delete the missing-host fallbacks in `GlamourBlock`. |
| [DEAD-013](findings/DEAD-013.md) | dead-code | MEDIUM / LOW · NONE · REMOVE WITH CAUTION | Remove the `check-bundle-size.js` rows that match no emitted chunk (vendor-spectral, other vendor, dye selector); re-run `build:check`. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app...` and `pnpm --filter xivdyetools-web-app run build:check` → merge → `deploy-web-app.yml` (beta follows `deploy-web-app-beta.yml`).

## Sprint 2 — discord-worker (PATCH): single attachment shape
Must merge **before** bot-logic 5.0.0 (Sprint 7) so the narrowing of `fileText` finds no live call site. Independent of the security plan's Sprint 5; the two can share a release.

| ID | Source | Conf / Blast · Semver · Rec | Item |
|---|---|---|---|
| [DEAD-014](findings/DEAD-014.md) | dead-code | HIGH / LOW · NONE · REMOVE | Drop `downloadCharaAttachment`'s text-only shape and the adapters' `fileText` pass-through; the adapters assert `fileBytes`. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-discord-worker...` → merge → `deploy-discord-worker.yml` (production). Bare `deploy` is the beta bot.

## Sprint 3 — api-worker (PATCH): docs and two internal edits
The v1 HTTP contract is unchanged (the `version` response field and `?version=` stay — see [DEAD-042](findings/DEAD-042.md), [-043](findings/DEAD-043.md)). **Interlock:** the security plan's Sprint 7 edits `xivapi.ts` (FINDING-002); [DEAD-018](findings/DEAD-018.md) is in `XivapiClient.get` — make it the same PR.

| ID | Source | Conf / Blast · Semver · Rec | Item |
|---|---|---|---|
| [DEAD-004](findings/DEAD-004.md) | dead-code | HIGH / NONE · NONE · REMOVE | Correct the stale docs and comments: icon caching, the resolve "consumer" claim, the `latest`-version claim, the orphaned `POST /resolve` origin comment, and the `cache.ts:20` stale-while-revalidate comment. |
| [DEAD-018](findings/DEAD-018.md) | dead-code | HIGH / LOW · NONE · REMOVE | Delete the redundant `status === 503` test in `XivapiClient.get`. |
| [DEAD-019](findings/DEAD-019.md) | dead-code | HIGH / LOW · NONE · REMOVE | Drop the `CharaTwinRules` re-export from `types.ts`. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-api-worker...` → merge → `deploy-api-worker.yml` (production).

## Sprint 4 — core 5.16.0 (publish): relocations, deprecations, doc and tag cleanup
Everything here is additive or internal, so one MINOR. **Interlock:** the security plan's Sprint 12 (core + svg publish for the quadratic-sink hardening) should ride the same 5.16.0 bump. Verify the barrel is unchanged (`diff` the built `dist/index.d.ts` before and after).

| ID | Source | Conf / Blast · Semver · Rec | Item |
|---|---|---|---|
| [DEAD-020](findings/DEAD-020.md) | dead-code | HIGH / LOW · NONE · REFACTOR FIRST | Move `MAX_CHARA_FILE_BYTES` into `chara-library.ts` (or a tiny `chara-limits.ts`); keep the barrel export unchanged and rewrite the stale doc. |
| [DEAD-021](findings/DEAD-021.md) | dead-code | HIGH / MEDIUM · NONE · REFACTOR FIRST | Relocate the live slot, result and `StainIdLookup` types out of `chara-parser.ts` / `chara-resolver.ts`; type `race` as `Race | null`; same exported names. In the same release add `@deprecated` to the legacy pair and its legacy-only types plus a `DEPRECATIONS.md` entry targeting 6.0.0 (phase 1 of [DEAD-024](findings/DEAD-024.md)). |
| [DEAD-002](findings/DEAD-002.md) | dead-code | HIGH / NONE · NONE · REMOVE | Fix the stale comments, docs and READMEs (shader-table reader claims, "lands in the stacked change", `@entrypoint` docblocks on `chara.ts` and `copy-chara-notices.mjs`, core CLAUDE.md / services.md / overview.md, the npm README and NOTICE credit for xivcharakit). |
| [DEAD-003](findings/DEAD-003.md) | dead-code | HIGH / NONE · NONE · REMOVE | Remove the seven stale `/** @public */` tags on chara-facade barrel exports that now have in-repo consumers. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=@xivdyetools/core...` and `pnpm dead-code:check` → bump `packages/core/package.json` (MINOR) and the CHANGELOG → merge → Actions → "Publish Packages to npm" → `@xivdyetools/core`.

## Sprint 5 — bot-logic (publish): test oracle, internals, tarball hygiene
Depends on core ^5.16.0. **Interlock:** the security plan's Sprint 2 publishes bot-logic for the sanitizer fixes (FINDING-021, -014, -043). Ship one release if the order allows; if Sprint 2 has already shipped 4.12.0 this sprint is 4.13.0 — the version numbers here are provisional. Also add the `@deprecated` tags this release owes the MAJOR pair (`SwatchResult.character`, `SwatchInput` / `GlamourInput.fileText`, `NO_INPUT`, the `familySize` fallback — see [DEAD-023](findings/DEAD-023.md), [DEAD-038](findings/DEAD-038.md), [DEAD-039](findings/DEAD-039.md)).

| ID | Source | Conf / Blast · Semver · Rec | Item |
|---|---|---|---|
| [DEAD-022](findings/DEAD-022.md) | dead-code | HIGH / NONE · NONE · REFACTOR FIRST | Replace the four legacy-oracle sites and the `vi.fn` resolver wrapper in `swatch.test.ts` with facade or literal expectations, so the legacy imports can go in core 6.0. |
| [DEAD-005](findings/DEAD-005.md) | dead-code | HIGH / NONE · NONE · REMOVE WITH CAUTION | Fix the comments and README that describe the legacy parser's errors and value echoes (the README ships to npm). |
| [DEAD-015](findings/DEAD-015.md) | dead-code | HIGH / LOW · NONE · REMOVE | Remove the unreachable `?? 'card.slotSkin'` slot-label fallback. |
| [DEAD-016](findings/DEAD-016.md) | dead-code | HIGH / LOW · NONE · REMOVE | Un-export the module-internal `getCharacterColors` and `CharaFileSource`. |
| [DEAD-017](findings/DEAD-017.md) | dead-code | HIGH / NONE · NONE · REMOVE | Exclude `__fixtures__/` in `tsconfig.build.json` so the test fixture stops shipping in the tarball; add an `npm pack --dry-run` file-list check. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=@xivdyetools/bot-logic...` → bump (MINOR) and the CHANGELOG → merge → Actions → "Publish Packages to npm" → `@xivdyetools/bot-logic`; consumers (discord-worker, moderation-worker, stoat-worker) pick it up at their next deploy.

## Sprint 6 — core 6.0.0 (publish, MAJOR): remove the legacy parser pair — maintainer decision, isolated
The maintainer chose the MAJOR path at the §8 gate on 2026-10-26. **Gated on:** (1) the Sprint 4 release carrying the `@deprecated` tags and the `DEPRECATIONS.md` entry; (2) beta acceptance of web-app 5.16.0 and discord-worker 5.9.0 on the xivcharakit path in production (the core CLAUDE.md:191 revisit trigger); (3) Sprints 2 and 5 merged. Also resolves the `@public`-tagged KEEP rows if chosen: [DEAD-027](findings/DEAD-027.md), [-028](findings/DEAD-028.md), [-029](findings/DEAD-029.md), [-030](findings/DEAD-030.md).

| ID | Source | Conf / Blast · Semver · Rec | Item |
|---|---|---|---|
| [DEAD-024](findings/DEAD-024.md) | dead-code | HIGH / HIGH · MAJOR · REFACTOR FIRST | Phase 2 (core 6.0.0, after the deprecation release has shipped and beta acceptance has closed): delete `parseCharaFile`, `resolveCharaColors`, the legacy-only types, the three legacy test files and the parity harness's `[host]` half; drop the barrel rows; update the three docs. Phase 1 (the `@deprecated` tags) is in Sprint 4. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=@xivdyetools/core...` and `pnpm dead-code:check` → bump to 6.0.0 with a BREAKING CHANGELOG note pointing to `inspectCharaForTools` / `resolveCharaForTools` → merge → Actions → "Publish Packages to npm" → `@xivdyetools/core`.

## Sprint 7 — bot-logic 5.0.0 (publish, MAJOR) and the consumer redeploys
**Gated on** core 6.0.0 being on npm (the same maintainer decision applies). Also makes `fileBytes` required and drops `fileText` / `NO_INPUT` ([DEAD-038](findings/DEAD-038.md)) and makes `familySize` required ([DEAD-039](findings/DEAD-039.md)). Then redeploy the consumers: discord-worker MINOR (adapters on bot-logic 5.0.0), web-app PATCH (the `extended*` fields leave the protocol and mocks if [DEAD-027](findings/DEAD-027.md) is taken), og-worker and api-worker rebuild against core 6.0.0 with no source change — the merge redeploys **all production workers**. **Conflict:** [FINDING-043](../2026-10-26-security/findings/FINDING-043.md) (drop the raw `TypeName` from `SwatchResult.character`) is superseded by [DEAD-023](findings/DEAD-023.md) now that this MAJOR is approved; if the maintainer reverses that, FINDING-043 ships in Sprint 5.

| ID | Source | Conf / Blast · Semver · Rec | Item |
|---|---|---|---|
| [DEAD-023](findings/DEAD-023.md) | dead-code | HIGH / MEDIUM · MAJOR · REFACTOR FIRST | Remove `SwatchResult.character` and its legacy `ResolvedCharaSlot` back-mapping; first ship `@deprecated` tags in a 4.x minor and rewrite the library tests to assert on the card and embed. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=@xivdyetools/bot-logic...` → bump to 5.0.0 → merge → Actions publish `@xivdyetools/bot-logic`; then one merge per consumer deploy workflow (`deploy-discord-worker.yml`, `deploy-web-app.yml`, `deploy-api-worker.yml`, `deploy-og-worker.yml`; `oauth` untouched).

## Superseded findings
| ID | Superseded by | Why |
|---|---|---|
| 2026-10-26-security/FINDING-043 | [DEAD-023](findings/DEAD-023.md) | **Conditional** on the MAJOR pair being approved (see *Conflicts*) |

## KEEP register

Unscheduled; each has a concrete revisit trigger. Six of them (DEAD-027–030, DEAD-038, DEAD-039) resolve in the Sprint 6–7 MAJOR pair if the maintainer takes it.

| ID | Item | Revisit trigger |
|---|---|---|
| [DEAD-025](findings/DEAD-025.md) | Chara row cache's stale-while-revalidate window never revalidates | The next change to CHARA_CACHE_CONFIG or CHARA_ROW_SHAPE_VERSION, a maintainer decision to add real background revalidation or a strict 7-day TTL, or a report of stale item names that outlived a game patch. |
| [DEAD-026](findings/DEAD-026.md) | Eight api-worker chara exports referenced only in their own file (live symbols, redundant export ke… | Revisit if knip.jsonc ignoreExportsUsedInFile is changed to false, or if knip starts flagging these exports in api-worker's lint:dead. At that point, un-export only the four constants. |
| [DEAD-027](findings/DEAD-027.md) | ImportedCharaCharacter.extendedValid / extendedDeclared are filled but no production code reads the… | Release planning for @xivdyetools/core 6.0.0 together with @xivdyetools/bot-logic 5.0.0 (e.g. the major that removes the legacy chara-parser/chara-resolver). Remove both fields in that release pair. Optionally add @deprecated in the next c… |
| [DEAD-028](findings/DEAD-028.md) | Provider arm of resolveCharaForTools (isPaletteProvider) is test-only in-repo but is published, doc… | Revisit when core 6.0.0 (the next MAJOR) is being planned. Narrow it then only if git grep -n -w resolveCharaForTools still shows every non-test caller passing a CharacterColorService. Optionally, tag it @deprecated in a 5.x MINOR first, p… |
| [DEAD-029](findings/DEAD-029.md) | Barrel re-export of resolveCharaWithProvider duplicates the ./chara subpath; in-repo barrel use is… | When packages/core/package.json is bumped to 6.0.0 (the next core MAJOR release prep): decide then whether the barrel keeps resolveCharaWithProvider, or earlier mark it @deprecated in a MINOR if the subpath is declared the sole supported r… |
| [DEAD-030](findings/DEAD-030.md) | CHARA_WEAPON_SLOTS exported @public with no consumer outside its own module | Revisit when the core 6.0.0 major-bump PR is opened (packages/core/package.json version goes to 6.x). Fold this into that PR's removals of @public exports that have no consumer. |
| [DEAD-031](findings/DEAD-031.md) | FIXED_KEYS.noItem entry cannot be reached | A core release changes the CharaPieceProblem union (chara-game-rules.ts:132), OR git grep "push('noItem')" packages/core/src/services/chara returns a hit. |
| [DEAD-032](findings/DEAD-032.md) | KEEP shader tables + chara-shader-colors.ts (live via palette bridge; deliberate duplicate of xivch… | Re-audit when either of two conditions holds. (a) An xivcharakit release after 0.1.0-beta.4 exports a lazy, shader-only PaletteProvider entry, and switching core to it keeps web-app `run build:check` within budget. (b) A core MAJOR removes… |
| [DEAD-033](findings/DEAD-033.md) | KEEP CharacterColorService, interface sheets, build-character-colors script, .chara fixtures, chara… | Fixtures: revisit when the core 6.0.0 release that removes parseCharaFile/resolveCharaColors (core-legacy-03) lands AND `git ls-files \| xargs grep -l 'fixtures/.*\.chara\\|lalafell-dunesfolk'` returns no test in packages/core, packages/bo… |
| [DEAD-034](findings/DEAD-034.md) | matchHexFor's interpretation==='inactive' arm is unreachable under xivcharakit 0.1.0-beta.4 | When core's exact xivcharakit pin (packages/core/package.json:78) moves off 0.1.0-beta.4: re-grep dist/appearance.js for "inactive". Simplify only if that release's appearance/types.d.ts encodes the invariant, for example as a discriminate… |
| [DEAD-035](findings/DEAD-035.md) | Palette provider guards (table, palette type, shader lipsLight/facePaint) the library never trips | Revisit :109/:110 only at a core MAJOR that removes createCharaPaletteProvider from the published barrel (drops the @public export at index.ts:278), and only if every remaining caller validates the request first (web-app parsePaletteReques… |
| [DEAD-036](findings/DEAD-036.md) | Exports used in their own file that exist only as test seams (web-app-09): KEEP | Re-audit a symbol when symrefs.sh apps/web-app <sym> shows prod<=1 (its in-file caller was deleted, so the body is dead) or tests=0 (no test imports it, so the export can be dropped), or when knip.jsonc ignoreExportsUsedInFile is set to fa… |
| [DEAD-037](findings/DEAD-037.md) | config-controller scrub of the retired swatch.fileProvided key | Remove it when either of these becomes true: (a) loadFromStorage passes stored values through sanitizeConfigPartial, so undeclared keys are dropped as importConfigs already does at :426, which makes the delete redundant; or (b) CONFIG_STOR… |
| [DEAD-038](findings/DEAD-038.md) | Published SwatchInput/GlamourInput.fileText and the NO_INPUT guard: KEEP until bot-logic 5.0.0 | When packages/bot-logic/package.json is bumped to 5.0.0, the first MAJOR after 4.11.0 (for example, the release that removes SwatchCharacter under bot-discord-01): make fileBytes required and drop fileText and NO_INPUT in that same release. |
| [DEAD-039](findings/DEAD-039.md) | familySize ?? twins.length fallback is dead for this repo's api-worker | The release of @xivdyetools/bot-logic 5.0.0 (bundle it with the bot-discord-08 fileText removal), or GlamourResolvedItem losing its @public tag or export in index.ts:117. Whichever comes first, make familySize required and drop the `?? twi… |
| [DEAD-040](findings/DEAD-040.md) | Unreachable guard for a 304 with no retained ETag in loadIcon | Revisit when any of these happens: apps/api-worker/src/chara/xivapi.ts get() stops refusing a 304 without allowNotModified (lines 395-397); fetchIcon gets a caller other than icons.ts:25; or fetchIcon's allowNotModified is no longer Boolea… |
| [DEAD-041](findings/DEAD-041.md) | Empty-lookup guards in searchItems and loadRows are reached only by tests | Re-check when either of these happens. (1) router.ts drops its `misses.length > 0` check at line 225: the loadRows guard then becomes the live path and must stay. (2) A caller other than lookup-loader.ts:55 starts calling searchItems, or o… |
| [DEAD-042](findings/DEAD-042.md) | Resolve response field 'version' is read by no in-repo client | Revisit when either of these happens. (a) api-worker adds a /v2/chara/resolve route, or meta.apiVersion moves past 'v1' (apps/api-worker/src/index.ts and docs/reference/chara.md). (b) chara.md's field table marks `version` as deprecated. U… |
| [DEAD-043](findings/DEAD-043.md) | Icon ?version= branch has no in-repo caller | Revisit in either of two cases. (1) web-app's charaIconUrl (chara-resolve-service.ts:124) starts appending the resolve result's version: the branch is then live in-repo, so close the item. (2) The api-worker CHANGELOG and docs/reference/ch… |
| [DEAD-044](findings/DEAD-044.md) | Exported unit-test seams in the chara resolver | Re-audit when the CI `pnpm dead-code:check` step (ci.yml:244) reports any of these nine symbols under apps/api-worker/src/chara, or when a PR removes one of the production call sites: router.ts:193, router.ts:216, lookup-loader.ts:56, reso… |
| [DEAD-045](findings/DEAD-045.md) | chara-concurrency.test.mjs is run by no CI job or turbo task (manual workerd check, deliberately ke… | The next commit that touches apps/api-worker/src/chara/lookup-loader.ts or the POST /resolve handler in apps/api-worker/src/chara/router.ts, or the next wrangler major bump in apps/api-worker/package.json. When that happens, run pnpm --fil… |
| [DEAD-046](findings/DEAD-046.md) | facewear-unlocks.json maps 12 Glasses rows (709-720) to unlock item 52447, which has no acquisition… | acquisition.en.json gains key "52447" (Thick-rimmed Goggles gets a confirmed source) on a build-acquisition.ts run. acquisition.test.ts:38 (known === 720) and :57 (undefined for the 12 variants) then fail, so update those expectations. |
| [DEAD-047](findings/DEAD-047.md) | acquisition.meta.json provenance keys read by no code | Revisit only if a commit to build-acquisition.ts removes the human review pause: its printReview call, or the user-approval step in the 2026-09-27 plan. Also revisit if regeneration moves to an unattended CI job that nobody reads. Either c… |

## Standing guidance
- Verify each finding's evidence against the code before removing — findings are leads, and the verifiers read the tree at `88189ee8`.
- One commit per task (or per sprint when tiny); gate at every sprint boundary (`release-mechanics.md` → Standing verification gate); stage only your own paths with `git commit --only -- <paths>`.
- Route each sprint's agents by role (`.agents/skills/audit-shared/model-routing.md` § *Remediation sprints*): collectors run the gates, workers implement and review, a verifier settles what ships — and **no Fable agent** unless the maintainer says otherwise. Sprints 4–7 (published packages) get a verifier review lens, not only a final verdict.
- "Unused in this repo" is not "unused" for a published export: the version rule applies (`npm view @xivdyetools/<pkg> version` against `package.json`). Deprecate in a MINOR before any MAJOR removal.
- Re-run `evidence/scripts/` (symrefs, the reachability gate, knip) after each sprint; removals unlock new findings.
- Annotate executed sprints in the heading: **✅ COMPLETED <date> <commits>** + **Deploy needs:** — the plan doubles as the tracker.
