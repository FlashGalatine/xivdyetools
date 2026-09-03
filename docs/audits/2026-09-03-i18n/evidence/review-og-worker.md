# i18n review — `apps/og-worker`

**Reviewer date:** 2026-09-03 · **Worktree HEAD:** `32e08207` (2026-09-01T22:44:34-04:00, branch `i18n-audit-2026-09-03`)
**Scope:** every localized string table, the crawler HTML, the nine card generators, the fonts, and locale plumbing in `apps/og-worker`.
**Method:** read-only. No pnpm/vitest/build run by me — `docs/audits/2026-09-03-i18n/evidence/og-i18n.txt` already contains a green run from the parallel gate process (`4 Test Files passed (4), 116 Tests passed (116)`, captured before this review started) and is cited as existing evidence, not reproduced.
**Prior audit:** `docs/audits/2026-08-20-og-worker-i18n/I18N_AUDIT.md` — 14 findings, all executed 2026-08-21 (og-worker 2.2.0). Treated as the baseline; this review verifies a sample and looks for regressions/new surfaces since.

---

## 1. Table completeness

### 1a. Every table in `og-strings.ts` and `og-embed.ts`

Read in full: `apps/og-worker/src/services/og-strings.ts` (415 lines), `apps/og-worker/src/services/og-embed.ts` (348 lines).

| Table | File | Keys × locales | All 6 locales present? | Placeholders match EN set? |
|---|---|---|---|---|
| `OG_DECK` | og-strings.ts:35-108 | 10 keys (9 tools + root) × `{name, sub}` | Yes — visually confirmed every `en/de/fr/ja/ko/zh` block has all 10 keys | No placeholders in this table |
| `TOOL_TAG` | og-strings.ts:132-199 | 9 keys × 6 locales | Yes | N/A |
| `OG_DECK_LINE` | og-strings.ts:220-257 | 4 keys × 6 locales | Yes | `{n}`/`{hex}`/`{name}` — confirmed present per key across all 6 (e.g. `budgetBest` carries `{name}` in every locale, ja/zh moved into the fullwidth-colon template correctly per OG-I18N-012) |
| `OG_ROLE` | og-strings.ts:306-409 | 15 keys × 6 locales | Yes | N/A |
| `OG_EMBED` | og-embed.ts:76-335 | 38 keys × 6 locales | Yes | Spot-checked by hand (see below) + mechanically pinned by test |

`apps/og-worker/src/services/og-strings.test.ts` (163 lines, read in full) already asserts, per-locale, exact key-set equality against EN for `OG_EMBED` (line 117: `expect(Object.keys(OG_EMBED[lc]).sort()).toEqual([...keys].sort())`) and `OG_ROLE` (line 151), plus a placeholder-set-equality check for every `OG_EMBED` key (lines 121-127: `expect(placeholders(OG_EMBED[lc][k])).toEqual(placeholders(OG_EMBED.en[k]))`). This test is part of the 4-file/116-test green run in `evidence/og-i18n.txt`.

Manual spot-check (independent of the test, since I can't execute it) on the two trickiest reordered templates:

- `swatch.descriptionSheetRace` — en `{gender} {race} {sheet} ({hex})`; de/fr/ja/ko/zh all reorder the words but every locale carries exactly `{gender, race, sheet, hex}`. No set mismatch.
- `mixer.title2` — en/de/fr/zh `{ratio}% {a} + {ratioB}% {b}`; ja/ko reorder to `{a} {ratio}% + {b} {ratioB}%`. Same 4-name set in all six.

No duplicate keys found in any locale block (each `xx: { ... }` literal has each key exactly once — visually confirmed on every table; JS object-literal duplication would silently keep only the last value, and the test's key-set-equality check would not by itself catch a same-count accidental duplicate, so this was checked by eye, not just by the test). **No P0 findings.**

### 1b. `font-coverage.test.ts`'s `stringsFor()` cross-check

Read in full: `apps/og-worker/src/services/font-coverage.test.ts` (229 lines).

```ts
function stringsFor(locale: LocaleCode): string[] {
  const out: string[] = [];
  const data = new LocaleLoader().loadLocale(locale) ...
  collectStrings(rest, out);
  collectStrings(OG_DECK[locale], out);
  collectStrings(TOOL_TAG[locale], out);
  collectStrings(OG_DECK_LINE[locale], out);
  collectStrings(OG_ROLE[locale], out);
  return out;
}
```

Covers: core locale data, `OG_DECK`, `TOOL_TAG`, `OG_DECK_LINE`, `OG_ROLE`. **Does not include `OG_EMBED`** — this is correct, not a hole: `OG_EMBED` (og-embed.ts) is crawler/browser text, never drawn by resvg, and the module header explicitly documents why it is a separate file precisely so it is excluded from font subsetting (og-embed.ts:26-31). Confirmed no table in `og-strings.ts` (the only file `stringsFor()` needs to track) is missing from the list — `OG_DECK`/`TOOL_TAG`/`OG_DECK_LINE`/`OG_ROLE` are the complete set of exports from that file (verified against the full file read in §1a), and all four appear in `stringsFor()`. **No card table escapes the font gate.**

The four `og-strings.ts` tables have not changed since the 2026-08-21 remediation commit (`c7dd8595`, confirmed via `git log --oneline -8 -- apps/og-worker/src/services/og-strings.ts` — no commits after it touch the file), so there is nothing new for `stringsFor()` to have missed.

---

## 2. English literals reaching a surface

```
$ git ls-files 'apps/og-worker/src/**/*.ts' | grep -v -E '\.test\.ts$|og-strings|og-embed' | xargs grep -n -E "['\"\`][A-Z][a-z]+( [a-z]+){2,}"
apps/og-worker/src/services/renderer.ts:50:  `Failed to initialize SVG renderer: ${...}`
apps/og-worker/src/services/renderer.ts:108: `Failed to render SVG: ${...}`
apps/og-worker/src/services/renderer.ts:141: 'Image generation failed'
```

All three are internal/operational: a thrown `Error` message (never reaches a response body — `renderOGImage`'s catch converts to a fixed `text/plain` 500) and the one literal 500 body itself. This 500 only fires when resvg itself throws (WASM init failure or a malformed SVG) — an operational failure path, not a translated-content surface, and matches the prior audit's "JSON error bodies... developer-facing, English — correctly out of scope" precedent (renderer.ts's plain-text 500 is the same class of thing, just not JSON). Rejected.

```
$ git ls-files 'apps/og-worker/src/services/svg/*.ts' 'apps/og-worker/src/og-data-generator.ts' 'apps/og-worker/src/index.ts' | grep -v -E '\.test\.ts$' | xargs grep -n -E "['\`][A-Z][a-z]+ [A-Za-z]+['\`]"
```
Results: seven `'Invalid algorithm'` / `'Unknown tool'` / `'Not found'` JSON error bodies in index.ts (all developer-facing 400/404s — "Verified clean" in the prior audit, unchanged), one `logger.error('Unhandled error', ...)` (log message, explicitly out of scope per the audit brief), one CSS `font-family: 'Segoe UI'` (a font-stack name, not prose), and:

```
apps/og-worker/src/services/svg/budget.ts:41:
  return dye.acquisition === 'Venture Coffers' ? role('coffer', locale) : role('board', locale);
```

`'Venture Coffers'` is a comparison against the dye database's `acquisition` enum field, not a displayed string — confirmed against `packages/core/src/data/dyes.json`:
```
$ grep -o '"acquisition":\s*"[^"]*"' packages/core/src/data/dyes.json | sort -u
"acquisition": "Cosmic Exploration"
"acquisition": "Dye Vendor"
"acquisition": "The Firmament"
"acquisition": "Venture Coffers"
```
This is source data used only to branch between `role('coffer', locale)` / `role('board', locale)`, both already localized. Rejected.

### Card role labels (OG-I18N-011 regression check)

Read in full: `harmony.ts`, `gradient.ts`, `mixer.ts`, `swatch.ts`, `comparison.ts`, `accessibility.ts`, `extractor.ts`, `presets.ts`, `budget.ts`, `band-shared.ts`, `band.ts`, `default-card.ts`. Every band `role:` field, every `notFoundBand` call, and every `footRight` verdict routes through `role()` / `getToolTag()` / `getOgDeck()` / `deckLine()` — no raw English role literal found anywhere in the nine adapters. `apps/og-worker/src/services/svg/roles-i18n.test.ts` (94 lines, read in full) pins one example per card per non-EN locale (BASE→BASIS/ベース, START/END→START/ENDE, BUYABLE→購入可 with A/B/C staying codes, TARGET/NO STAIN ID→ZIEL/KEINE STAIN-ID, CLOSEST PAIR→최근접 쌍, AS DESIGNED→WIE ENTWORFEN, CURATED→精选, budget's TARGET·/vendor footer/BEST·, the ja/zh fullwidth-colon-no-space rule) and all agree with the current `og-strings.ts` content read in §1a. **OG-I18N-011's fix holds; no regression.**

Identifiers correctly left untranslated (matching the "Do NOT file" list): `ALGO_TAG` (ΔE2000/ΔEOK/ΔE76/REDMEAN/RGB DIST/DISTINGUISH %), `LENS_SHORT` (NORM/PROT/DEUT/TRIT/ACHR), mixer's A/B/C, budget's STD SPECTRUM/WIDE #1/WIDE #2/216 G, the wordmark `XIV DYE TOOLS` (band.ts:352, deliberately never localized per og-strings.ts's header comment and pinned by og-strings.test.ts:63-67).

**Note (rejected, not filed):** `band-shared.ts:14-22`'s `ALGO_TAG` has no row for `hyab` or `oklch-weighted` (two legacy `?algo=` spellings `VALID_ALGORITHMS` still accepts), so a share using either prints the raw uppercased param (`HYAB`) as the footer tag instead of a tag name. This is a display-correctness bug, but `ALGO_TAG` is explicitly named in the audit brief's "Do NOT file" list — rejected as out of i18n scope, noted here only for completeness.

---

## 3. Locale plumbing

### 3a. `?lang=` route → card

`resolveLocale()` (index.ts:401-405) reads `?lang=`, validates via `extractLocaleCode` (core), falls back to `'en'` on absence or an unrecognised value. Called at every tool-route handler (`createToolHandler`, index.ts:417), every `/og/*` image route (each handler calls `resolveLocale(new URL(c.req.url).searchParams)` — verified on all 11 image routes: harmony, gradient, mixer×2, swatch, comparison, accessibility, extractor, presets, budget, both default-card routes), and root/catch-all. `OG_ALLOWED_QUERY_KEYS` (index.ts:176) = `{'lang', 'frame', 'algo'}` — `lang` still admitted. The canonical cache key (`ogCacheKey`, index.ts:264-278) keys on the *resolved* lang, so `?lang=EN`/`?lang=en-US`/absent all correctly collapse onto the same `en` cache entry — confirmed by `og-guards.test.ts:373-379` ("closes the amplification: ?lang=en-US resolves like a missing lang").

### 3b. `?lang=` → crawler HTML

`generateOGHTML` (og-data-generator.ts:586-682) reads `ogData.locale ?? 'en'`, emits `<html lang="${locale}">` (line 593) and `<meta property="og:locale" content="${OG_LOCALE[locale] ?? OG_LOCALE.en}">` (line 605) via the `OG_LOCALE` map (lines 565-572: en_US/ja_JP/de_DE/fr_FR/ko_KR/zh_CN — all six correct territory codes). `ogData.title`/`description` are built through `embed()`/`getOgDeck()` against the same `locale`. **OG-I18N-009's fix holds.**

### 3c. Image URL carries `lang`

`withLang()` (og-data-generator.ts:76-79) appends `lang=` to every emitted `imageUrl` for non-EN, confirmed at every one of the 9 tool generators + root + fallback + `toolDefault`. Pinned by `og-data-generator.test.ts:672` and `:909` (`imageUrl` assertions with `&lang=ja` / `?lang=ja`).

### 3d. FINDING — `og:url` / `twitter:url` / the meta-refresh redirect / the body link never carry `lang`

While tracing `?lang=` end-to-end (per the brief's check 3), I checked whether the *page* URL (as opposed to the *image* URL) round-trips the locale, since `generateOGHTML` uses `ogData.url` for four things: `og:url`, `twitter:url`, the `http-equiv="refresh"` redirect, and the visible `<a href>` under `class="foot"` ("Open XIV Dye Tools →" / localized via `embed('body.open', locale)`).

```
$ grep -n "url:" apps/og-worker/src/og-data-generator.ts
124:    url: `${env.APP_BASE_URL}/${tool}/`,                                          (toolDefault)
199:      url: `${env.APP_BASE_URL}/harmony/`,                                        (harmony no-dye)
214:    url: `${env.APP_BASE_URL}/harmony/?dye=...&harmony=...&v=1`,
246:    url: `${env.APP_BASE_URL}/gradient/?start=...&end=...&steps=...&v=1`,
276:      url: `${env.APP_BASE_URL}/mixer/?dyeA=...&dyeB=...&dyeC=...&v=1`,
289:    url: `${env.APP_BASE_URL}/mixer/?dyeA=...&dyeB=...&ratio=...&v=1`,
345:    url: `${env.APP_BASE_URL}/swatch/?${urlParams.toString()}`,                    (urlParams: color/limit/sheet?/race?/gender?/algo?/v — no lang)
387:    url: `${env.APP_BASE_URL}/comparison/?dyes=...&v=1`,
425:    url: `${env.APP_BASE_URL}/accessibility/?dyes=...&vision=...&v=1`,
455:    url: `${env.APP_BASE_URL}/extractor/?colors=...${algoQuery}&v=1`,
495:    url: `${env.APP_BASE_URL}/presets/${preset.id}`,
520:    url: `${env.APP_BASE_URL}/budget/?dye=...&v=1`,
536:    url: env.APP_BASE_URL,                                                        (root)
548:    url: env.APP_BASE_URL,                                                        (fallback)
828:        url: env.APP_BASE_URL,                                                    (unknown-tool default)
```

None of the 15 `url:` construction sites append `lang`. `withLang()` is only ever applied to `imageUrl`. No post-processing step in `generateOGHTML` adds it either — `ogData.url` is used verbatim in all four places.

Confirmed no test currently asserts otherwise:
```
$ grep -n -i "lang" apps/og-worker/src/og-data-generator.test.ts | grep -i "url"
672: expect(r.imageUrl).toBe('...&lang=ja')
909: expect(r.imageUrl).toBe('...?lang=ja')
```
Both hits are `imageUrl` assertions; nothing asserts `r.url` (or `og:url`) carries `lang`.

**Effect:** a ja-locale crawler HTML response has a fully localized title/description/`<html lang>`/`og:locale`/card image, a localized "XIV Dye Tools を開く →" link — whose `href`, the `og:url`, the `twitter:url`, and the meta-refresh target all point at a URL with no locale marker, so the click-through / redirect lands on whatever the SPA's default/detected locale is rather than being marked as the sharer's locale. Checked whether the SPA currently reads `?lang=` on load to gauge real-world impact:
```
$ grep -rn "searchParams.get('lang')" apps/web-app/src --include=*.ts | grep -v test
(no matches)
```
It does not — matching the prior audit's note that an incoming `?lang=` was "ignored (harmless)" on the web-app side. So today's practical harm is muted (the SPA doesn't act on `lang` either way yet), but the inconsistency is real, easily verified, not covered by any existing test, and is exactly the shape of gap the `withLang` helper exists to close for the image URL — it was simply never applied to `url`. Filed as **cand-og-01, P2** (falls back to the SPA's default/English rather than propagating the sharer's locale) rather than P1, since no text is actually wrong and the current downstream consumer doesn't yet read the missing parameter.

### 3e. FINDING — swatch's real share grammar no longer reaches the sheet-aware embed strings at all

Checking reachability of the `OG_EMBED` `swatch.descriptionSheet` / `swatch.descriptionSheetRace` strings (both fully localized, verified in §1a) against what the web app actually emits today:

`apps/og-worker/src/og-data-generator.ts:764` (`generateSwatchOGData` caller, `generateOGDataForTool` case `'swatch'`):
```ts
const color = parseHexColor(searchParams.get('hex') || searchParams.get('color'));
if (!color) {
  return toolDefault('swatch', env, locale, embed('swatch.descriptionDefault', locale));
}
const sheetRaw = searchParams.get('sheet');
const raceRaw = searchParams.get('race');
```

`apps/web-app/src/components/swatch-tool.ts:2868-2889` (`getShareParams()`, read in full):
```ts
private getShareParams(): Record<string, unknown> {
  if (!this.selectedColor) return {};
  // Confirmed grammar: slot + i. A character swatch is identified by its
  // cell address, not its hex — two cells can carry the same colour, and
  // a hex lookup silently misses when the sheet reloads under a different
  // tribe/gender. `i` is the index the R·C address is derived from.
  const params: Record<string, unknown> = {
    slot: this.colorCategory,
    i: this.selectedColor.index,
    algo: this.matchingMethod,
    limit: this.maxResults,
  };
  if (RACE_SPECIFIC_CATEGORIES.includes(this.colorCategory)) {
    params.race = this.subrace;
    params.gender = this.gender;
  }
  return params;
}
```

The web app's swatch share URL carries `slot`/`i`/`algo`/`limit`(/`race`/`gender`) — **never `hex`, `color`, or `sheet`**. `searchParams.get('hex') || searchParams.get('color')` is therefore `null` for every real swatch share link produced today, `parseHexColor(null)` returns `null`, and `!color` is always true — **every swatch share, in every locale, degrades to the generic `toolDefault` card** (both the crawler embed and the `/og/swatch/*` image, since the image URL is built from the same unresolved `params.color`). The `sheet`/`race`-aware branches at og-data-generator.ts:312-325 (which is where `swatch.descriptionSheet`/`descriptionSheetRace` are invoked) are dead code against production traffic.

This directly orphans content that was authored and verified complete in §1a: the sheet-aware embed strings are correct in all six locales but are currently unreachable, so the localization work they represent is invisible in production. This is the same *shape* of defect as the prior audit's 🔴 OG-I18N-001 ("the localized path is unreachable from the app's share links") — a grammar/reachability break rather than a wrong-text break, but with full-tool-surface impact (100% of swatch shares, not an edge case). Filed as **cand-og-02, P1**.

*(Not filed, noted for context: `harmony-tool.ts`, `gradient-tool.ts`, `mixer-tool.ts`, and `budget-tool.ts` each grew a parallel "bare custom colour" share form — `hex`/`hexStart`+`hexEnd`/`hexA`+`hexB` — for a dye-less arbitrary-colour selection, which `og-data-generator.ts` also does not read. Checked all four: in every case the **stainID-based path** (`dye`, `start`/`end`, `dyeA`/`dyeB`) that the vast majority of real shares use is unchanged and still matches og-worker's grammar exactly; only the minority custom-colour case degrades to the (still correctly localized) default card, and no *authored, translated* string is orphaned by it the way swatch's is. Out of i18n scope — this is a feature-completeness gap, not a localization gap — so not filed as a row.)*

### 3f. `?perceptual=` / query-key allowlist

Confirmed `OG_ALLOWED_QUERY_KEYS` (index.ts:176) = `{lang, frame, algo}` only; `?perceptual=` (a harmony-tool.ts share param, seen in §3e's grep) is not in the allowlist and would 404 on an `/og/*` image URL if forwarded — consistent with the brief's note that this is deliberate, not a defect. Not filed.

---

## 4. Fonts

```
$ ls -la apps/og-worker/src/fonts/
FragmentMono-Regular.ttf   125368 bytes
NotoSansJP-Subset.ttf      380976 bytes  (371.66 KiB)
NotoSansKR-Subset.ttf      189264 bytes  (184.83 KiB)
NotoSansSC-Subset.ttf      571392 bytes  (558.00 KiB)
Onest-{Regular,SemiBold,Bold}.ttf
SpaceGrotesk-{Regular,SemiBold,Bold}.ttf
```

Staleness (also cross-checked against the parallel gate's own `evidence/font-vs-locale-mtimes.txt`, which independently captured the same four dates):
```
git log -1 --format=%cI -- apps/og-worker/src/fonts                      → 2026-08-29T00:33:38-04:00
git log -1 --format=%cI -- apps/og-worker/src/services/og-strings.ts     → 2026-08-21T00:02:00-04:00
git log -1 --format=%cI -- packages/core/src/data/locales                → 2026-08-18T15:11:51-04:00
```
Fonts (2026-08-29) postdate both the last `og-strings.ts` change (2026-08-21) and the last core-locale change (2026-08-18). **Not stale** by the mechanical rule. Cross-checked semantically too: `git log --oneline -8 -- apps/og-worker/src/services/og-strings.ts` shows no commit after `c7dd8595` (2026-08-21, the commit that both changed the strings and re-cut the subsets) touches the file, so no string change has landed since the last font regen. The 2026-08-29 fonts commit (`689a0679`) was a Latin-only static-instance fix (Onest/Space Grotesk Regular/SemiBold/Bold, per `apps/og-worker/CLAUDE.md`'s "resvg cannot move a variable axis" note) — it did not need to and does not appear to have touched the CJK subsets' glyph coverage, but since the directory-level date is what the brief's rule keys on, and no og-strings.ts change has occurred since the CJK subsets were last actually regenerated (`c7dd8595`), there is no drift either way.

`font-coverage.test.ts` (§1b) is the actual verifier here and could not be executed by me, but `evidence/og-i18n.txt` (captured by the parallel gate process, not by me) shows a green 4-file/116-test run consistent with these tables still passing.

Sizes vs. the brief's thresholds: SC (558.00 KiB) is over the 500 KiB guideline; JP (371.66 KiB) and KR (184.83 KiB) are under their thresholds. This SC size is **not new** — the prior audit already reviewed and accepted it ("SC is over the generic 500 KiB guideline, but it is the documented ja→SC fallback carrying both ja and zh and measures 0 surplus — it is the size the strings require, not bloat"), and the 2026-08-21 remediation commit's own notes record the post-recut sizes as "JP 372 KB / SC 558 KB / KR 185 KB" — matching what's on disk today almost exactly (my byte-accurate KiB conversion: 371.66/558.00/184.83). Not re-filed.

`STACKS` (tokens.ts:17-21) — `mono`/`body`/`display` all list `Noto Sans JP, Noto Sans SC, Noto Sans KR` after their Latin face, JP first (matching the JA-before-SC rule so Japanese never renders in Chinese letterforms). All three stacks that can draw CJK carry all three CJK fallbacks. No stack references an unloaded face (`fonts.ts` statically imports and bundles all six families used by `STACKS` plus Fragment Mono).

---

## 5. Surfaces added since 2026-08-21

```
$ git log --since=2026-08-21 --name-only --pretty=format: -- apps/og-worker/src | sort -u | grep -v '^$'
```
Files touched (excluding the eight `.ttf`s already covered in §4): `index.ts`, `index.test.ts`, `og-data-generator.ts`, `og-data-generator.test.ts`, `og-guards.test.ts`, `og-params.ts`, `services/font-coverage.test.ts`, `services/font-faces.test.ts`, `services/fonts.ts`, `services/svg/accessibility.ts`, `services/svg/accessibility.test.ts`, `services/svg/band.ts`, `services/svg/band-shared.ts`, `services/svg/band-shared.test.ts`, `services/svg/comparison.ts`, `services/svg/comparison.test.ts`, `services/translator.ts`.

These are all commits in this worktree's own history — `3ff697c1`/`f7a0c58e`/`c6bd962b`/`9b2f4ca3`/`e2bdeec6`/`e2e9ca6b`/`ebdc49ed`/`86884104`/`689a0679` — the 2026-08-21/29 FINDING-005/FINDING-024 security-hardening sprints (path/query canonicalisation, cache-key bounding, HEAD caching). None add a new tool, a new `OG_DECK`/`OG_EMBED` key, or new user-facing prose; confirmed by re-reading the current `og-strings.ts`/`og-embed.ts` in §1 (still exactly the 2026-08-21 `c7dd8595` content) and by `SUPPORTED_TOOLS` (index.ts:70-80) still listing the same nine tools.

**Important scoping note:** this worktree's HEAD (`32e08207`, 2026-09-01) predates a large 2026-09-02/09-03 "deep dive" remediation sprint that exists elsewhere in the repo's history but is **not an ancestor of this worktree** — confirmed:
```
$ git merge-base --is-ancestor 35914823 HEAD && echo YES || echo NO   → NO
$ git merge-base --is-ancestor 4eea5815 HEAD && echo YES || echo NO   → NO
```
Those out-of-tree commits (`35914823` "unfurl the cell a Swatch link actually shares", `d95efd97` "the card picks the dyes the page picks") independently confirm and are already fixing exactly the §3e swatch-grammar defect this review found live in the current tree ("BUG-021 — every Swatch share unfurled as the generic default card... The same gate made the two sheet-aware sentences the 2026-08-20 i18n audit authored x6 unreachable"), plus an `og:url`-drops-`lang` defect ("og-6") matching §3d almost exactly. This is independent corroboration of both findings from a source that did not exist when this review's analysis (§3d/3e) was written, not the basis for either finding — both were derived first from reading the current tree's actual code and confirming no test covers the gap.

**5.0/harmony-convergence surfaces:** `IDEAL_OFFSETS` (harmony.ts:39-48) already lists all 8 rotation-based harmony types including `'inverted-tetradic': [120, 180, 300]`; `VALID_HARMONY_TYPES` (og-params.ts:36-47) lists all 10 including `monochromatic`/`shades` (handled via the nearest-dye fallback, no offsets needed). No new harmony type is missing from either table. Swatch's web-app-side "Show all pieces" (PR #160, commit `ec4b3b61`) does not touch `apps/og-worker` at all:
```
$ git show --stat ec4b3b61 | grep -i "og-worker"
(no output)
```
Consistent with it being a pure web-app UI toggle (revealing non-dyeable equipment slots) with no OG card or route implication. No finding.

---

## Positive controls

- `getOgDeck('root', 'ja').name === 'XIV Dye Tools'` — the un-localized root brand name — matches `og-strings.ts:46/82` and is pinned by `og-strings.test.ts:63-67`.
- `role('base', 'de') === 'BASIS'` — matches `og-strings.ts:325` and `og-strings.test.ts:157`.
- `deckLine('budgetBest', 'ja', {name:'X'}) === 'ポイント当たり最良：X'` (no ASCII space after the fullwidth colon) — matches `og-strings.ts:242` and `og-strings.test.ts:160`, and independently `roles-i18n.test.ts:80-88`.
- `embed('gender.female', 'xx' as LocaleCode) === 'female'` — EN-fallback-on-unknown-locale behaviour confirmed both by reading `embed()` (og-embed.ts:338-347: `OG_EMBED[locale]?.[key] ?? OG_EMBED.en[key]`) and by `og-strings.test.ts:133`.
- `<html lang="ja">` / `og:locale content="ja_JP"` — confirmed by reading `generateOGHTML` (og-data-generator.ts:593, 605) and `OG_LOCALE` (og-data-generator.ts:565-572).
- Every one of the 9 tool generators' `imageUrl` construction goes through `withLang()` — confirmed by direct read of all 9 `generate*OGData` functions in og-data-generator.ts.
- `evidence/og-i18n.txt` (parallel gate run, not run by me): og-worker's i18n-scoped vitest files (4 files / 116 tests) all green as of the point that file was captured.

## Rejected leads (with reasons)

| Lead | Why rejected |
|---|---|
| `renderer.ts` thrown-error strings / the 500 `'Image generation failed'` body | Operational/developer-facing failure path, not a translated-content surface; same class as the prior audit's "JSON error bodies... correctly out of scope" |
| `index.ts` JSON error bodies (`'Invalid algorithm'`, `'Unknown tool'`, `'Not found'`, `'Unhandled error'`) | Developer-facing 400/404/500s, unchanged since the prior audit's "Verified clean" pass |
| `budget.ts:41` `'Venture Coffers'` literal | Compared against `dye.acquisition`, a core data enum value (confirmed against `dyes.json`), never displayed — only branches between two already-localized `role()` calls |
| `band-shared.ts` `ALGO_TAG` missing `hyab`/`oklch-weighted` rows | Real display bug (prints raw param), but `ALGO_TAG` is explicitly named in the audit's "Do NOT file" identifier list |
| gradient/mixer/harmony/budget "bare custom colour" share params (`hexStart`/`hexEnd`, `hexA`/`hexB`, `hex`) not read by og-worker | Narrow edge case (non-catalog color only); the dominant stainID-based grammar is unaffected and no *translated* string is orphaned, unlike swatch's `slot`/`i` case (§3e) which breaks 100% of real shares |
| SC subset at 558 KiB (over the 500 KiB guideline) | Pre-existing, already reviewed and accepted by the prior audit as the correct size for its content (0 surplus glyphs), unchanged since |
| `?perceptual=` excluded from `OG_ALLOWED_QUERY_KEYS` | Per the audit brief, deliberate, not a defect |
| PR #160 "Show all pieces" / harmony-convergence PR #159 as new og-worker surfaces | Verified via `git show --stat` / `IDEAL_OFFSETS` / `VALID_HARMONY_TYPES` reads that neither added a reachable new og-worker surface in this worktree |

## Files covered (this review)

Full reads: `services/og-strings.ts`, `services/og-embed.ts`, `services/font-coverage.test.ts`, `og-data-generator.ts`, `index.ts`, `og-params.ts`, `services/renderer.ts`, `services/svg/band-shared.ts`, `services/svg/budget.ts`, `services/svg/harmony.ts`, `services/svg/gradient.ts`, `services/svg/mixer.ts`, `services/svg/swatch.ts`, `services/svg/comparison.ts`, `services/svg/accessibility.ts`, `services/svg/extractor.ts`, `services/svg/presets.ts`, `services/svg/band.ts`, `services/svg/default-card.ts`, `services/translator.ts`, `services/svg/tokens.ts`, `services/og-strings.test.ts`, `services/svg/roles-i18n.test.ts`, `apps/og-worker/CLAUDE.md`, `docs/audits/2026-08-20-og-worker-i18n/I18N_AUDIT.md`. Grepped/partially read: `og-guards.test.ts`, `og-data-generator.test.ts` (lang assertions only), `apps/web-app/src/services/share-service.ts`, `apps/web-app/src/components/{swatch,gradient,mixer,harmony,comparison,accessibility,budget}-tool.ts` (`getShareParams` sections only), `packages/core/src/data/dyes.json` (acquisition enum only). Plus the full `git ls-files apps/og-worker/**` listing (46 tracked files) and font byte sizes/mtimes.

**COVERED: 35 files**
