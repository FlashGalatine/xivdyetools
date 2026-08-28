# i18n Audit — `apps/og-worker`

**Date:** 2026-08-20 · **Branch:** `monorepo-2.0-prep` @ `1cbb303e` · **Worker version:** og-worker 2.1.0
**Scope:** every string the worker emits — the crawler HTML (`og:title` / `og:description` / page body), the nine 15E band cards + the 2a default cards (SVG text), the six bundled fonts, and the locale data it consumes (`@xivdyetools/core` locales + its own `services/og-strings.ts` ×6 tables).
**Baseline:** `pnpm type-check` clean · `pnpm test` 274/274 · `font-coverage.test.ts` green for all six locales, 0 surplus CJK glyphs.
**Dictionary:** `docs/reference/ffxiv-terminology.md` cross-checked against the runtime source `packages/core/src/data/locales/*.json`.
**Evidence:** `evidence/probe-ja-de.txt` (every tool's crawler text + every card's `<text>` nodes rendered with `?lang=ja` and `?lang=de`), `evidence/tool-name-vocabularies.txt`, `evidence/core-locale-parity.txt`, `evidence/bot-card-roles.txt`.
**Sibling:** `docs/audits/2026-08-20-web-app-i18n/` (same day, web-app tree). OG-I18N-001 and -005 below are cross-repo with it.

---

## Executive summary

The **picture is localized; the words around it are not.** Under `?lang=`, every band card renders dye names, tool tags, decks and deck lines in the requested language with correct glyphs (the CJK subsets are tight and complete). But the `og:title` / `og:description` the crawler actually reads are English sentence templates with localized *fragments* spliced in, so a `?lang=ja` share produces `Snow White - 分裂補色 Harmony | XIV Dye Tools` above a fully Japanese card — and the CHANGELOG's "every social preview now respects the sharer's locale" overstates what ships.

More fundamentally, **no link the web-app produces ever carries `?lang=`** — `ShareService.generateUrl` does not append it and the worker resolves locale from nothing else — so the whole localized path (the ×6 tables, `translator.ts`, and ~1.1 MB of CJK subsets) is reachable only from hand-edited URLs.

| Area | Status |
|------|--------|
| Locale data parity (core, 6 locales) | ✅ 222/222 keys each, no duplicates, identical-to-EN cells are proper nouns (Gil, Lalafell…) |
| og-worker's own ×6 tables (`OG_DECK`, `TOOL_TAG`, `OG_DECK_LINE`) | ✅ complete, pinned by `og-strings.test.ts`, no unfilled placeholders |
| Fonts — coverage / staleness / stacks | ✅ every runtime string drawable, ja in the JP subset, 0 surplus glyphs, all three `STACKS` carry JP/SC/KR fallbacks |
| Reachability of localization from real share links | 🔴 none (OG-I18N-001) |
| Crawler HTML (`og:title` / `og:description` / body / `<html lang>`) | 🔴 English templates, mixed-language output (002–009) |
| Card SVG role labels | 🟡 English literals in every locale — spec'd that way, but the Discord bot localizes the same words (011) |
| Terminology | ⚪ consistent with the dictionary; one house-style note (013) |

| Severity | Count | IDs |
|----------|-------|-----|
| 🔴 High | 2 | 001, 002 |
| 🟠 Medium | 4 | 003, 004, 005, 011 |
| 🟡 Low | 4 | 006, 007, 008, 009 |
| ⚪ Info | 4 | 010, 012, 013, 014 |

---

## Findings

### OG-I18N-001 🔴 The localized path is unreachable from the app's share links *(cross-repo: web-app)*

| | |
|-|-|
| **Where** | `apps/web-app/src/services/share-service.ts:207-216` (`generateUrl` — sets tool params + `v`, never `lang`); `apps/web-app/src/services/language-service.ts` (never reads `?lang=`); `apps/og-worker/src/index.ts:175-178` (`resolveLocale` — `?lang=` or `'en'`, nothing else) |
| **Effect** | Every share link the SPA produces unfurls in English on every surface, for every user, regardless of the app language they were using. The ×6 deck/tag/line tables, `translator.ts`, the locale-aware default cards, and the three CJK subsets (JP 375 KB + SC 564 KB + KR 188 KB) are live code that production traffic cannot reach. |
| **Why not `Accept-Language`?** | Discord / X / Slack / Telegram crawlers send no useful `Accept-Language`; the sharer's locale is knowable only from the URL. `?lang=` is the right mechanism — it just has to be emitted. |
| **Fix** | In `ShareService.generateUrl`, append `lang=<current LanguageService locale>` when it is not `en` (EN stays unparameterised — matches the worker's cache-key rule at `og-data-generator.ts:52-55`). Optionally have the SPA honour an incoming `?lang=` on first load so the link's reader lands in the sharer's language; today it is ignored (harmless). Add an og-worker `index.test.ts` case is not enough here — the guard belongs in web-app's share-service tests: "non-EN locale → URL carries `lang=`". |

### OG-I18N-002 🔴 `og:title` / `og:description` are English sentence templates — localized fragments spliced in

| | |
|-|-|
| **Where** | `src/og-data-generator.ts` — harmony `:145-146, :154-155`; gradient `:177, :185-186`; mixer `:209, :220, :231`; swatch `:252-260, :632`; comparison `:304, :314-315`; accessibility `:337, :348`; extractor `:368, :375-376`; presets `:399, :408-409`; budget `:428, :432-433`; unknown-tool fallback `:698-699`; root `index.ts:688-690`; catch-all `index.ts:716-717` |
| **Observed (`?lang=ja`)** | `Snow White - 分裂補色 Harmony \| XIV Dye Tools` · `Explore 分裂補色 color harmonies for Snow White (#e4dfd0) in FFXIV. Find matching dyes for your glamour!` · `2型色覚: Snow White, Ash Grey` · `Find FFXIV dyes matching this female miqote 髪の色 (#AABBCC).` — full set in `evidence/probe-ja-de.txt` |
| **Observed (`?lang=de`)** | `Snow White - Geteiltes Komplement Harmony` · `Explore geteiltes komplement color harmonies …` · `Deuteranopie: Snow White, Ash Grey` · `See how Snow White, Ash Grey appear with deuteranopie.` |
| **What localizes today** | only the harmony-type name, the vision short name, the sheet name, and the core `tools.*` name on default cards — four nouns inside ~25 English sentences |
| **Docs** | `CHANGELOG.md:175` ("Every social media link preview now respects the sharer's locale … localized titles and descriptions") and `README.md:3` overstate this. |
| **Fix** | Author the embed copy ×6 the same way the deck was: an `OG_EMBED` table in `services/og-strings.ts` — per tool a `title` and `description` template (plus the no-data `default` description) with `{dye}`, `{dyeA}`/`{dyeB}`/`{dyeC}`, `{hex}`, `{harmony}`, `{lens}`, `{n}`, `{ratio}`, `{names}`, `{sheet}`, `{race}` placeholders, filled by a small `embed()` helper like `deckLine()`. Roughly 9 tools × 3 strings + root/fallback = ~30 strings × 6. The subset script needs nothing new — `scripts/subset-cjk-fonts.py:131` already parses **every** `  xx: {` block in `og-strings.ts` — but the crawler HTML is browser text, not resvg text, so it does not actually need the subsets; still, add the table to `stringsFor()` in `font-coverage.test.ts:148-156` only if any of it is ever drawn on a card. Keep `| XIV Dye Tools` and `XIV Dye Tools` unlocalized (the root name never localises — `og-strings.test.ts:63`). |

### OG-I18N-003 🟠 Dye names in the crawler text are always English

| | |
|-|-|
| **Where** | `src/og-data-generator.ts:106-118` — `getDyeInfo()` returns `dye.name`; every title/description above interpolates it |
| **Effect** | The embed says `Snow White`, the card beneath it says `スノウホワイト` / `Schneeweißer`. `getLocalizedDyeName()` already exists in `services/translator.ts:27-29` and every card adapter uses it. |
| **Fix** | `getDyeInfo(stainID, locale)` → `name: getLocalizedDyeName(dye, locale)`. One-line change per call site; falls out naturally with 002. |

### OG-I18N-004 🟠 `getToolName()` cannot localize extractor / presets / budget — they fall through to a formatted key

| | |
|-|-|
| **Where** | `src/og-data-generator.ts:74-86` (`toolDefault` / `getToolName` — `tool as ToolKey`), `:405` (presets title `… — ${getToolName('presets', locale)}`) |
| **Root cause** | core `ToolKey` is the six pre-5.0 tools (`packages/types/src/localization/index.ts:40`) and core `tools.*` has six entries in every locale. `TranslationProvider.getToolName()` falls back to `formatKey()` → `"Extractor"`, `"Presets"`, `"Budget"` in all six locales. The `as ToolKey` cast is what hides the type error. |
| **Observed** | `?lang=ja` `/presets/community-abc` → `Presets \| XIV Dye Tools`; `/extractor/` → `Extractor \| XIV Dye Tools`; `/presets/gc-maelstrom` → `Maelstrom — Presets \| XIV Dye Tools` |
| **Fix** | `getOgDeck(tool, locale).name` — the ×6 names for all nine tools already exist in `og-strings.ts`. Drop the cast. (See 005 for why this is the right source for the other six too.) |

### OG-I18N-005 🟠 Three tool-name vocabularies in one unfurl *(cross-repo: core / web-app)*

| | |
|-|-|
| **Where** | `og:title` ← core `tools.*` (`og-data-generator.ts:84`); card deck ← `OG_DECK.name` (`og-strings.ts`); landing page ← web-app `tools.*.title` |
| **Evidence** | `evidence/tool-name-vocabularies.txt` — **20 of 36** (locale × shared-tool) cells differ between what the embed title says and what the picture under it says. Only the harmony row is the documented deliberate shortening ("drops the Explorer suffix"); the rest is core's older vocabulary vs the 5.0 web-app titles that `OG_DECK` quotes. |
| **Examples** | de gradient: title `Verlaufs-Generator` / card `Verlauf-Ersteller` / page `Verlauf-Ersteller` · de swatch `Farbabgleich` / `Charakter-Matcher` · de accessibility `Barrierefreiheits-Check` / `Barrierefreiheitsprüfung` · ja swatch `スウォッチマッチャー` / `キャラクターマッチャー` · zh mixer `染剂调色器` / `染剂混合器` · zh accessibility `色彩辅助检测` / `无障碍检查器` · fr swatch `Comparateur de nuances` / `Nuancier` |
| **Fix (og-worker-local)** | Source the title's tool name from `OG_DECK` (same change as 004). The embed title and the picture then cannot disagree, and both match the page. The core `tools.*` ↔ web-app `tools.*.title` drift itself belongs to the sibling audit ("two vocabularies") — not fixable from here. |

### OG-I18N-006 🟡 `.toLowerCase()` on localized nouns

| | |
|-|-|
| **Where** | `src/og-data-generator.ts:146, :155` (harmony), `:256` (sheet), `:348` (vision) |
| **Effect** | German nouns lose their capital (`geteiltes komplement`, `deuteranopie`, `haarfarben`); no-op for CJK; fine only for EN. |
| **Fix** | Goes away with 002 (templates decide case per locale). Until then, lowercase only when `locale === 'en'`. |

### OG-I18N-007 🟡 Swatch sheet description interpolates raw URL slugs for race and gender

| | |
|-|-|
| **Where** | `src/og-data-generator.ts:258` — `` `…this ${gender} ${race} ${sheetName}…` `` → `female miqote 髪の色` |
| **Fix** | Race: core has `races.*` ×6 — `ogTranslator.getRace(race as RaceKey, locale)` (guard the cast; slugs are `miqote`/`aura`…, check they match `RaceKey`). Gender: no core key — two strings in the `OG_EMBED` table (002). The official race spellings are in the dictionary (§ Playable Races). |

### OG-I18N-008 🟡 `'Color Vision'` literal when `?vision=` is absent

| | |
|-|-|
| **Where** | `src/og-data-generator.ts:332` |
| **Fix** | `getLocalizedVisionName('normal', locale)` (core `visions.normal` = "Normal Vision" / `正常視覚`…), or an `OG_EMBED` string. |

### OG-I18N-009 🟡 `<html lang="en">` is hardcoded; no `og:locale`; body copy English

| | |
|-|-|
| **Where** | `src/og-data-generator.ts:468` (`<html lang="en">`, pinned by `og-data-generator.test.ts:320`), `:550` (`Open XIV Dye Tools →`); `OGData` (`types.ts:62-69`) carries no locale |
| **Fix** | Add `locale: LocaleCode` to `OGData`, emit `<html lang="${locale}">`, add `<meta property="og:locale" content="ja_JP">` (map en→`en_US`, ja→`ja_JP`, de→`de_DE`, fr→`fr_FR`, ko→`ko_KR`, zh→`zh_CN`), and put the one body string in the ×6 table. Update the test pin to assert `lang` follows the locale. |

### OG-I18N-010 ⚪ Curated preset name + description are EN-only in the embed (by design)

`presetData` carries one `name`/`description`; `4-og-15e-band-port-spec.md:118` says "preset names not localised". The embed description (`og-data-generator.ts:408-409`) therefore mixes an English sentence with an English blurb in every locale — falls under 002 for the sentence, accepted for the blurb. No action unless presets gain localized names upstream.

### OG-I18N-011 🟠 Band role labels are English literals on every card, in every locale — *decision needed*

| | |
|-|-|
| **Where** | harmony `BASE` (`svg/harmony.ts:117`) · gradient `START`/`END` (`:75`) · mixer `BUYABLE` (`:93`), `A`/`B`/`C` (`:85-87`) · swatch `TARGET`, `NO STAIN ID` (`svg/swatch.ts:62-64`) · comparison `CLOSEST PAIR`, `CLOSEST Δ…` (`:68, :85`) · accessibility `AS DESIGNED` (`:80`) · budget `TARGET · …`, `COFFER`, `BOARD`, `STD SPECTRUM`, `WIDE #1/#2`, `VENDOR 216 G`, `BEST · …` (`svg/budget.ts:36-44, :88, :131-132`) · presets `CURATED` (`svg/presets.ts:65`, `index.ts:276`) · not-found `NOT FOUND` (`svg/band-shared.ts:52`) |
| **Design intent** | `4-og-15e-band-port-spec.md:104-118` spells these in English, and `ALGO_TAG` / `LENS_SHORT` are explicitly "identifiers — never localise". So this is *as specified*. |
| **But** | the Discord bot localizes the same words on its cards — `bot-logic` `card.base` → `BASIS` / `ベース` / `베이스`, `card.target` → `ZIEL` / `目標色`, `card.designed` → `WIE ENTWORFEN` / `本来の色`, `card.vendorCheaper` → `HÄNDLER GÜNSTIGER` / `店売りが安い` (`evidence/bot-card-roles.txt`). A DE user sees `BASIS` in the bot embed and `BASE` in the link unfurl of the same result. |
| **Options** | (a) keep as identifiers and say so in the `og-strings.ts` header (one sentence, like `ALGO_TAG`'s); (b) add an `OG_ROLE` ×6 table (~13 word-roles: BASE, START, END, TARGET, BUYABLE, CLOSEST PAIR, AS DESIGNED, NOT FOUND, CURATED, BEST, VENDOR, COFFER, BOARD), reusing bot-logic's `card.*` vocabulary where it exists, and keep true codes (`A`/`B`/`C`, `ΔE…`, `DEUT`, `STD SPECTRUM`, `WIDE #1`) untranslated. |
| **If (b)** | re-run `scripts/subset-cjk-fonts.py` (new glyphs), add the table to `stringsFor()` in `font-coverage.test.ts`, and mind width — roles already ellipsise on narrow bands (`TARGET · STD SP…`, `WIDE…`, mixer's `A ·…` at ratio 30), and `WIE ENTWORFEN` is two characters longer than `AS DESIGNED`. |
| **Recommendation** | (b) for the word-roles — the bot already made this call and the two surfaces should agree; the picture is the one thing in the unfurl the user actually looks at. |

### OG-I18N-012 ⚪ Fullwidth colon + ASCII space in the ja / zh budget deck

`OG_DECK_LINE.budgetBest` ends in `：` for ja/zh and `svg/budget.ts:127` appends `' ' + bestName` → `ポイント当たり最良： ピュアホワイト` (double gap; the fullwidth colon carries its own spacing). Move the name into the template (`'ポイント当たり最良：{name}'`) and let `deckLine()` fill it — the EN/DE/FR/KO forms keep their space inside the template.

### OG-I18N-013 ⚪ Terminology / house style

- Dictionary check: every game noun in `og-strings.ts` and in the core data the worker renders matches `ffxiv-terminology.md` (Marktbrett, 染剂, 염료, teinture, マーケットボード, 市场布告板). No official-term violations.
- ja "dye" is written both ways in the deck: `カララント` ×5 and `染料` ×8 (e.g. harmony sub `…好きなカララントを軸に…実在の染料のみ`). The official noun is `カララント` (core `labels.dye`); `bot-logic` ja uses it exclusively (72 : 0), web-app mixes (85 : 39). A style choice, not a defect — flag for the next string pass.
- fr `Palettes Communautaires` is title-cased where the rest of the fr table is sentence-cased (`Harmonies de couleurs`, `Constructeur de dégradé`).
- `216 G` (budget) is an EN gil abbreviation on every locale's card; ja would read `216ギル` / ko `216길` / zh `216金币` (dictionary § Currencies). Part of 011's decision.

### OG-I18N-014 ⚪ Dead English literals

`DEFAULT_DECK.label` (`'/HARMONY'`, `'/GRADIENT'`, … ×9 — `svg/default-card.ts:187-197`) is never read: `index.ts:272` builds the label from `getToolTag(tool, locale)`. knip cannot see an unused object *property*. Drop `label` from `DEFAULT_DECK` (keep `glyphName`). `index.ts:276` also duplicates presets' `'CURATED'` literal — fold into whichever table 011 lands in.

---

## Verified clean

| Check | Result |
|-------|--------|
| Core locale parity (`packages/core/src/data/locales/`) | 222 leaf keys in all six files, 0 missing, 0 extra, 0 duplicate keys; 10 de / 9 fr cells identical to EN are proper nouns (`Gil`, `Lalafell`, `Miqo'te`, `Roegadyn`, `Hrothgar`, `Viera`, clans) — correct |
| `OG_DECK` / `TOOL_TAG` / `OG_DECK_LINE` | 10 + 9 + 4 keys × 6 locales, all present, `{n}`/`{hex}` preserved, EN writes EN-US — pinned by `og-strings.test.ts` |
| Font coverage | `font-coverage.test.ts` green: every runtime string codepoint drawable in all six locales; code glyphs `Δ · — … → – ↔ ≈ ° # %` present; every ja CJK codepoint is in the **JP** subset (Japanese letterforms); **0** surplus CJK glyphs in JP/SC/KR (no staleness) |
| Font files | Onest 123 KB, Space Grotesk 134 KB, Fragment Mono 125 KB, NotoSansJP-Subset 375 KB, NotoSansKR-Subset 188 KB, NotoSansSC-Subset 564 KB. SC is over the generic 500 KiB guideline, but it is the documented ja→SC fallback carrying both ja and zh and measures 0 surplus — it is the size the strings require, not bloat |
| Font stacks | `tokens.ts:18-20` — `mono`, `body`, `display` all end in `Noto Sans JP, Noto Sans SC, Noto Sans KR`; `renderer.ts` loads all six buffers; JA puts JP before SC. No stack references an unloaded face |
| CJK layout | `wrapName` (`band.ts:249-300`) wraps CJK per character and hyphenates Latin (`Rußschwarzer` → `Rußsch-/warzer`); `estimateTextWidth` is CJK-aware; verified in the probe (`スノウホワイ` / `ト`, `Schneewe-` / `ißer`) |
| Crawler HTML encoding | `Content-Type: text/html; charset=utf-8`, `escapeHtml` on every interpolation; CJK survives (probe) |
| `?lang=` propagation | every emitted `og:image` / `twitter:image` URL carries `lang` for non-EN (`index.test.ts:561-581`); EN unparameterised for stable cache keys |
| Stateless translator | `translator.ts` preloads six locales; every lookup passes `locale` explicitly — no per-request state (REFACTOR-001 holds) |
| JSON error bodies (`index.ts` 400/404s) | developer-facing, English — correctly out of scope |

## Incidental (not i18n) — surfaced by the probe

- Mixer 2-dye: the A band's role `A · 30%` ellipsises to `A ·…` at ratio 30 (`svg/mixer.ts:89` — the proportional band is too narrow for the role). The B band keeps `B · 70%`.
- Budget: `TARGET · STD SPECTRUM` → `TARGET · STD SP…` and `WIDE #1` → `WIDE…` on **both** frames; the comment at `svg/budget.ts:111-118` anticipated the row-figure overflow but the target's role label overflows too. The design's own `role` slot cannot hold the tier name.

---

## Remediation sketch (og-worker-local unless marked)

| Step | Finding(s) | Touches |
|------|------------|---------|
| 1. **web-app** `ShareService.generateUrl` appends `lang=` for non-EN (+ test) | 001 | `apps/web-app/src/services/share-service.ts` — coordinate with the sibling audit's share-service rows |
| 2. `OG_EMBED` ×6 table in `og-strings.ts` + `embed()` helper; rewrite `og-data-generator.ts` templates on it; `getDyeInfo(id, locale)`; tool names from `getOgDeck(...).name`; race via `getRace`; drop `.toLowerCase()` | 002, 003, 004, 005, 006, 007, 008 | `og-strings.ts`, `og-data-generator.ts`, tests |
| 3. `OGData.locale` → `<html lang>` + `og:locale` + body string | 009 | `types.ts`, `og-data-generator.ts`, `og-data-generator.test.ts:320` |
| 4. Decide 011; if (b): `OG_ROLE` ×6, adapters read it, re-subset, extend `stringsFor()`; fix 012's template; drop `DEFAULT_DECK.label` | 011, 012, 014 | `og-strings.ts`, nine adapters, `band-shared.ts`, `default-card.ts`, `index.ts:276`, `scripts/subset-cjk-fonts.py` run, `font-coverage.test.ts` |
| 5. Correct `CHANGELOG.md:175` / `README.md:3` wording once 2 lands; bump og-worker version | docs | |

Gate to add with step 2: a `og-data-generator.test.ts` case that renders every tool with `?lang=ja` and asserts the title/description contain **no** `[A-Za-z]{4,}` run other than `XIV Dye Tools`, dye hexes and the preset blurb — the "mixed-language" shape this audit found is exactly what such a test would have caught.

---

## Remediation status (2026-08-21)

All fourteen findings executed on `monorepo-2.0-prep`:

| Commit | Findings | What |
|--------|----------|------|
| `ca2443bf` | 002, 003, 004, 005, 006, 007, 008, 009 (+ root / catch-all) | `OG_EMBED` ×6 in `services/og-embed.ts` + `embed()`; `og-data-generator.ts` rewritten on it; localized dye names; tool names from `OG_DECK`; clan/race via core; `OGData.locale` → `<html lang>` + `og:locale` + body link; ja gate test |
| `c7dd8595` | 011 (option b), 012, 014 | `OG_ROLE` ×6 in `og-strings.ts` + `role()`; all nine adapters + `notFoundBand(locale)` + the presets default `CURATED`; `budgetBest {name}`; `DEFAULT_DECK.label` removed; CJK subsets re-cut (JP 372 KB / SC 558 KB / KR 185 KB); `font-coverage.test.ts` covers `OG_ROLE`; `roles-i18n.test.ts` |
| `7c992e35` | 001 *(web-app)* | `ShareService.generateUrl` appends `lang=` for non-EN |
| docs commit | 010, 013 (noted, no code change); CHANGELOG 2.2.0, README, CLAUDE.md, version bump | — |

Verification at the docs commit: og-worker `pnpm type-check` clean, `pnpm test` 302/302 (was 274), `pnpm lint` (knip both modes) clean; web-app `pnpm type-check` clean, unit suite 2465/2465.

Left as designed / noted only: **010** (preset name + blurb EN-only by spec), **013** (ja 染料/カララント house style, fr title case, `216 G` — for the next string pass). The incidental layout notes (mixer `A ·…`, budget `TARGET · STD SP…`) were not touched — they are not i18n and the role slot is the design's.
