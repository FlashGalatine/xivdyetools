# FINDING-043: Published SwatchResult.character still carries the raw, uploader-controlled TypeName as `producer`
**Severity:** INFO · **Exposure:** INTERNET-AUTH · **Deploy unit:** bot-logic · **Rotation:** NONE · **Policy:** NONE · **CWE:** n/a

## Location
- `packages/bot-logic/src/commands/swatch.ts:102` — Published SwatchResult.character still carries the raw, uploader-controlled TypeName as `producer`

## Evidence
- swatch.ts:102 `export type SwatchCharacter = Omit<ResolvedCharaCharacter, 'nickname'>;` swatch.ts:369-372 `const { issues, slots, ...rest } = character; return { ...rest, slots: ... }` (producer kept in rest). chara-library.ts:265 `producer: boundedLabel(inspection.metadata.TypeName.value)`
- Reach: An uploader puts free text in the .chara `TypeName`. On /swatch, core's chara-library.ts:265 copies it as `producer` (capped at 256 UTF-16 units by boundedLabel, line 146), and toSwatchCharacter (swatch.ts:369) passes it through to `SwatchResult.character`, which is exported `@public` at bot-logic index.ts:127-128. No in-repo code reads `result.character`: apps/discord-worker/src/handlers/commands/swatch.ts:123-155 uses only svgString and embed, and stoat-worker never imports executeSwatch.
- `SwatchCharacter = Omit<ResolvedCharaCharacter,'nickname'>` removes only the nickname. The raw TypeName stays in the published result, while the card itself shows only an allowlisted token (producerToken, chara-identity.ts:81-85, used at swatch.ts:479). Nothing in the repo reads this field, so it has no effect today. TypeName is a producer label, not a character name, so PRIVACY_POLICY.md:74 ("character names... never displayed") is not breached. The risk is limited to a future npm consumer echoing the free text. Preconditions: The finding needs a downstream consumer of the published @xivdyetools/bot-logic API that prints or stores `result.character.producer`; no such consumer exists in the repo.

## Fix
- In toSwatchCharacter, replace `producer` with `producerToken(producer)`, or omit it from SwatchCharacter, so the published result has the same allowlist as the card. This changes a published type, so bump bot-logic's major version (or ship a minor with a changelog note), and add a test that a hand-edited TypeName never shows up in `result.character`.

## Status
OPEN
