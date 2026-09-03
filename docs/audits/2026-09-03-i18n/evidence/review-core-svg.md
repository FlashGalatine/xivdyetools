# i18n review — `packages/core` (locale data + generator inputs) + `packages/svg`

**Date:** 2026-09-03 · **Worktree:** `i18n-audit-2026-09-03` · **HEAD:** `32e08207` (2026-09-01)
**Units:** `packages/core` (generator inputs + locale data), `packages/svg` (card generators)
**Method:** read-only. No pnpm/turbo/vitest/npm/eslint/build commands were run. Search used `git ls-files` piped to `grep` (tracked files only) or the Grep tool scoped to `packages/core`/`packages/svg` (neither touches the `apps/web-app/e2e-coverage` poison directory, so scoping was sufficient without extra exclusions). CJK/glyph scanning used Python (`fontTools` 4.63.0 was available and used directly against the bundled `.ttf` files — see §5). Scratch scripts live in `docs/audits/2026-09-03-i18n/evidence/scripts/` (this directory) and are reproducible.

---

## 0. Methodology flag — this checkout predates PR #159 (read before §3)

The task brief states "Core's `generateHarmonySlots` became the single harmony implementation in PR #159 (merged 2026-09-03, `9ef904cf`)" as a fixed fact. **That is true of the repository, but not of this worktree.**

```
$ git log -1 --format="%H %ci %s" HEAD
32e082079776997dd2c5ca2d7b7b070567e0693d 2026-09-01 22:44:34 -0400 docs(repo): add Working-in-this-checkout block

$ git log -1 --format="%H %ci %s" 9ef904cf
9ef904cfb71c0b30278663b7d13707b3dd8ae6b8 2026-09-03 05:55:15 -0400 Merge pull request #159 from FlashGalatine/harmony-convergence-2026-09-03

$ git merge-base --is-ancestor 9ef904cf HEAD && echo ancestor || echo NOT-ancestor
NOT-ancestor

$ git merge-base HEAD 9ef904cf
8ca1bb09f1f21e788ddb38ed594c808eec6378f3
```

`8ca1bb09` (merge PR #154) is the common ancestor — this worktree branched *before* both PR #158 (deep-dive) and PR #159 (harmony convergence) landed on `monorepo-2.0-prep`, even though both merged today. Confirmed by absence, not just by commit graph:

```
$ grep -r "generateHarmonySlots" .          # (Grep tool, whole repo)  -> No files found
$ git ls-files | grep -i HarmonySelector    -> (no output)
```

`packages/core/src/services/dye/HarmonyGenerator.ts` in this checkout is the **pre-convergence** implementation (returns `Dye[]` only, no slot labels; the per-surface duplication PR #159's commit message describes is still live). Check 3 as literally scoped ("confirm every harmony type/slot label `generateHarmonySlots` can emit has a localized name") cannot be executed against this code. §3 below reports what **was** verified instead: the `harmonyTypes` locale namespace (the vocabulary layer, unaffected by which selector implementation is active) is complete, and a confirmatory fact about the pre-convergence gap. **This section should be read by whoever assembles the final audit report — the harmony-vocabulary check needs to be re-run once this worktree (or a fresh one) actually contains `9ef904cf`.**

---

## 1. Generator inputs — `dyenames.csv`, `localize.yaml`, `build-locales.ts`

### 1.1 `dyenames.csv` — structural scan

```
$ wc -l packages/core/dyenames.csv        -> 126 (1 header + 125 data rows)
$ python scan_csv.py                      -> see csv_scan_results.txt
$ python scan_csv_dupvalues.py            -> see csv_dupvalues_results.txt
```

| Check | Result |
|---|---|
| Row count vs `dyes.json` | 125 CSV rows == 125 `dyes.json` entries; itemID column matches `stainID`/`legacyItemID` 1:1, **zero** unmatched ids either direction |
| Blank/whitespace-only cells (any of the 6 name columns) | **0** |
| Duplicate itemIDs | **0** |
| Cell identical to trimmed English Name, per locale | **0** in every one of ja/de/fr/ko/zh — no untranslated-leftover cells anywhere in the CSV |
| Duplicate *values* within a single locale column (copy-paste signal) | **0** in all 6 columns — all 125 names are pairwise distinct per locale |
| Smart/curly quotes (`' ' " " ‚ „`), U+FFFD replacement char | **0** |
| Full-width ASCII variants (U+FF00–FFEF) inside ja/ko/zh cells | **0** — no half-width/full-width inconsistency |
| Encoding | Parses cleanly as UTF-8 (`utf-8-sig`), no mojibake, no BOM issues |
| Leading/trailing whitespace (raw, pre-trim) | **English Name** and **German Name** columns carry a trailing space on ~124/125 rows (e.g. `'Snow White '`, `'Schneeweißer '`); ja/fr/ko/zh columns never do. **Harmless**: `build-locales.ts:63` passes `{ trim: true }` to `csv-parse`, so every cell is trimmed before use — confirmed the generated JSON carries no trailing space. Cosmetic CSV-hygiene-only; not filed as a defect (see Rejected §7). |

**cand-core-01 (P1):** one truncated German name, found by the "value ends in a bare hyphen" heuristic and independently by "unusually short/malformed relative to its siblings":

```
packages/core/dyenames.csv:114
30123,Pearl White ,パールホワイト,Perlmutt-,blanc perlé,진주색,珍珠白
                                 ^^^^^^^^^ German Name cell — ends in a bare hyphen, no completion
```

Every other German dye name in the file is a complete compound adjective following the game's `[Noun]weißer`/`[Noun]blauer`/etc. pattern (`Schneeweißer`, `Wolkenweißer`, `Knochenweißer` for the other three "White" dyes). `Perlmutt-` ("mother-of-pearl-") stops mid-compound. Confirmed this reaches the shipped artifact unchanged (`build-locales.ts`'s `buildDyeNames()` just trims and copies the column):

```
$ python -c "import json; d=json.load(open('packages/core/src/data/locales/de.json',encoding='utf-8')); print(repr(d['dyeNames']['30123']))"
'Perlmutt-'
```

De-locale players see the literal string `Perlmutt-` (trailing hyphen) as this dye's name everywhere `getDyeName(30123,'de')` is called. I could not independently confirm the correct full German name (no live XIVAPI access from this environment) — **fix belongs in `dyenames.csv`**: re-run `fetch_dye_names.py` for itemID 30123, or correct the cell by hand against XIVAPI/the German client.

### 1.2 `localize.yaml` — full read (39 lines)

```
$ cat packages/core/localize.yaml   (39 lines total; en 1-9, ja 10-18, de 19-27, fr 28-39; no ko/zh blocks)
```

**cand-core-04 (P3):** `General_Purpose` is authored (en: `"General-purpose"`, line 3; ja/de/fr: `null`, lines 12/21/30) but is dead:

```
packages/core/scripts/build-locales.ts:16     General_Purpose: string | null;        // read into the type...
packages/core/scripts/build-locales.ts:228-246  buildLabels() body — maps Dye, Dark, Metallic,
                                                 Pastel, Cosmic, Cosmic_Exploration, Cosmic_Fortunes.
                                                 There is NO `if (yamlLabels.General_Purpose) …` line.
```

Confirmed absent from every locale's output, and confirmed zero consumers anywhere in `core`/`svg`:

```
$ python -c "...print(d['en']['labels'])"
{'dye': 'Dye', 'dark': 'Dark', 'metallic': 'Metallic', 'pastel': 'Pastel', 'cosmic': 'Cosmic',
 'cosmicExploration': 'Cosmic Exploration', 'cosmicFortunes': 'Cosmic Fortunes'}   # no generalPurpose key
$ grep -rn "generalPurpose|General_Purpose|General-purpose" packages/core/src packages/svg/src
(no output)
```

Not a translation gap today (nothing renders it, so nothing is wrong on a card) — it is dead generator input, filed **P3 stale-only**. The ja/de/fr `null` placeholders are permanently inert as a result. Fix belongs in **`build-locales.ts`** (add the missing mapping line) if the label is ever wired to a UI surface, and/or **`localize.yaml`** (author ko/zh + complete ja/de/fr, or delete the vestigial field if the label was abandoned).

**cand-core-05 (P3):** the French `Metallic` entry is an array with two extra values that are not alternate generic-label translations — they are **specific per-dye names copy-pasted from the CSV**:

```
packages/core/localize.yaml:32-35
  Metallic:
    - "métallique"
    - "cuivre jaune"       <- this is dyenames.csv:115's French name for itemID 30124 "Metallic Brass"
    - "argent brillant"    <- this is dyenames.csv:89's  French name for itemID 13116 "Metallic Silver"
```

```
packages/core/dyenames.csv:89   13116,Metallic Silver ,...,argent brillant,...
packages/core/dyenames.csv:115  30124,Metallic Brass ,...,cuivre jaune,...
```

`build-locales.ts:235-239` only ever reads index 0 (`Array.isArray(yamlLabels.Metallic) ? yamlLabels.Metallic[0] : yamlLabels.Metallic`), so today's shipped `fr.json labels.metallic` is `'métallique'` — correct, but by luck of ordering rather than by design. A future re-ordering, or any code that iterates the array instead of indexing it, silently breaks. Filed **P3** (currently correct output, fragile input). Fix belongs in **`localize.yaml`**: trim to the single string `"métallique"` (matching every other locale's shape), or add a comment explaining why the alternates are retained if that's deliberate.

### 1.3 `build-locales.ts` — full read (992 lines)

Namespaces emitted: `labels` (YAML-sourced + ko/zh hardcoded fallback, lines 198-220), `dyeNames` (CSV-sourced, `buildDyeNames` lines 249-266), `categories` (lines 268-340), `acquisitions` (342-402), `currencies` (404-488), `harmonyTypes` (490-568), `visionTypes` (570-618), `visions` (620-670), `tools` (672-727), `sheets` (729-803), `races` (805-871), `clans` (873-987) — every one of the latter 10 is a flat hardcoded `Record<LocaleCode, Record<string,string>>` table, all six locales authored inline (not generated from an external source). See §2 for coverage results.

**cand-core-02 (P2): the 11 Facewear color names have no localization pathway anywhere in the generator.**

```
$ cat packages/core/src/data/facewear_colors.json
[{ "id": "silver", "name": "Silver", "hex": "#c0c0c0" }, ...11 entries, one flat "name" field each]

$ grep -n "acewear" packages/core/dyenames.csv packages/core/localize.yaml packages/core/scripts/build-locales.ts
packages/core/scripts/build-locales.ts:280,291,302,313,324,335   <- only the "Facewear" CATEGORY label (×6)
packages/core/scripts/build-locales.ts:352,361,370,379,388,397   <- only "Facewear Collection" ACQUISITION label (×6)
(no facewear rows in dyenames.csv — it holds exactly the 125 stainID rows, confirmed §1.1)
```

`buildDyeNames()` (`build-locales.ts:249-266`) builds `dyeNames` purely by iterating `csvRows` keyed on `row.itemID` — facewear entries are never in that CSV (they use string slugs, not itemIDs, and have no stainID at all per `packages/core/CLAUDE.md`'s schema v2 section). Consumption side confirms the dead end:

```
packages/core/src/services/localization/TranslationProvider.ts:89   getDyeName(itemID, locale) {
  ...looks up localeData.dyeNames[String(itemID)]... }
```

`getDyeName()` only ever indexes the CSV-derived map. Facewear's frozen legacy negative IDs (`packages/core/src/config/facewear.ts` — `LEGACY_FACEWEAR_ITEM_IDS`, -1629..-1283) never appear as keys in that map (they're not itemIDs from the CSV), so `getDyeName(-1629, 'ja')` returns `null` in every non-English locale, same as English. Any caller displaying a Facewear color name to a ja/de/fr/ko/zh player is left with the single, English-only `facewearColors[].name` field (`Silver`, `Gold`, `Black`, `White`, `Grey`, `Red`, `Blue`, `Green`, `Brass`, `Purple`, `Brown`) — there is no other name to fall back to, translated or not.

This is a structurally different fix from a CSV row addition: facewear entries are slug-keyed, not itemID-keyed, so they don't fit `dyenames.csv`'s existing column shape. **Fix needs a new generator pipeline** — a facewear-names source (new CSV/YAML section, slug-keyed) plus a `buildFacewearNames()` step in **`build-locales.ts`**, not a same-shape edit to the existing CSV.

**cand-core-03 (P2): `tools.*` still covers only 6 of the 9 web-app tools — unchanged since the 2026-08-20 og-worker audit (OG-I18N-004/005).**

```
packages/core/scripts/build-locales.ts:672-727   buildTools() — harmony, gradient, mixer, swatch,
                                                  comparison, accessibility. No extractor/presets/budget,
                                                  in any of the 6 locale blocks.
packages/types/src/localization/index.ts:40      export type ToolKey = 'harmony' | 'gradient' | 'mixer'
                                                  | 'swatch' | 'comparison' | 'accessibility';
```

```
$ python -c "for loc in [...]: print(loc, list(json.load(...)['tools'].keys()))"
en/ja/de/fr/ko/zh tools keys: ['harmony', 'gradient', 'mixer', 'swatch', 'comparison', 'accessibility']  (all 6 identical)
```

Confirmed uniform across all six locales (not a ko/zh-specific gap — a namespace-completeness gap that affects every locale equally). The 2026-08-20 `docs/audits/2026-08-20-og-worker-i18n/I18N_AUDIT.md` findings OG-I18N-004/005 already documented the symptom (og-worker's `getToolName()` falling through to `formatKey()` → `"Extractor"`/`"Presets"`/`"Budget"` in every locale) and its remediation sketch explicitly routed **around** this — og-worker now sources tool names from its own `OG_DECK` table instead. That means the root cause in `packages/core` itself was never fixed; it's still here, 14 days later, unrelated to the routing workaround. Any other current or future consumer that calls `LocalizationService.getToolName('extractor'|'presets'|'budget', locale)` hits the same `formatKey()` English-literal fallback (`TranslationProvider.ts:335-349`) — or can't compile the call at all, since those three strings aren't valid `ToolKey` values. **Fix belongs in `build-locales.ts`** (`buildTools()`, 3 more keys × 6 locales) plus the `ToolKey` union in `packages/types` (adjacent package, cited for completeness, not this unit).

---

## 2. Namespace coverage — `packages/core/src/data/locales/*.json`

```
$ python scan_namespace_parity.py   -> namespace_parity_results.txt (full listing)
```

| Namespace | Union key count | Key-set parity (6 locales) | ko/zh-English-copy fingerprint? |
|---|---|---|---|
| `labels` | 7 | equal | none |
| `dyeNames` | 125 | equal (125/125/125/125/125/125) | none (§1.1) |
| `categories` | 9 | equal | none |
| `acquisitions` | 7 | equal | none |
| `currencies` | 11 | equal | none |
| `harmonyTypes` | 10 | equal | none |
| `visionTypes` | 5 | equal | none |
| `visions` | 5 | equal | none |
| `tools` | 6 (should be 9 — cand-core-03) | equal (uniformly short) | none |
| `sheets` | 9 | equal | none |
| `races` | 8 | equal | none |
| `clans` | 16 | equal | none |

**Zero P0s.** No namespace has a missing or extra key in any single locale — every namespace's key set is identical across en/ja/de/fr/ko/zh (the only *incompleteness* is `tools`, and it's incomplete identically in all six, which is cand-core-03 above, not a parity defect).

**Zero ko/zh hand-sourcing-gap fingerprints.** Every identical-to-English cell found across the *entire* dataset (11 namespaces + dyeNames) is in **German or French only**, never ko/zh:

```
labels.metallic 'Metallic'   == en, in de           (loanword — German uses "Metallic" as-is, e.g. "Metallic-Lack")
categories.Neutral 'Neutral' == en, in de            (identical spelling in German)
currencies.Cosmocredits 'CC' == en, in ALL SIX        (deliberate: kept as a 2-letter code in every locale,
                                                        same pattern as Gil/Scrips/Coffer abbreviations)
currencies.Gil 'Gil'         == en, in de, fr         (already blessed 2026-08-20 — proper noun)
races.* (auRa/elezen/hrothgar/lalafell/miqote/roegadyn/viera) == en, in de and/or fr
clans.* (helions/raen/rava/veena/xaela)                == en, in de and/or fr
```

This is the **exact same set** the 2026-08-20 og-worker audit blessed ("10 de / 9 fr cells identical to EN are proper nouns — Gil, Lalafell, Miqo'te, Roegadyn, Hrothgar, Viera, clans") — confirms nothing regressed and nothing new appeared. `Cosmocredits: 'CC'` is the one cell identical across *all six* locales; verified deliberate (not an oversight) by reading `buildCurrencies()` directly — every locale block explicitly writes `Cosmocredits: 'CC'` rather than a locale-specific abbreviation, consistent with treating it as a currency *code* rather than a translatable word (do-not-file: same bucket as "Gil").

### 2.1 Total leaf-key drift vs the 2026-08-20 baseline (222) — explained, not a new gap

```
$ python -c "...sum of all 11 namespace lengths + dyeNames..."
TOTAL leaf keys (excl locale/meta): 218
```

218 today vs 222 recorded by the prior audit. Traced to a single commit, already in this worktree's history:

```
$ git log --oneline -- packages/core/scripts/build-locales.ts | head -1
7917e5f5 chore(core): dead-code cleanup Wave 3e — constants, tooling, VERSION, blending, utils,
          calibration barrel, locale sections (DEAD-030/031/033/029/032/036)
```

That commit (2026-08-18, part of the already-closed-out `xiv-discord-worker-dead-code-audit-2026-08-18` remediation) deleted three zero-consumer locale sections wholesale: `metallicDyeIds` (a computed array, superseded by `METALLIC_STAIN_IDS` in `config/dye-vocabulary.ts`), `jobNames`, and `grandCompanyNames` (FFXIV job-class / Grand Company name tables with no callers anywhere in the workspace at the time). This fully accounts for the reduction — it is a previously-reviewed, previously-executed cleanup, not a new coverage gap. Not filed; noted for the record since the task asked what changed since the 222-key baseline.

Note the removed `jobNames`/`grandCompanyNames` (FFXIV class/Grand-Company names) are unrelated to `packages/svg/src/preset-swatch.ts`'s `CATEGORY_DISPLAY.jobs`/`CATEGORY_DISPLAY['grand-companies']` (§4.4) — those are *preset category* labels ("FFXIV Jobs" as a curated-preset folder name), not FFXIV job-class names ("Paladin", "Warrior") — no overlap, no contradiction.

---

## 3. Harmony vocabulary (`harmonyTypes`) — scope-adjusted per §0

```
$ grep -rn "compound|shades" packages/core/src/services/dye/HarmonyGenerator.ts \
    packages/core/src/services/dye/DyeSearch.ts packages/core/src/services/DyeService.ts
(no output — confirms neither type has ANY generator implementation in this checkout)
```

`harmonyTypes` (§2 table) has all **10** keys — `complementary, analogous, triadic, splitComplementary, tetradic, invertedTetradic, square, monochromatic, compound, shades` — fully populated across all six locales, including `compound` and `shades`, which (per §0) have **no** generator support in this pre-PR#159 checkout at all. This is harmless: translated vocabulary sitting ahead of a feature that hasn't landed in this branch yet is not a defect (nothing can render an untranslated `compound`/`shades` card if nothing can generate a `compound`/`shades` result to begin with). It also means: **once this worktree/branch is updated to include `9ef904cf`, the locale-vocabulary layer needs no additional work** — `harmonyTypes` was already complete for all 10 types before the convergence code landed. What *cannot* be confirmed from here is whether PR #159 introduced any new **slot label** (as opposed to harmony-type name) that isn't in `harmonyTypes` or any other namespace — that requires re-running this check against a checkout that actually contains `generateHarmonySlots`.

---

## 4. `packages/svg` — English-literal inventory

```
$ git ls-files 'packages/svg/src/**' | grep '\.ts$' | grep -v -E '\.test\.ts$'
```
17 non-test source files (listed in full in §6). All greps below ran against exactly this file list.

### 4.1 Required greps

```
$ ... | xargs grep -n -E "['\"\`][A-Z][a-z]+( [a-z]+){2,}"      # sentence-shaped literals (3+ words)
gradient.ts:2        (comment — design-doc quote, not drawn)
palette-grid.ts:69   (JSDoc — documents a caller-supplied title, not drawn)
preset-swatch.ts:125 (JSDoc for emptyLabel default)
preset-swatch.ts:175 (the actual default — see cand-svg-02)

$ ... | xargs grep -n -E "['\`][A-Z][a-z]+ [A-Za-z]+['\`]"       # 2-word Title Case labels
base.ts:253   'Space Grotesk'   (font family name, not card text)
base.ts:255   'Fragment Mono'   (font family name, not card text)
preset-swatch.ts:88   'Grand Companies'  (CATEGORY_DISPLAY — see §4.4, verified never drawn on card)
preset-swatch.ts:156  (JSDoc example)
```

### 4.2 Supplementary greps (beyond the prescribed two — needed because both require a lowercase letter after the initial capital, so neither catches ALL-CAPS role labels, which is exactly what the sibling og-worker audit found in *its own* separate card module)

```
$ ... | xargs grep -n -E "['\"\`][A-Z]{2,}[A-Z ·]*['\"\`]"        # ALL-CAPS literals
a11y-card.ts:55        "DEUT" (comment, short-code example)
dye-info-card.ts:160-163  'HEX','RGB','HSV','LAB' — real code, drawn (see §4.3, do-not-file)
icons/tool-icons.ts (9 hits)  'INK' — SVG template placeholder, replaced via .replaceAll('INK', ink)
                               before ever reaching output; never user-visible text
mixer-card.ts:52       "OKLAB" (comment, blend-mode readout example)

$ ... | xargs grep -n -E "= ['\"][A-Za-z][A-Za-z ]{2,}['\"]"      # default-parameter English literals
(all hits are type-union literals like 'mono'|'body'|'display' = 'mono', or CSS mode strings,
 EXCEPT preset-swatch.ts:175 — see cand-svg-02)

$ ... | xargs grep -n -E "(\?\?|\|\|)\s*['\"\`][A-Za-z]"          # nullish/OR fallback English literals
frame.ts:166,616,617  — algorithm/mode identifiers ('mono','ciede2000','match'), not user text
(preset-swatch.ts:224's `authorLine ?? (authorName ? ... : 'Official')` does NOT match this regex —
 found only by reading the file in full; see cand-svg-02)
```

### 4.3 Targeted `text()`/`cardText()` call-site scan (content argument is a literal string)

```
$ ... | xargs grep -n -E "(^|[^a-zA-Z])(card)?[Tt]ext\([^,\n]+,[^,\n]+,\s*['\"\`]"
```
13 call sites found (full list in evidence scripts). Disposition of every one:

| File:line | Literal | Disposition |
|---|---|---|
| a11y-card.ts:223 | `` `${labels.separation} · ${subject.short}` `` | templated from `labels` — clean |
| comparison-card.ts:171 | `'ΔE2000'` | algorithm tag, do-not-file; glyph noted §5 |
| contrast-card.ts:397,399 | `'1:1'`, `'21:1'` | numeric axis ticks, not text |
| contrast-card.ts:418 | `` `${p.abbrA}·${p.abbrB}` `` | templated, `·` glyph noted §5 |
| dye-info-card.ts:129 | `` `${labels.stain} ${stainID}` `` | templated — clean |
| dye-info-card.ts:159-163 | `'HEX'/'RGB'/'HSV'/'LAB'` | field codes — do-not-file (same bucket as already-accepted "RGB DIST") |
| harmony-card.ts:184 | `` `${labels.base} · ${baseAngle}` `` | templated — clean |
| harmony-card.ts:206,216 | `'ΔE'` (via `deTag`) | algorithm tag, do-not-file; glyph noted §5 |
| harmony-card.ts:208 | `` `${labels.ideal} → ${labels.found}` `` | templated — clean |
| harmony-card.ts:251 | `'→'` | pure glyph, no translatable content |
| harmony-card.ts:351 | `'↓'` | pure glyph ("verdict badge") |
| mixer-card.ts:131 | `` `${num(r.pct, lang, 0)}%` `` | locale-aware numeric formatter — clean |
| nearest-sheet.ts:143, palette-grid.ts:179 | `'ΔE'` | algorithm tag, do-not-file |
| swatch-card.ts:162 | `'ΔE'` | algorithm tag, do-not-file |

**Conclusion: outside `preset-swatch.ts`, every card generator in `packages/svg` draws only labels-object/data-templated text, numeric formatters, or do-not-file codes/glyphs.** This confirms and updates the 2026-08-20 discord-worker audit's finding ("`packages/svg/src` references zero locale keys — architecture confirmed as label-injection only") — it still holds, one file excepted.

### 4.4 `preset-swatch.ts` — the one file with real findings (full file read, 327 lines)

Per its own module docblock, this is "the one generator not on the frame system" — `/preset`'s redesign is deferred, but per the file's own header comment ("the defects are not [deferred]"), in-place bug fixes to this file are an accepted, ongoing practice (it already received a BUG-056 emoji-tofu fix and a 2026-08-20 i18n-audit fix, F-11, adding the `authorLine`/`emptyLabel`/`dyeName` override parameters).

**cand-svg-02 (P2):** the override parameters exist, but their **fallback values are still hardcoded English literals**, drawn directly onto the card whenever a caller omits them:

```
packages/svg/src/preset-swatch.ts:175   emptyLabel = 'No valid dyes in this preset',
packages/svg/src/preset-swatch.ts:224   metaParts.push(authorLine ?? (authorName ? `by ${authorName}` : 'Official'));
```

Both values reach `text()`/`cardText()` unconditionally when not overridden (`generateEmptySwatch()` line 314 for `emptyLabel`; the header meta line, line 230, for the author/Official fallback). This is the same defect class the 2026-08-20 discord-worker audit filed as F-11 for this exact file — F-11's remediation added the *parameters*, not translations for their *defaults*. I did not audit `apps/discord-worker`'s call site (out of this unit's scope), so I cannot say whether the fallback is exercised in production today; I can confirm `packages/svg` still ships an English-only fallback for both.

**`CATEGORY_DISPLAY` (lines 86-95) — reviewed and rejected as a card-drawn literal:**

```
export const CATEGORY_DISPLAY: Record<PresetCategory, { icon: string; name: string }> = {
  jobs: { icon: '⚔️', name: 'FFXIV Jobs' }, 'grand-companies': { icon: '🏛️', name: 'Grand Companies' }, ...
};
```

All 8 `name` values are English-only, no per-locale variant. However, `generatePresetSwatch()`'s destructure (line 167-177) never reads `options.category`, and a full read of the function body (lines 166-249) confirms `CATEGORY_DISPLAY` is never referenced inside it — it is exported standalone, purely for `discord-worker`'s embed/message text (confirmed by the module's own comment at line 198: *"CATEGORY_DISPLAY icons remain for Discord message text, where they work"* — written when BUG-056 pulled the emoji off the card specifically because the bundled fonts can't render them). **Not filed** — it fails check 4's own test ("For every literal drawn onto a card…" — this one isn't). Flagged here as context only: if `discord-worker`'s embed text uses these names as-is, that is a finding for whoever audits `discord-worker`, not this unit.

---

## 5. Glyph inventory — non-ASCII codepoints `packages/svg` actually draws

Full non-ASCII scan (`scan_svg_glyphs.py`) found CJK/umlaut characters, but almost all of them live in **JSDoc comments** illustrating what a caller-supplied `labels.*` value looks like in another locale (e.g. `/** NEAREST DYES / NÄCHSTE FARBSTOFFE / … */`) — those strings are never in `packages/svg`'s own code; they're documentation for values the *caller* (bot-logic) supplies. A second pass (`scan_svg_glyphs.py`'s comment-stripping heuristic, verified by hand for edge cases like a trailing `//` comment on a code line) isolated only glyphs that appear in **executable code**:

| Codepoint | Char | Drawn at (file:line) | Role |
|---|---|---|---|
| U+00B7 | `·` | a11y-card.ts:223, contrast-card.ts:418, dye-info-card.ts:205, harmony-card.ts:184 | field separator |
| U+2014 | `—` | budget-ledger.ts:117 (`const DASH = '—'`), dye-info-card.ts:162, random-dyes-grid.ts:147 | "blank, never invented" placeholder (per packages/svg's own CLAUDE.md rule) |
| U+0394 | `Δ` | comparison-card.ts:171, harmony-card.ts:206+216, nearest-sheet.ts:143, palette-grid.ts:179, swatch-card.ts:162 | `ΔE`/`ΔE2000` algorithm tag |
| U+2026 | `…` | frame.ts:193,196, preset-swatch.ts:73,74 | truncation ellipsis |
| U+00B0 | `°` | harmony-card.ts:146 (`baseAngle = '0°'`) | angle badge default |
| U+2192 | `→` | harmony-card.ts:208,251 | header separator / verdict glyph |
| U+2193 | `↓` | harmony-card.ts:351 | verdict badge |
| U+2605 | `★` | preset-swatch.ts:226 | vote-count suffix |
| U+2022 | `•` | preset-swatch.ts:230 | metadata-parts joiner |

9 distinct codepoints. Verified each against the **actual font files** `discord-worker` bundles for `packages/svg` (the sole consumer, per its own CLAUDE.md) via direct `fontTools` cmap inspection — not inference from the prior punctuation-block reasoning in `FONT_SUBSET_AUDIT.md`:

```
$ python check_font_cmap.py    (fontTools.ttLib.TTFont(...).getBestCmap(), 7 Latin font files)
codepoint              FragmentMono-Regular  Onest-Regular  Onest-SemiBold  Onest-Bold  SpaceGrotesk-Regular  SpaceGrotesk-SemiBold  SpaceGrotesk-Bold
MIDDLE DOT ·           YES  YES  YES  YES  YES  YES  YES
EM DASH —              YES  YES  YES  YES  YES  YES  YES
DELTA Δ                MISSING MISSING MISSING MISSING  YES  YES  YES
ELLIPSIS …             YES  YES  YES  YES  YES  YES  YES
DEGREE SIGN °          YES  YES  YES  YES  YES  YES  YES
RIGHT ARROW →          YES  YES  YES  YES  YES  YES  YES
DOWN ARROW ↓           YES  YES  YES  YES  YES  YES  YES
BLACK STAR ★           MISSING (all 7)
BULLET •               YES  YES  YES  YES  YES  YES  YES
```

```
$ python check_star_cjk.py     (the 3 Noto CJK subset fonts, for the 2 non-clean codepoints above)
NotoSansJP-Subset.ttf: BLACK STAR (U+2605): MISSING     NotoSansJP-Subset.ttf: DELTA (U+0394): YES
NotoSansSC-Subset.ttf: BLACK STAR (U+2605): MISSING     NotoSansSC-Subset.ttf: DELTA (U+0394): YES
NotoSansKR-Subset.ttf: BLACK STAR (U+2605): MISSING     NotoSansKR-Subset.ttf: DELTA (U+0394): MISSING
```

**cand-svg-01 (P1) — genuine tofu, not previously documented.** `★` (U+2605) is absent from **all 10** font files `discord-worker` bundles (3 Latin families × up to 3 weights, + 3 Noto CJK subsets) — Latin and CJK alike. `preset-swatch.ts:226` draws `` `${voteCount}★` `` as part of `metaParts`, rendered at line 230 with `fontFamily: FONTS.primaryCjk` (`base.ts:260` = `'Onest, Noto Sans JP, Noto Sans SC, Noto Sans KR'`) — every single face in that font-family string lacks the glyph. There is no fallback left to try: this renders as a literal `.notdef` tofu box on every `/preset` card that has a vote count set (the guard is `voteCount !== undefined`, so `0★` triggers it too), in **every locale**, including English. Not a translation defect — a hard glyph-availability bug that the existing font-coverage gates cannot catch, because `apps/discord-worker/scripts/subset-cjk-fonts.py` (per the 2026-08-20 discord-worker audit) only ever scans `packages/core` + `packages/bot-logic` locale JSON for required codepoints — it has no visibility into glyphs `packages/svg` hardcodes directly in its own TypeScript source. This is new territory precisely because (per the task brief) `packages/svg` had never been i18n-audited on its own before.

**cand-svg-03 (P3) — corroborates, and sharpens with exact call sites, a known finding.** `Δ` (U+0394) is missing from Fragment Mono and all three Onest weights — the two Latin faces present in `FONT_STACKS.mono` (`packages/svg/src/frame.ts:154`: `'Fragment Mono, Onest, Noto Sans JP, Noto Sans SC, Noto Sans KR'` — note Space Grotesk is **not** in the mono stack at all, so the fallback cannot land there). It **is** present in Noto Sans JP and SC (both ahead of KR in the fixed stack, which is not locale-conditional), so every `ΔE`/`ΔE2000` render — on an English card as much as a Japanese one — silently falls through Fragment Mono → Onest (both miss it) → Noto Sans JP (has it). Not tofu, but a mixed-face glyph inside an otherwise-monospace run. The underlying font gap was already reported by `docs/audits/2026-08-20-discord-worker-i18n/FONT_SUBSET_AUDIT.md` §4.3 ("Onest and Fragment Mono lack Δ … resvg per-glyph fallback pulls Δ from Space Grotesk or Noto") — that report reasoned from the locale-JSON codepoint scan, not from `packages/svg`'s own source, and did not have (nor need) the specific `packages/svg` call sites; this entry adds those 5 file:line citations and pins the fallback face precisely to Noto Sans JP (not Space Grotesk, which the prior report's phrasing left ambiguous and which turns out not to be reachable from the `mono` stack at all). Filed at P3 to avoid double-counting a cosmetic issue the sibling audit already accepted as low-priority.

---

## 6. Files covered

**Read/grepped in full or with targeted line ranges (content actually inspected, not just listed):**

`packages/core` (17): `dyenames.csv`, `localize.yaml`, `scripts/build-locales.ts` (full 992 lines), `src/data/locales/{en,ja,de,fr,ko,zh}.json` (6), `src/data/facewear_colors.json`, `src/config/facewear.ts`, `src/services/localization/TranslationProvider.ts`, `src/services/LocalizationService.ts`, `src/services/dye/HarmonyGenerator.ts`, `src/data/dyes.json`, `CLAUDE.md`, `packages/types/src/localization/index.ts`

`packages/svg` (18): all 17 non-test `src/**/*.ts` files (`a11y-card.ts`, `base.ts`, `budget-ledger.ts`, `comparison-card.ts`, `contrast-card.ts`, `dye-info-card.ts` full read, `frame.ts`, `gradient.ts`, `harmony-card.ts`, `icons/tool-icons.ts`, `index.ts`, `mixer-card.ts`, `nearest-sheet.ts`, `palette-grid.ts`, `preset-swatch.ts` full read, `random-dyes-grid.ts`, `swatch-card.ts`) + `CLAUDE.md`

Fonts inspected via `fontTools` cmap (10): `apps/discord-worker/src/fonts/{FragmentMono-Regular, Onest-Regular, Onest-SemiBold, Onest-Bold, SpaceGrotesk-Regular, SpaceGrotesk-SemiBold, SpaceGrotesk-Bold, NotoSansJP-Subset, NotoSansSC-Subset, NotoSansKR-Subset}.ttf`

Prior-audit context read: `docs/audits/2026-08-20-og-worker-i18n/I18N_AUDIT.md` (full), `docs/audits/2026-08-20-discord-worker-i18n/{FONT_SUBSET_AUDIT.md (substantial), I18N_AUDIT.md, HARDCODED_STRINGS.md, README.md}` (grepped for `packages/svg` mentions)

**COVERED: 48 files** (17 core + 18 svg incl. CLAUDE.md + 10 fonts + 3 prior-audit docs), plus 6 test files in `packages/svg/src` confirmed excluded by design (`preset-swatch.test.ts`, `contrast-card.test.ts`, `base.test.ts`, `frame-budget.test.ts`, `palette-grid.test.ts` inspected only to confirm their hits were fixture data, not source).

---

## 7. Rejected leads (verified, not filed)

| Lead | Why rejected |
|---|---|
| CSV trailing whitespace (English/German columns, ~124 rows) | `csv-parse({ trim: true })` at `build-locales.ts:63` neutralizes it before any output; confirmed zero trailing space in generated JSON. |
| `dye-info-card.ts:160-163` `'HEX'/'RGB'/'HSV'/'LAB'` | Field-code abbreviations, same bucket as already-accepted "RGB DIST" on the do-not-file list — international color-space codes, not translatable prose. |
| `comparison-card.ts:171` etc. `'ΔE'/'ΔE2000'` text content | Algorithm/method tag, do-not-file (`ALGO_TAG` bucket) — only the *glyph* (Δ) is evaluated, at §5, not the string as a translation gap. |
| `icons/tool-icons.ts` `'INK'` (9 occurrences) | SVG template placeholder token, `.replaceAll('INK', ink)`'d before the string is ever returned — never reaches a viewer. |
| `base.ts:253,255` `'Space Grotesk'`, `'Fragment Mono'` | Font family names passed to `font-family=`, not card content. |
| `preset-swatch.ts:86-95` `CATEGORY_DISPLAY` (8 English category names + emoji) | Verified via full-file read: never referenced inside `generatePresetSwatch()`; exported solely for `discord-worker` embed/message text (own comment confirms). Not a card-drawn literal — see §4.4. |
| `CATEGORY_DISPLAY` emoji (🏛️🍂🎉🎨🏔️👤🗡️⚔️) as a card tofu risk | Already identified and mitigated by design: BUG-056 (cited in the file's own comment, line 196-198) removed emoji from card SVG text specifically because the bundled fonts can't render them — confirmed true by the same "never referenced in the card renderer" read above. |
| `harmonyTypes.compound`/`.shades` having no generator implementation | Not an i18n defect — translated vocabulary ahead of a feature not yet in this branch (§0, §3). Extra vocabulary, not missing vocabulary. |
| 218 vs 222 total leaf-key count | Fully explained by commit `7917e5f5` (2026-08-18 dead-code cleanup, already executed and closed out) — not a coverage regression. See §2.1. |
| `currencies.Cosmocredits: 'CC'` identical in all 6 locales | Verified deliberate in `buildCurrencies()` — every locale block explicitly writes the same 2-letter code, consistent with treating it as a currency code rather than a translatable word (same bucket as `Gil`). |
| ko/zh entirely absent from `localize.yaml` (only `labels` fallback exists in `build-locales.ts`) | By design, not a gap — `buildLabels()`'s `fallbackLabels.ko`/`.zh` (lines 203-219) supply all 7 keys `labels` needs; confirmed both fully populated, matching the ja/de/fr YAML-sourced set key-for-key (§2). |
| Font stack ordering (`FONTS.headerCjk`/`primaryCjk`/`monoCjk` in `base.ts` lacking Noto Sans JP precedence, vs `frame.ts`'s `FONT_STACKS`) | Already filed by `docs/audits/2026-08-20-discord-worker-i18n/FONT_SUBSET_AUDIT.md` §5 (the `preset-swatch.ts`-only "ja renders in SC letterforms" finding) — re-verified still true by inspection, not re-filed to avoid duplicate credit. |

---

## 8. Positive controls

- `dyenames.csv`: 125/125 dyes × 6/6 columns, zero blanks, zero cross-locale duplicate values per column, zero identical-to-English leftovers in ko/zh (or any locale), zero smart quotes, zero full/half-width inconsistency, itemIDs match `dyes.json` 1:1 both directions.
- All 11 hardcoded namespace tables in `build-locales.ts` have identical key sets across all six locales — zero P0 key-set drift.
- Zero ko/zh-English-copy fingerprints anywhere in the dataset; every identical-to-EN cell is DE/FR and a previously-blessed proper noun or deliberate currency-code (exact match to the 2026-08-20 precedent).
- `NUMFMT` (`packages/svg/src/base.ts:272-279`, decimal/thousands separators for `num()`/`grp()`) has all 6 locales, each with locale-correct conventions (German comma-decimal, French narrow-no-break-space thousands, JA/KO/ZH Western-digit conventions) — spot-checked against real-world convention, all correct.
- `packages/svg`'s label-injection architecture holds in 16 of 17 non-test files — only `preset-swatch.ts` (already known as the one pre-frame-system generator) hardcodes English fallbacks.
- 7 of 9 hardcoded `packages/svg` glyphs (`· — … ° → ↓ •`) are present in every bundled Latin font weight — confirmed by direct cmap inspection, not assumption.
- File encoding intact throughout: all 6 locale JSON files and `dyenames.csv` parse cleanly as UTF-8 via Python `json.load`/`csv.DictReader`, no mojibake, no BOM issues.
