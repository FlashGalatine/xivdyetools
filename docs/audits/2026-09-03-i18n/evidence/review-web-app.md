# i18n review — apps/web-app (2026-09-03)

Reviewer scope: `apps/web-app`. Read-only; no gate commands run by me (evidence files
under `docs/audits/2026-09-03-i18n/evidence/` were produced by a separate, concurrent
process per the task brief and are cited, not regenerated).

## 0. Scoping caveat — this worktree predates PR #158/#159/#160/#161

`git log --oneline -1` → `32e08207` on branch `i18n-audit-2026-09-03`.
`git merge-base --is-ancestor cf79ac9f HEAD` → **NOT ANCESTOR**.

`apps/web-app/package.json` `"version": "5.0.0"`. `grep -rn "show all pieces|showAllPieces|allPieces" apps/web-app/src/` → no hits.

This checkout branched before the 2026-09-03 merges (deep-dive PR #158, harmony
convergence PR #159, swatch "Show all pieces" PR #160, tool hand-off grammar PR #161).
Concretely: `apps/web-app/src/shared/tool-handoff.ts` does not exist in this tree, and
there is no "Show all pieces" feature. Per my brief item 5, I swept what **is** present
(`git log --since=2026-08-21 --name-only --pretty=format: -- apps/web-app/src | sort -u`,
44 files — the analytics/telemetry opt-in work and the general 2026-08-29 to 09-01
churn), and explicitly did not fabricate findings for the two features this tree
doesn't contain. This is a scope fact for the report, not a defect.

---

## 1. Hardcoded user-visible strings

### 1a. eslint.json mining

`python3 docs/audits/2026-09-03-i18n/evidence/scripts/mine_eslint.py` (script written this session) —
`docs/audits/2026-09-03-i18n/evidence/eslint.json` is valid JSON, 237 file entries (all under
`apps/web-app`; `git ls-files 'apps/web-app/src/**/*.ts' | wc -l` = 232, so the run covered
essentially the whole tree). Aggregate: **0 active `errorCount`, 0 active `warningCount`, 0
active `messages`** across all 237 files. `xivdyetools-i18n/no-hardcoded-ui-strings` and
`xivdyetools-i18n/no-i18n-fallback` fired **zero live warnings**.

`suppressedMessages`: 23 total, only 6 files carry any, only **one** is i18n-related:

| File:line | Rule | Justification |
|---|---|---|
| `components/v4/result-card.ts:1867` | `no-hardcoded-ui-strings` | `-- brand name` ("Saddlebag Exchange") |

Verified by opening `result-card.ts:1855-1869`: the disabled line sits directly under an
un-disabled `TeamCraft` button label — both are third-party site names, consistent with
the settled "codes and tags" / brand-name exclusion. Not a candidate.

### 1b. `innerHTML = \`` sweep (the ~28 sites the lint rule cannot see)

`git ls-files 'apps/web-app/src/**/*.ts' | xargs grep -n 'innerHTML = \`'` → 28 matches
across 21 files. Opened every one (`Read` at the reported line ± 20-40 lines):

| File | Sites | Verdict |
|---|---|---|
| `accessibility-tool.ts:1014` | 1 | SVG icon only, sibling text node uses `LanguageService.t('accessibility.addDye')` |
| `add-to-collection-menu.ts:113,197,216` | 3 | Pure SVG, no text |
| `budget-tool.ts:1046,1389` | 2 | `LanguageService.t('budget.selectTargetToStart'/'budget.fetchingPrices')` |
| `camera-preview-modal.ts:110,213,247` | 3 | All `LanguageService.t('camera.*')` |
| `collection-manager-modal.ts:156,166,177` | 3 | Pure SVG, no text |
| `comparison-tool.ts:1053` | 1 | SVG icon; sibling text `LanguageService.t('comparison.addDye')` |
| `dye-action-dropdown.ts:112` | 1 | Pure SVG (menu-dots icon) |
| `extractor-tool.ts:627,670,693` | 3 | All `LanguageService.t('matcher.*')` |
| `gradient-tool.ts:1167` | 1 | `LanguageService.t('gradient.setStartAndEnd'/'clickPlusButtons')` |
| `market-board.ts:349` | 1 | SVG spinner + `LanguageService.t('marketBoard.refreshing')` |
| `mixer-tool.ts:1486` | 1 | `LanguageService.t('mixer.selectTwoDyesToMix')` |
| `my-submissions-modal.ts:169` | 1 | All text via local `t()` → `LanguageService.t()`, literal keys |
| `shortcuts-panel.ts:126` | 1 | `LanguageService.t('shortcuts.platformHintFull')` |
| `signin-modal.ts:35` | 1 | All copy via local `t()`; "Discord"/"XIVAuth" are brand names |
| `swatch-tool.ts:1482` | 1 | Pure SVG; sibling text `LanguageService.t('tools.character.noColorSelected')` |
| `v4-layout.ts:556,713,729` | 3 | `LanguageService.tInterpolate`/`t()` throughout |
| `shared/__tests__/utils.test.ts:24` | 1 | Test file, excluded by scope |

**Result: 0 hardcoded user-visible strings in any `innerHTML = \`…\`` site.**

### 1c. Broader manual sweeps (not covered by the lint rule)

- `dye-action-dropdown.ts:133-175`: `defaultLabel` field is destructured to `_defaultLabel`
  (unused) — every rendered label goes through `LanguageService.t(labelKey)`. Vestigial
  dead field, not a hardcoded string (out of scope — dead-code, not i18n).
- Custom-attribute sweep across the whole tree (eslint's Lit scanner only checks
  `title`/`placeholder`/`aria-label`/`alt`; it does **not** check other attributes like a
  Lit component's `label=`/`subtitle=`/`hint=` prop):
  `git ls-files 'apps/web-app/src/**/*.ts' | xargs grep -nE '\b[a-zA-Z-]+="[a-zA-Z][a-zA-Z]*( [a-zA-Z]+){1,}"' | grep -vE '^\S+:\d+:\s*(\*|//)' | grep -vE 'style="|class="|viewBox="|xmlns="|stroke-linecap="|stroke-linejoin="|fill="|d="'`
  → only JSDoc `@example` comment lines (`display-options-v4.ts:62`, `range-slider-v4.ts:30`,
  `toggle-switch-v4.ts:28,34`) and `rel="noopener noreferrer"`. No live hardcoded custom
  attributes.
- `chara-import.ts` (1671 lines, the largest single .chara-related file, part of the
  2026-08-20 equipment-identity feature): every `this.el(tag, style, text)` call's text
  argument goes through `this.t(key)` (38 literal keys + the `gearSlot.${slot}` template);
  `grep -noE "'[A-Za-z][A-Za-z' -]*[A-Za-z]{2,}'" chara-import.ts` filtered to non-CSS
  2+-word literals returns only `'unknown producer'` (inside `logger.info`, excluded by
  rule and by the audit's own "log messages" exclusion) and the font family names
  `'Fragment Mono'`/`'Space Grotesk'` (see §4).
- String-concatenation assignment check: `grep -nE "(textContent|innerText|\.title|placeholder)\s*=\s*'[A-Za-z]+ [A-Za-z]+.*'\s*\+"` → 0 hits (the lint rule's `checkExpression` only
  inspects `Literal`/`TemplateLiteral` nodes, not `BinaryExpression`; no such pattern exists).

**Verdict: check 1 is clean. No P1/P2 hardcoded-string candidates in this worktree.**

---

## 2. Dynamically built key lookups

Catalogue base: `docs/audits/2026-08-16-web-app-dead-code/evidence/agent-report-i18n.md` §A
(patterns 4-8 are the dynamic-key families; re-verified against **current** source since
that catalogue predates the 2026-08-20/08-21 remediation and the tool renames).

Found every live template-literal / wrapper-indirected key site by:
```
git ls-files 'apps/web-app/src/**/*.ts' | xargs grep -n "t(\`"          # wrapper defs + direct templates
git ls-files 'apps/web-app/src/**/*.ts' | xargs grep -n 'translationKey'
git ls-files 'apps/web-app/src/**/*.ts' | xargs grep -n 'visionDesc\|model\${\|Cap}\`'
git ls-files 'apps/web-app/src/**/*.ts' | xargs grep -n 'const t = \|function t('
```
then opened each producing file and, for each, enumerated the full possible value domain
from the source (union types, `as const` arrays, `Record` keys, JSON data) — not guessed.

11 families / 214 keys total, written out with their source citation in
`docs/audits/2026-09-03-i18n/evidence/scripts/check_dynamic_keys.py` (kept for
reproducibility) and checked against all six flattened locale JSONs:

| # | Family | Source | Domain | Keys |
|---|---|---|---|---|
| 1 | `accessibility.${key}` wrapper | `metric-help.ts:137-234` | stems×{Label,Desc,Caveat,Short} + 6 literals | 18 |
| 3 | `accessibility.visionDesc${Cap(id)}` | `accessibility-tool.ts:1338` | `VISION_TYPES` ids (5) | 5 |
| 4 | `comparison.${key}` wrapper | `metric-help.ts:317`, `comparison-tool.ts:1555,1663` | `METHOD_STEM`×{Label,Desc,Caveat} + kind0-2 + 13 literals | 34 |
| 5 | `comparison.${METHOD_STEM[m]}Short` | `metric-help.ts:302` | 6 methods | 6 |
| 6 | `comparison.${TIER_KEYS[tier]}` | `comparison-tool.ts:1207` | 4 tiers | 4 |
| 7a | `swatch.gearSlot.${slot}` | `chara-import.ts:1121` | `CharaGearSlotId` (12, `packages/core/.../chara-parser.ts:49-61`) | 12 |
| 7b | `swatch.${key}` via `this.t()` | all 38 literal call sites in `chara-import.ts` | — | 38 |
| 7c | `swatch.slotError.*` | `SLOT_ERROR_KEY` Record, `chara-import.ts:85-89,356-357` | 3 codes + `unknown` fallback | 4 |
| 8 | `themes.${localeKey}` | `theme-modal.ts:131` | `ThemeService.getAllThemes()` (2: standard-light/dark) | 2 |
| 9 | `preset.${id}.${field}` | `preset-i18n.ts:38` | 15 curated ids (`packages/core/src/data/presets.json`) × {name,description} — **has a built-in fallback**: `lookup()` returns `null` (→ preset's own text) when `t(key) === key`, never a raw dotted key | 30 |
| 10 | `${tool.translationKey}.{title,shortName,description}` | `v4-app-header.ts:533/534/565/588` | `TOOL_MENU` (9 tools, incl. legacy `tools.matcher`/`tools.character`) | 27 |
| 11 | `mixer.model${Cap(model)}` | `mixer-tool.ts:1251,1886` | `MODELS` (6: ryb/spectral/oklab/lab/hsl/rgb) | 6 |
| S1 | `preset.categories.*` (Record indirection, not template, but invisible to the literal-regex validator the same way) | `preset-i18n.ts:68-78` | 9 categories | 9 |
| S2 | `preset.validation.*` | `preset-i18n.ts:106-119` | `VALIDATION_KEYS` Record | 11 |
| S3 | `preset.{login,anotherPreset,duplicateFound}` / `errors.*` | `preset-i18n.ts:142-149` | `PRESET_ERROR_KEYS` Record | 8 |

`python3 docs/audits/2026-09-03-i18n/evidence/scripts/check_dynamic_keys.py`:

```
TOTAL dynamic/indirect keys checked: 214
TOTAL problems found: 0
```

Every single one of the 214 keys is present, and is a string, in **all six** locale
files. Cross-checked this is a real gap the automated gates leave open: `scripts/validate-i18n.js`
extracts keys with `/LanguageService\.t\(\s*['"]([^'"]+)['"]\s*\)/g` — a literal-only
regex that matches **none** of families 1/3/4/5/6/7a/7b/7c/8/9/10/11 (all reached via a
template literal or a local wrapper, never `LanguageService.t('literal')` directly). The
`i18n-orphans.test.ts` oracle (`scripts/analyze-unused-keys.js`) is deliberately the
opposite kind of generous — "any `` `ns.${…}` `` template marks the **whole prefix**
reachable" — so it cannot catch a specific suffix resolving to nothing either. Neither
gate would have caught a real miss in any of these 214; I checked them by hand.

**Verdict: check 2 is clean. 0 P1/P2 candidates.**

---

## 3. Terminology

`docs/reference/ffxiv-terminology.md` vs `apps/web-app/src/locales/*.json` vs
`packages/core/src/data/locales/*.json`. Started from the prior audit's
`docs/audits/2026-08-20-web-app-i18n/TERMINOLOGY_VIOLATIONS.md` (5 findings + a dictionary-drift
note); re-verified every one against current source since the remediation branch merged
2026-08-21 and I need to know regression vs. still-open vs. re-fixed.

| ID | Claim | Current state | Command / evidence |
|---|---|---|---|
| TERM-001 | ko `swatch.absentFurPattern` said 로스가르 (wrong) for Hrothgar, official 로스갈 | **FIXED, confirmed** — now reads `로스갈에서는 이 값이...` | `python3` read of `ko.json` `swatch.absentFurPattern` |
| TERM-002 | `colorPalette.{reds,blues,...}` category map mismatched runtime `Dye.category`, and the map was **unreachable dead code** (`dye-palette-drawer.ts` calls `LanguageService.t('Blues')` with no namespace, always misses) | **FIXED, confirmed** — the 11-key wrong map is gone from `en.json` (verified `colorPalette` keys list has no reds/blues/etc.); `dye-palette-drawer.ts:1302` now calls `LanguageService.getCategory(category)` | `grep -n getCategory apps/web-app/src/components/v4/dye-palette-drawer.ts` → line 1302 |
| TERM-003 | `config.{triadic,...}` sidebar harmony names disagreed with `getHarmonyType()` result-card names | **FIXED, confirmed** — `config-sidebar.ts:927-943` now calls `LanguageService.getHarmonyType('complementary'\|...)` for every option; the 9 duplicate `config.*` keys are gone from `en.json` | `grep -n getHarmonyType apps/web-app/src/components/v4/config-sidebar.ts` |
| TERM-004 | `config.{deuteranopia,...}` sidebar vision names' head noun disagreed with `getVisionType()` (ja 第二色覚異常 vs core 2型色覚; ko 녹색맹 vs core 제2색맹) | **FIXED, confirmed** — recommendation was "align head noun, keep short form" (not delete); web-app now reads ja `2型色覚`/ko `제2색맹`/zh `绿色盲` — exact head-noun match to core, parenthetical correctly dropped, same as en/de/fr's existing pattern | `docs/audits/2026-09-03-i18n/evidence/scripts/vision_term_compare.txt` (script output, all 6 locales) |
| TERM-005 | "Venture Coffer" paraphrased away from the official term in 6 strings (de/fr/ko) | **FIXED, confirmed** — de now "Schatzkisten-Farbstoffe", fr "teintures de trouvaille"/"de trouvaille", ko "보물상자" throughout | `docs/audits/2026-09-03-i18n/evidence/scripts/fr_mixing_check.txt` sibling check + direct `python3` reads of `filters.excludeCoffers`/`preset.cfgHideUnbuyableDesc`/`budget.offText` |
| dict-drift | fr `config.mixing*` had a leading space typo | **FIXED, confirmed** — `docs/audits/2026-09-03-i18n/evidence/scripts/fr_mixing_check.txt`: `leading_space=False` for all 6 `mixing*` keys; the `validate-i18n.js` whitespace gate (added by the same remediation) now guards this permanently |

No regressions found in any of the five. All confirmed fixed and gated (whitespace/order
gate; harmony/vision now delegate to core instead of carrying a parallel vocabulary).

### Fresh sweep for new terminology issues

- `grep -n "getRace\|getClan\|SubRace\|Gender" chara-import.ts` → `LanguageService.getClan(SUBRACE_TO_CLAN_KEY[...])` (line 672), correct core delegation; gender renders as a symbol (♀/♂), never text.
- `grep -n "Maelstrom\|Immortal Flames\|Twin Adder\|Adders" apps/web-app/src/locales/en.json` → hits are `preset.gc-maelstrom.name = "Maelstrom"`, `preset.gc-adders.name = "Twin Adders"`, `preset.gc-flames.name = "Immortal Flames"` — curated **preset names**, sibling to `season-spring.name = "Spring"` etc. These are deliberately-shortened palette titles (same convention as the season/event presets), not a UI re-translation of the official GC noun. **Rejected** — falls under the settled "preset name/blurb" exclusion; filing would ask the team to un-stylize a title, not fix a translation bug.
- No hardcoded job/race/GC names found outside the curated-preset and `preset.categories.*`/`config.*` machinery already covered above.

**Verdict: check 3 is clean. 0 new candidates; 1 rejected lead.**

---

## 4. Fonts / CJK

### 4a. FONT-WEB-001 (prior finding) — confirmed still fixed

`grep -n "font-cjk\|:lang(" apps/web-app/src/styles/globals.css`:
```
81:  --font-cjk: 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans KR', ...
111: :root:lang(zh) { --font-cjk: 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans JP', 'Noto Sans KR'; }
115: :root:lang(ko) { --font-cjk: 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans JP', 'Noto Sans SC'; }
```
Matches the prescribed fix exactly (commit `13b84fdb` per the prior audit). Guarded by a
dedicated test (`src/__tests__/font-contract.test.ts`, `describe('per-locale CJK
glyph-form overrides (FONT-WEB-001)')`, 3 `it`s). `docs/audits/2026-09-03-i18n/evidence/webapp-i18n-tests.txt`
(pre-generated by the concurrent gate run, read not re-run) shows `Test Files 4 passed
(4), Tests 50 passed (50)` for the exact suite that includes this file. Shadow-DOM
boundary reasoning: `--font-cjk` is a CSS **custom property**; custom-property values are
inherited properties and inheritance is not blocked by a shadow root (only *selector
matching* is) — the `:root:lang()` rule sets the value on `<html>` (in the light DOM,
where `LanguageService.setLocale` sets `document.documentElement.lang`), and that value
flows down into `V4LayoutShell`'s shadow tree by ordinary inheritance. Confirmed this is
the intended mechanism, not a guess: `v4-layout.ts:337-346`'s own comment distinguishes
"a rule that must apply to tool content" (needs page-side injection, e.g. `tool-content.css`
injected via `v4-layout.ts:353` `toolContentCss` into `layoutElement.shadowRoot`) from a
custom-property value (which the comment does not list as broken — only *selector rules*
in `globals.css`/`v4-layout.css` are called out as not reaching shadow content).

### 4b. NEW — the same bug class FONT-WEB-002 fixed in one file is unfixed in 22 others

`docs/audits/2026-09-03-i18n/evidence/apps/web-app/src/__tests__/font-contract.test.ts:131-139`
("names no family directly outside globals.css (FONT-WEB-002)") is a **narrow regression
guard**: it `readFileSync`s exactly `src/components/my-submissions-modal.ts` and asserts
that ONE file has no inline `font-family: 'Fragment Mono'`. It does not scan the rest of
`src/`.

```
git ls-files 'apps/web-app/src/**/*.ts' | xargs grep -l \
  "font-family: 'Fragment Mono'\|font-family: 'Space Grotesk'\|font-family: 'Onest'" \
  | grep -v '__tests__\|\.test\.ts\|my-submissions-modal.ts'
```
→ **22 files, 75 occurrences** of a hardcoded face name in an inline `style`/`cssText`/
Lit-CSS string, bypassing `--font-display`/`--font-body`/`--font-mono` entirely (and by
extension `--font-cjk` and the `:lang(zh)`/`:lang(ko)` glyph-form overrides in §4a — none
of that machinery is reachable from a literal `'Fragment Mono', monospace` string).

I opened enough of these to establish the pattern is real (not just decorative CSS that
never receives translated text) by finding, for each, what `textContent`/Lit binding the
class actually renders:

| File:line | Class / selector | Renders | Sample CJK value (confirms risk) |
|---|---|---|---|
| `v4/config-sidebar.ts:309-316` | `.v4-sidebar-title` | `LanguageService.t('common.options')` — sidebar header shown on **every tool** | zh `选项`, ko `옵션`, ja `オプション` |
| `v4/config-sidebar.ts:376-383` | `.config-label` | `LanguageService.t('config.*')` — ~20 section labels across all 9 tools' config panels (`harmonyType`, `matchingMode`, `visionTypes`, `colorSpace`, `searchSettings`, `displayOptions`, …) | zh `视觉类型` / `和谐类型`, ko `시각 유형` |
| `v4/dye-palette-drawer.ts:547-556` | `.category-label` | `LanguageService.getCategory(category)` (line 1302) — dye category header in the palette drawer used by **every tool** | core `categories.*`, e.g. zh `红色系` |
| `v4/result-card.ts:508-515` | `.zlabel` | `LanguageService.t('resultCard.spectrumShort'/'acquisitionShort')`, `common.cost` | short tag labels |
| `v4/result-card.ts:521-527` | `.zval` | `LanguageService.getAcquisition(dye.acquisition)` (line 1642) — the Acquisition Method text on **every dye result card** | ja e.g. `染色師`, `イクサル族のよろず屋` |
| `comparison-tool.ts:1783-1790` | inline (row label) | `t('deltaLight'\|'deltaSat'\|'deltaHue'\|'deltaVendor'\|'deltaSource')` — "What Differs" row labels | ja `明度`/`彩度`/`色相`/`販売価格`/`入手先`; zh `亮度`/`饱和度`/`色相`/`商店价`/`来源` |
| `comparison-tool.ts:1607` | inline (badge) | `t('badgeSame'\|'badgeClose'\|'badgeWide')` | ja `同色`/`代用可`/`別色`; zh `同色`/`可替代`/`不同色` |
| `metric-help.ts:157,332` | inline (badge/kind tag) | `t('notAStandard')`, `t('kind0'\|'kind1'\|'kind2')` | ja `非規格`, `非知覚的`/`近似`/`知覚的` |
| `v4/v4-color-wheel.ts:225-229` | `.hub-label` | `LanguageService.t('harmony.baseColorSection')` (line 541) — wheel hub label, Harmony tool | ja `ベースカラー`, ko `기본 색상`, zh `基础颜色` |
| `signin-modal.ts:39` | inline | `t('preset.gateTitle')` | ja `アカウントでできること`, ko `계정으로 할 수 있는 것`, zh `账号的用途` |
| `gradient-tool.ts:1550-1551` | inline | `LanguageService.tInterpolate('gradient.pinnedCount', ...)` | localized count phrase |
| `harmony-tool.ts:1207-1208` | inline | `LanguageService.t('harmony.railSwipeHint')` | localized hint sentence |
| `v4/preset-detail.ts:448-453,525-531` | `.example-link-label`, `.cost-label` | localized tag labels | — (not individually re-verified; same file already confirmed at-risk via the pattern) |

Files with the pattern I located but did not individually re-verify per-line content
(same mechanism, listed for completeness — `grep -l` above is the full, exact list):
`accessibility-tool.ts`, `export-sheet.ts`, `extractor-tool.ts`, `modal-container.ts`,
`preset-category-selector.ts`, `preset-submission-form.ts`, `swatch-tool.ts`,
`v4/display-options-v4.ts`, `v4/dye-filters-v4.ts`, `v4/preset-card.ts`,
`v4/preset-tool.ts`, `v4/v4-app-header.ts`.

**Mechanism, precisely:** a browser will still render these glyphs (font-matching falls
through to *some* installed system CJK font even when nothing in the CSS names one) — so
this is not blank/tofu in the typical case. The concrete, visible defect is the exact
FONT-WEB-001 mechanism (Han-unification: the same codepoint drawn with the wrong region's
strokes) recurring **without even the partial protection `--font-cjk` gives the rest of
the app** — none of these 75 sites can benefit from the `:lang(zh)`/`:lang(ko)` steering
in §4a, because they never reference the variable at all. `config-sidebar.ts` and
`dye-palette-drawer.ts` are the two highest-traffic surfaces in the app (rendered on
literally every tool visit), which is why I lead with them.

**Verdict: 1 systemic, well-evidenced NEW finding (P1), 22 files / 75 sites, entirely
unguarded by the existing FONT-WEB-002 test.**

### 4c. Latin-only bundle fact re-verified

`ls apps/web-app/public/fonts/` → `FragmentMono-Regular.woff2`, `Onest-Variable.woff2`,
`SpaceGrotesk-Variable.woff2` only. No CJK files ship (consistent with the brief's fixed
fact; `--font-cjk` names OS-installed families, nothing downloaded).

---

## 5. Surfaces added since 2026-08-20

Per §0, PR #160 (Swatch "Show all pieces") and PR #161 (`@shared/tool-handoff`) are not
in this tree. What **is** present and was swept:

- **Analytics/telemetry opt-in (web-app 5.1, PR #149 lineage)**: toggle lives in
  `advanced-options-panel.ts:363-370`, `t('config.enableAnalytics')` /
  `t('config.analyticsDesc')`, both direct-literal `LanguageService.t()` calls (caught by
  the automated validator regardless). Confirmed present in all 6 locales by direct
  Python check. `TelemetryService` itself (`services/telemetry-service.ts`) has no UI
  strings of its own — event names are not rendered. Privacy-notice / "Learn more" links
  elsewhere (`camera-preview-modal.ts:99`, `extractor-tool.ts:1076`,
  `image-upload-display.ts:167-189`, `signin-modal.ts:62`) all route text through
  `LanguageService.t()`; only the `href` URL is a literal (correctly not localized).
- **`.chara` equipment identity / "DYES ON THIS GLAMOUR"** (`chara-import.ts`, part of the
  2026-08-20 base feature, still actively touched per `git log --since=2026-08-21`):
  fully covered in §1c and §2 (families 7a/7b/7c) — 0 hardcoded strings, 0 missing keys
  across all 54 of its keys (38 literal + 12 `gearSlot` + 4 `slotError`).
- Remaining files touched since 2026-08-21 (`dye-grid.ts`, `dye-selector.ts`,
  `empty-state.ts`, `image-upload-display.ts`, `dye-palette-drawer.ts`, `preset-tool.ts`,
  `v4-layout.ts`, and the touched service/shared files) are covered by the codebase-wide
  eslint sweep (§1a, 0 warnings across ~232 files) and the custom-attribute sweep (§1c).
  `empty-state.ts` opened in full: every title/description/action string routes through
  `LanguageService.t()`, including the string-returning `getEmptyStateHTML()` helper
  (escapes already-localized text before templating it).

**Verdict: nothing new to file for this unit; the two flagship PR #160/#161 surfaces
named in the brief are not in this checkout (see §0).**

---

## Positive controls

- eslint eslint-config's own rule fired correctly at least once (the suppressed
  `result-card.ts:1867` brand-name case) — proves the rule is live, not silently
  misconfigured.
- `docs/audits/2026-09-03-i18n/evidence/webapp-validate-i18n.txt` (pre-generated): 1154
  keys in en.json, all six locales structurally identical (1154 each), key order matches,
  no stray whitespace, i18n-parity clean (0 dup/missing/extra/empty/varMismatch across
  all locales, `identical=N` counts are the explicit allow-list).
- `docs/audits/2026-09-03-i18n/evidence/_gate-summary.txt` `### webapp-i18n-unused`: "1152
  keys in en.json (meta.* excluded) — used: 1152 orphaned: 0."
- All 5 terminology findings from the 2026-08-20 audit (TERM-001..005) plus the fr
  whitespace typo independently re-verified fixed with no regressions (§3).
- FONT-WEB-001 fix independently re-verified intact and test-gated (§4a).
- 214/214 dynamically-built keys resolve in all six locales (§2) — a check neither
  existing gate performs.

## Rejected leads

| Lead | Where | Reason rejected |
|---|---|---|
| GC preset names "Maelstrom"/"Twin Adders" vs official "The Maelstrom"/"Order of the Twin Adder" | `en.json` `preset.gc-maelstrom.name`/`preset.gc-adders.name` | Curated preset title, same stylization convention as `season-spring.name = "Spring"`; falls under the settled "preset name/blurb" exclusion, not a UI mistranslation |
| `dye-action-dropdown.ts` `defaultLabel` field | lines 137-177 | Dead/unused (destructured to `_defaultLabel`), every render path uses `LanguageService.t(labelKey)` — dead-code, not an i18n defect |
| `webapp-i18n-tests` / `core-i18n-tests` / etc. showing `EXIT: 1` in `_gate-summary.txt` | `docs/audits/2026-09-03-i18n/evidence/_gate-summary.txt` lines 99-114 | Failure signature is a Vite/Vitest **server startup** crash (`Vitest._setServer`/`_createServer`), identical across 6 unrelated packages simultaneously — the signature of the documented concurrent-process collision ("another process is running the gates right now"), not a content-level test failure. The same command's own dedicated evidence file (`webapp-i18n-tests.txt`) shows a clean 50/50 pass from an earlier, uncontended run. Not a web-app source defect. |
| Inline `font-family` in `v4-app-header.ts:432` for the locale-code chip | grep hit in the §4b file list | Renders `LanguageService.getCurrentLocale().toUpperCase()` — always a 2-letter Latin code (EN/JA/DE/FR/KO/ZH); no CJK content ever reaches it. Listed in §4b's "not individually re-verified" set for completeness of the grep, but this specific site is safe. |

## Files covered

- 232 web-app `.ts` source files via the automated eslint sweep (§1a) + `validate-i18n.js`/`i18n-parity.mjs`/`analyze-unused-keys.js` (pre-generated, read as evidence).
- 21 files opened and read in full for the `innerHTML` sweep (§1b).
- ~30 additional files opened directly with `Read` for the dynamic-key (§2), terminology
  (§3), font (§4), and new-surface (§5) checks: `accessibility-tool.ts`, `advanced-options-panel.ts`,
  `budget-tool.ts`, `camera-preview-modal.ts`, `chara-import.ts`, `comparison-tool.ts`,
  `config-sidebar.ts`, `dye-action-dropdown.ts`, `dye-palette-drawer.ts`, `empty-state.ts`,
  `extractor-tool.ts`, `gradient-tool.ts`, `harmony-tool.ts`, `market-board.ts`,
  `metric-help.ts`, `mixer-tool.ts`, `my-submissions-modal.ts`, `preset-detail.ts`,
  `preset-i18n.ts`, `result-card.ts`, `shortcuts-panel.ts`, `signin-modal.ts`,
  `swatch-tool.ts`, `theme-modal.ts`, `v4-app-header.ts`, `v4-color-wheel.ts`,
  `v4-layout.ts`, `globals.css`, `font-contract.test.ts`, `i18n-orphans.test.ts`,
  `validate-i18n.js`, `no-hardcoded-ui-strings.js`.
- 6 web-app locale JSONs + 6 core locale JSONs, each read/flattened programmatically at
  least twice (dynamic-key check, terminology check).
- 4 reference/prior-audit docs: `ffxiv-terminology.md`, `TERMINOLOGY_VIOLATIONS.md`,
  `agent-report-i18n.md`, plus this unit's own evidence files
  (`eslint.json`, `_gate-summary.txt`, `webapp-i18n-tests.txt`, `webapp-validate-i18n.txt`).

**Total distinct files opened/read: ~63.** Total files covered by the automated sweep
cited as evidence: 232 (eslint) — overlapping with, not additive to, the ~63.
