# Gap 3 review: DEAD-018 restatement (getSharedColors / getRaceSpecificColors are LIVE)

## Commands run
1. `git grep -n -w -E 'getSharedColors|getRaceSpecificColors' -- apps packages ':!*.test.ts' ':!**/__tests__/**' ':!docs/audits/**'`
   - apps/og-worker/src/services/character-cells.ts:66 `characterColors.getRaceSpecificColors(sheet, race, gender as Gender)`
   - apps/og-worker/src/services/character-cells.ts:68 `characterColors.getSharedColors(sheet as SharedColorCategory)`
   - packages/core/src/services/CharacterColorService.ts:157, :253 (definitions); packages/core/CHANGELOG.md:1107 (doc)
2. `sed -n 50,72p apps/og-worker/src/services/character-cells.ts`: both calls sit inside exported `resolveCellHex` (line 57); `characterColors = new CharacterColorService()` at line 29, imported from `@xivdyetools/core` (line 18).
3. `git grep -n -E 'resolveCellHex|character-cells' -- apps/og-worker/src ':!*.test.ts'`: sole production importer og-data-generator.ts:26; call at og-data-generator.ts:863.
4. `sed -n 835,866p apps/og-worker/src/og-data-generator.ts`: the call is inside `case 'swatch':` of the OG data switch, fed by `?slot=`/`?sheet=`, `race`, `gender` query params. Reachable on every Swatch share unfurl, so a real production path.
5. `git grep -n -w -E 'getAvailableLocales|hexToRyb|rybToHex' -- apps packages` (non-test): only core definitions (LocalizationService.ts:586 instance, :593 static; ColorService.ts:676, :686) plus docs/CHANGELOG/README mentions. No non-test callers: DEAD-018 still applies to these.
6. Read review-core.md "Prior KEEP register" (line 52): it claims "getSharedColors/getRaceSpecificColors still have 0 non-test callers". Contradicted by commands 1-4.

## Candidates
None. This is a correction to the KEEP register, not a new dead-code finding.

## Corrected DEAD-018
DEAD-018 = `LocalizationService.getAvailableLocales` (instance, LocalizationService.ts:586, and static, :593) + `ColorService.hexToRyb` / `rybToHex` (ColorService.ts:676, :686). Trigger "next core major": not met (core 5.8.0, no 6.0 in any merged PR).
`getSharedColors` and `getRaceSpecificColors` are DROPPED from DEAD-018 as live (og-worker character-cells.ts:66,68 via og-data-generator.ts:863). The review-core.md line 52 text is wrong on this point; the core group's keepTriggers entry should be restated accordingly. (Note: review-core.md line 11 also lists `interpolateHue` as a @public ColorService member under DEAD-018; not rechecked here.)

## Rejected
- getSharedColors / getRaceSpecificColors as DEAD-018 members or dead exports: live production callers (above).
