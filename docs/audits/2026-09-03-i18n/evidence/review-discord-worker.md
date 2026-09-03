# i18n review — apps/discord-worker (2026-09-03)

**Reviewer unit:** `apps/discord-worker` only (bot-logic/core/svg opened only to resolve keys/stacks the worker calls into).
**Repo state audited:** worktree `i18n-audit-2026-09-03`, HEAD `32e08207` (2026-09-01, "docs(repo): add Working-in-this-checkout block").
**Method:** static only — grep/read/python (fontTools + json), no pnpm/vitest/build run. Read-only throughout.

## 0. IMPORTANT scope caveat — this checkout is behind `origin/main`

`git merge-base HEAD origin/main` = `8ca1bb09` (2026-08-31). HEAD (`32e08207`) is **not an ancestor of** `origin/main` (`cf79ac9f`, 2026-09-03) — this worktree branched before four PRs that the task brief explicitly asks me to check landed on main:

| PR | Subject | Merge commit (on `origin/main`) | Present in this worktree? |
|---|---|---|---|
| #158 | worktree-deep-dive-2026-09-02 | `1602239f` | **No** |
| #159 | harmony-convergence-2026-09-03 (`generateHarmonySlots`) | `9ef904cf` | **No** |
| #160 | swatch-show-all-pieces | `ec4b3b61` | **No** |
| #161 | review-followups-2026-09-03 | `cf79ac9f` | **No** |

Verified directly: `grep -rn "generateHarmonySlots"` across `packages/core/src`, `packages/bot-logic/src`, `apps/discord-worker/src` returns nothing; `git log` on both `apps/discord-worker/src/handlers/commands/harmony.ts` and `packages/bot-logic/src/commands/harmony.ts` shows no commit after 2026-08-29 (analytics-only) / 2026-08-21 (F-13) respectively — i.e. no hue-rotation or slot-naming change of any kind since the last i18n audit.

**Consequence for Check 5:** the harmony-convergence item ("check that the harmony slot/name vocabulary the bot renders is localized in all six") **cannot be evaluated in this snapshot** — the code it refers to is not present. This is reported as a scope gap, not a finding. Everything else in Check 5 (changelog, analytics Tier A, stainID, `.chara` name-privacy) *is* present and was checked normally (§5).

---

## 1. Hardcoded user-visible strings

Commands run exactly as specified:

```
git ls-files 'apps/discord-worker/src/**/*.ts' | grep -v -E '\.test\.ts$|localize' \
  | xargs grep -n -E "['\"\`][A-Z][a-z]+( [a-z]+){2,}"
```
→ 177 hits (`/tmp/check1_sentences.txt`).

```
git ls-files 'apps/discord-worker/src/services/**/*.ts' 'apps/discord-worker/src/handlers/**/*.ts' | grep -v -E '\.test\.ts$' \
  | xargs grep -n -E "['\`][A-Z][a-z]+ [A-Za-z]+['\`]"
```
→ 25 hits (`/tmp/check1_twoword.txt`).

### Triage

Every hit falls into one of these buckets — none is a new user-visible defect:

| Bucket | Count (approx) | Examples | Disposition |
|---|---|---|---|
| `schemas.ts` command/option `description:` strings | ~95 | `harmony.ts` companions, `/dye list category`, `/preferences set` options | Known F-03 phase-2 gap (option descriptions never localized) — see §3. Not re-filed. |
| `logger.error(...)` / `logger.warn(...)` / `console.error(...)` | ~45 | `index.ts`, `preferences.ts`, `rate-limiter.ts`, `env-validation.ts`, `svg/renderer.ts` | Log messages — excluded per brief. Verified each is a first-arg literal passed to a logger call, not user-facing (spot-checked 8, all confirmed `logger?.` / `console.error` receivers). |
| `/stats` panel strings (`stats.ts:265,302,354,456,546`) | 5 | `'Stats stored in Cloudflare KV…'`, `'No commands executed yet'` | Explicitly on the "Do NOT file" list (four `/stats` admin dashboards). Not re-filed. |
| Clan display labels (`types/preferences.ts:192-193`) | 2 | `SeekerOfTheSun: 'Seeker of the Sun'` | On the README's "Left open by design" list (clan autocomplete labels). Not re-filed. |
| `about.ts` attribution/trademark block | 2 | `ATTRIBUTION`, `BUILT_ON` (line 25-32) | File comment: "Verbatim in every locale... a trademark notice is a fixed string." Deliberate (matches prior audit's "about.ts 0 (2 deliberate)"). Not filed. |
| `preset-notifications.ts` moderation-channel copy | 8 | `'No visible changes'` (:106) | Admin/moderator-only surface (posts to `MODERATION_CHANNEL_ID`), unchanged since before 2026-08-21, already catalogued in prior `HARDCODED_STRINGS.md` §2.6 (mixed `adminT.t()`/literal). Not re-filed (file untouched in `git log --since=2026-08-21`). |
| `quick-picks.ts` dye `name:` fields | 22 | `'Jet Black'`, `'Pure White'`, … | See §3 — feeds an unlocalized Discord choice list, same class as documented F-03 phase-2 gap, but the list **grew from 5 → 22 entries** since the prior audit. Reported as status/growth, not a new class. |
| JSDoc examples / comments | 4 | `sanitize.ts:43,45`, `registry.ts:25`, `preset-notifications.ts:13` | Comments, not runtime strings. |
| Internal error messages never shown to a Discord user (thrown, caught, and replaced by a translated string before any response) | ~12 | `universalis-client.ts:112,179` (`UniversalisError` — verified caught at `budget.ts:402-405`, only `t.t('budget.errors.rateLimited')`/`t.t('budget.errors.apiError')` reach the embed), `budget-calculator.ts:131`, `preset-api.ts:178`, `svg/renderer.ts:54,116` | Verified by tracing the catch site for each; none renders the raw `.message` in an embed/content field. |

**No new hardcoded user-visible string was found.** All 202 raw grep hits resolve to either an already-documented/settled category or a non-user-facing sink.

### Regression check on the 2026-08-21 remediation (spot-verified, not just assumed)

| Prior finding | Fix commit | Verified still holding? |
|---|---|---|
| F-01 (7 missing keys) | `8cc40c13` | Yes — `budget.noWorldSet.{title,description}`, `budget.errors.{missingWorld,saveFailed,missingPreset}`, `common.unknownError`, `preset.notFound` all resolve in all 6 bot-logic locales (python check, §2 script). |
| F-04 (rate-limit message) | `b1dcfd55` | Yes — `rate-limiter.ts:314` now `t.tc('errors.rateLimited', seconds, { seconds })`; `errors.rateLimited_one`/`_other` present in all 6 locales. |
| F-05 (extractor subcommand errors) | `6185a10d` et al. | Yes — `extractor.ts:180,198` now `t.t('errors.missingSubcommand')` / `t.t('errors.unknownSubcommand', {...})`, matching `dye.ts:68,87`. |
| F-05 (preset field names) | `6185a10d` et al. | Yes — `preset.ts:1023,1027,1034,1035` now `t.t('preset.colors')` / `t.t('preset.tags')` / `t.t('preset.author')` / `t.t('preset.votes')` (raw `Name`/`Category`/`Dyes` gone). |
| F-05 (preferences filter labels / affects / blending-mode & method descriptions) | `d70b67f7`/`0f8ce291`/`689f431c` | Yes — now dynamic keys `preferences.filters.labels.*`, `preferences.affects.*`, `preferences.methods.*`, `preferences.blendingModes.*` (all verified resolving, §2). |
| F-06 (`/swatch` `errorMessage` English passthrough) | `78d4be62` | Yes — `packages/bot-logic/src/commands/swatch.ts:236,267,290,425` all set `errorMessage: t.t(...)` before returning; the worker's `swatch.ts:244` render of `result.errorMessage` is therefore already-localized text, not raw English. |
| F-07 (Skybuilders currency spelling) | `f9ad62d5` | Yes — `dye-vocabulary.ts:58` and `consolidated-ids.ts:72` both spell `'Skybuilders Scrips'` (no apostrophe), matching the `currencies` key in all 6 core locale files. |
| F-13 (dead `\|\| 'fallback'`) | `71301da7` | Yes — `grep -n "t\.t([^)]*)\s*\|\|\s*'"` across discord-worker + bot-logic returns zero hits. |
| F-13 (bot-logic `createTranslator` without logger) | `71301da7` | Yes — all 8 bot-logic command files now call `createTranslator(locale, input.logger)`. (Note: discord-worker's *own* several `createTranslator(locale)` calls, e.g. `harmony.ts:119`, are a different call and were never part of F-13's scope — not evaluated further, out of this audit's 5 checks.) |

---

## 2. Dynamically-built keys

Searched both `apps/discord-worker/src` and `packages/bot-logic/src` (non-test) for `t.t(`/`t.tc(` calls whose key argument is a template literal, string concatenation, or a bare identifier:

```
xargs grep -n -E "\.t(c)?\(\s*\`" ...            # template-literal keys
xargs grep -n -oE "\bt\.tc?\([a-zA-Z_][a-zA-Z0-9_.]*[,)]" ... | grep -v "t\.t([\"']"   # bare-identifier keys
```

Every dynamic key site found, the source enum/table it iterates, and resolution across all 6 `packages/bot-logic/src/i18n/locales/*.json` (verified with `C:\tmp\check2_dynamic_keys.py`, fontTools-free, pure `json`):

| Site | Key pattern | Possible suffixes (source) | Resolves in en/ja/de/fr/ko/zh? |
|---|---|---|---|
| `manual.ts:290,298` | `manual5.topics.${key}.{body,name}` | `TOPIC_KEYS` (manual.ts:242-248) → 5 of 6 `ManualTopicId` (core `learn-links.ts:36-41`); `match_image` handled by a separate branch, guarded by `topic in TOPIC_KEYS` at `manual.ts:326` so `key` is never `undefined` at the call site | **OK** all 10 (5 topics × 2 fields) |
| `manual.ts:294` | `manual5.learnLead` (static) | — | OK |
| `preferences.ts:120` | `preferences.filters.labels.${option}` | `FILTER_OPTION_KEYS` (preferences.ts:107-116), 8 options | **OK** all 8 |
| `preferences.ts:212,363,378,401,481` | `preferences.keys.${key\|f.key\|s.key}` | `PreferenceKey` union (types/preferences.ts:32-47), 15 values | **OK** all 15 |
| `preferences.ts:596` | `preferences.blendingModes.${m.value}` | `BLENDING_MODES` (`@xivdyetools/core/blending/types.ts:13-20`), 6 values | **OK** all 6 |
| `preferences.ts:603` | `preferences.methods.${m.value}` | `MATCHING_METHODS` (types/preferences.ts:145-156), 6 values | **OK** all 6 |
| `preferences.ts:391` | `t.t(v)` where `v` is one non-`/`-prefixed entry from `getAffectedCommands()` | `services/preferences.ts:570-590`, switch over all 15 `PreferenceKey` (exhaustive — no `default`, and TS would error on a missing arm); returns either a literal `/command` token (untranslated by design) or one of 4 `preferences.affects.*` keys | **OK** all 4 (`allCommands`,`marketData`,`everyCard`,`resultCards`) |
| `about.ts:79` | `t.t(meta.labelKey)` | `CATEGORY_META` (about.ts:50-56), 5 `CommandCategory` values | **OK** all 5 |
| `bot-logic/commands/accessibility.ts:102` | `t.t(\`accessibility.${lens}\`)` | `VisionType` (`@xivdyetools/types`), 4 values (`normal` handled separately) | **OK** all 4 |
| `bot-logic/commands/harmony.ts:130-144` | `t.t(key)` where `key = keyMap[type]` | `keyMap` covers all 8 `HarmonyType` values exhaustively — the English `formats` fallback table below it is dead code (unreachable for any valid `HarmonyType`), matching prior audit F-12 | N/A — dead code, not reachable; not a defect |
| `bot-logic/commands/gradient.ts:340` | `t.tc('gradient.steps', stepCount)` | static key, plural-aware | `gradient.steps_one`/`_other` present in all 6 (no bare `gradient.steps`, correct — matches F-09's `_one`/`_other` convention) |

**Result: zero dynamic-key misses.** Every enumerable suffix resolves in all six bot-logic locale files. This is a clean positive control — the F-01/F-05/F-09 remediation correctly extended to every dynamically-built key it touched, not just the literal ones a reverse-gate would catch.

`localize.ts:101,103,127` (`t.t(key)`/`t.t(v)` inside `choiceLocalizations`) is build-time-only (never imported by the runtime worker — see §3) and is exercised against every value actually present in `schemas.ts`'s choice arrays at `register-commands.ts` run time; not a runtime dynamic-key risk.

---

## 3. Command metadata coverage

`apps/discord-worker/src/commands/localize.ts` (195 lines) and `registry.ts` (65 lines) read in full.

**Zero diff since `102a5520` (2026-08-21, F-03 phase 1)** — `git diff 102a5520 HEAD -- apps/discord-worker/src/commands/localize.ts apps/discord-worker/src/commands/registry.ts` is empty. The localization *machinery* has not changed; only the *data* it operates on (`schemas.ts`) has.

Mechanism (confirmed by reading the code, not assumed):
- `description_localizations` is attached **only at the top-level command**, from `commands.<name>.description`, data-driven off `registry.ts`'s 17 names — so a **new command automatically gets coverage with zero code change**, as long as its locale key exists.
- Option-level `description_localizations` is **never** set (`localizeOption` only touches `choices`) — this is F-03 phase 2, unchanged, documented.
- `name_localizations` is **never** set on a top-level command (command tokens stay typed identifiers in every locale — deliberate, not a gap). It **is** set on `Choice.name_localizations`, but only for 6 hardcoded `(command, option)` pairs in `choiceLocalizations()` (`localize.ts:116-145`): `preferences/key`, `preferences/gender`, `preferences/theme`, `harmony/type`, `accessibility|a11y/vision`, `dye/category`.

### Per-command table (17 commands from `registry.ts`)

| Command | `description_localizations` (top-level) | Option `description_localizations` | Choice `name_localizations` | Notes |
|---|---|---|---|---|
| `about` | ✅ (verified all 6 locales) | n/a (no options) | n/a | |
| `harmony` | ✅ | ❌ (phase 2) | `type` ✅ (8/8 verified) · `color_space` ❌ · `matching` ❌ | |
| `mixer` | ✅ | ❌ | `mode` ❌ · `matching` ❌ | |
| `gradient` | ✅ | ❌ | `color_space` ❌ · `matching` ❌ | |
| `extractor` | ✅ | ❌ | `matching` ❌ (×2 subcommands) | |
| `swatch` | ✅ | ❌ | `order` ❌ · `slot` ❌ | |
| `dye` | ✅ | ❌ | `list category` ✅ (8/8) | |
| `comparison` | ✅ | ❌ | `matching` ❌ | |
| `contrast` | ✅ | ❌ | n/a | |
| `accessibility` | ✅ | ❌ | `vision` ✅ (incl. `allLenses`, verified) | shares `ACCESSIBILITY_OPTIONS` with `a11y` |
| `a11y` | ✅ | ❌ | `vision` ✅ | second registration, same handler (Discord has no alias) |
| `budget` | ✅ | ❌ | `matching` ❌ · `quick preset` ❌ (grew 5→22, see below) | |
| `preset` | ✅ | ❌ | `category` ❌ (×3 subcommands) · `list sort` ❌ | |
| `preferences` | ✅ | ❌ | `key` ✅ (16/16) · `gender` ✅ · `theme` ✅ · `blending` ❌ · `language` — native endonyms hardcoded directly, correct by design | |
| `manual` | ✅ | ❌ | `topic` ❌ (no `choiceLocalizations` case for `manual`/`topic`, despite `manual5.topics.*.name` existing and being used at render time — F-03 phase-2 gap, not previously itemized by name but same class) | |
| `changelog` | ✅ **(added 2026-08-22, after F-03 phase 1 — verified covered automatically)** | ❌ (`version` option is free-text, no choices) | n/a | **Positive regression check: new command inherited coverage for free.** |
| `stats` | ✅ | ❌ | n/a | |

All ❌ cells above are the pre-existing, documented "F-03 phase 2: option descriptions, remaining choice lists" gap (README "Left open by design") — **not re-filed as new**, except where noted.

### Status item: `/budget quick preset` choice list grew 5 → 22 entries, still unlocalized

`git diff 102a5520~1 HEAD -- apps/discord-worker/src/commands/schemas.ts` (123-line diff, read in full) shows the only *structural* schema change since F-03 phase 1: `/budget quick preset`'s `choices` array changed from a **hardcoded 5-entry list** (`Pure White`, `Jet Black`, `Metallic Silver`, `Metallic Gold`, `Pastel Pink`) to `QUICK_PICKS.map((pick) => ({ name: `${pick.emoji} ${pick.name}`, value: pick.id }))` (`schemas.ts:1264-1267`), and `services/budget/quick-picks.ts` now defines **22** dye entries (`grep -c "^\s*id: '"` = 22), each with an English `name:` field (`'Jet Black'`, `'Cherry Pink'`, `'Metallic Brass'`, …).

This is the *same class* of gap the prior audit already catalogued (`/budget quick preset` in the F-03 §3 table, "5 ≙ `getLocalizedDyeName`") — `choiceLocalizations()` has no `(command==='budget', option==='preset')` case, so none of these are localized, even though core's `getLocalizedDyeName` could supply every one. The surface simply grew 4.4×. Reported as status per the brief's instruction ("may be reported as status... unless the surface grew"); filed as `cand-dw-02` (P3) because of the growth.

---

## 4. Fonts

### 4.1 CJK coverage in every stack — clean

`src/services/svg/base.ts` does not exist in discord-worker; the stacks live in `packages/svg/src/base.ts` (`FONTS.{cjk,headerCjk,primaryCjk,monoCjk}`) and `packages/svg/src/frame.ts` (`FONT_STACKS.{mono,body,display}`), both consumed by discord-worker's card generators via `services/svg/renderer.ts` + `services/fonts.ts`. Read both files in full:

```
frame.ts:154-156   mono/body/display  → all three list "Noto Sans JP, Noto Sans SC, Noto Sans KR"
base.ts:252-263    cjk/headerCjk/primaryCjk/monoCjk → all four list "Noto Sans JP, Noto Sans SC, Noto Sans KR"
```

Every CJK-capable stack lists all three subsets, JP first. `preset-swatch.ts` (the one card previously missing JP, F-11/F-17) now imports `FONTS.headerCjk`/`primaryCjk` at lines 207, 217, 233, 275, 307, 317 — all JP-inclusive. `FONTS.mono`/`primary` (Latin-only, no CJK) are used only for the ASCII hex value and an English-only literal — correct as-is. **No stack lacks CJK coverage.** Positive control.

### 4.2 Staleness — mtime heuristic says stale, byte-level coverage proves it is not

```
apps/discord-worker/src/fonts (whole dir, last touch)        35df3d7f  2026-08-29T00:30 (Latin static-instancing — did not touch the 3 CJK .ttf)
  NotoSansJP/SC/KR-Subset.ttf specifically (each, individually) 349276e0  2026-08-21T00:30 (F-11 re-cut)
packages/bot-logic/src/i18n/locales (last touch)               faab951c  2026-08-29T15:06 (added card.swatchTitle, 1 line × 6 files)
packages/core/src/data/locales (last touch)                    7917e5f5  2026-08-18T15:11 (before the font re-cut — fine)
discord-worker handlers+schemas.ts (last touch)                dfc6de47  2026-08-30T11:47 (validation/logging only, verified no new strings — see §1)
```

By the letter of the heuristic ("fonts older than the last string change means the subsets are stale"): the CJK subsets (2026-08-21) **are** older than the bot-logic locale change that added `card.swatchTitle` (2026-08-29) — `card.swatchTitle` reaches the swatch **card** (resvg), not just an embed, so glyph coverage matters here.

**Independently verified with fontTools instead of trusting the heuristic** (`C:\tmp\check4_font_coverage.py`, replicates `font-coverage.test.ts`'s own algorithm — cmap union across all 6 bundled fonts, every codepoint >U+0020 except U+FE0F, across core locales + bot-logic locales + `CONSOLIDATED_DYES` names + `MATCHING_METHOD_TAGS`... note: the two TS-only tables were not re-parsed in Python, only the JSON locale trees were — see caveat below):

```
ja: OK  de: OK  fr: OK  ko: OK  zh: OK  en: OK   (0 missing codepoints, union of all 6 bundled fonts)
ja CJK-in-JP-subset: OK        ko Hangul-in-KR-subset: OK        code glyphs (Δα·—…→↓–↔≈°÷♂♀#%): OK
Surplus CJK glyphs: JP 0, SC 0, KR 0   (threshold is <500 — comfortably clean, better than the 217-stale figure from the 2026-08-20 audit)
```

`card.swatchTitle`'s ja (`キャラクターの色見本`) / ko (`캐릭터 색상 견본`) / zh (`角色色板`) values render with zero missing glyphs — their characters were already covered by the existing corpus. **Conclusion: technically stale by the mtime rule, but verified functionally correct — no tofu today.** Caveat: my Python replica did not independently re-parse `CONSOLIDATED_DYES`/`MATCHING_METHOD_TAGS` (TS source, not JSON) the way `font-coverage.test.ts` does — those two tables are unchanged since 2026-08-10 per `git log`, so this gap does not affect the conclusion, but strictly speaking only the vitest gate covers them end-to-end.

### 4.3 Size thresholds — over the letter of the threshold, but not for the reason the threshold assumes

| File | Size | Threshold | Over? |
|---|---|---|---|
| `NotoSansJP-Subset.ttf` | 547.5 KiB | >500 KiB | **Yes** |
| `NotoSansSC-Subset.ttf` | 814.3 KiB | >500 KiB | **Yes** |
| `NotoSansKR-Subset.ttf` | 232.4 KiB | >300 KiB | No |

Given §4.2 showed **zero surplus glyphs**, the size is not explained by over-inclusion of unnecessary characters. Investigated further — see §4.4.

### 4.4 NEW FINDING — the three CJK subsets are still variable fonts (never received the 2026-08-29 static-instancing fix)

`fontTools.ttLib.TTFont` on each of the three `-Subset.ttf` files shows `fvar`/`gvar` tables present (i.e. they are variable-weight fonts), with:

```
NotoSansJP-Subset.ttf   wght axis: min 100.0  default 100.0  max 900.0
NotoSansSC-Subset.ttf   wght axis: min 100.0  default 100.0  max 900.0
NotoSansKR-Subset.ttf   wght axis: min 100.0  default 100.0  max 900.0
```

This is the exact defect class documented in `apps/discord-worker/CLAUDE.md` and fixed for the Latin brand faces on 2026-08-29 (commit `35df3d7f`, "resvg ignores variable axes... one variable file exposes exactly its default instance"): resvg cannot select a non-default instance from a variable font, so **any card requesting a non-default `font-weight` for text that falls back to a Noto Sans CJK glyph renders that glyph at weight 100 (Thin) regardless of the requested weight** — worse than the pre-fix Space Grotesk case, whose default was Light (300).

This is reachable: `font-weight` is a first-class attribute on the shared `text()` helpers (`frame.ts:168`, `base.ts:189`) used by every card, and all CJK-capable stacks (`headerCjk`, `primaryCjk`, `monoCjk`, `display`, `body`, `mono`) request weight explicitly at multiple call sites (e.g. bold headers, dye-name labels) — so any ja/zh/ko dye name or CJK label rendered at a bold/semibold weight is affected.

**Not caught by any existing gate:**
- `font-faces.test.ts:60-62` — `'ships no variable font'` — matches bundled filenames against `/VariableFont/i`. The CJK files are named `NotoSans{JP,SC,KR}-Subset.ttf`, not `*VariableFont*`, so the filename heuristic is blind to them despite them being variable fonts internally.
- `font-faces.test.ts:64` — the 400/600/700 render-and-diff loop only iterates `['Space Grotesk', 'Onest']`. Neither the CJK families nor Fragment Mono are in that list.
- `font-coverage.test.ts` checks glyph *presence* (cmap), not weight *selection* — a covered-but-wrong-weight glyph passes it cleanly (confirmed in §4.2: 0 missing, 0 surplus, yet the underlying files are still variable).

Filed as `cand-dw-01`. Tier note: the brief's P0–P3 rubric is built around text/key correctness; this is a rendering-fidelity defect (right text, wrong weight) scoped to non-Latin scripts, so none of the four tiers fits cleanly. Filed as **P3** (closest: an asset gap parallel to "stale," not a text/key defect) — flagging explicitly that the real-world impact (every bold/semibold CJK glyph on every card rendering Thin) may warrant a higher priority than a typical P3; leaving the final call to the assignee.

---

## 5. Surfaces added since 2026-08-20

Per `git log --since=2026-08-21 --name-only --pretty=format: -- apps/discord-worker/src | sort -u` (full listing gathered; new non-test files: `services/command-trace.ts`, `services/image-input-errors.ts`, `types/markdown.d.ts`, `utils/text.ts`).

| Surface | Status |
|---|---|
| `/changelog` (bundled `CHANGELOG-laymans.md`) | Chrome fully localized: `changelog.ts:108` `` `${t.t('changelog.title')} — ${expanded.version} (${expanded.date})` ``; `commands.changelog.description` resolves in all 6 locales (§3). Body content is the English markdown source — explicitly out of scope ("Do NOT file"). `changelog-parser.ts`/`announcements.ts` unchanged in i18n terms since the prior audit. |
| Analytics Tier A (PR #150: `analytics.ts`, `command-trace.ts`, `image-input-errors.ts`) | **Not a user-facing i18n surface.** Grepped all three for `content:`/`embeds:`/`description:`/`title:` — zero hits; these files write KV counters / Analytics Engine datapoints only, never a Discord response body. `image-input-errors.ts`'s `IMAGE_INPUT_MARKERS` table holds **English substring markers matched against image-worker's own error text** (deliberately not translated — it's a classifier key, not a rendered string; the localized message the user sees is chosen downstream from the matched `ImageInputReason`, via existing `card.*`/`errors.*` keys). |
| stainID-everywhere (`46d20453`, `3734fc2d`) | i18n-neutral. Diffed the commit against `preset.ts`/`budget.ts`: no new user-facing sentence added. The one locale-relevant piece (`preset.errors.dyeCount` "3-6" wording) is confirmed correctly updated in **all 6** locale files (`de`: "3–6 Farbstoffe", `fr`: "de 3 à 6 teintures", `ja`: "3〜6色", `ko`: "3~6개", `zh`: "3-6 种"). |
| `.chara` name-privacy (`f7abff8f`, `31f8b869`, `faab951c`) | Verified end-to-end: `packages/bot-logic/src/commands/swatch.ts:80` types the resolved character as `Omit<ResolvedCharaCharacter, 'nickname'>`; `:175-176` explicitly destructures-and-discards `nickname` with a comment ("nothing below can print one"); `:221` `title = t.t('card.swatchTitle')` — static key, confirmed resolving with correct glyph coverage in all 6 locales (§4.2). `SwatchInput.fileName` is gone; the worker (`swatch.ts:256`) only forwards `result.embed.title`. No raw name/filename path survives. |
| harmony convergence (PR #159, `generateHarmonySlots`) | **Not present in this checkout — see §0.** Cannot be checked here. |

---

## Positive controls (i.e., checks that were run and found clean — listed so "no finding" isn't mistaken for "not checked")

1. All 7 previously-missing keys (F-01) still resolve in all 6 locales; the 3 previously-flagged dynamic-key namespaces plus 8 more I enumerated independently (44 individual keys total) resolve 100% in all 6 locales — zero misses (§2).
2. All 17 registered commands have working `description_localizations` in all 6 Discord locale slots, including `/changelog` which was added *after* the F-03 phase-1 commit and required zero code change to inherit coverage (§3).
3. Every CJK-capable font stack in both `base.ts` and `frame.ts` lists all three Noto subsets, JP-first (§4.1).
4. `font-coverage.test.ts`'s own algorithm, independently re-run in Python against the current repo state, shows zero missing glyphs and zero surplus glyphs across all 6 locales (§4.2) — better than the 2026-08-20 audit's baseline (217 stale → 0).
5. F-04/F-06/F-07/F-13 remediations (rate-limit plural, swatch errorMessage, currency spelling, dead `||` fallbacks) all independently re-verified still holding, zero regressions (§1).
6. The 3 new Tier-A analytics files (`command-trace.ts`, `analytics.ts`, `image-input-errors.ts`) build zero Discord-facing content — confirmed not an i18n surface (§5).

## Rejected leads (investigated, not filed)

| Lead | Why rejected |
|---|---|
| `preferences.ts:391` `t.t(v)` bare-identifier call | Traced to `getAffectedCommands()` — an exhaustive switch over all 15 `PreferenceKey` values returning only literal `/command` tokens or one of 4 verified-resolving `preferences.affects.*` keys. No `'filters'` `PreferenceKey` exists (it's a different keyspace: `preferences.keys.filters` is a display label, not a settable preference key) — initial suspicion of an uncovered switch arm was a misread of two different enums. |
| `bot-logic/harmony.ts:134-144` English `formats` fallback table | `keyMap` above it (`:130-141`) covers all 8 `HarmonyType` values exhaustively — table is genuinely dead code, matches prior audit F-12, not reachable, not re-filed. |
| `stats.ts` panel strings (~40 across 4 handlers) | Explicitly on the brief's "Do NOT file" list. |
| `types/preferences.ts:192-193` clan display names | On the README's "Left open by design" list. |
| `preset-notifications.ts` moderation-channel copy | Admin-only surface, file untouched since before the last audit, already fully catalogued in prior `HARDCODED_STRINGS.md` §2.6. |
| `about.ts` `ATTRIBUTION`/`BUILT_ON` | Deliberate per in-file comment (trademark/proper-noun text), matches prior audit's documented exemption. |
| discord-worker's own `createTranslator(locale)` calls without a logger (e.g. `harmony.ts:119`, `dye.ts:196`) | Different call site/function than the bot-logic F-13 fix targeted; pre-existing pattern, not flagged by the prior audit, not one of the 5 assigned checks. Noted but not filed. |
| `universalis-client.ts:112,179,217` `UniversalisError` messages ("Request timeout", "Universalis proxy not configured", "Too many items requested...") | Traced every catch site (`budget.ts:401-405`) — only logged, never rendered; user always gets `t.t('budget.errors.rateLimited'\|'apiError')` or `t.t('errors.generationFailed')`. |
| `rate-limiter.ts:266` `'Rate limiter: some RL_* bindings are missing...'` (newest commit, 2026-08-30) | Confirmed `logger?.warn?.()` call, operator-only, explicitly excluded (log messages). |

## Files covered

- **58/58** non-test `.ts` files in `apps/discord-worker/src` swept by the Check-1 greps (100% of tracked non-test source); every file in the `git log --since=2026-08-21` changed-file list (42 non-test files + 4 new) individually re-examined for regressions/new strings.
- Individually opened/read in full or near-full: `schemas.ts` (1281 lines), `registry.ts`, `localize.ts`, `preferences.ts` (handler + service), `manual.ts`, `about.ts`, `swatch.ts` (both layers), `budget.ts`, `extractor.ts`, `dye.ts`, `rate-limiter.ts`, `quick-picks.ts`, `image-input-errors.ts`, `text.ts`, `fonts.ts`, `font-coverage.test.ts`, `font-faces.test.ts`, `preset.ts`, `preset-notifications.ts`.
- Cross-package (read-only, to resolve keys/stacks the worker depends on): `packages/core/src/config/learn-links.ts`, `.../blending/types.ts`, `.../dye-vocabulary.ts`, `.../consolidated-ids.ts`; `packages/svg/src/base.ts`, `frame.ts`, `preset-swatch.ts`; `packages/bot-logic/src/commands/{accessibility,harmony,swatch,gradient,comparison,mixer}.ts`; all 12 locale JSON files (6 bot-logic + 6 core), each fully parsed by script, not spot-read.
- Independent tooling written for this review: `C:\tmp\check2_dynamic_keys.py` (dynamic-key resolution across 6 locales), `C:\tmp\check3_cmd_desc.py` (per-command description coverage), `C:\tmp\check4_font_coverage.py` (fontTools cmap replica of `font-coverage.test.ts`).
