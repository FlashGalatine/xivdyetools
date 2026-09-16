# Review: pkg-svg-bot-logic

Scope: `packages/svg/src/` (all non-test source, ~5,500 lines) and
`packages/bot-logic/src/` (all non-test source, ~3,550 lines). Repo root
`C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-16`, commit
`79a69d1f`. Read-only review; no source files modified.

## 1. Map

| Module | Role |
|---|---|
| `svg/frame.ts` | 5.0 card vocabulary: dimensions, theme, `cardText`/`fitText`/`textWidth`, `commandChip`, `bandInk`/`pillInkOnDye`, `measuredRow` |
| `svg/base.ts` | XML escape, hex/RGB/luminance, `estimateTextWidth` (CJK 2×), `num`/`grp` locale formatting |
| `svg/emitted-glyphs.ts` | Hand-rolled lexer scanning source for emitted non-ASCII glyphs (feeds font-coverage gates in discord-worker/og-worker, outside this scope) |
| `svg/icons/tool-icons.ts` | Single geometry home: tool/harmony/chrome/panel/category glyphs |
| `svg/harmony-card.ts` | `/harmony` 11A card — renders pre-computed slots, incl. optional wheel label |
| `svg/gradient.ts`, `mixer-card.ts`, `palette-grid.ts`, `nearest-sheet.ts` | `measuredRow` consumers for gradient/mixer/extractor |
| `svg/contrast-card.ts`, `a11y-card.ts`, `comparison-card.ts` | Count-routed card families (pair/dye count → frame) |
| `svg/dye-info-card.ts`, `random-dyes-grid.ts` | `/dye info`, `/dye random` |
| `svg/swatch-card.ts`, `budget-ledger.ts` | `/swatch`, `/budget` |
| `svg/preset-swatch.ts` | Pre-frame-system `/preset` generator (deferred redesign) |
| `svg/index.ts` | Public barrel |
| `bot-logic/commands/harmony.ts` | `/harmony` — now delegates selection entirely to core's `generateHarmonySlots` |
| `bot-logic/commands/{gradient,mixer,comparison,contrast,accessibility,dye-info,swatch}.ts` | Other command business logic |
| `bot-logic/i18n/{translator,locale-resolution,types,index}.ts` | `Translator.t()`/`tc()`, Discord-locale mapping, shared KV preference resolution |
| `bot-logic/localization.ts` | Per-locale `LocalizationService` cache wrappers |
| `bot-logic/css-colors.ts`, `discord-markdown.ts`, `moderators.ts`, `input-resolution.ts` | CSS colour table, embed sanitisation, moderator-ID parsing, colour/dye input resolution |
| `bot-logic/index.ts` | Public barrel |

## 2. Candidates

**pkg-svg-bot-logic-01** — BUG, MEDIUM, `packages/bot-logic/src/commands/swatch.ts:115-125,251-254`. Off-grid heterochromia rows lose their L/R distinguisher. `SLOT_KEYS['leftEye']` and `['rightEye']` both resolve to `card.slotEyes`, and the `·L`/`·R`/`·LR` suffix is only appended `if (!offGrid && ...)`. When `eyesShareIndex` is false and **both** eyes are independently off-grid (real per `chara-resolver.ts:98,362-363` — 16% of files don't share an eye index), the card renders two rows both labelled "EYES" / "OFF GRID" with no side marker, distinguishable only by swatch colour and (unstably, since `order: 'hardest'` re-sorts by ΔE) row position. Failing input: a `.chara` file with distinct off-grid left/right eye colours → two visually-ambiguous rows. Not caught by `swatch.test.ts`'s heterochromia case because that fixture's eyes are on-grid (asserts `/·(L|R)</` generically, never the off-grid arm). Covered by test: no.
```ts
let addr = offGrid ? t.t('card.offGridShort') : (slot.gridAddress ?? '—');
if (!offGrid && (slot.slot === 'leftEye' || slot.slot === 'rightEye')) {
  if (character.eyesShareIndex) addr += '·LR';
  else addr += slot.slot === 'leftEye' ? '·L' : '·R';
}
```
Fix direction: append the `·L`/`·R` suffix regardless of `offGrid` (only `eyesShareIndex` should gate `·LR` vs a side marker).

**pkg-svg-bot-logic-02** — REFACTOR/LOW, `packages/bot-logic/src/commands/dye-info.ts:90-97`. `marketValue()` reimplements core's `getMarketItemID`/`isConsolidationActive` gate by hand: it prints the consolidated name+ID whenever `dye.consolidationType` is set, without checking `isConsolidationActive()`. Currently dormant — `CONSOLIDATED_IDS` (`packages/core/src/config/consolidated-ids.ts:34-38`) are hardcoded non-null literals, so the gate is always true today — but a future consolidation type shipped before its item ID is known (the exact scenario `ConsolidatedDye.itemID: number | null`'s docblock anticipates) would make core's `getMarketItemID` fall back to the dye's own `itemID` while this hand-rolled copy would still print the (null) consolidated ID. Not currently reachable, so no live failing input today. Fix direction: call `getMarketItemID`/`isConsolidationActive` from core rather than re-deriving the same branch locally.

**pkg-svg-bot-logic-03** — REJECTED (checked, not a bug), `packages/svg/src/palette-grid.ts:111-129` (`bandSlices`). When `entries.length * MIN_SLICE > totalWidth` (>52 colours on a 368px band), the debt-redistribution loop can't reclaim width (`give` hits 0) and the band undershoots `innerW`. No crash — `pgband` clipPath just leaves a gap at the right edge. `/extractor` draws at most a few dozen clusters in practice; filed as REJECTED given no realistic failing input, not as OPT.

## 3. POSITIVE

- Harmony convergence (PR #159) is real and complete: `bot-logic/commands/harmony.ts` no longer carries its own offset table at all — it calls core's `generateHarmonySlots` directly, and `harmony.test.ts:28-30` pins `HARMONY_TYPES` against `Object.keys(HARMONY_OFFSETS)`. Grepped both packages for `IDEAL_OFFSETS` — zero hits.
- `bandInk()` (`frame.ts:306-312`) correctly picks the higher-WCAG-contrast ink (`(l+0.05)/0.05 >= 1.05/(l+0.05)` is exactly "black contrast ≥ white contrast"), and `pillInkOnDye()` judges ink against the dye *as composited through the pill's black scrim*, not the bare dye — matches the documented law.
- `fitText`/`estimateTextWidth`/`textWidth` are pixel-budget, code-point-safe (slice by `[...content]`, never UTF-16 units) everywhere checked, including the non-frame `preset-swatch.ts`'s independent `fitToWidth`. `measured-row-fit.test.ts` and `frame-budget.test.ts` assert behaviour (ellipsis appears, budget not exceeded), not implementation.
- `emitted-glyphs.ts`'s hand-rolled lexer correctly stays in sync through `base.ts`'s `/"/g` regex (verified in `emitted-glyphs.test.ts:84-94` against the real file, not a fixture) and classifies emoji-vs-text presentation by trailing VS16/astral range, not by Unicode block — `⚔` vs `⚔️`/`★` is exactly the case that broke the old hand-maintained literal.
- Every card generator I read handles an empty rows/slots collection by producing a shorter, valid card (no crash, `Math.min(350, ...)` height clamps hold), matching the "height grows with the result" design law.
- Prototype-key lookups are consistently guarded: `Object.hasOwn` in `css-colors.ts:175`, `locale-resolution.ts:105` (`discordLocaleToLocaleCode`), `harmony.ts:144,378`. `locale-resolution.test.ts:35,62` explicitly regression-tests `'constructor'`/`'toString'` inputs.
- `swatch.ts`'s character-name strip (PR #151) still holds: `SwatchCharacter = Omit<ResolvedCharaCharacter, 'nickname'>`, stripped at `withoutNickname()` before any card/embed sees the record; `PRODUCER_TOKENS` allowlist (brio/ktisis/anamnesis) still gates the identifier line rather than printing raw `TypeName`.
- Static-instance font-weight discipline is documented in the code, not just claimed: `a11y-card.ts:320-322,421-423` explicitly resolve a would-be 500 (Medium) to 400 because resvg's bundled statics are 400/600/700 only.

## 4. REJECTED

- `contrast-card.ts` REST-strip x-accumulation (`render13A`) uses `rText.length * 7` instead of `textWidth` — looked like the character-count-ellipsis anti-pattern, but `rText` is always locale-formatted digits/`:`/decimal-separator (no CJK), and it only affects spacing of up to 5 items, not truncation — no wrong output producible.
- `renderGlyph()`'s `.replace(' F ', ...)` (`tool-icons.ts:285-287`) only replaces the first `' F '` — checked every geometry string in `TOOL_COMPACT`/`TOOL_DETAIL`/`HARMONY`/`PANEL`/`CATEGORY` for a second `F` marker; none exists, consistent with the documented "exactly one filled element per glyph" invariant.
- `mixer.ts`'s `dye1.itemID && ...` truthy check (not `> 0`) looked like the itemID null-check anti-pattern the domain facts warn about — but `Dye.itemID` is never negative in schema v2 (facewear no longer lives in `Dye`), so truthy and `> 0` are equivalent here.
- `Translator.t()`/`tc()` prototype access (`getNestedValue`, `has()`) — no `hasOwn` guard, but every miss path is filtered by `typeof v !== 'string'`, so `t('constructor')` returns the key (a function fails the type check), not `Object.prototype.constructor`.

## 5. COVERED

39 files read (all non-test source in scope, plus the most relevant test files for verification):

`packages/svg/src/`: frame.ts, base.ts, emitted-glyphs.ts (+.test.ts), icons/tool-icons.ts, harmony-card.ts (+.wheel.test.ts), budget-ledger.ts, swatch-card.ts, preset-swatch.ts, comparison-card.ts, contrast-card.ts, a11y-card.ts, gradient.ts, mixer-card.ts, dye-info-card.ts, palette-grid.ts, nearest-sheet.ts, random-dyes-grid.ts, index.ts, measured-row-fit.test.ts, frame-budget.test.ts.

`packages/bot-logic/src/`: commands/harmony.ts (+.test.ts), commands/gradient.ts, commands/dye-info.ts, commands/accessibility.ts, commands/comparison.ts, commands/contrast.ts, commands/mixer.ts, commands/swatch.ts (+.test.ts), commands/types.ts, commands/fallback-branches.test.ts, i18n/translator.ts, i18n/locale-resolution.ts (+.test.ts), i18n/index.ts, i18n/types.ts, localization.ts, css-colors.ts, moderators.ts, discord-markdown.ts, input-resolution.ts, index.ts.

Plus: `packages/core/src/config/consolidated-ids.ts` (to verify candidate 02), `packages/core/src/services/chara/chara-resolver.ts` excerpts (to verify candidate 01).
