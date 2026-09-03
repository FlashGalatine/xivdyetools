# review — `pkg-svg-bot-logic`

Deploy units: `@xivdyetools/svg`, `@xivdyetools/bot-logic` (npm publish; **svg before bot-logic** when both change).
Repo root: `C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02` (origin/main `e7ac4042`). Read-only.

## 1. Map

### `packages/svg/src` — pure data-in → SVG-string-out

| Module | Role |
|---|---|
| `base.ts` | `escapeXml` (+XML-illegal strip), `hexToRgb`/`getLuminance`, `rect`/`circle`/`line`/`text`/`group`, `THEME`/`FONTS`, `NUMFMT`/`num`/`grp`, `estimateTextWidth` (CJK 2×) |
| `frame.ts` | 5.0 frame: `CARD_WIDTH 400`/`CARD_MAX_HEIGHT 350`, `CARD_DARK`/`CARD_LIGHT`, `cardText`/`textWidth`/`fitText`, `cardShell`, `commandChip`+`placeGlyph`, `bandInk`/`pillInkOnDye`, `appIcon`/`markFooter`, `swatch`/`idealSwatch`, `formatMeasure`, `measuredRow`, rules |
| `icons/tool-icons.ts` | glyph geometry + `renderGlyph`/`toolGlyph`/`harmonyGlyph`/`chromeGlyph`/`panelGlyph`/`categoryGlyph` |
| `harmony-card.ts` | 11A · `HARMONY_ROW_CAP 4` + tail strip + footer budget (drops note, then verdict) |
| `gradient.ts` | 12H·2/·3/·4 · strip + `measuredRow` rows + `wrapVerdict` verdict/legend |
| `mixer-card.ts` | 12F ratio sweep · `measuredRow` ×5 |
| `nearest-sheet.ts` | 14J·2 `/extractor color` · `measuredRow` ×5 |
| `palette-grid.ts` | 14K `/extractor image` · `bandSlices` proportional band + `measuredRow` |
| `a11y-card.ts` | 13D lens / 13E all / 13H solo · `separationTone` (reversed ramp) |
| `contrast-card.ts` | 13A / 13B / 13C·1 routed on pair count · `ratioTier` 3/4.5/7 · `axisPos` log axis |
| `comparison-card.ts` | 14A duel (7 readouts) / 14C·2 / 14C triangle |
| `dye-info-card.ts` | 11B sheet · dye-coloured band + `bandInk`/`pillInkOnDye` + nearest strip |
| `random-dyes-grid.ts` | 11B table (`/dye random`) |
| `swatch-card.ts` | `.chara` character sheet · `measuredRow` consumer #5 · neutral `title` (never the nickname) |
| `budget-ledger.ts` | 13G ledger · tier groups carry the single price |
| `preset-swatch.ts` | pre-frame 600 px generator (deferred) · own `fitToWidth` (code-point safe) |

### `packages/bot-logic/src` — platform-agnostic command logic

| Module | Role |
|---|---|
| `i18n/translator.ts` | `Translator.t()` (key on a miss) / `.tc()` (`_one`/`_other`) / `getNestedValue` / `interpolate` |
| `localization.ts` | per-locale `LocalizationService` cache; `getLocalizedDyeName/Category/Acquisition/Currency` |
| `input-resolution.ts` | `parseDyeIdInput` (1–254 stainID · ≥5729 item id), `isValidHex`/`normalizeHex`, `searchDyesByName`, `findDyeByName`, `resolveColorInput`, `resolveDyeInput`, module-scope `dyeService` |
| `css-colors.ts` | 148 CSS named colours → hex |
| `discord-markdown.ts` | `escapeDiscordMarkdown`, `sanitizeEmbedText`, `ALLOWED_MENTIONS_NONE` |
| `moderators.ts` | `parseModeratorIds` / `isModeratorId` |
| `commands/*.ts` | `executeHarmony`, `executeGradient` (+`capGradientRows`), `executeMixer`, `executeComparison`, `executeContrast`, `executeAccessibility`, `executeDyeInfo`/`executeRandom`, `executeSwatch` — each returns `{ ok } | { ok:false, error }` + `EmbedData` |

---

## 2. Candidates

### pkg-svg-bot-logic-01 — BUG — MEDIUM — `packages/svg/src/gradient.ts:495-511` (used at `:443`)

**Claim.** `wrapVerdict` word-wraps on ASCII spaces at a fixed 6.6 px per *character*, so a Japanese/Chinese verdict (no spaces) or a Korean one (Hangul is 13.5 px/char at 12.5 px body, not 6.6) never wraps — and unlike every other card's footer the resulting lines are never passed through `fitText`, so the 12H·4 verdict overruns the 400 px canvas and is clipped.

**Failing input → wrong outcome.** `/gradient` in `ja` with ≥4 steps resolving to ≤2 dyes (`gradient.ts:320-323`) sets `verdict` = `"6ステップの該当は2色のみ。中間に存在するカララントはありません。"`. Measured with this package's own `estimateTextWidth`/`textWidth` at `size 12.5, font 'body'`: **432.0 px**, drawn from `x = PAD = 16` → right edge **448** on a 400 px card. `ko` (`"6단계가 염료 2개로 수렴합니다. 그 사이에 해당하는 염료는 없습니다."`) → **445.5 px**, right edge **461.5**. The last ~35–40 % of the sentence is cut off by the viewport. `en`/`de`/`fr` wrap to two lines and fit (max right edge 380.5), `zh` fits at 313.

**Why tests miss it.** `gradient.test.ts:83-92` only exercises the English verdict ("The verdict wraps across text lines — assert a fragment within one line"); no suite renders a CJK card, and no assertion anywhere measures horizontal extent (see -04).

**Covered by test?** No.

```ts
// gradient.ts:495-511
function wrapVerdict(textContent: string, maxPx: number): string[] {
  const words = textContent.split(' ');
  ...
    // ~6.6 px per Latin char at 11–12.5 px; CJK strings rarely space-split,
    // so an unbreakable long run falls through to fitText at render
    if (candidate.length * 6.6 > maxPx && line) { lines.push(line); line = word; }
// gradient.ts:446 — the comment's claim is false: no fitText here
cardText(PAD, rowsTop + 6 + i * 17, line, { fill: theme.name, size: 12.5, font: 'body', weight: 600 }),
```

**Fix direction.** Measure inside `wrapVerdict` with `textWidth(candidate, size, font)` instead of `length * 6.6`, break CJK runs per code point when a single "word" exceeds the budget, and wrap each emitted line in `fitText` as `harmony-card.ts:372` already does.

---

### pkg-svg-bot-logic-02 — BUG — LOW — `packages/svg/src/gradient.ts:477-488`

**Claim.** Same helper, the footer legend: the 6.6 px/char estimate under-measures 11 px mono (6.82 px/char actual), so a line accepted at the 238 px budget renders wider and runs under the app-icon mark.

**Failing input → wrong outcome.** `fr` `card.gradKey` = `"bande = chaque palier · lignes = les teintures distinctes"`; `wrapVerdict(legend, innerW - 130 = 238)` emits a first line measuring **245.5 px** → right edge **261.5**, while `markFooter` starts at `384 − (18 + 7 + textWidth('xivdyetools.app', 11, 'mono') = 102.3) = 256.7`. ~5 px of the legend sits under the icon.

**Why tests miss it.** Same gap as -01 — nothing measures x-extent, and `frame-budget.test.ts` runs only `de`.

**Covered by test?** No.

**Fix direction.** Fold into -01's fix (real measurement + `fitText`); the 130 px mark reservation is already correct.

---

### pkg-svg-bot-logic-03 — BUG — MEDIUM — `packages/bot-logic/src/css-colors.ts:170`

**Claim.** `CSS_COLORS` is a plain object literal, so an inherited `Object.prototype` key resolves to a **function**, and `?? null` does not reject it — `resolveCssColorName` returns a non-string for eight reserved names.

**Failing input → wrong outcome.** `/contrast dye1:constructor …`: `resolveColorInput` falls through the bare-number, hex and dye-name branches, then `resolveCssColorName('constructor')` returns the `Object` constructor (truthy). Because `/contrast` passes `findClosestForHex: true` (`apps/discord-worker/src/handlers/commands/contrast.ts:56`), `input-resolution.ts:407` calls `dyeService.findClosestDye(<Function>)`, which throws inside the *handler* — outside any bot-logic `try` — so the user gets the generic worker error instead of the localized `errors.invalidColor`. On the other commands the same value reaches a card generator and dies at `.replace`/`.toUpperCase` → `GENERATION_FAILED`. Reproduces for `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString`, `__proto__`.

**Why tests miss it.** `css-colors.test.ts:60-72` covers "unknown name", "empty string", "hex code", "RGB notation" — no prototype-key case. Note `DyeDatabase` guards exactly this class (`DANGEROUS_KEYS`, `DyeDatabase.ts:70`), so the discipline exists in the monorepo.

**Covered by test?** No.

```ts
// css-colors.ts:170
export function resolveCssColorName(input: string): string | null {
  return CSS_COLORS[input.toLowerCase().trim()] ?? null;   // Object.prototype leaks through
}
```

**Fix direction.** Build the map with `Object.create(null)` (or `new Map`), or guard `typeof v === 'string'` before returning.

---

### pkg-svg-bot-logic-04 — UNTESTED — MEDIUM — `packages/svg/src/frame-budget.test.ts:286-299`

**Claim.** The suite's only cross-card guardrail asserts `width === 400`, `height ≤ 350` and the 11 px type floor — it never measures whether the *content* fits inside 400 px, and every one of its eight fixtures is German. A Latin-only corpus cannot exercise `estimateTextWidth`'s wide branch (`base.ts:317-324`), which is the branch that produced -01/-02.

**Behaviour it was supposed to catch.** "A card's text stays inside the 400 px canvas in every locale." Its own docblock claims the fixtures use "the *binding* locale — German for length", but for horizontal overflow the binding locale is ja/ko/zh (2× per character), never German.

```ts
// frame-budget.test.ts:286-299
it.each(cards)('$name draws 400 wide and never exceeds 350', ({ svg }) => {
  const { width, height } = dimensions(svg());
  expect(width).toBe(CARD_WIDTH);
  expect(height).toBeGreaterThan(0);
  expect(height).toBeLessThanOrEqual(CARD_MAX_HEIGHT);   // no x-extent assertion
});
```

**Fix direction.** Add a ja/ko fixture row per card and a third `it.each` that parses every `<text x=… font-size=… font-family=…>` and asserts `x + textWidth(content) ≤ 400` (and `≥ 0` for `text-anchor="end"`).

---

### pkg-svg-bot-logic-05 — BUG — LOW — `packages/svg/src/frame.ts:185-197`

**Claim.** `fitText` truncates with `out.slice(0, -1)` — UTF-16 code units — while this package's other ellipsiser, `preset-swatch.ts:71-74`, slices by code point and cites BUG-060 for doing so. The two disagree.

**Failing input → wrong outcome.** A name/title whose truncation point lands inside a surrogate pair (astral CJK ext-B, an emoji) leaves a lone high surrogate. `escapeXml` (`base.ts:18-23`) then deletes it, so the character silently disappears instead of being ellipsised — the XML stays valid, which is why this is latent rather than fatal. No user-supplied free text currently reaches `fitText` (all bot-card strings are dye names / localized labels / allowlisted `charSub`), so this is a trap waiting on the next caller.

**Why tests miss it.** `base-escape.test.ts:96-100` proves `escapeXml` strips lone surrogates; nothing feeds an astral string into `fitText`.

**Covered by test?** No.

```ts
// frame.ts:191-196
if (textWidth(content, size, font) <= maxPx) return content;
let out = content;
while (out.length > 1 && textWidth(out + '…', size, font) > maxPx) {
  out = out.slice(0, -1);            // preset-swatch.ts uses [...content] + pop()
}
return out.trimEnd() + '…';
```

**Fix direction.** Slice `[...content]` and `pop()`, matching `fitToWidth`; ideally delete `fitToWidth` and have `preset-swatch` call `fitText`.

---

### pkg-svg-bot-logic-06 — BUG — LOW — `packages/svg/src/gradient.ts:392`, `packages/svg/src/mixer-card.ts:455`

**Claim.** Two `MeasuredRowWidths` tables sum past the card's content box, so `measuredRow`'s right-anchored measure lands outside the 384 px right margin the rest of the card uses.

**Failing input → wrong outcome.** `measuredRow` consumes `lead + pair + name + bar + measure + 4 × gap(10)` (`frame.ts:585-624`). Gradient: `28+56+186+34+32+40 = 376`, drawn from `x = PAD = 16` → the ΔE column is right-anchored at **392**. Mixer: `374` → **390**. The header readout, footer legend and `markFooter` all right-align at `CARD_WIDTH - PAD = 384`, so every gradient/mixer row's number sits 8 px (resp. 6 px) proud of the card's own margin. `swatch-card.ts:415` sums to exactly `370 = 400 − 2 × 15`, and `nearest-sheet`/`palette-grid` are 2 px over — the intended invariant is visible in the one that is exact.

**Why tests miss it.** Height and font-size only (-04); no geometry assertion.

**Covered by test?** No.

**Fix direction.** Trim `name` by 8 (gradient) / 6 (mixer) px, or assert `lead+pair+name+bar+measure+40 === CARD_WIDTH − 2·PAD` in a frame test.

---

### pkg-svg-bot-logic-07 — BUG — LOW — `packages/svg/src/a11y-card.ts:320` and `:419`

**Claim.** `weight: l.isNormal ? 500 : 600` asks for a Medium face that no bundled font ships, so resvg silently resolves 500 → Regular 400.

**Failing input → wrong outcome.** `apps/discord-worker/src/fonts/` bundles only `Onest-Regular/SemiBold/Bold` (400/600/700) — verified by listing the directory. Per CSS font matching, a request for 500 with no 500 face falls back to 400, so the "normal" control row on 13E/13H renders one step lighter than the design's Medium. Benign (the Regular-vs-SemiBold contrast the row needs survives), but the value is a no-op — exactly the class of defect PR #148 was created for.

**Why tests miss it.** `apps/discord-worker/src/services/font-faces.test.ts:64-75` renders 400 / 600 / 700 and asserts the three differ; 500 is not in the loop, and nothing cross-checks the weights the generators actually emit against the weights that ship.

**Covered by test?** No.

**Fix direction.** Use 400 for the control row (honest about what renders), or extend `font-faces.test.ts` to scan the generators for `font-weight="N"` and assert each `N` maps to a distinct bundled face.

---

### pkg-svg-bot-logic-08 — REFACTOR — LOW — `packages/bot-logic/src/commands/harmony.ts:136-149`

**Claim.** The English `formats` fallback under `getLocalizedHarmonyType` is unreachable: `keyMap` covers all eight `HarmonyType`s, so `if (key) return t.t(key)` always returns, and `Translator.t()` returns the raw key on a miss rather than `undefined`.

**Failing input → wrong outcome.** If `harmony.tetradic` were ever dropped from a locale, the card's type label would print `HARMONY.TETRADIC` (uppercased at `harmony-card.ts:169`) instead of falling back to `Tetradic`. All eight keys are present in all six locales today, so this is latent — but it is the checklist's "`|| 'x'` is dead" shape, and `getHarmonyTypeChoices():347-358` keeps a second copy of the same table.

**Covered by test?** No (no test deletes a key).

**Fix direction.** Delete the dead `formats` map from `getLocalizedHarmonyType` (the reverse-key gate is the real guard), or make the fallback reachable via a `t.has`-style probe.

---

### pkg-svg-bot-logic-09 — BUG — LOW — `packages/bot-logic/src/commands/dye-info.ts:65-66, 114-119, 134`

**Claim.** `omitted` is a compile-time constant: `NEAREST_POOL = 4`, `NEAREST_DRAWN = 3`, and the 125-dye pool always yields four, so `omitted === 1` on every card and the `: ''` arm is unreachable.

**Failing input → wrong outcome.** Every `/dye info` card's nearest-strip headline reads `NEAREST DYES · +1 more` (`他1色`, `+1 weitere`), which a player reads as "one further dye is near this one" when 121 others were ranked and the 4th was simply not drawn.

**Why tests miss it.** A test asserting the label is present passes on the constant; nothing asserts what the number means.

**Covered by test?** No.

**Fix direction.** Either drop the "+n more" line (three columns is already the whole statement) or count against a real threshold (e.g. dyes within a ΔE band), not against the drawn-column count.

---

### pkg-svg-bot-logic-10 — REFACTOR — LOW — `packages/svg/src/contrast-card.ts:173, 241-242, 302-304`; `dye-info-card.ts:553-554`; `palette-grid.ts:345, 351`

**Claim.** Six `fill=` / `stroke=` interpolations bypass `escapeXml` while the neighbouring primitives (`swatch`/`idealSwatch`/`halfRoundedRect`, `frame.ts:430-449, 526`) escape the same class of value.

**Failing input → wrong outcome.** Not reachable today — every one of these receives either a theme constant or a hex from `dyes.json` / `normalizeHex` (anchored `/^#?[0-9A-Fa-f]{6}$/`, `input-resolution.ts:252`). The risk is the next caller: an unvalidated hex here breaks out of the attribute and injects markup into the document, which is precisely how FINDING-028 reached resvg.

**Covered by test?** No.

**Fix direction.** Wrap all six in `escapeXml`, then add a lint/test that greps the generators for `fill="${`/`stroke="${` without it.

---

### pkg-svg-bot-logic-11 — OPT — LOW — `packages/bot-logic/src/commands/gradient.ts:308, 319`

**Claim.** `capGradientRows(gradientSteps)` is called twice per `/gradient`; the second call recomputes the full merge → filter → sort only to read `.merged`, which the first call already returned.

**Fix direction.** Destructure `merged` from the first call: `const { rows: capped, merged: distinctAfterMerge, omitted } = capGradientRows(gradientSteps);`

---

### pkg-svg-bot-logic-12 — UNTESTED — LOW — `packages/svg/src/index.test.ts:1-113`

**Claim.** 113 lines of `expect(x).toBeDefined()` / `expect(typeof x).toBe('function')` over the public barrel — no assertion can fail for a reason `tsc` (consumers import these by name) and the root knip gate do not already catch, and the file gives `index.ts` full statement coverage while asserting nothing about behaviour.

**Behaviour it was supposed to catch.** "The barrel re-exports the right symbols." The real risk — a specifier renamed in its module but re-exported under the old name with different semantics — is invisible to a `typeof` check.

**Fix direction.** Replace with one assertion that the barrel's exported key set equals an inline expected list (so an addition or removal must be acknowledged), and let type-check carry the rest.

---

## 3. POSITIVE — do not re-file

- `escapeXml` (`base.ts:18-37`) strips the full XML-illegal set including lone surrogates, and `base-escape.test.ts` proves it per class — FINDING-028 stays fixed.
- `bandInk`/`pillInkOnDye` (`frame.ts:300-322`) measure both candidate inks and are tested at the exact crossover (`frame.test.ts:28-33`, `#757575` vs `#787878`) and through the pill scrim — the contrast law from PR #147 is genuinely guarded.
- `.chara` name privacy is **type**-enforced: `SwatchCharacter = Omit<ResolvedCharaCharacter, 'nickname'>` (`swatch.ts:80`) plus `withoutNickname`, a neutral localized `title`, and a three-entry producer allowlist (`swatch.ts:187-197`) — no branch can print a player name.
- `harmony-card.ts:327-344` degrades the footer in a declared order (derived note, then verdict) and re-measures each time; verified to stay ≤ 350 for 4 slots + tail + off-default method.
- `classifyBandTier` is always 0–3 (`band-vocabulary.ts:142`, NaN → 3), and every consumer still clamps with `Math.min(tier, 3)` — no `tiers[undefined]` is reachable.
- Every `execute*` awaits `initializeLocale(locale)` before any localized lookup, and `getLocaleInstance` caches per locale rather than mutating a singleton (`localization.ts:33-47`) — the 4.x locale race stays fixed. The autocomplete path also awaits it (`apps/discord-worker/src/index.ts:1023`).
- `sanitizeEmbedText` (`discord-markdown.ts:236-246`) strips invisibles, defuses mentions, escapes markdown, caps by **code point**, and refuses to end on a dangling backslash.
- `contrast-card.test.ts:126-137` explicitly documents that render13A's WORST PAIR / REST branches are unreachable through the router — the dead branch is known and pinned, not drifting.

## 4. REJECTED

- **`Dye.id` vs `itemID` in `harmony.ts:292`** — `getDyeById(baseId)` looks correct: `Dye.id` is documented as always equal to `itemID` after `initialize()` (`packages/types/src/dye/dye.ts:49-56`).
- **`deltaEFormula: 'cie2000'` (`harmony.ts:184`)** — a legal alias, folded by `normalizeDeltaEFormula` (`ColorConverter.ts:21-46`). Not an `===` trap.
- **`getLocalizedDyeName` keyed on `itemID` under 7.5 consolidation** — checked `dyes.json`: 125 rows, zero missing/zero `legacyItemID`, zero duplicates. Consolidation only affects `getMarketItemID`.
- **U+202F (fr thousands separator from `grp`) missing a glyph** — read the bundled `cmap`s: absent from Fragment Mono and Space Grotesk but present in all three Onest faces, which every mono/body/display stack lists as the next fallback. Union coverage holds; no tofu.
- **Dye-DB initialisation hidden behind a "pure" helper** — `new DyeService(dyeDatabase)` at `input-resolution.ts:162` calls `database.initialize(dyeData)` in the constructor, so the module-scope singleton is loaded at import. `getAllDyes()` is a shallow `[...this.dyes]`, so the per-slot scans in `swatch.ts` are cheap.
- **Autocomplete 25-choice / 100-char caps** — bot-logic returns uncapped lists by design; `apps/discord-worker/src/index.ts:1109, 1144, 1169, 1216` all `slice(0, 25)`, and choice names are `name (HEX)`, far under 100.
- **`d.category !== 'Facewear'` filters throughout bot-logic** — no-ops now (schema v2 `dyes.json` has zero Facewear rows), but they are the documented guard for legacy fixture shapes; the 2026-09-01 dead-code audit's KEEP class.
- **`/gradient` and `/mixer` cards print ΔE2000 without a method tag while `matchingMethod` picked the dye** — inconsistent with harmony/nearest-sheet/palette-grid, but the gradient *embed* prints the matching label (`apps/discord-worker/src/handlers/commands/gradient.ts:187-201`), so the information is not lost.
- **`bandInk`'s threshold treats `#0A0A0A` as luminance 0** — the true crossover is L≈0.1860 vs the coded 0.1791, so ~7 dyes in a 0.007-wide band take dark ink where white measures marginally higher (both ≈4.58:1). Deliberate: the same formula is og-worker's, and agreement between the two cards outranks the sub-1 % contrast delta.
- **`render13A` with an empty `pairs`** — `o.pairs[0]` would throw, but `generateContrastCard` is only reached from `executeContrast`, which is inside a `try` returning `GENERATION_FAILED`, and the command schema requires ≥2 dyes (≥1 pair).
- **`budget-ledger` `labels.keyLines[0]` on an empty array** — would throw in `fitText`; the only caller always pushes at least one line (`apps/discord-worker/src/handlers/commands/budget.ts:328`).
- **`markUid` module-scope counter (`frame.ts:328`)** — shared across requests in an isolate, but it only makes `clipPath` ids unique per render; monotonic growth is harmless.
- **`Translator` plural keys** — checked all six `.tc()` keys (`card.gradKeyCut`, `card.gradVerdict`, `card.swatchFootKey`, `dye.search.foundCount`, `errors.rateLimited`, `gradient.steps`) across all six locales: `_one` and `_other` present everywhere.
- **`palette-grid.bandSlices` debt loop** — can exit early leaving the band wider than the box when every share is 0, but the band is inside a `clipPath` and extraction never yields all-zero shares.

## 5. COVERED — 36 in-scope non-test files read in full

`packages/svg/src/`: `base.ts`, `frame.ts`, `icons/tool-icons.ts`, `index.ts`, `harmony-card.ts`, `gradient.ts`, `mixer-card.ts`, `nearest-sheet.ts`, `palette-grid.ts`, `a11y-card.ts`, `contrast-card.ts`, `comparison-card.ts`, `dye-info-card.ts`, `random-dyes-grid.ts`, `swatch-card.ts`, `budget-ledger.ts`, `preset-swatch.ts` — 17.

`packages/bot-logic/src/`: `index.ts`, `i18n/index.ts`, `i18n/types.ts`, `i18n/translator.ts`, `localization.ts`, `input-resolution.ts`, `css-colors.ts`, `discord-markdown.ts`, `moderators.ts`, `commands/types.ts`, `commands/harmony.ts`, `commands/gradient.ts`, `commands/mixer.ts`, `commands/comparison.ts`, `commands/contrast.ts`, `commands/accessibility.ts`, `commands/dye-info.ts`, `commands/swatch.ts`, `commands/__fixtures__/chara-fixtures.ts` — 19.

**Tests skimmed (8):** `svg/base-escape.test.ts`, `svg/frame.test.ts`, `svg/frame-budget.test.ts`, `svg/gradient.test.ts`, `svg/contrast-card.test.ts`, `svg/index.test.ts`, `svg/svg-pipeline.integration.test.ts`, `bot-logic/css-colors.test.ts`.

**Read outside scope to confirm claims (14):** `packages/types/src/dye/dye.ts`; `packages/core/src/{index.ts, types/index.ts, config/band-vocabulary.ts, services/DyeService.ts, services/dye/DyeDatabase.ts, services/LocalizationService.ts, services/color/ColorConverter.ts, services/chara/chara-resolver.ts, data/dyes.json}`; `packages/bot-logic/src/i18n/locales/{en,ja,de,fr,ko,zh}.json`; `apps/discord-worker/src/{services/font-faces.test.ts, services/font-coverage.test.ts, index.ts, handlers/commands/{contrast.ts, gradient.ts}}`; `apps/discord-worker/src/fonts/*.ttf` (cmap tables).
