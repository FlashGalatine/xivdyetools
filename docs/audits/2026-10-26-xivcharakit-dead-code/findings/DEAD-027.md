# DEAD-027: ImportedCharaCharacter.extendedValid / extendedDeclared are filled but no production code reads them (KEEP: published type contract)
**Confidence:** HIGH · **Blast radius:** MEDIUM · **Deploy unit:** core + bot-logic (+ web-app follow-on) · **Semver:** MAJOR · **Category:** Legacy
**Calibration:** Blast HIGH->MEDIUM: these are fields on a published type, which the rubric grades as MEDIUM, not a published runtime export. The removal stays MAJOR and must land after D03 removes bot-logic's read at swatch.ts:369-372.

## Location
- `packages/core/src/services/chara/chara-library.ts:270-271`
- `packages/core/src/services/chara/chara-library-types.ts:43 (inherits via Omit<ResolvedCharaCharacter,'slots'>)`
- `packages/core/src/services/chara/chara-resolver.ts:114-115,441-442`

## Evidence
- git grep -e extendedValid -e extendedDeclared (non-test): only producers/pass-throughs: chara-library.ts:270-271, resolver.ts:441-442, web-app protocol validates+forwards (731-761), swatch.ts:369-372 spreads into SwatchCharacter; 0 hits in discord/stoat/og/api-worker. Legacy resolver.ts:326,410 reads ParsedChara.extendedValid (parser field, not this one). Types are public: core index.ts:261 ResolvedCharaCharacter, :280 /** @public */ ImportedCharaCharacter; bot-logic index.ts:128 /** @public */ SwatchCharacter = Omit<ResolvedCharaCharacter,'nickname'>. npm view: core 5.15.0, bot-logic 4.11.0 = local; npm pack core 5.15.0 dist chara-resolver.d.ts carries both fields. git log -S: field dates to 3fe098c1 (original parser), long-published.
- The fields are unread in this repo, but they are part of three exported, published types (core ResolvedCharaCharacter and @public ImportedCharaCharacter, plus bot-logic @public SwatchCharacter), and they ship in core 5.15.0 and bot-logic 4.11.0 on npm. Dropping them narrows a published type, which is a MAJOR change for both packages, and npm consumers may read them. KEEP is right. Revisit trigger, made concrete: when core 6.0.0 and bot-logic 5.0.0 are planned (for example the major that retires the legacy chara-parser/resolver), remove both fields in that pair of releases. Until then, a MINOR @deprecated JSDoc tag on the two fields is the optional interim step.
- Still live: No in-repo reader. Published contract: core index.ts:261,280 and bot-logic index.ts:128 (SwatchCharacter, swatch.ts:102), present in the npm core 5.15.0 dist .d.ts

## Fix
- **KEEP** — revisit trigger: Remove extendedValid/extendedDeclared in the core 6.0.0 + bot-logic 5.0.0 release pair, optionally @deprecated in the next MINORs.
- Trigger as verified: Release planning for @xivdyetools/core 6.0.0 together with @xivdyetools/bot-logic 5.0.0 (e.g. the major that removes the legacy chara-parser/chara-resolver). Remove both fields in that release pair. Optionally add @deprecated in the next core/bot-logic minor.
- Cascade: web-app chara-inspection-protocol validator + mocks/imported-chara.ts + protocol test; bot-logic swatch-library.test.ts; core chara-library and parity tests
- Published: core 5.15.0 and bot-logic 4.11.0 are latest on npm, and both expose the fields through public types. Removal is MAJOR for both; a @deprecated tag is MINOR.

## Status
OPEN
