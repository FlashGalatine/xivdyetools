# Font Subset Audit — discord-worker (2026-08-20)

**Scope:** the six TTFs bundled into `apps/discord-worker/src/fonts/` and loaded by `services/fonts.ts` → resvg, checked against every codepoint in `packages/core/src/data/locales/*.json` + `packages/bot-logic/src/i18n/locales/*.json` (the exact inputs of `scripts/subset-cjk-fonts.py`), plus the CJK literals that live in TypeScript source outside those files.
**Method:** fontTools `cmap` read of each subset vs. a Python scan of the locale JSON (scripts in the session scratchpad; re-runnable — see §7). Compared by cmap, never by md5 (fontTools rewrites `head.modified` every run).
**Companion:** [I18N_AUDIT.md](I18N_AUDIT.md) · previous font audit: [2026-05-28](../2026-05-28/i18n/FONT_SUBSET_AUDIT.md)

---

## 1. Headline

| Check | Result |
|---|---|
| Subsets cover every codepoint the script is fed | ❌ **No** — SC missing 3, JP missing 1, KR missing 2 (all in `previewImage.*`, embed-only text) |
| Any *card-rendered* (`card.*`) string hits a missing glyph | ✅ No — zero visible tofu today |
| KR bloat from 2026-05-28 (821 Han glyphs, 820 KiB) | ✅ Fixed (OPT-001) — 233 KiB, 0 Han glyphs |
| Stale (unneeded) glyphs | ⚠️ SC 118 · JP 75 · KR 24 — locale trimming since the 2026-08-10 re-cut |
| Coverage gate in CI/tests | ❌ **None** in discord-worker (og-worker has `font-coverage.test.ts`) — this is the 3rd consecutive audit to find stale subsets |
| Latin fonts cover Δ / α / ♀ / ♂ | ❌ Onest and Fragment Mono lack **Δ α ♀ ♂**; Space Grotesk lacks **α ♀ ♂**. `ΔE` appears in 9 `card.*` strings → resvg per-glyph fallback pulls Δ from Space Grotesk or Noto — mixed-font rendering, not tofu |
| `preset-swatch.ts` font stacks | ⚠️ Uses `base.ts FONTS.*Cjk` which has **no Noto Sans JP** → Japanese text on preset swatches renders in SC (Chinese) letterforms; every frame-based card uses `frame.ts FONT_STACKS` which is correct |

---

## 2. Font inventory (as committed)

| File | Size | cmap entries | Variable | nameID 1 | Notes |
|---|---|---|---|---|---|
| `NotoSansSC-Subset.ttf` | 843.7 KiB | 1,262 | yes | `Noto Sans SC` | terminal CJK fallback for all locales |
| `NotoSansJP-Subset.ttf` | 571.1 KiB | 663 | yes | `Noto Sans JP` | ja letterforms, ahead of SC for ja |
| `NotoSansKR-Subset.ttf` | 233.2 KiB | 584 | yes | `Noto Sans KR` | Hangul + ASCII only (OPT-001 landed) |
| `Onest-VariableFont_wght.ttf` | 120.5 KiB | 470 | yes | `Onest` | body |
| `SpaceGrotesk-VariableFont_wght.ttf` | 131.0 KiB | 735 | yes | `Space Grotesk Light` (nameID 16 = `Space Grotesk`) | display |
| `FragmentMono-Regular.ttf` | 122.4 KiB | 487 | no | `Fragment Mono` | numerics/hex |

Total CJK overhead ≈ 1.65 MiB raw. nameID 1 fix from FONT-001 (2026-08-10) is present on all three Noto subsets. Space Grotesk's nameID 1 is `Space Grotesk Light` (upstream variable-font quirk; resvg matches on the typographic family, nameID 16, so it resolves — same pattern FONT-001 documented for SC).

---

## 3. Per-locale script inventory (core + bot-logic locale JSON, non-ASCII only)

| Locale | Scripts (distinct codepoints) | Required face |
|---|---|---|
| en | Gen. punct 3 (– — •), math 3 (− ≤ ≥), → , ♀ ♂, Δ α, U+FE0F | Latin + symbol fallback |
| ja | CJK Unified **343**, Katakana 76, Hiragana 51, Fullwidth 7, CJK punct 5, + the en symbol set | Noto Sans JP → SC |
| zh | CJK Unified **722**, Fullwidth 9, CJK punct 4, + symbols | Noto Sans SC |
| ko | Hangul **467** (zero Han), Fullwidth 2 (／ ＝), + symbols | Noto Sans KR (+ SC for ／ ＝) |
| de | Latin-1 8, ‚ (U+201A), + symbols | Onest / Space Grotesk |
| fr | Latin-1 18, ’ , + symbols | Onest / Space Grotesk |

Totals the script sees: 1,014 CJK-range codepoints, 467 Hangul. (2026-05-28: 1,061 / 458.)

---

## 4. Coverage results

### 4.1 Missing glyphs (would render as □ if the string reached resvg)

| Font | Missing | Where the character lives |
|---|---|---|
| `NotoSansSC-Subset.ttf` | `体` U+4F53 · `受` U+53D7 · `钮` U+94AE | bot-logic `previewImage.rejectedFooter` (ja, zh), `previewImage.invalidButton` (zh) |
| `NotoSansJP-Subset.ttf` | `体` U+4F53 | bot-logic ja `previewImage.rejectedFooter` |
| `NotoSansKR-Subset.ttf` | `님` U+B2D8 · `튼` U+D2BC | bot-logic ko `previewImage.approvedFooter` / `rejectedFooter` / `invalidButton` |
| Union of all six | the 5 above + U+FE0F (variation selector, zero-width — harmless) + `\n` | — |

**Cause:** the subsets were re-cut in `5345e35a` (2026-08-10, "128 tofu glyphs to 0"); later the same day `d3355a3a` and `40e2a1d3` added the `previewImage.*` keys and did not re-run the script. The `previewImage.*` strings are Discord-embed footers/replies — the Discord client renders them, not resvg — so **no tofu is visible today**. The subsets are nonetheless out of sync with their declared inputs, and the next `card.*` edit in ja/ko/zh will hit the same gap with nothing to catch it.

### 4.2 Stale glyphs (in the subset, needed by nothing)

| Font | Stale non-ASCII glyphs | Cause |
|---|---|---|
| SC | 118 (CJK range) | locale trimming 2026-08-18 (`7c7e9013` orphan removal, `7917e5f5` core sections) |
| JP | 75 | same |
| KR | 24 | same |

Harmless; a re-cut reclaims a few KiB.

### 4.3 Latin/symbol coverage — the `ΔE` case

| Font | Missing from the non-CJK/non-Hangul locale set |
|---|---|
| Onest | `Δ` `α` `♀` `♂` (U+FE0F) |
| Space Grotesk | `α` `♀` `♂` |
| Fragment Mono | `Δ` `α` `♀` `♂` |

`Δ` appears in **9 `card.*` strings** in every locale (`card.derivedNote`, `card.matchKey`, `card.budgetKey`, `card.budgetKeyMethod`, `card.budgetBest`, `card.swatchFootKey`, `card.swatchDropped`, + `card.swatchLip` uses `α`) and is also emitted from code (`ΔE`, `MATCHING_METHOD_TAGS`). Every frame card stack is `Fragment Mono | Onest | Space Grotesk → Noto Sans JP → SC → KR`, so resvg's per-glyph fallback finds Δ in Space Grotesk (display stack) or Noto SC/JP/KR (body/mono stacks). Result: correct glyph, **different face and metrics** for the Δ inside an otherwise-Onest run — a subtle weight/baseline mismatch on every card that says "ΔE2000". ♀/♂ only appear in `preferences.values.*` (embed text) — not a render concern.

Options: (a) accept — it has rendered this way since 5.0; (b) add `Δ`/`α` to a Latin face by subsetting them in from Noto Sans (they're in the JP/SC subsets already); (c) put `Noto Sans JP` *before* Onest for just those tokens. Low priority, cosmetic.

### 4.4 CJK literals in TypeScript source (not in the script's inputs)

The subset script reads only the two locale trees. CJK text that lives in `.ts` files is invisible to it:

| File | CJK content | Reaches resvg? | Covered by the union today? |
|---|---|---|---|
| `packages/core/src/config/consolidated-ids.ts:50-82` | ja/ko/zh names of the 3 consolidated market items | **Not today** — both consumers use `.names.en` (see I18N_AUDIT F-10) | ✅ yes (28/28, by luck — every char also appears in a locale string) |
| `packages/core/src/config/learn-links.ts:136-164` | ja/ko/zh authority names for `/manual` learn links | No (embed text) | ❌ 11 missing (医 翻 译 병 털 …) — irrelevant unless these move into a card |
| `apps/discord-worker/src/commands/schemas.ts:595-599`, `handlers/commands/preferences.ts:535-539` | `日本語 / 한국어 / 中文` language-choice labels | No (Discord UI) | partial — irrelevant |

If F-10 (localise consolidated names) is adopted, **add `consolidated-ids.ts` to the script's inputs** or the coverage test, or the next name edit there will not be subsetted.

### 4.5 User-supplied text — inherent limit

The subsets are cut from locale strings only. Text that reaches a card from users — preset `name`/`description`/`authorName` on `preset-swatch.ts`, Discord display names — can contain arbitrary CJK outside the subset and **will** render as tofu. This is by design (a full CJK face is ~10 MiB against a 3 MiB gzipped Worker limit) but is undocumented in `fonts.ts`/`CLAUDE.md`. Worth one sentence there and, for `preset-swatch`, a `□`-avoidance fallback (strip non-covered chars, or render the title in the embed rather than the image) if anyone reports it.

---

## 5. Font-stack validation

| Context | Stack | JP? | CJK fallback? | Status |
|---|---|---|---|---|
| `packages/svg/src/frame.ts` `FONT_STACKS` (mono/body/display) — used by all 12 frame cards + `commandChip`/`markFooter`/`measuredRow` | `…, Noto Sans JP, Noto Sans SC, Noto Sans KR` | ✅ | ✅ | ✅ correct |
| `packages/svg/src/base.ts` `FONTS.headerCjk/primaryCjk/monoCjk` — used **only** by `preset-swatch.ts` | `…, Noto Sans SC, Noto Sans KR` | ❌ | ✅ | ⚠️ ja text renders in SC letterforms |
| `base.ts` `FONTS.primary` / `FONTS.mono` (no CJK) — `preset-swatch.ts:270` hex (ASCII, fine), `:301` `'No valid dyes in this preset'` (ASCII, fine) | Latin only | — | — | OK as used |
| resvg `defaultFontFamily` (`services/svg/renderer.ts:103`) | `Onest` | — | — | OK — every `<text>` sets its own family |

Fix for the JP gap: add `Noto Sans JP` to `FONTS.cjk/headerCjk/primaryCjk/monoCjk` in `base.ts` (one-line each), or migrate `preset-swatch.ts` to `frame.ts` primitives (it is the only non-frame card left). Note `preset-swatch` also receives no locale at all (I18N_AUDIT F-11), so the JP gap is currently moot for dye names and only bites user-supplied Japanese preset titles.

---

## 6. Gate gap (the recurring finding)

| Audit | Stale subsets found? |
|---|---|
| 2026-04-28 | yes |
| 2026-05-28 | yes — 9 tofu glyphs |
| 2026-08-18 (og-worker dead-code) | yes — 99 stale glyphs (reverse case) → og-worker got `font-coverage.test.ts` |
| **2026-08-20 (this)** | yes — 6 missing, 217 stale |

`apps/discord-worker` has `locale-and-fonts.test.ts` but it tests **locale resolution only** — nothing reads the TTFs. `apps/og-worker/src/services/font-coverage.test.ts` already contains a dependency-free cmap reader (formats 0/4/6/12) and asserts (1) union coverage of every locale string + code-emitted glyphs and (2) JP-subset coverage of every ja CJK codepoint, warning on surplus. It ports to discord-worker almost verbatim — swap `og-strings.ts` for the bot-logic locale tree (and `consolidated-ids.ts` names if F-10 lands).

---

## 7. Actions

| # | Action | Effort | Impact |
|---|---|---|---|
| F1 | Re-run `scripts/subset-cjk-fonts.py`, commit the three subsets (closes 6 missing + 217 stale) | 5 min | correctness hygiene |
| F2 | Port `font-coverage.test.ts` from og-worker into discord-worker (`src/services/font-coverage.test.ts`); inputs = core + bot-logic locales + `MATCHING_METHOD_TAGS` + code glyphs `Δ · — … → ↓ ° ♂ ♀` | 1 h | **prevents the 4th recurrence** |
| F3 | Add `Noto Sans JP` to `base.ts FONTS.*Cjk` (or retire `preset-swatch`'s use of `base.ts` text) | 10 min | ja preset swatches |
| F4 | Document the user-supplied-text limit in `fonts.ts` header + worker `CLAUDE.md` | 10 min | expectations |
| F5 | (optional) Subset `Δ α` into the Latin faces or accept the mixed-face ΔE | 30 min | cosmetic |

Re-run the checks: the scan scripts used here (`font_audit.py`, `src_cov.py`) read the committed TTFs with fontTools and the locale JSON directly; any equivalent — or F2 once it lands — reproduces the tables above.
