# Review: bot-logic slice (packages/bot-logic), deep-dive 2026-10-04

Branch preview/integration-2026-10-04 @80262a2f. All paths are repo-relative. Read-only review; nothing was run except static queries (and a node script over `dyes.json` / `coverage-final.json`).

PR delta for this package: only six locale JSONs, each dropping `commands.stats.options.preferences.description`. That is safe: `apps/discord-worker/src/commands/schemas.ts:581-600` registers `summary`/`overview`/`commands`/`health` only. Every other finding is `MAIN`.

## 1. Map

| Module | Role |
|---|---|
| `src/commands/glamour.ts` (490) | `/glamour`: resolve via injected resolver, twin rules (core `chara-twins`), card + GPOSERS embed list |
| `src/commands/swatch.ts` (406) | `/swatch`: `.chara` colours to nearest dye, slot routing, tail rule |
| `src/commands/chara-identity.ts` | palette service singleton, producer allowlist token, tribe/gender line |
| `src/commands/harmony.ts` | core `generateHarmonySlots`; filters applied to the candidate pool |
| `src/commands/mixer.ts`, `gradient.ts` | blend / interpolate then nearest dye, filters applied after the search (attempt-capped) |
| `src/commands/dye-info.ts` | `/dye info` + `/dye random` |
| `src/commands/comparison.ts`, `contrast.ts`, `accessibility.ts` | pair cards |
| `src/input-resolution.ts` | hex / id / name / CSS resolution, `dyeService` singleton |
| `src/localization.ts` | per-locale `LocalizationService` cache |
| `src/i18n/translator.ts`, `locale-resolution.ts`, `types.ts`, `index.ts` | bot UI translator, KV locale resolution |
| `src/discord-markdown.ts`, `moderators.ts`, `css-colors.ts` | sanitiser, MODERATOR_IDS grammar, 148 CSS names |

Coverage lead (`evidence/coverage-run.txt:5556`): `vitest.config.ts:20-25` sets a 90% global branch threshold. The run measured 88.38% (502 of 568 branches), so **10 more branches** reach 90%. The 66 uncovered branches are `glamour.ts` 25, `swatch.ts` 10, `input-resolution.ts` 9, `harmony.ts` 6, `localization.ts` 4, `dye-info.ts` 3, and the rest 1-2 each (`gradient`, `locale-resolution`, `translator`, `comparison`, `mixer`, `discord-markdown`). The `glamour.ts` gap is where the open product work is. CI never runs `test:coverage`, so nothing caught the drop. See bot-logic-04.

## 2. Candidates

### bot-logic-01 | BUG | MEDIUM | `src/input-resolution.ts:210-214` (with `:39-51`)
- **Claim:** an all-digit 6-character hex typed without `#` is read as a dye id and rejected, not as a colour.
- **Failing input:** `resolveColorInput('000000')`, `'333333'`, `'123456'`, `'808080'`.
  - `isBareNumber` is true, so `parseDyeIdInput` runs. n=0 is outside 1..254 and below 5729, so it returns null. 123456 is at least 5729, so `getDyeById(123456)` returns null.
  - `resolveColorInput` returns `null` before it ever reaches `isValidHex`. Callers report "invalid colour" for black or grey.
- **Contrast:** `resolveDyeInput('123456')` takes the hex path (`:306`) and works, so the two resolvers disagree. Legacy item ids never exceed 5 digits (max 52256), so a 6-digit number can never be an id.
- **Why tests miss it:** `input-resolution.test.ts:149` only tries `'FF0000'` (has letters), and `:387-433` only tests ids 1-254, 5729+ and the gap. Covered by a test: no.
- **Origin:** MAIN (3734fc2d, 2026-08-28).
- **Excerpt:**
  ```ts
  if (isBareNumber(input)) {           // '000000' -> true
    const dye = parseDyeIdInput(input); // 0 / 123456 -> null
    if (!dye || ...) return null;       // never reaches isValidHex
  ```
- **Fix:** in `resolveColorInput`, when the bare number resolves no dye and `isValidHex(input)`, fall through to the hex branch. Alternatively, restrict the id interpretation to <=5 digits.

### bot-logic-02 | BUG | MEDIUM | `src/commands/gradient.ts:273-284`, `src/commands/mixer.ts:74-89`
- **Claim:** filters are applied after the search, with a cap of 10 attempts (gradient) or 20 (mixer). Whenever the nearest N dyes are all excluded, the result is "no match" even though allowed dyes exist.
  - `harmony.ts:210-212` filters the candidate pool instead, so the three commands disagree.
- **Failing input:** `dyeFilters.excludeVendorDyes = true` (`packages/core/src/services/dye/DyeFilter.ts:46`) leaves 40 allowed dyes (85 of 125 are 'Dye Vendor' per `dyes.json`).
  - I scanned every dye hex as a target using plain RGB distance, which only approximates the real ΔE2000/chosen-method ranking.
  - For 40 of 125 targets the 10 nearest are all vendor dyes (so a gradient step gets no dye).
  - For 21 of 125 the 20 nearest are all vendor dyes (so a mixer stop is silently dropped by `.filter((s) => s.dye != null)`).
  - In a gradient the failed step has `distance = 999` (`gradient.ts:288`), which `capGradientRows` ranks as the worst and keeps. The card prints "no match" rows or a "ΔE 999" row. In the mixer the stop vanishes, or the whole command returns `NO_MATCHES`.
- **Why tests miss it:** `fallback-branches.test.ts:162-178` uses `excludeEverything`, and its body is `if (result.ok) { ...; return }`, so it passes whichever way the command behaves. It never exercises a partial filter. Covered: no (`mixer.ts:83` `if (!candidate) break` is uncovered).
- **Origin:** MAIN.
- **Excerpt:**
  ```ts
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = dyeService.findClosestDye(hex, { excludeIds, matchingMethod });
    if (!candidate) break;
    if (candidate.category !== 'Facewear' && (!dyeFilters || !isDyeExcluded(dyeFilters, candidate))) { closestDye = candidate; break; }
    excludeIds.push(candidate.id);
  }
  ```
- **Fix:** `filterDyes(dyeFilters, dyeService.getAllDyes())` once, then a linear nearest over the pool (as harmony does). Add a test with `excludeVendorDyes` on a vendor-dense hex.

### bot-logic-03 | BUG | LOW | `src/commands/glamour.ts:247-260`, `:321-327`, `:450`
- **Claim:** the embed's copy-paste GPOSERS list diverges from the web reader's list.
  - The web builder is `apps/web-app/src/components/glamour-list-actions.ts:65-69, 103-107`. It leaves an item-less piece nameless ("the model key means nothing on a submission form") and writes a bare `Facewear:` whenever `glassesId > 0`, even unresolved.
  - The bot puts the placeholder `Model <label>` (`card.glamourNoItemName`, localised, built from `formatCharaModelLabel`) into `piece.name`. `gposersList` then prints it as the item name.
  - The bot only adds `Facewear` when the resolver also returned `answer.glasses` (`glassesId && answer.glasses`), so a worn but unresolved pair of glasses is missing from the list.
- **Failing input:** a file with an NPC/prop model on Head. The list reads `**Head:** Model e0361 ...` instead of a bare `**Head:**` prompt.
- **Why tests miss it:** `glamour.test.ts` has no item-less piece and no glasses case. Branches `glamour.ts:327` and `:450` are uncovered. Covered: no.
- **Origin:** MAIN (bfd393e7, 2026-09-27).
- **Fix:** keep the placeholder only for the card row. Build `GposersInput` with `name: item ? piece.name : null` (and only when `item` exists). Add `input.Facewear = { name: glasses }` whenever `glassesId > 0`.

### bot-logic-04 | UNTESTED | MEDIUM | `packages/bot-logic/vitest.config.ts:20-25`, `src/commands/glamour.ts` (25 uncovered branches)
- **Claim:** the new `/glamour` command has behaviour with no test, and the package fails its own 90% branch gate unnoticed. CI never runs `test:coverage` (the lead).
- **Uncovered, from `coverage/coverage-final.json`:**
  - `glamour.ts:234` blocked-by-`dye` and fall-through-`glamour` statuses (`card.glamourStatusDye` / `Glamour`).
  - `:468-470` Grand Company note.
  - `:475-477` embed truncation.
  - `:327`/`:450` glasses.
  - `:404/411/412/418-420` the whole undyed-file path (`listed = pieces`, `glamourWorn`, `glamourNoDyes`, `glamourFootShownWorn`).
  - `:217` `mask === null`.
  - `:483` no-dye embed colour.
- **Other uncovered arms that guard real behaviour:**
  - `swatch.ts:242` `NO_LIVE_SLOTS`.
  - `swatch.ts:367` the float-won lip raw colour (the 4.4.2 fix has no test on its float side).
  - `locale-resolution.ts:272` logger arms (see bot-logic-06).
- **Impact:** I read these branches and found no defect in the glamour ones. Each one is reachable by real files, so a regression there ships silently. About 10 well-chosen tests (company, truncation, glasses, dye-blocked, undyed file, no-live-slots) put the package back over 90%.
- **Origin:** MAIN. **Fix:** add the cases; add `test:coverage` for bot-logic to CI or lower the threshold knowingly.

### bot-logic-05 | BUG | LOW | every `execute*` catch: `glamour.ts:487`, `swatch.ts:399`, `harmony.ts:350`, `mixer.ts:170`, `gradient.ts:356`, `comparison.ts:313`, `contrast.ts:445`, `accessibility.ts` (final catch), `dye-info.ts:185,296`
- **Claim:** a bare `catch {}` turns any exception into `GENERATION_FAILED` and discards the error.
  - `input.logger` is only used for translator misses. The discord adapter logs only the code: `apps/discord-worker/src/handlers/commands/glamour.ts:166` is `logger.warn('Glamour command failed', { error: result.error })`.
  - The root cause is therefore invisible in production. A resolver answer of the wrong shape, an svg-package throw or a font bug all look the same.
- **Test pinning it:** `fallback-branches.test.ts:56-64` asserts that comparing one dye returns `GENERATION_FAILED`. That is a TypeError used as control flow.
- **Origin:** MAIN. **Fix:** `catch (error) { input.logger?.warn(...error message...) }`. Validate input counts explicitly (comparison/contrast/accessibility need 2+).

### bot-logic-06 | BUG | LOW | `src/i18n/locale-resolution.ts:306` vs `:176-183`, `src/localization.ts:380-387`
- **Claim:** two silent degradations contradict their own docs.
  - `resolveUserLocale` calls `getLegacyLanguagePreference(kv, userId)` without a logger. The docblock says the unification "kept the louder" behaviour of logging KV failures. In fact a KV failure on this path is never logged. The unified-blob `catch` at `:302` is also silent.
  - `initializeLocale` swallows a locale-load failure and does not cache the failed locale, so every request retries and silently renders English dye names.
- **Evidence:** the uncovered `cond-expr` arms at `locale-resolution.ts:272` (`error instanceof Error ? error : undefined`) exist only because `logger?.error(...)` short-circuits.
- **Origin:** MAIN (1b67aadd, 2026-09-02). **Fix:** accept an optional logger on `resolveUserLocale` and forward it; log once in `initializeLocale`'s catch.

## 3. POSITIVE (do not re-file)
- `discord-markdown.ts` sanitiser plus the adapters' use of it: `.chara` parser errors echo raw field values (`chara-parser.ts:231-245,281-285,311-325`), and both `/swatch` and `/glamour` pass `errorMessage` through `sanitizeEmbedText` (`apps/discord-worker/.../swatch.ts:133`, `glamour.ts:168`). Mention defusal and the length cap are correct.
- Nickname handling: `glamour.ts:356` never destructures it; `swatch.ts:80,156-160` strips it from the type and the object. `producerToken` is an allowlist.
- Own-property lookups on client strings: `css-colors.ts:173-175`, `locale-resolution.ts:252`, `harmony.ts:144`.
- `localization.ts` per-locale instance cache has no shared mutable locale and no cached rejected promise.
- `Translator.tc` uses `Intl.PluralRules` correctly and falls back `_other`, then bare key. The i18n parity and orphan tests exist.
- `glamour.ts` error mapping (429 busy, 400/413/422 file's problem, others failed) is consistent with its docblock. The `onlyOtherRace` bit logic is right (column c uses bits 2c and 2c+1).
- All `card.glamour*` keys exist in all 6 locales (checked by script, plural pairs included).
- The `commands.stats.options.preferences` locale deletions in the open PR leave no dangling key reference.

## 4. REJECTED
- Parser error text echoing user data into embeds: defended in the adapters (above); stoat-worker only uses `errorMessage` in `info.ts:93`, not for swatch/glamour.
- `Translator` / `locales[locale]` prototype keys: callers pass validated `LocaleCode`; `t()` returns the key for non-strings.
- `executeRandom` with NaN or fractional `count`: Discord integer option; not reachable.
- `executeGradient` unclamped `stepCount`: schema `max 12` (`schemas.ts:396`).
- `glamour.ts:475-477` truncation `lastIndexOf` with a negative index: needs a tail of about 4000 characters, which is unreachable (12 notes at most).
- OffHand `viaMainHand` skipping its dye channels: a stated design choice (the quiver is the bow).
- `sanitizeEmbedText` trailing-backslash cut leaving an unbalanced escape: affects only the "…" glyph, cosmetic.
- Facewear category checks in `input-resolution.ts` / `dye-info.ts`: dead code, owned by the dead-code audit.

## 5. COVERED (23 files)
`packages/bot-logic/package.json`, `src/index.ts`, `src/input-resolution.ts`, `src/localization.ts`, `src/css-colors.ts`, `src/discord-markdown.ts`, `src/moderators.ts`, `src/i18n/{index,locale-resolution,translator,types}.ts`, `src/commands/{types,chara-identity,glamour,swatch,harmony,mixer,gradient,dye-info,comparison,contrast,accessibility}.ts`, `src/commands/__fixtures__/chara-fixtures.ts`.

Also read: `packages/core/src/services/chara/{chara-twins,chara-gposers}.ts`, `DyeSearch.findClosestDye`, `apps/web-app/src/components/glamour-list-actions.ts`, and the tests `glamour.test.ts`, `fallback-branches.test.ts`, `input-resolution.test.ts` (skimmed).
