# Review: pkg-botlogic-svg-types (bot-logic 4.11.0, svg 4.4.0, types 3.3.0, test-utils 3.0.0)

Read-only review, 2026-10-26, HEAD 13c386e5. No routes in these packages, so no authz matrix; they are libraries consumed by discord-worker, moderation-worker, stoat-worker, og-worker and presets-api.

## Module table

| Module | Trust boundary / input | Result |
|---|---|---|
| `bot-logic/src/discord-markdown.ts` | `sanitizeEmbedText` / `escapeDiscordMarkdown` / `ALLOWED_MENTIONS_NONE`: user text into embeds | Two LOW gaps (candidates 01, 02) |
| `bot-logic/src/moderators.ts` | `parseModeratorIds` / `isModeratorId`: split on `[\s,]+`, snowflake filter, fail-closed on empty | Sound |
| `bot-logic/src/input-resolution.ts`, `css-colors.ts` | dye id / hex / name / CSS name from slash options | Sound: ids 1-5 digits, six digits = hex, `Object.hasOwn` on CSS table, anchored hex regex |
| `bot-logic/src/i18n/translator.ts`, `locale-resolution.ts`, `localization.ts` | locale code, KV prefs blob, translation keys | Sound: `isValidLocale` allowlist, `Object.hasOwn` on Discord-locale map, malformed blob not logged, no caller builds a key from user text inside bot-logic |
| `bot-logic/src/commands/{accessibility,comparison,contrast,dye-info,gradient,harmony,mixer}.ts` | resolved colours/dyes; step and companion counts | Logs use `failureKind` (class + code, never message); `companionCount` clamped 1-3; gradient `stepCount` not clamped in bot-logic but Discord schema enforces 2-12 (`apps/discord-worker/src/commands/schemas.ts:432-433`) and stoat parser has no steps path |
| `bot-logic/src/commands/chara-identity.ts`, `failure-kind.ts` | `.chara` producer string, errors | `producerToken` is an allowlist (BRIO / KTISIS / ANAMNESIS) so `TypeName` never prints; `failureKind` drops messages |
| `svg/src/base.ts`, `frame.ts` (cardText, cardShell, appIcon, glyph inject) | every text node and attribute | `escapeXml` strips XML-illegal chars and escapes `& < > " '`; used on all text content and string attributes; numeric attrs are typed numbers; `FONT_STACKS` is a constant |
| `svg/src/{swatch,glamour,harmony,gradient,mixer,palette-grid,random-dyes-grid,nearest-sheet,budget-ledger,preset-swatch,a11y,comparison,contrast,dye-info}-card.ts` | dye names, labels, hex | All text through `cardText`/`text()` (escaped); `generator-hygiene.test.ts` asserts every `fill=`/`stroke=` interpolation is escaped; no `<image>`, `<use>`, `href`, `style=`, `<script>`, `<foreignObject>`, `data:` in any generator |
| `svg/src/icons/tool-icons.ts` | `ink`/`accent` colours | Escaped (`renderGlyph`, lines 295-305); `weight` is a number |
| `types/src/preset/review-custom-id.ts` | moderation `custom_id` | Strict grammar: 100-char cap, longest-prefix first, UUID v4 regex, decimal revision without leading zeros, `isSafeInteger`, status allowlist via frozen set; legacy ids parse to `binding: null` |
| `types/src/auth/discord-snowflake.ts`, `color/branded.ts` | ids, hex | Anchored regexes; `createHexColor` error text quotes the input (callers use `failureKind`) |
| `test-utils` | private test mocks | `"private": true`; only a `devDependency` of api-worker, discord-worker, moderation-worker, oauth, presets-api, svg; no non-test import found by `git grep` over `apps/*/src` and `packages/*/src`; no literal secrets |

## Positive controls

- SVG hygiene is enforced by a source-level test, not only by output tests (`packages/svg/src/generator-hygiene.test.ts`).
- Loop and size bounds: ROW_CAP slices in gradient / palette-grid / random-dyes-grid (`gradient.ts:120`, `palette-grid.ts:137`, `random-dyes-grid.ts:77`); `cardShell` clamps height to `CARD_MAX_HEIGHT` (`frame.ts:213`); `fitText` slices by code point.
- `sanitizeEmbedText` runs the invisible-char strip before `defuseMentions`, so `@​everyone` still gets defused; it caps by code point and avoids a dangling backslash.
- Review `custom_id` parser rejects anything outside the grammar; a handler must not act on `binding: null`.
- `failureKind` keeps error messages out of every bot-logic log line (BUG-125); `locale-resolution` never logs the prefs blob or parse error.
- No bot-logic code path puts a nickname, file name or `TypeName` into a card or log (`producerToken` allowlist).

## Rejected items

- `harmony.ts:190` logs `input.wheel`: the Discord handler normalises with `parseColorWheelId` first (`apps/discord-worker/src/handlers/commands/harmony.ts:50-56`) and the option is choice-restricted, so the log string is always an enum member; stoat has no wheel path.
- Translator `getNestedValue` with `__proto__` keys: read-only, non-string results return the key, no bot-logic caller builds keys from user text.
- `executeGradient` unclamped `stepCount`: bounded by Discord's `min_value/max_value` on a signed interaction; no other caller.
- `renderGlyph` `.replaceAll('INK', escapeXml(ink))` `$&` replacement-pattern quirk: `ink` is always a theme constant.
- `createHexColor` allowing 3-digit input: output is normalised and every SVG use is escaped anyway.
- `budget-ledger` row count unbounded in the generator: caller packs against `CARD_MAX_HEIGHT`, shell clamps height; layout only.

## FILES COVERED

About 100 tracked files read or grepped: packages/bot-logic/src (29 non-test source files, directories src, src/commands, src/commands/__fixtures__, src/i18n), packages/svg/src (19 non-test, plus icons/), packages/types/src (32 non-test, auth/color/preset/error/character), packages/test-utils (src, package.json). Test files opened only where they pin a control (generator-hygiene). Locale JSON not read value by value.
