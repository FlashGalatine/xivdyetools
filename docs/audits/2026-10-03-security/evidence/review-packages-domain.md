# Review: packages-domain (2026-10-03)

Scope: packages/core (chara parser/resolver/twins/gposers, APIService, DyeSearch, i18n), packages/svg, packages/bot-logic, packages/types, packages/test-utils. Commit 0ab33466. Read-only; one probe script at `evidence/scripts/packages-domain/gposers-text-redos.mjs`.

## 1. Entry points and authz matrix

These are libraries; the entry points are the exported functions that take untrusted input. No routes or bindings of their own.

| Entry | Untrusted input | Who reaches it | Guards before it | Caps |
|---|---|---|---|---|
| `parseCharaFile(text)` core chara-parser.ts:341 | whole `.chara` text | any Discord user via /swatch, /glamour; any web visitor via file drop | callers cap size: discord-worker utils/chara-attachment.ts:17 (1 MiB, `readTextCapped` :98); web-app chara-file-loader.ts:51 (`MAX_USER_FILE_BYTES`). Parser itself has no cap. | gear loop fixed at 12 slots (chara-parser.ts:139,448); JSON engine limits |
| `resolveCharaColors` chara-resolver.ts | parsed indices, tribe/gender (enum-mapped) | same | indices range-checked in `resolveSheet`, `.find` only | none needed |
| `executeSwatch` / `executeGlamour` bot-logic | file text, locale, resolver callback | discord-worker handlers | handler-level `sanitizeEmbedText` on error text (handlers/commands/glamour.ts:167, swatch.ts:128) | ROW_CAP 5, EMBED_BUDGET 4000 (glamour.ts) |
| `generateGlamourCard` and every svg card generator | dye/item names, preset names, hex | bot-logic callers | `escapeXml` at emission (base.ts:29) and `fitText` | height clamped `CARD_MAX_HEIGHT` (frame.ts:214) |
| `APIService.buildApiUrl/buildBatchApiUrl` core APIService.ts:853,872 | dataCenterID, item ids | web-app, workers | `sanitizeDataCenterId` strips non-alphanumerics (:906); ids `Number.isInteger && >= 1`, max 100 (:884-896) | response size caps (:700-715) |
| `resolveColorInput/searchDyesByName/findDyeByName` bot-logic input-resolution.ts | free-text option | any Discord user | anchored regexes only (:40,:50, `isValidHex`) | Discord option max length |
| `sanitizeEmbedText/escapeDiscordMarkdown` discord-markdown.ts:57 | any string | discord-worker | n/a | code-point cap param |
| `Translator.t/tc` i18n/translator.ts | interpolation variables (may hold user text) | all bot commands | single-pass `{\w+}` replace over locale templates | none |
| `resolveUserLocale` i18n/locale-resolution.ts | discordLocale, KV blob | every interaction | `isValidLocale`, own-property mapping (:103-106) | none |
| `gposersGroups` / `text()` chara-gposers.ts:100 | item/dye names; user-typed acquisition notes (web only) | web-app glamour sheet | none | none (see c1) |

Authz: none of these packages authenticate; they are pure. Authentication belongs to each app (other reviewers).

## 2. Positive controls

- Prototype-key safe lookups: `Object.hasOwn` in `mapNamed` / `lookupOptional` (chara-parser.ts, FINDING-027 fix still in place) and `discordLocaleToLocaleCode` (locale-resolution.ts:103-106). JSON `__proto__`/`constructor` keys become own data properties and are only read by fixed key names; `'X' in record` checks use names absent from Object.prototype.
- Parser is allowlist-first: tribe and gender go through tables so only table values leave the parser (chara-parser.ts:355-356); `Base64Image` is never read; gear loop bounded to 12 fixed slots; model lanes coerced by `readModelLane` (`Number.isFinite`, floor); `readIndex` rejects non-finite.
- Nickname never reaches output: `ParsedCharaFile.nickname` doc (chara-parser.ts:108-115); glamour.ts destructures it away (`const { gearModels, gearDyes, glassesId, race, gender, tribe, producer } = character`); swatch.ts removes it at type level (`SwatchCharacter = Omit<..., 'nickname'>` :80, `withoutNickname` :157). `producerToken` (chara-identity.ts) prints only BRIO/KTISIS/ANAMNESIS, never raw `TypeName`. No log or analytics callback in bot-logic receives file fields: the only logger is `TranslatorLogger`, which gets `Missing translation: <key> for locale <loc>` (translator.ts:80). The glamour card header is producer token + tribe + gender symbol only (glamour.ts `charSub`; glamour-card.ts header doc).
- `escapeXml` strips XML-illegal characters then escapes `& < > " '` (base.ts:29-37) and wraps every string and colour that lands in text or an attribute: glamour-card.ts (strip fills, dye chips, `cardText`), base.ts rect/circle/line/text, frame.ts `cardText` :171 and `cardShell` :217-218, dye-info-card.ts:224,239. A grep sweep of `="${...}"` / `>${...}<` over all svg/src found only numeric or internal values unescaped (clip ids, widths). `font-family` is a constant table in `cardText` (frame.ts:153-157); `text()` escapes a caller `fontFamily` (base.ts:188). No `<image>`, `href`, `<style>` or `foreignObject` anywhere in svg/src.
- Discord output: `sanitizeEmbedText` strips invisible/bidi characters first, then defuses `@everyone/@here/<@id>`, escapes markdown and caps by code point without leaving a dangling backslash (discord-markdown.ts:57-76). `plain()` escapes api-worker-supplied names (glamour.ts:313).
- Universalis URL: path built from a stripped DC id and validated integer ids; content-type check, content-length and text-length caps, 100-item batch cap, abort timeout (APIService.ts:691-725,872-896,906).
- Logging: every consumer builds core services with the default `NoOpLogger` (DyeDatabase.ts:77), so the DyeSearch warn lines that echo raw `hex` (DyeSearch.ts:234,319) are silent. No `console.*` calls in non-test source of core/svg/types/test-utils/bot-logic.
- Tarballs (`npm pack --dry-run --json --ignore-scripts`): svg, types, test-utils and core ship only `dist/` plus README/LICENSE/package.json (core also NOTICE); no tests, coverage, env or key files. The 1.3 MB core colour JSON is intended data.
- Translator interpolation is single pass over trusted templates, so user text containing `{x}` is not re-expanded (translator.ts:38-40).
- Dynamic imports use literal paths, no user-controlled module path (chara-shader-colors.ts:36,46; CharacterColorService.ts:175,202).

## 3. Rejected items

- `AppError.toJSON` includes `stack` (types/src/error/app-error.ts): no caller serialises an AppError (git grep `.toJSON()` in apps and packages, non-test: empty).
- Raw `TypeName` kept in `ParsedCharaFile.producer` and `SwatchResult.character.producer` (swatch.ts:80): nothing reads it except `producerToken`; discord-worker never touches `.character` (git grep empty). Hardening only, see handoffs.
- DyeSearch logs user hex at warn (DyeSearch.ts:234,319): NoOp logger in every consumer.
- ReDoS in other regexes: all anchored, bounded or class-only (input-resolution.ts:40,50, `isValidHex`, conversions.ts:316, DyeDatabase.ts:137, utils/index.ts:483,521-534, discord-markdown.ts:49,63).
- `parseFloatColor` `split(',')` on a huge string (chara-parser.ts:237): linear and bounded by the callers' 1 MiB cap.
- Unbounded stain ids and model lanes: finite numbers only (`BigInt(Math.floor(1e300))` is legal); api-worker caps lanes at 0xFFFF per glamour.ts comment; stain ids go through a lookup.
- Parser error messages echo file-controlled values (`unparseable float colour "${value}"`, `unrecognised value "${value}"`, `JSON.stringify(value)`): the FINDING-019 class. discord-worker sanitises (glamour.ts:167, swatch.ts:128) and web-app renders via Lit text binding, so not a defect today; see handoffs.
- `Translator.interpolate` `variables[key]` prototype lookup (translator.ts:39): key comes from locale JSON templates, never user text.
- bot-logic `__fixtures__/chara-fixtures` in the tarball: synthetic corpus samples, Author/Description/Nickname null or absent; no personal data (hygiene only, handoffs).
- svg `num(value, lang, dp)` `lang`: validated `LocaleCode` from callers.
- KV key `prefs:v1:${userId}` in locale-resolution: user id is the policy-listed pseudonymous Discord id.

## 4. Files covered

packages/core/src/services/chara/{chara-parser,chara-resolver,chara-models,chara-game-rules,chara-twins,chara-gposers}.ts; packages/core/src/services/APIService.ts (395-410, 585-735, 850-925); services/dye/DyeSearch.ts (210-240, 315-325); services/dye/DyeDatabase.ts (logger lines); regex / JSON.parse / console greps over packages/core/src; packages/svg/src/base.ts, glamour-card.ts, frame.ts (150-260, 355-395), dye-info-card.ts (excerpt), and grep sweeps of all svg/src; packages/bot-logic/src/{input-resolution,discord-markdown}.ts, commands/{chara-identity,glamour}.ts, commands/swatch.ts (1-100, 150-265), commands/__fixtures__/chara-fixtures.ts, i18n/{translator,locale-resolution}.ts; packages/types/src/{error/app-error,auth/discord-snowflake,dye/facewear}.ts; packages/test-utils/src/auth/jwt.ts (grep); package.json `files` plus `npm pack --dry-run --json` for core, svg, bot-logic, types, test-utils; cross-reads apps/discord-worker/src/handlers/commands/{glamour,swatch}.ts, utils/chara-attachment.ts, apps/web-app/src/services/chara-file-loader.ts, components/glamour-list-actions.ts; evidence pii-sinks, outbound-fetch, potential-secrets filtered to packages/.

## 5. Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | LOCAL | packages/core/src/services/chara/chara-gposers.ts:101 | `text()` uses `/\s*[\r\n]+\s*/g`, quadratic on a long whitespace run with no newline. web-app feeds user-typed acquisition notes through it (glamour-list-actions.ts:185-187), so a pasted note freezes the author's own tab (60,000 spaces took 4.0 s in the probe) and, being kept on the device, again on each reload. Self-inflicted; never reaches the bot or another user. policy NONE, case 0, rotation NONE. |

c1 evidence (chara-gposers.ts:100-102):

    function text(value: string | null | undefined): string {
      return value?.replace(/\s*[\r\n]+\s*/g, ' ').trim() ?? '';
    }

Probe `node evidence/scripts/packages-domain/gposers-text-redos.mjs`: 60000 spaces + "x" took 4017 ms. Fix: `value.split(/[\r\n]+/).map(s => s.trim()).join(' ')`, or cap the note length in the web editor.

No personal-data findings: no field reaches a log, datapoint, KV/D1/R2 write or third-party body from these packages. No CRITICAL, HIGH or MEDIUM items.

## 6. Handoffs

- documentation: the chara-parser error text echoes arbitrary file values; any new consumer (stoat-worker if it ever adds /swatch) must run `sanitizeEmbedText`. Worth a line in packages/bot-logic CLAUDE.md.
- hardening: omit `producer` from `SwatchCharacter` (or carry only `producerToken`) so raw `TypeName` cannot leave bot-logic by accident (swatch.ts:80).
- web-app reviewer: chara-file-loader.ts logs `file.name` and producer via `logger.info` (:98) and the echoed field value via `logger.error` (:81); confirm the web logger is console-only.
- package hygiene: bot-logic tarball ships `dist/commands/__fixtures__/chara-fixtures.*`; exclude it from the build or `files`.
