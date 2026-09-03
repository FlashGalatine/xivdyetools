# Coordinator verification — i18n audit 2026-09-03

Work done in the coordinator's own context (not delegated), each claim verified by opening
the file at the line named. Scripts under `scripts/`, raw output beside this file.

## 1. Gate baseline (all green)

Re-run after the first pass was invalidated by my own bad flag — see §6.

| Gate | Result |
|---|---|
| `core` build:locales + `git status` on the generated locales | exit 0, **no drift** (no hand edits to the generated JSON) |
| `core` band-vocabulary / DyeSearch / LocalizationService parity | 3 files, 23 tests pass |
| `bot-logic` `src/i18n` (parity, orphans, reverse key-existence, `.tc()`) | 3 files, 35 tests pass |
| `web-app` `validate:i18n` (key order + parity) | exit 0 — "i18n parity clean" |
| `web-app` `i18n:unused` | 1152 keys, **0 orphaned** |
| `web-app` i18n-orphans / locale-switch / chara-import / preset-i18n | 4 files, 50 tests pass |
| `og-worker` og-strings / roles-i18n / og-data-generator / font-coverage | 4 files, 116 tests pass |
| `discord-worker` bot-i18n / i18n / locale-and-fonts / font-coverage | 4 files, 69 tests pass |
| `moderation-worker` bot-i18n / i18n | 2 files, 90 tests pass |
| `svg` full suite | 16 files, 270 tests pass |
| `web-app` eslint (`xivdyetools-i18n/*` at `warn`) | 237 files linted, **0 messages** |

## 2. Locale-file parity (`locale-diff.py`, all three sets)

| Set | Keys × 6 | dup | missing | extra | placeholder mismatch |
|---|---|---|---|---|---|
| `packages/core/src/data/locales` | 222 | 0 | 0 | 0 | 0 |
| `packages/bot-logic/src/i18n/locales` | 505 | 0 | 0 | 0 | 0 |
| `apps/web-app/src/locales` | 1154 | 0 | 0 | 0 | 0 |

No structural defect anywhere. `script-inventory.py` shows no unexpected script blocks
(no Cyrillic / Arabic / Thai / Devanagari) — only Latin-1, Greek (Δ α), CJK, Hangul, kana,
fullwidth and CJK punctuation, as designed.

## 3. Fonts — settled, nothing to fix

`font-union-analysis.py` models glyph resolution the way the runtime does (union of the
faces the worker bundles, because every stack lists all three CJK subsets):

| Worker | Needed cps | Union cmap | Needed but in **no** face | Surplus CJK glyphs |
|---|---|---|---|---|
| `discord-worker` | 1680 | 2437 | 2 (`U+000A`, `U+FE0F`) | **0** in JP/KR/SC |
| `og-worker` | 956 | 1748 | **0** | **0** in JP/KR/SC |

Per-face: discord JP 514/514, KR 484/484, SC 1065/1065 needed — zero waste. og JP 221/221,
KR 301/301, SC 562/562 — zero waste.

## 4. Cross-surface vocabulary drift (`vocab-split.py`) — the audit's main finding

Pairs a `web-app` / `bot-logic` key with a `core` key when their **English** values match,
then compares the five target locales. 39 pairs, **28 diverge in at least one locale**.

Verified who actually renders what:

- `apps/web-app/src/services/harmony-generator.ts:99` and
  `apps/web-app/src/components/v4/config-sidebar.ts:927-943` → `LanguageService.getHarmonyType()` (**core**)
- `apps/web-app/src/components/accessibility-tool.ts:696,807,1347,1794` → `LanguageService.getVisionType()` (**core**)
- `apps/og-worker/src/services/translator.ts:43` → `ogTranslator.getHarmonyType()` (**core**)
- `packages/bot-logic/src/commands/harmony.ts:127-134` → bot-logic's own `harmony.*` keys (**not core**)
- `packages/bot-logic/src/commands/accessibility.ts:102` → bot-logic's own `accessibility.*` keys (**not core**)

So the Discord bot is the outlier: web-app and og-worker agree with core, the bot does not.
Same concept, different words, in ja / ko / zh / de. Examples:

| Concept | web-app + og-worker (core) | Discord bot (bot-logic) |
|---|---|---|
| Split-Complementary (ja) | 分裂補色 | スプリット補色 |
| Tetradic (ja) | 四色配色 | テトラード |
| Monochromatic (ja) | 単色 | モノクロマティック |
| Square (ko) | 정사각형 | 정방형 |
| Triadic (zh) | 三角配色 | 三色 |
| Protanopia (ko) | 제1색맹 | 적색맹 |
| Deuteranopia (ko) | 제2색맹 | 녹색맹 |
| Normal Vision (de) | Normales Sehen | Normale Sicht |

This matters now because PR #159 (`9ef904cf`, merged 2026-09-03) converged the harmony
*algorithm* across exactly these three surfaces — the **names** are what is left disagreeing.

## 5. Terminology vs `docs/reference/ffxiv-terminology.md` (`term-check.py`)

45 dictionary rows map to a core key; **3 mismatches**, all Japanese, all hardcoded in the
generator (so the fix goes in `build-locales.ts`, never in the generated JSON):

| Core key | Dictionary | core | Line | Read |
|---|---|---|---|---|
| `categories.Neutral` | 無彩色系 | ニュートラル | `packages/core/scripts/build-locales.ts:283` | core is the outlier — its other categories use the 〜系 pattern (赤系 青系 茶系 緑系 黄系 紫系) |
| `acquisitions.Dye Vendor` | 染色師 | 染料販売業者 | `build-locales.ts:355` | core is a literal translation; 染色師 is the in-game NPC name |
| `acquisitions.Crafting` | 制作 | 製作 | `build-locales.ts:356` | **the dictionary is the likely error** — FFXIV JP uses 製作 for crafting. Needs a human call, not a code change |

## 6. Rejected suspicions (do not re-chase)

- **Six gates "failing".** My first run passed `--reporter=basic`; vitest 4 has no `basic`
  reporter, so `loadCustomReporterModule` threw before a single test ran. Re-ran without it:
  all green. A red gate here is a flag error until proven otherwise.
- **CJK punctuation missing from the JP/KR subsets** (`font-coverage.py` reports
  `，、。「」〜！（）／：；＝？` missing). Not tofu: every one is carried by the SC (and mostly
  JP) subset, and every stack lists all three CJK faces. The skill's per-font script is
  stricter than the runtime; the repo's own union-based gate is the correct model.
- **`U+FE0F` in no bundled face** (from `preferences.values.male/female` = `♂️ ♀️`).
  `apps/discord-worker/src/services/font-coverage.test.ts:152` excludes it deliberately —
  it is a zero-width variation selector, and `♂ ♀` themselves are covered.
- **Subsets over the 500 KiB "over-inclusion" threshold** (discord SC 814 KiB, JP 547 KiB;
  og SC 558 KiB). Surplus is **0** glyphs in all six subsets — the size is the honest cost of
  1065 / 562 CJK codepoints. The byte threshold is a bad proxy here.
- **discord-worker fonts cut before the last string change** (fonts `2026-08-29T00:30`,
  bot-logic locales `2026-08-29T15:06`). Coverage is complete, so that change added no new
  glyph. Near-miss, not a defect — the gate is what caught it.
- **core `visions.*` duplicating `visionTypes.*`.** Deliberate: `visions.*` is the short form,
  `visionTypes.*` the long form with the parenthetical gloss.
- **web-app de `swatch.slotTattoo` = "Tattoo"** and the other identical-to-EN values.
  `apps/web-app/scripts/i18n-identical-allowlist.json` carries a written reason per entry
  ("cognate - 'Tattoo' is German") and the parity gate reports allow-list entries that stop
  being identical, so the file cannot rot.
- **`labels.dark` pairings** (`themes.standardDark`, `swatch.rangeDark`). Same English word,
  different concepts — a theme name and a lightness-range label are not the dye "Dark"
  property. core's fr value is lowercase `foncé`, i.e. an inline modifier. Not drift.

## 7. Positive controls (already right — do not re-file next audit)

- Three locale sets, 1881 keys per locale across them, zero duplicate / missing / extra /
  placeholder defects. Nothing in this audit is a locale-file data defect.
- `web-app`'s identical-value allow-list with a per-entry reason **and** staleness reporting is
  the strongest guardrail of the three sets — the model the others should copy.
- `web-app` eslint i18n rules: 237 files, 0 warnings.
- `discord-worker/src/services/font-coverage.test.ts` is a genuinely well-built gate: union
  semantics, a separate "ja glyphs must be in the JP subset" assertion, surplus as a warning,
  and a comment explaining why md5 comparison is wrong.
- core's generated locales have **no drift** — nobody has hand-edited a generated artifact.
