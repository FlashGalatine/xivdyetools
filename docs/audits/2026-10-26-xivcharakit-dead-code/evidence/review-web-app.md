# Dead-code review: web-app `.chara` slice (key `web-app`)

HEAD 88189ee8, `xivdyetools-web-app@5.16.0` (an app, so every removal is semver NONE). This was a
read-only review. Reference counts use tracked files only (`symrefs.sh`, `members.py`, `git grep`).
Scratch scanner: `.../scratchpad/locale_scan.py` (outside the repo).

## Module map

| Module | Role | Production importers |
|---|---|---|
| services/chara-file-loader.ts | name/size gate, capped read, telemetry, session hand-off | chara-file-card.ts |
| services/chara-inspection-service.ts | one worker per call, palette answers, deadline, attachDyes | chara-file-loader.ts, chara-file-card.ts (prefetch) |
| services/chara-inspection-protocol.ts | message shapes + allowlist validators | service, worker |
| workers/chara-inspection.worker.ts | `@entrypoint` (new Worker URL) | none by design; the test mock `chara-inspection-inline.ts` imports `handleInspectRequest` |
| services/chara-resolve-service.ts | POST /v1/chara/resolve, icon URLs, session cache | glamour-block.ts, item-links-menu.ts, glamour-list-actions.ts, glamour-twin-picker.ts, budget-tool.ts (`itemNameFor`) |
| services/chara-session-service.ts | the loaded file in memory | 9 prod files (incl. config-controller, config-sidebar) |
| components/chara-file-card.ts | drop zone / file card | swatch-tool.ts, glamour-tool.ts |
| components/chara-sheet.ts | THIS CHARACTER | swatch-tool.ts (+ `saveCharacterColors`, used by glamour-block) |
| components/chara-ui.ts | shared helpers | file card, sheet, glamour-block, glamour-tool, swatch-tool, budget/mixer (MONO, amber, dyeName) |
| components/glamour-tool.ts | the reader (ToolId glamour) | v4-layout.ts (dynamic import) |
| components/glamour-block.ts | DYES ON THIS GLAMOUR, its own chunk | glamour-tool.ts (dynamic import; the ONLY host) |
| glamour-twin-picker / item-links-menu / glamour-sheet / glamour-list-actions / shared/item-links / shared/glamour-markdown | reader sub-parts | glamour-block (lazy for menu and sheet) |
| scripts/copy-chara-notices.mjs | `@entrypoint` (build script) | the `build` and `copy-chara-notices` package.json scripts |
| public/licenses/xivcharakit.txt | served asset | about-modal.ts:80, e2e/reader-license.spec.ts, smoke-test-pages.js, public/_headers:119 |

## Reference tables

### Exports (symrefs.sh apps/web-app …): every export has prod>0 or an in-file use
Counted only in their own file, with tests as the only outside callers: `validateImportedCharacter` (prod=2, both in
the protocol: definition plus the `parseInspectionResponse` call; tests=78), `handleInspectRequest` (prod=2, worker only;
tests=19, including the inline mock), `garlandToolsUrl`/`teamcraftUrl`/`mirapriUrl`/`lodestoneUrl`/`GLASSES_BLOCK` (prod=2–3, all
in item-links.ts), `glamourMarkdownInput` (prod=3, in glamour-list-actions.ts), `clearCharaResolveCache` (@testonly, already
exempt). knip skips these on purpose: apps/web-app/knip.jsonc sets `ignoreExportsUsedInFile: true`, with the comment "Drop-the-export is churn". The same setting covers the types used only in their own file
(`CharaInspectionWorkerCode`, `CharaResolvedGlasses`, `GlamourBlockCallbacks`, `TwinPickerOptions`, `ItemLinksMenuOptions`,
`ItemLinkTarget`, `ItemLinkEntry`, `LodestoneLinkEntry`, `LODESTONE_REGIONS`, `IMPORTED_SLOT_ORDER`), so they are not filed.

### Class members (members.py)
- GlamourBlock.moveTo: members.py shows unitSrc=1, but `git grep -w moveTo` finds a live call at glamour-tool.ts:109 (`this.block.moveTo(blockContainer, actions)`), so moveTo is LIVE.
- CharaSheet.setSelectedSlot: called at swatch-tool.ts:1457, :2391 and :2494, so it is LIVE.
- GlamourTool renderContent/bindEvents/onMount/onUnmount: BaseComponent lifecycle overrides, so they are LIVE.
- CharaSessionService methods: all used (config-controller.ts:196/201/220, swatch-tool.ts:414/482, and others).
- A loop over every `private` member and module-local function in glamour-block, chara-sheet, chara-file-card, swatch-tool,
  glamour-sheet, glamour-twin-picker, item-links-menu, item-links, glamour-list-actions and chara-ui found no zero-use members.

### Locale keys (the dynamic-prefix families the gate cannot see)
`tSwatch(key)` builds `swatch.${key}` (chara-ui.ts:88), so `analyze-unused-keys.js` rule 2 marks all of `swatch.*` live.
I re-scanned with stricter matching: a key counts only when the full key is quoted, or `tSwatch('<rest>')` is called, or, for
itemLinks, the local `t('<rest>')` of item-links-menu.ts is called. Result: 147 swatch keys and 67 glamour keys. The strict pass left 7 weak hits,
and each one resolved to a live use: charaHint (chara-file-card.ts:108, a ternary), glamourViewPieces/Dyes (glamour-block.ts:666,
a ternary), itemLinks.mirapri/garlandTools/teamcraft/gamerEscape (item-links-menu.ts:53 LINK_LABEL_KEY),
itemLinks.lodestoneRegion.* (item-links-menu.ts:364 over LODESTONE_REGIONS). glamour.fact.* is the
`glamour.fact.${fact.key}` template at glamour-twin-picker.ts:62: core chara-twins.ts:154-182 emits all 8 keys. glamour.sheet.state*
comes from the templates at glamour-sheet.ts:240/282. tools.glamour.shortName comes from v4-app-header.ts:551. **No orphan keys.**

### CSS (shadow-DOM rule)
The slice has no stylesheet rules (`git ls-files 'src/**/*.css' | xargs grep chara|glamour|swatch|twin` matches only `.dye-swatch`).
Two injected `<style>` blocks exist, and each is appended into the component's own container, so it is scoped to whichever root
the component mounts in:
- chara-sheet.ts:59-64 `.chara-slots-grid`: set at :351 and appended at :318.
- glamour-block.ts:227-232 `.chara-equip-grid`: set at :926 and :1257, appended at :362.
Both are live. **No dead CSS.**

### Issue codes and the library's vocabulary
Every code in chara-ui.ts ISSUE_KEY / PALETTE_FAILURE_CODES, and in worker INPUT_REFUSAL_CODES, appears as a literal in
`packages/core/node_modules/xivcharakit/dist/*.js`. The palette names in protocol PALETTE_NAMES equal `PaletteName` in
xivcharakit `dist/palettes/types.d.ts:2`. One entry cannot be reached (WA-04).

## Candidates

### web-app-01: a non-null dye validator that the worker can never use (REMOVE WITH CAUTION, HIGH)
- chara-inspection-protocol.ts:587-669 `readDye` validates a full runtime `Dye` object. It is supported by DYE_HEX (:98-99),
  ImportedDye/RuntimeDyeExtras/RuntimeDye (:103, :106-119), DYE_FIELDS/DYE_KEYS (:270-294), RGB/HSV/LAB_KEYS (:336-338) and
  readNumbers (:431-444), about 140 lines in all.
- Proof that no producer sends a non-null dye:
  - worker.ts:88 calls `resolveCharaWithProvider(inspection, palettes)` with no `dyes` argument.
  - core chara-library.ts:251 sets `dye: dyes?.getByStainId(field.value) ?? null`, so every badge the worker sends has `dye: null`.
  - The worker doc (worker.ts:7-8) and the protocol doc (:14-17, :108-111) say so too.
  - The page then overwrites every dye in attachDyes (service.ts:223-231).
  - The inline mock (src/__tests__/mocks/chara-inspection-inline.ts) runs the same path.
  - This has held since commit 89a9ccbd (2026-10-26, Task 4b), found with `git log -S'dye: null'`.
- The only things that ever pass a non-null dye are tests: protocol.test.ts:131-145 (realDye/draftWithDye) and :837-897, and
  service.test.ts:1187-1220.
- Fix: replace readDye with `value === null ? null : undefined`. This rejects any non-null dye, which is stricter than now: a worker
  that leaks a dye object is defective. Delete the dye tables. Turn service.test.ts:1187-1198 ("well-formed dye … replaced") into a
  rejection test, and drop the forged-dye `it.each` cases.
- Cascade: nothing else imports these private tables. service.ts:263 has a comment ("a malformed dye from the worker still fails")
  that needs rewording. The `DyeService`/`dyeDatabase` imports in protocol.test.ts:15-16 die with realDye.
- Lines removed: about 140 in production and about 105 in tests.

### web-app-02: GlamourBlock code paths for a block with no host (REFACTOR FIRST, MEDIUM)
glamour-block.ts:234-242 makes `onSubmitPalette` and `actionsHost` optional. The else-branches serve a block with no host:
- :571-573 puts Copy list and Save .md into the block header.
- :1774 hides the Submit button.
- :309, :325 and :359 hold conditional clears.

The block's only production host is glamour-tool.ts:146-149, which always passes both. The `actionsHost ?? undefined` fallback there
is set at :79, before syncBlock runs at :113. `symrefs` shows GlamourBlock prod files are only glamour-block, glamour-sheet (a
type) and glamour-tool. The host-less form is a leftover of the Swatch Matcher host, which was removed in 5.13.0 (docs/projects/web-app/tools.md:176).

Tests construct the block without a host: glamour-block.test.ts:184 and :1437, glamour-block-item-links.test.ts:154. Many header assertions
depend on that form. So refactor the tests to pass a host first, then make both callbacks required. About 8 production lines go.

### web-app-03: the facewear-era `dye.itemID <= 0` guard is always false (REMOVE, HIGH)
The guard sits at chara-sheet.ts:163 (bestDye) and swatch-tool.ts:1869 (closestDyeTo), both over `dyeService.getAllDyes()`.
- Every dye has a positive itemID: a python check over packages/core/src/data/dyes.json printed `125 5729 1`. That is 125 dyes,
  minimum itemID 5729 (`legacyItemID` or the stainID fallback), minimum stainID 1.
- Facewear left the database in schema v2 (2026-07-31; core CLAUDE.md: "Code that filters 'real dyes' no longer needs to").
- Keep the guard where it is a market predicate (preset-detail.ts:874, market-board-service.ts:316).
- Removes 1 line and edits 1.

### web-app-04: the EYE_PAIRING_UNCONFIRMED entry cannot be reached and duplicates the default (REMOVE, HIGH)
The entry is at chara-ui.ts:328-329, and its own comment says it is unreachable.
- xivcharakit appearance.js:10 defaults `historicalEyeCorrection: true`. Core passes no `policy` (`git grep policy` in
  chara-library.ts finds only a doc line).
- `pairEyes` returns before it adds UNCONFIRMED whenever the correction is on.
- Even if the code were emitted, the default severity is `"warning"` (chunk-TCBT3LBA.js:31). issueRow (:373) would then map it to the
  same `swatch.issue.unknown`.
- Removes 2 lines.

### web-app-05: `CharaResolveResult.version` is written but never read (REMOVE WITH CAUTION, MEDIUM)
- Declared at resolve-service.ts:89 and in the envelope at :147. Written at :178, :229 and glamour-block.ts:388.
- `git grep -E 'equipment\??\.version|result\??\.version'` over src (excluding tests) has no hits. Tests only build it as
  fixture data (`version: 'test'`, about 10 lines).
- api-worker still sends the field (router.ts:221), so dropping it from the client DTO is safe.

### web-app-06: `CharaResolveUnavailableError.status` and the class's identity are never checked (REMOVE WITH CAUTION, LOW)
- The class is constructed only in resolve-service.ts (prod refs 7, all in that file).
- No production `instanceof` or `.status` read exists: glamour-block.ts:400 and item-links-menu.ts:187 catch every error the same way.
- `.status` is read only at resolve-service.test.ts:92.
- Fix: drop the `status` parameter (3 lines plus 1 test line). Keep the class, since its name shows in item-links-menu's warn log.

### web-app-07: comments and docs that describe behavior that is gone (REMOVE (rewrite), HIGH)
- swatch-tool.ts:1103 says "(Constructed further down, once the glamour container exists.)". Swatch has no glamour container
  since 5.13.0. :1109-1112 is a layout comment orphaned above `this.mountChara`.
- glamour-block.ts:302-304 says moveTo serves "a language switch rebuilds the Swatch Matcher's panel". The host is now the Glamour Reader (glamour-tool.ts:109).
- glamour-block.ts:244-247 is an orphaned class JSDoc that sits above the PICKS doc.
- chara-resolve-service.ts:3 says "(Swatch Matcher 11a/11c …)". apps/web-app/CLAUDE.md:136 says "(Swatch 11a/11c)".
- chara-inspection-protocol.ts:87-90 and protocol.test.ts:393-394 claim the 12/24 caps are never reached because "the uniqueness
  check rejects either first". That is false: readArray (:376-379) checks the length before the uniqueness loop, so the cap
  rejects the 13-model and 25-channel cases.
- chara-file-card.ts:10-11 says "nothing uploaded" without the `sendsGearIds` exception it documents at :59-66.

### web-app-08: swatch-tool copies MONO and SANS from chara-ui (REFACTOR, HIGH)
- swatch-tool.ts:259 `const MONO = 'var(--font-mono)'` and :279 `const SANS = 'var(--font-display)'` have the same values as the exports at chara-ui.ts:25/27.
- The file already imports from chara-ui (:64).
- Fix: import the two names instead. Removes 3 lines.

### KEEP

| Item | Why | Revisit when |
|---|---|---|
| Test seams: `validateImportedCharacter`, `handleInspectRequest` (inline mock), item-links URL builders, `glamourMarkdownInput`, `GLASSES_BLOCK` | Each is used in production inside its file; exporting it lets tests reach it directly (knip `ignoreExportsUsedInFile`) | A refactor makes one of them file-private |
| config-controller.ts:478-484 `swatch.fileProvided` scrub (tested at config-controller.test.ts:139-151) | Persisted legacy key from before 5.12.7 | Next config schema bump with a storage version gate |
| copy-chara-notices.mjs:102 `pinnedVersion ?? locateCharaKit()` default | Only copy-chara-notices.test.js:72 relies on it; harmless | The script's API changes |
| Exhaustive-union fallbacks: chara-sheet.ts:155-156, chara-ui.ts:247-248 and :161-162 | Type safety against a new upstream slot | xivcharakit adds a slot |
| `CHARA_PALETTE_REQUEST_CAP` / `isPaletteRequestMessage` pre-check in the worker (:139-142) | Reachable through a library request carrying an unexpected tribe | Never |

## Positives
- No main-thread parse path remains. `git grep parseCharaFile|resolveCharaColors|resolveCharaForTools` over web-app src, e2e and
  scripts has no hits, and the worker imports only `@xivdyetools/core/chara` (worker.ts:24).
- No orphan keys in the swatch.*/glamour.* dynamic families, and no dead CSS. Both injected style blocks are live.
- No skipped, todo or only tests in the slice. Every e2e `data-role` (17) exists in src/components.
- The mocks are used: imported-chara.ts by 6 suites, chara-inspection-inline.ts by setup.ts:59.
- The license asset is served, linked and checked for drift.

## FILES COVERED
These files were read in full:
- src/services/chara-file-loader.ts, chara-inspection-protocol.ts, chara-inspection-service.ts, chara-resolve-service.ts,
  chara-session-service.ts
- src/workers/chara-inspection.worker.ts
- src/components/chara-file-card.ts, chara-ui.ts, glamour-tool.ts
- scripts/copy-chara-notices.mjs
- src/__tests__/mocks/chara-inspection-inline.ts

These files were read in part:
- glamour-block.ts:1-420 and :540-600, :1760-1830
- chara-sheet.ts:1-340
- swatch-tool.ts:100-295, :1095-1460, :1855-1875
- the protocol and service tests

These files were checked by grep only:
- glamour-twin-picker.ts, item-links-menu.ts, glamour-sheet.ts, glamour-list-actions.ts
- shared/item-links.ts, shared/glamour-markdown.ts
- v4/config-sidebar.ts, config-controller.ts
- e2e specs (3), copy-chara-notices.test.js, imported-chara.ts
- locales/en.json, public/licenses/xivcharakit.txt
