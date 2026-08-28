# Hardcoded String Extraction Report — discord-worker · bot-logic · svg (2026-08-20)

**Files scanned:** 53 non-test `.ts` in `apps/discord-worker/src`; all non-test `.ts` in `packages/bot-logic/src` and `packages/svg/src`. Excluded: `*.test.ts`, `__tests__/`, fixtures, `coverage/`, `dist/`, logger/`console` text, `throw new Error(...)` internals, comments.
**Companion:** [I18N_AUDIT.md](I18N_AUDIT.md) (findings F-01…F-17 referenced below).

## Summary by priority

| Priority | Count | Where | Action |
|---|---|---|---|
| 🔴 High — missing locale keys (raw key rendered) | 7 keys / 11 sites | `budget.ts`, `preset.ts` | F-01 — add keys + reverse gate |
| 🔴 High — public, frequent, English-only | ≈ 90 | rate-limiter, router catch-all, `/stats` (public summary), `/preset` errors + favorites | F-04, F-05 |
| 🟡 Medium — English on non-default paths | ≈ 60 | `preset.ts` edit/submit paths, `getSafeMessage`, `copy.ts`, `preferences.ts` filter labels, `extractor.ts`, world autocomplete, `/swatch` generation error | F-05, F-06 |
| 🟡 Medium — inside SVG cards | 17 sites | `preset-swatch.ts`, `dye-info-card.ts`, `comparison-card.ts`, `contrast-card.ts` | F-11, F-12 |
| 🟢 Low — glue/format/plural | ≈ 30 | separators, `toFixed`, `toLocaleString()`, `%`, `GIL`, plurals | F-08, F-09, F-14 |
| ⚪ Skip — intentional | — | admin translators, identifiers (`NORM/PROT`, `ΔE2000`), endonyms, brand, changelog source, `quick-picks` (never rendered) | F-16 |

Static `t.t()` call sites in discord-worker: **400** (259 distinct keys). The worker is heavily localized; the gaps are concentrated in a handful of files.

---

## 1. Missing keys (F-01) — raw dotted key is what the user sees

| Key | Sites |
|---|---|
| `budget.noWorldSet.title`, `budget.noWorldSet.description` | `apps/discord-worker/src/handlers/commands/budget.ts:170`, `:427` |
| `budget.errors.missingWorld` | `budget.ts:375` |
| `budget.errors.saveFailed` | `budget.ts:389` |
| `budget.errors.missingPreset` | `budget.ts:416` |
| `common.unknownError` | `handlers/commands/preset.ts:1155`, `:1226`, `:1306` |
| `preset.errors.notFound` (should be `preset.notFound`) | `preset.ts:1127` |

Dynamic keys all resolve: `manual5.topics.{5}.{name,body}` (`manual.ts:290/:298`), `preferences.keys.{16}` (`preferences.ts:202/:329/:344/:365/:445`), `accessibility.{4 lenses}` (`bot-logic/commands/accessibility.ts:97`). Orphaned reason code: `services/preferences.ts:384` `'invalidTheme'` has no key/case.

## 2. discord-worker — per-file inventory

| File | Hardcoded user-facing literals | `t.t()` calls |
|---|---|---|
| `handlers/commands/stats.ts` | ≈ 75 | 1 |
| `handlers/commands/preset.ts` | ≈ 50 | 70 |
| `handlers/commands/preferences.ts` | 11 | 64 + 5 dynamic |
| `handlers/commands/preset-notifications.ts` | 8 (admin) | 11 |
| `index.ts` | 5 | 19 |
| `handlers/buttons/copy.ts` | 4 + button labels | 0 |
| `handlers/commands/manual.ts` | 3 | 64 + 2 dynamic |
| `handlers/commands/extractor.ts` | 2 (+1 spliced) | 35 |
| `handlers/commands/swatch.ts` | 2 (spliced) | 9 |
| `handlers/buttons/index.ts` | 1 | 0 |
| `handlers/commands/gradient.ts` | 0 (2 dead `\|\| 'English'`) | 19 |
| `handlers/commands/about.ts` | 0 (2 deliberate) | 12 |
| `harmony` `comparison` `contrast` `accessibility` `mixer-v4` `dye` `changelog` `budget` `preview-image` | 0 | 8–43 each |
| `services/rate-limiter.ts` | 1 (the most-seen) | 0 |
| `types/preset.ts` `getSafeMessage` | 7 | — |
| `types/preferences.ts` `MATCHING_METHODS`/`BLENDING_MODES` `.name/.description` | 12 | — |
| `services/budget/universalis-client.ts` | 1 | — |
| `services/preferences.ts` `getAffectedCommands` | 4 | — |
| `services/announcements.ts` | 3 (EN source by nature) | 0 |

### 2.1 `services/rate-limiter.ts:206` — F-04
```ts
return `You're using this command too quickly! Please wait **${seconds} second${seconds !== 1 ? 's' : ''}** before trying again.`;
```
Surfaced at `index.ts:640` for 13/17 commands. New key: `common.rateLimited` = `"You're using this command too quickly! Please wait **{seconds}s** before trying again."` (or `_one/_other`).

### 2.2 `index.ts` router
```
:617   'Unable to identify user. Please try again.'
:735   `The \`/${commandName}\` command is not yet implemented in the Workers version.`
:744   'An error occurred while processing your command.'      ← catch-all for every command failure
:1073  'This component type is not yet supported.'
:1091  'Unknown modal submission.'
```
`interaction.locale` is in scope at each. Keys: `errors.unknownUser`, `errors.notImplemented`, `errors.commandFailed` (exists as `errors.generationFailed`-adjacent — check wording), `errors.unsupportedComponent`, `errors.unknownModal`.

### 2.3 `handlers/commands/stats.ts` — translator discarded (`_t: Translator` at `:145/:203/:262/:352/:455`)
```
:86-87   '⛔ Access Denied' / 'You do not have permission to view this statistics panel.'
:127     'Failed to retrieve statistics. Please try again later.'
:153-164 '📊 XIV Dye Tools Bot' / 'A Discord bot for FFXIV dye matching and color analysis.' / '🎨 Features' / '• Color matching & extraction' … '• Accessibility analysis'
:169,:187 '📈 Stats' / `Version ${BOT_VERSION} • Use /manual for command help`
:215-245 '📈 Usage Overview' / '📊 Volume' / '👥 Users' / '✅ Quality' / 'Stats stored in Cloudflare KV with 30-day retention'
:283,:290 'No commands executed yet' / 'N/A'
:312-326 '⭐ Command Usage Breakdown' / '🏆 Top 10 Commands' / '📉 Least Used' / '🆕 5.0 Adoption'
:398-399 '⚙️ Preference Adoption' / `Based on ${sampleSize} user sample from ${total.toLocaleString()} total users with preferences.`
:438     'Percentages based on sampled users'
:459-477 '🟢 Healthy' / '🟡 Slow' / '🔴 Error' / '🟢 Enabled' / '⚪ Disabled' / '🟢 Configured' / '⚪ Not configured'
:485-529 '🏥 System Health' / '💾 Storage' / '📊 Analytics' / '🌐 External Services' / '⚙️ Configuration' / '🔐 Security' / 'Health check performed at request time'
```
`/stats summary` is public. Suggest a `stats.*` namespace (≈ 40 keys) or, if the panel is meant to stay operator-English, rename `_t` away and say so in the file header.

### 2.4 `handlers/commands/preset.ts`
```
:93,:137   'Invalid command structure'                :162,:167  `Unknown … subcommand: ${name}`
:220,:375  'No presets found.'                         :243       `📊 Showing ${n} of ${total} presets`
:263,:327,:388  'Failed to load presets.' / 'Failed to load preset.' / 'Failed to load random preset.'
:510-511   'A preset with the same dyes already exists:' / `**"${dup.name}"** by ${dup.author_name || 'Official'}`
:540-546,:858-864,:1005  field names 'Name' / 'Category' / 'Dyes'; `${preset.dyes.length} colors`
:570,:885  'Failed to submit preset.' / 'Failed to edit preset.'     :650  'Failed to process vote.'
:695       'Please provide at least one field to update.'           :751  'You can only edit your own presets.'
:799,:809  `Invalid dye: ${dyeName}` / 'Preset must have 2-5 dyes.'
:825-830   '⚠️ Duplicate Dye Combination' / 'This dye combination already exists in another preset:' / 'Please use a different dye combination.'
:852-867   '⏳ Preset Updated - Pending Review' / '✅ Preset Updated' / 'Your changes have been submitted for review due to content moderation.' / 'Your changes have been applied.' / 'A moderator will review your changes shortly.'
:936       `by ${preset.author_name}` : 'Official'
:1105,:1176 'preset_name is required'
:1136-1139 `**${name}** is already in your favorites.` / `You've reached the limit of ${MAX} favorited presets.` / 'Failed to add favorite — please try again.'
:1147      '⭐ Favorite added' / `**${name}** is now in your favorited presets.`
:1206-1217 `**${name}** is not in your favorites.` / 'Failed to remove favorite — please try again.' / '🗑️ Favorite removed' / `**${name}** has been removed from your favorites.`
:1261-1294 '⭐ Your favorite presets' / "You haven't favorited any presets yet. Use `/preset favorite add` to add one." / 'All of your favorited presets appear to have been removed. …' / `⭐ Your favorite presets (${n}/${MAX})`
:526,:635,:842  embed body = raw `response.error` from presets-api
```
Plus `types/preset.ts:117-137` `getSafeMessage()`: `'Invalid request. Please check your input and try again.'`, `'Permission denied.'`, `'Not found.'`, `'This already exists or conflicts with another resource.'`, `'Too many requests. Please wait a moment and try again.'`, `'A server error occurred. Please try again later.'`, `'An error occurred. Please try again.'` — surfaced via `preset.ts:570/:885`. `preset.*` namespace already has 20 keys; ≈ 35 more needed.

### 2.5 `handlers/commands/preferences.ts` + `types/preferences.ts`
```
preferences.ts:102-111  FILTER_OPTION_KEYS labels: 'Metallic', 'Pastel', 'Dark', 'Cosmic', 'Ishgardian', 'Expensive (Pure White / Jet Black)', 'Vendor', 'Crafted'  → rendered :228 / :623 / :668
preferences.ts:244      `Last updated: ${new Date(prefs.updatedAt).toLocaleString()}`   (label + unlocalized date)
preferences.ts:519      value === 'light' ? '☀️ light' : '🌙 dark'
preferences.ts:488,:493 BLENDING_MODES[].name / MATCHING_METHODS[].name (EN)
preferences.ts:557,:562 …[].description joined into t.t('preferences.validation.invalid*', { options })
types/preferences.ts:148-157  'Industry-standard perceptual formula (default)', 'OKLAB perceptual distance', 'CIELAB Euclidean distance', 'Weighted RGB approximation', 'Euclidean RGB distance', 'RGB DIST rescaled to 0-100'  (file comment: "Localised descriptions land with the MATCHING_METHODS locale keys in the graphics port")
services/preferences.ts:525-546  'all commands', 'market data on Result Cards', 'every generated card', 'all commands with Result Cards'
```
Note `core` locale `labels.{metallic,pastel,dark,cosmic}` already exist for four of the filter labels.

### 2.6 Other handler/service sites
```
handlers/buttons/copy.ts:52,:83    'Invalid RGB format.' / 'Invalid HSV format.'
handlers/buttons/copy.ts:66,:94    `**RGB Values:**…` / `**HSV Values:**\nH: …°, S: …%, V: …%`
handlers/buttons/copy.ts:130-142   button labels `HEX: #…` / `RGB: …` / `HSV: …`
handlers/buttons/index.ts:88       'This button is not recognized.'
handlers/commands/extractor.ts:177,:193  errorEmbed('Error', 'No subcommand provided') / `Unknown subcommand: ${sub}`   (errors.missingSubcommand / errors.unknownSubcommand exist; dye.ts:60/:79 use them)
handlers/commands/manual.ts:229-231      '• [Web App](…)' / '• [Support Server](…)' / '• [Patreon](…)'
services/budget/universalis-client.ts:397 `${dc.name} (${dc.region} Data Center)`   (world autocomplete, 4 commands)
services/announcements.ts:57,:61,:65     '*Summary shown — run `/changelog` for the full notes.*' / `🆕 XIV Dye Tools v${v}` / `Released ${date} • Full changelog: ${url}`
handlers/commands/preset-notifications.ts:86-122  '**Name:** …', '**Description:** Changed', '… Updated', '**Changes:**', 'No visible changes', `${n} colors`, 'Use `/preset moderate` …'  (moderator channel; mixed adminT.t()/literal)
```

### 2.7 Glue / casing / splicing (F-14)
```
harmony.ts:166           `${t.t('harmony.baseColor')}: ${…}`              hardcoded ': '
gradient.ts:195-199      `**${t.t('gradient.colorSpace') || 'Color Space'}:** … • **${t.t('gradient.matching') || 'Matching'}:** …`   dead fallbacks + '•' glue
preferences.ts:211       `(${t.t('preferences.show.default').toLowerCase()})`   .toLowerCase() on translated text
preferences.ts:331,:346,:366  `${emoji} **${label}**: ${reason}` / ` → **${value}**`
budget.ts:318            `${t.t('card.nearestMore', …)} — ${names}`
changelog.ts:99          `${t.t('changelog.title')} — ${version} (${date})`
swatch.ts:60,:97         t.t('card.swatchParseError', { message: `file too large (${n} bytes)` }) / `download failed (${status})`
extractor.ts:567, bot-logic swatch.ts:364   `${t.t('card.manualLead')} \`/manual topic:📸\`${t.t('card.manualTail')}`   ← correct pattern
```

### 2.8 Numbers / units (F-08)
```
preferences.ts:244                       new Date(…).toLocaleString()            no locale
stats.ts:171,221,222,223,230,305,328,399,433   n.toLocaleString()                no locale
stats.ts:172,210,238,239,277,393 ; extractor.ts:341   .toFixed(n)               '.' decimal in de/fr
dye.ts:263 ; copy.ts:94                  `${h}°, ${s}%, ${v}%`
budget.ts:229                            `${grp(v, locale)} GIL`                  unit position fixed
budget.ts:295                            perDeLabel: 'GIL/ΔE'                    card header literal
preset.ts:237,:512,:956                  `${vote_count}★`
```
`budget.ts` otherwise uses `grp()/num()` correctly (`:69,:70,:229,:266,:310`); all `timestamp:` fields use `toISOString()` ✓.

### 2.9 Intentional (no action)
7× `createTranslator('en')` admin/moderation (`preview-image.ts:123,:159`, `preset-notifications.ts:73`, `preset.ts:983`, `index.ts:223,:288,:334`); `about.ts` 2 documented; `budget.ts:51-58` `DE_LABEL` identifiers; `services/budget/quick-picks.ts` 22 name/description pairs never rendered (`getQuickPickById` → `targetDyeId` only); `/preferences set language` endonyms; `/changelog` + announcements body from EN markdown.

## 3. Slash-command metadata (F-03) — `commands/schemas.ts`

17 commands · 29 subcommands + 2 groups · 104 options → **152 `description` strings** · 27 `choices` arrays → **166 labels**. `name_localizations`/`description_localizations`: **0**.

| Option | Labels | Note |
|---|---|---|
| matching (`:155,:282,:317,:386,:436,:622,:1184`) | 6 × 7 = 36 | `'ΔE2000 - Industry standard (default)'` … identical block ×7 |
| `/harmony type` `:119-126` | 8 | `'Complementary (opposite colors)'` … `harmony.*` keys exist |
| `/harmony color_space` `:135-138` | 4 | |
| `/dye list category` `:221-228` | 8 | ≙ `getLocalizedCategory` |
| `/gradient color_space` `:369-377` | 9 | |
| `/mixer mode` `:422-427` | 6 | |
| `/accessibility|/a11y vision` `:81-85` | 5 ×2 | `accessibility.*` keys exist |
| `/manual topic` `:515-520` | 6 | `manual5.topics.*.name` exist |
| `/preferences set language` `:594-599` | 6 | ✅ endonyms — leave |
| `/preferences set blending` `:608-613` | 6 | |
| `/preferences set gender|theme` `:651,:710` | 2 + 2 | `preferences.values.*` exist |
| `/preferences reset key` `:727-742` | 16 | ≙ `preferences.keys.*` (translated ×6) |
| `/swatch order|slot` `:839,:849-855` | 2 + 7 | `card.slot*` exist |
| `/preset … category` `:42-49` | 8 ×3 | ≙ `CATEGORY_DISPLAY` |
| `/preset list sort` `:924-926` | 3 | |
| `/budget quick preset` `:1239-1243` | 5 | ≙ `getLocalizedDyeName` |

## 4. bot-logic (F-06, F-12, F-13)

| File:line | String | Existing key | Live? |
|---|---|---|---|
| `commands/swatch.ts:378` | `'Failed to generate swatch card.'` | `errors.generationFailed` | **yes** — worker `swatch.ts:117` renders `result.errorMessage` |
| `commands/accessibility.ts:244` · `comparison.ts:134` · `contrast.ts:125` · `dye-info.ts:147,:253` · `gradient.ts:350` · `harmony.ts:334` · `mixer.ts:166` | `'Failed to generate …'` | `errors.generationFailed` | latent (worker substitutes its own) |
| `dye-info.ts:190` · `harmony.ts:189` · `mixer.ts:116` | `'No dyes available.'` / `'No harmony dyes found.'` / `'No matching dyes found.'` | `errors.noDyesAvailable` / `errors.noMatchFound` | latent |
| `harmony.ts:134-144` | dead `formats` table (`'Complementary'` …) after complete `keyMap` | `harmony.*` | unreachable |
| `harmony.ts:342-354` | `getHarmonyTypeChoices` EN names | — | by design (ties to F-03) |
| `dye-info.ts:73` | `` `${consolidated.names.en} · ${itemID}` `` | `names.{ja,de,fr,ko,zh}` exist | documented intent (F-10) |
| `swatch.ts:153-156` | tribe name uppercased as `charSub` | core `clans` exist | documented identifier |
| `input-resolution.ts:204` | `searchByName` (EN) | `searchByLocalizedName` exists | F-02 |

No `|| 'English'` fallbacks in bot-logic (grep clean). `createTranslator(locale)` called **without logger** at 9 sites → silent misses.

## 5. svg (F-11, F-12)

| File:line | String | Category |
|---|---|---|
| `preset-swatch.ts:205,:207,:253,:298` | `` `by ${authorName}` `` / `'Official'` / raw `dye.name` / `'No valid dyes in this preset'` | (a) no label surface; also `base.ts FONTS` (no JP) |
| `dye-info-card.ts:156-159` | `'HEX' 'RGB' 'HSV' 'LAB'` | (a) not in `DyeInfoLabels` |
| `comparison-card.ts:171` | `'ΔE2000'` verdict unit | (a) |
| `contrast-card.ts:122,:242,:425,:378-397` | `toFixed` ratio `:1`; axis `3 / 4.5 / 7`, `1:1`, `21:1` | (a) + decimal separator |
| `mixer-card.ts:130,:140` · `palette-grid.ts:194` | `` `${pct}%` `` bypass `num()` | format |
| `harmony-card.ts:251,:312,:351` | `'→'` / `` `+${n}` `` / `'↓'` | documented glyphs |
| `budget-ledger.ts:117` · `random-dyes-grid.ts:147` · `dye-info-card.ts:158` | `'—'` | neutral |
| `frame.ts:352` · `swatch-card.ts:193` | `'xivdyetools.app'` | brand |
| 13 generators | `commandLabel = '/HARMONY'` … defaults | (b) command tokens — keep |

Label surfaces: 9 generators fully localizable; `contrast-card`, `comparison-card`, `dye-info-card` partial (the literals above); `preset-swatch` none. `packages/svg/src` references **zero** locale keys — architecture confirmed as label-injection only.

## 6. New keys to add to `en.json` (then ×5)

Minimum for F-01 (ship first):
```json
"budget": { "noWorldSet": { "title": "No world set", "description": "Set your world with `/budget set_world <world>` or pass the `world` option." },
            "errors": { "missingWorld": "Please specify a world.", "saveFailed": "Could not save your world preference. Please try again.", "missingPreset": "Please choose a preset." } },
"common": { "unknownError": "Something went wrong. Please try again." }
```
(and repoint `preset.errors.notFound` → `preset.notFound`). Wording is a suggestion — take it from the existing `budget.errors.*` voice.

Then, by file: `common.rateLimited` (F-04) · `errors.commandFailed/unknownUser/notImplemented/unsupportedComponent/unknownModal/unknownButton` (router/buttons) · `stats.*` (≈ 40) · `preset.*` (≈ 35 incl. `favorite.*`, `safe.*`) · `preferences.filters.labels.*` (8) · `preferences.show.lastUpdated {date}` · `budget.worldLabel {name} {region}` · `copy.*` (6) · `manual.tips.linkLabels.*` (3) · `card.hex/rgb/hsv/lab`, `card.perDe` · `card.swatchFootKey_one` etc.
