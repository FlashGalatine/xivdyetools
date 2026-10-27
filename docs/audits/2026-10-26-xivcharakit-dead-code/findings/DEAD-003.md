# DEAD-003: Seven stale @public tags on core barrel chara-facade exports that now have production in-repo consumers
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** core (packages/core; comment-only, no release needed) · **Semver:** NONE · **Category:** Legacy

## Location
- `packages/core/src/index.ts:274,277,278,280,281,282,283 (keep the tag at :275 resolveCharaWithProvider)`

## Evidence
- sed -n 255,300p index.ts: tags at 274,275,277,278,280-283 as filed. Import-source scan over tracked prod files: bot-logic chara-identity.ts:12-13 imports inspectCharaForTools+resolveCharaForTools from '@xivdyetools/core'; web-app chara-inspection-service.ts imports createCharaPaletteProvider+CharaPaletteProvider from barrel; ImportedCharaCharacter/Slot, CharaImportIssue from barrel in 8 web-app files + bot-logic swatch/glamour/chara-identity. resolveCharaWithProvider only via '@xivdyetools/core/chara' (worker.ts) -> keep tag. knip --workspace packages/core --trace-export: createCharaPaletteProvider, CharaPaletteProvider, resolveCharaForTools each show a non-test consumer through index.ts reExport. No typedoc/a…
- Under the repo's convention, @public marks published API that is deliberately kept with no in-repo consumer. These seven were tagged in d9bccc36, when the CHANGELOG said nothing in the apps used the new entry points yet. Today all seven have production consumers through the barrel: bot-logic 4.11.0 and web-app 5.16.0. knip's root graph follows both of them (web-app has its own workspaces key), so lint stays green without the tags. The tags now only hide a future loss of consumers from knip. Removing them changes comments only, with no runtime, type or API effect, so semver is NONE.
- Still live: packages/bot-logic/src/commands/chara-identity.ts:12-13; apps/web-app/src/services/chara-inspection-service.ts (createCharaPaletteProvider, CharaPaletteProvider); apps/web-app/src/components/chara-sheet.ts, chara-ui.ts, glamour-block.ts; packages/bot-logic/src/commands/glamour.ts, swatch.ts (types)

## Fix
- **REMOVE** — In packages/core/src/index.ts delete the leading `/** @public */ ` from the specifiers inspectCharaForTools (:274), resolveCharaForTools (:277), createCharaPaletteProvider (:278), ImportedCharaCharacter, ImportedCharaSlot, CharaImportIssue, CharaPaletteProvider (:280-283); leave :275 resolveCharaWithProvider tagged. No tests or barrels change. Gate: pnpm turbo run build type-check lint test --filter=...@xivdyetools/core && pnpm dead-code:check (knip lint:dead must stay clean).
- Cascade: None. Afterwards knip's includeEntryExports on packages/core reports these exports again if the web-app/bot-logic consumers are ever removed, and that report is the purpose of the change.
- Published: core 5.15.0 is published, but only a JSDoc tag changes. The export surface and the .d.ts types stay the same, so this is not a semver event and can go out with the next core release.

## Status
OPEN — A-CORE source prepared on 2026-10-27: seven stale barrel tags removed with exported names preserved. Independent review passed; merge pending. [Evidence](../evidence/remediation-core-2026-10-27.md).
