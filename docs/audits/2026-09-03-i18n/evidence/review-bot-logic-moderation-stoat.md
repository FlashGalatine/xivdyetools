# i18n review — `packages/bot-logic`, `apps/moderation-worker`, `apps/stoat-worker`

**Reviewer date:** 2026-09-03 · **Worktree HEAD:** `7bf5444e` (branch `i18n-audit-2026-09-03`; the worktree was rebased onto `origin/main` — PRs #158-#161 — partway through this review at `07:21:09-04:00`. All file:line citations below were re-verified against `7bf5444e` after the rebase landed; one draft finding was dropped because the rebase's own PR #158/#159 work had already fixed it — see "Findings the rebase fixed out from under me" at the end.)
**Scope:** bot-logic locale-JSON content quality (register/tone/CJK punctuation/string length/`.tc()` plurals — NOT the mechanical parity/dup/placeholder sweep, which runs separately and is cited as `evidence/botlogic-i18n.txt`, a green 3-file/90-assert run); bot-logic handler code for hardcoded English; dynamically-built translator keys across all three units; `apps/moderation-worker` (never audited — green field); `apps/stoat-worker` (never audited — green field, parked).
**Method:** read-only. No pnpm/vitest/build run by me. `evidence/botlogic-i18n.txt` and `evidence/moderation-i18n.txt` already contain green runs from the parallel gate process and are cited, not reproduced.
**Prior audit:** `docs/audits/2026-08-20-discord-worker-i18n/` covered `packages/bot-logic` — all 13 actions landed 2026-08-21 (commit table in its README). Treated as fixed baseline for bot-logic; `apps/moderation-worker` and `apps/stoat-worker` were **not** in that audit's scope and have never been reviewed for i18n before this.

---

## Part 1 — `packages/bot-logic`

### 1a. Engine + gates (context, not re-verified)

Read in full: `src/i18n/translator.ts` (131 lines), `src/i18n/types.ts`, `src/i18n/locales.test.ts`, `src/i18n/translator.test.ts`, `src/i18n/__tests__/locale-orphans.test.ts` (315 lines). Three gates exist and are green per `evidence/botlogic-i18n.txt`:
- `locales.test.ts` — every locale has en.json's key set + a valid `meta` block.
- `locale-orphans.test.ts` — forward orphan check (every en.json key is read by some consumer tree or is in an enumerated dynamic-key set), reverse existence check (every literal `t.t('a.b')`/`t.tc('a.b')` call resolves in en.json), and six-locale key-set equality.
- `translator.test.ts` — unit tests for `.t()`/`.tc()`, including the F-09 plural mechanics.

`Translator.tc(key, count)` (translator.ts:102-107): resolves `${key}_one}` when `count===1`, else `${key}_other}`, via a `has()` check that falls back to the bare key if neither suffix exists. This is safe for ja/ko/zh carrying identical `_one`/`_other` text (verified below) — the engine never *requires* a plural distinction, it only *permits* one.

### 1b. `.tc()` plural forms — read every plural pair by hand

All six locale files read in full (en/ja/de/fr/ko/zh, 684 lines each). Plural-suffixed keys present in en.json: `errors.rateLimited`, `dye.search.foundCount`, `gradient.steps`, `card.gradKeyCut`, `card.gradVerdict`, `card.swatchFootKey` (6 pairs × 6 locales = 36 strings, all read).

| Key | en | de | fr | ja/ko/zh (identical _one/_other, expected) |
|---|---|---|---|---|
| `gradient.steps` | `1 Step` / `4 Steps` | `1 Schritt` / `4 Schritte` | `1 étape` / `4 étapes` | ja `1ステップ`/`4ステップ` (same string) — confirmed identical in all three |
| `errors.rateLimited` | `1 second` / `4 seconds` | `1 Sekunde` / `4 Sekunden` | `1 seconde` / `4 secondes` | confirmed identical pairs in ja/ko/zh |
| `dye.search.foundCount` | `Found 1 dye:` / `Found 4 dyes:` | `1 Farbstoff gefunden:` / `4 Farbstoffe gefunden:` | `1 teinture trouvée:` / `4 teintures trouvées:` | confirmed identical pairs |
| `card.gradKeyCut` | sing./plur. differ only in "gap"/"gaps" | differ only in noun | differ only in noun | confirmed identical pairs |
| `card.gradVerdict` | "dye."/"dyes." | "Farbstoff."/"Farbstoffe." | "teinture."/"teintures." | confirmed identical pairs |
| `card.swatchFootKey` | "slot"/"slots" | "Slot"/"Slots" | correctly SAME string both forms (fr doesn't inflect "empl." here) | confirmed identical pairs |

en/de/fr forms are grammatical (correct singular/plural noun agreement in all three — verified by native-pattern inspection: German pluralises the noun only, French adds `-s`/adjusts the participle agreement `trouvée`→`trouvées`, English adds `-s`). No P0/P1 here — this duplicates ground the mechanical sweep also covers, so no row filed; recorded as a **positive control**.

### 1c. Register/tone consistency — full read, both directions

**ja.json**: consistently です/ます (polite) register throughout all 684 lines — welcome text, error strings, manual descriptions, card labels. No plain-form (だ/である) slips found. Positive control.

**de.json**: consistently **du**-form (informal) throughout — `dein`, `deine`, `versuche`, `gib`, `Du hast`, etc. No `Sie`/`Ihr` (formal) slips found anywhere in 684 lines. Positive control.

One cross-locale style inconsistency found and verified:

**cand-bl-04** — `packages/bot-logic/src/i18n/locales/fr.json:393-406` (re-verified post-rebase; was 391-404 pre-rebase, shifted +2 by the `harmony.compound`/`harmony.shades` insertion, see §1g). Within `preferences.methods`, `ciede2000` is capitalized (`"Formule perceptuelle de référence (par défaut)"`) but all five siblings (`oklab`, `cie76`, `redmean`, `rgb`, `distinguish`) start lower-case (`"distance perceptuelle OKLAB"`, `"distance euclidienne CIELAB"`, `"approximation RVB pondérée"`, `"distance euclidienne RVB"`). All of `preferences.blendingModes` (401-406) is *also* lower-case-initial, including its first entry — so the file uses three different capitalization rules across two structurally identical option lists. Compare en.json:390-405 and de.json:390-405 (unshifted — the addition landed in `harmony`, which sorts earlier in en/de/fr alike, so their line numbers moved too, but relative structure didn't), where **every** entry in both blocks is capitalized (matching how each is a standalone list item, likely a `/preferences` dropdown-description line). Tier P3 (style/cosmetic, not a translation error) — filed as `cand-bl-04`.

### 1d. CJK full-width punctuation — full read

**cand-bl-02** — `packages/bot-logic/src/i18n/locales/ja.json:340-341` vs `:354-358`, and identically `packages/bot-logic/src/i18n/locales/zh.json:340-341` vs `:354-358` (re-verified post-rebase; both files shifted +2 by the `harmony.compound`/`harmony.shades` insertion, §1g). The `errors.*` block uses full-width colon `：` before an interpolated variable (ja:341 `"{key}の値が無効です。有効なオプション：{options}"`; zh:341 `"{key} 的值无效。有效选项：{options}"`), while the `validation.*` block 13 lines later uses half-width colon `:` for the same "label: value" shape (ja:354 `"有効なオプション: \`en\`, ...\`"`, ja:355 `"有効なオプション:\n{options}"`; zh:354-355 same pattern). This is not a one-off — it is the *same* split, in the *same* two blocks, in *both* CJK-full-width-punctuation locales, strongly suggesting the two blocks were authored/edited at different times under different conventions. ko.json has no full/half-width distinction in modern typesetting and uses half-width throughout both blocks — consistent, not a finding. Tier P3 — filed as `cand-bl-02`.

**cand-bl-03** — `packages/bot-logic/src/i18n/locales/ja.json:473` vs `:245` (re-verified post-rebase; was 471/243). `matchImageHelp.fileLimitsContent` (473) reads `"...処理時間：約1-3秒"` — ASCII hyphen for the "1 to 3" range. `preset.edit.dyeCount` (245) reads `"プリセットのカララントは3〜6色にしてください。"` — Japanese wave-dash `〜` for the "3 to 6" range, and `manual.gradient.description` (67, unshifted) also uses `〜` for "2 to 10" (`"ステップ数を設定可能（2〜10）"`). Two different range-separator conventions for the identical semantic pattern (number–dash–number–counter-word) inside one locale file. ko.json uses ASCII `~` consistently in both spots (`3~6`, `~1-3초`); zh.json uses ASCII `-` consistently in both spots (`3-6`, `约1-3秒`); only ja.json mixes `〜` and `-`. Tier P3 — filed as `cand-bl-03`.

### 1e. String length vs. card/embed truncation surfaces

Traced every `card.slot*`/`card.offGridShort` consumer: `swatch.ts:116-124` (`SLOT_KEYS` map) → `swatch.ts:257` (`label: t.t(SLOT_KEYS[slot.kind] ?? 'card.slotSkin')`) → `SwatchCardRow.slotLabel` → `packages/svg/src/swatch-card.ts:361` (`generateSwatchCard`) → `measuredRow()` in `packages/svg/src/frame.ts:554-584`.

Read `frame.ts:561-611`: the shaped-label branch (566-584, used by every swatch row) renders `o.lead.text` and `o.lead.sub` with **no `fitText()` call** — contrast with `name` three lines later (605: `fitText(o.name, w.name, nameSize, 'body')`). `swatch-card.ts:89` fixes the lead column's budget at `w.lead = 56`px, after which the swatch-pair box begins (`cx = x + w.lead + gap`, gap=10). The package's own `CLAUDE.md` states the load-bearing rule this violates: *"Never ellipsise to a character count. Use `fitText`/`estimateTextWidth`... German compounds run ~3× English."*

Computed against `frame.ts:175-182`'s own `textWidth` formula (mono factor 0.62, size 11 → 6.82px/Latin-char, no CJK involved here): current longest lead-slot strings are `card.offGridShort` en `"OFF GRID"` (8 chars ≈ 54.6px) and de `"ABSEITS"` (7 chars ≈ 47.7px) — both currently *fit* under the 56px budget, EN by a margin of only ~1.4px. All `card.slotHl`/`slotTattoo`/`slotPaint` values across en/de/fr are ≤6 characters (≈41px), also under budget. **No confirmed active overflow** — this is a code-quality/latent-risk finding (an unprotected path that the file's own documented rule says must be protected), not a proven visual bug; I cannot render to confirm and the current strings happen to clear the budget.

Re-checked against the post-rebase HEAD (`7bf5444e`) specifically because `git log` showed a very on-point-sounding commit landed *during* this review: `ab81d435 fix(svg): measure text before wrapping it, and keep every card inside its own margins` (2026-09-02 deep-dive Sprint 4, BUG-054/REFACTOR-008/pkg-svg-bot-logic-02/06/07/10). Read its full message and re-read `measuredRow()` at the current HEAD (lines 560-611) to check whether it already fixed this: it did not — that commit's BUG-054 fix is in a *different* function, `wrapVerdict` (ja/ko `/gradient` verdict text overflowing its card because the old width estimate used a per-character constant that ignored CJK and never split on spaceless CJK text). `measuredRow`'s shaped-label branch (574-587) is untouched by it and still has no `fitText()` call on `lead.text`/`lead.sub`, confirmed at the current line numbers. This is a genuinely different, still-open instance of the same bug class this sprint was actively hunting — not a false positive invalidated by the rebase. Tier P3 — filed as `cand-bl-05`.

### 1f. Hardcoded English in handler/business-logic code

```
$ git ls-files 'packages/bot-logic/src/**/*.ts' | grep -v -E '\.test\.ts$|/i18n/' | xargs grep -n -E "['\"\`][A-Z][a-z]+( [a-z]+){2,}"
(no matches outside i18n/ and *.test.ts)

$ [Grep tool] pattern ['"`][A-Z][a-z]+ [a-z]+  glob *.ts  path packages/bot-logic/src
→ only translator.ts's own `logger?.warn('Missing translation: ...')` (excluded: log message)
  and translator.test.ts / locale-orphans.test.ts (excluded: test strings)

$ for f in localization.ts input-resolution.ts moderators.ts discord-markdown.ts css-colors.ts; \
    grep -nE "['\"][A-Z][a-z]+ [a-z]" $f
(no matches in any of the five)

$ git ls-files 'packages/bot-logic/src/**/*.ts' | grep -v '\.test\.ts$' | xargs grep -n "TODO\|FIXME\|XXX\b"
(no matches)
```

Clean — matches the prior audit's "handler code 100% keyed" conclusion, still true. **No new findings.** (`localization.ts`'s `getLocalized{DyeName,Category,Acquisition,Currency}` fall back to the raw English *key/input string* when a locale instance isn't yet initialized — this is a defensive, tested `catch`/`!instance` path, `localization.uninitialized.test.ts` pins it, and these wrap `@xivdyetools/core`'s game-noun data which the brief says is out of scope for hand-review — rejected, not filed.)

### 1g. Dynamically-built keys (bypass the reverse-existence gate)

Searched for `.t(`/`.tc(` calls whose first argument is not a bare string literal, and for `Record<string,string>` lookup tables feeding `t.t()`:

1. **`accessibility.ts:102`** — `` t.t(`accessibility.${lens}`) ``. `lens` ranges over `VISION_TYPES` (accessibility.ts:30-35 = `protanopia`/`deuteranopia`/`tritanopia`/`achromatopsia`). Verified `accessibility.protanopia/deuteranopia/tritanopia/achromatopsia` present in all six locale files (read in full, §1c). **Resolves in all six locales.** This is exactly the key the orphan gate already enumerates by importing `VISION_TYPES` directly (locale-orphans.test.ts:219-221) — not a new gap. Positive control, not filed.

2. **`swatch.ts:115-124` (`SLOT_KEYS`) → `swatch.ts:257`** — `t.t(SLOT_KEYS[slot.kind] ?? 'card.slotSkin')`. The eight possible resolved values (`card.slotSkin/slotHair/slotHl/slotEyes/slotLip/slotPaint/slotTattoo/slotLimbal`) are literal strings inside the dict, so the forward orphan gate sees them (they appear as quoted literals in the corpus) even though the reverse gate's `.t('literal')` regex does not match this particular call site. All eight verified present in all six locale files (§1c full read). **Resolves in all six locales.** Positive control, not filed.

3. **`harmony.ts:101-124` (`getLocalizedHarmonyType`)** — RE-CHECKED at post-rebase HEAD and this draft finding is now **stale/fixed**. My first read (pre-rebase) found exactly the pattern I expected to file: `keyMap` exhaustively covering every `HarmonyType`, behind it a genuinely-unreachable hardcoded-English `formats` fallback dict. The rebase's harmony-convergence work (`d376440e feat(bot-logic): /harmony answers what the web app answers`) had **already deleted that dict** before I could file it — the current code (116-123) reads: `// pkg-svg-bot-logic-08: an English formats table used to sit here as a "fallback", duplicating all eight names. It could never run — keyMap covers every HarmonyType... Only a genuinely unknown type reaches here, and capitalising it is the honest answer for one. return type.charAt(0).toUpperCase() + type.slice(1);` — i.e. someone else independently reached the same conclusion and fixed it first. `HARMONY_TYPES` also grew from 8 to 10 in this same rebase (`compound`, `shades` added, harmony.ts:38-49); I independently re-verified `harmony.compound`/`harmony.shades` are translated in all six locale files (en "Compound"/"Shades", ja "複合"/"シェード", de "Zusammengesetzt"/"Schattierungen", fr "Composé"/"Nuances", ko "복합"/"명암", zh "复合"/"明暗", all at lines 160-161). **Not filed** — see "Findings the rebase fixed out from under me" and positive controls.

4. **`harmony.ts:332-351` (`getHarmonyTypeChoices`, shifted from 345-357)** — a second, separate `formats` dict, explicitly commented `"English labels, for Discord autocomplete"`, now guarded with `Object.hasOwn` (so a harmony type literally named `toString` can no longer walk a `Function` down the old `||` fallback) and extended to cover `compound`/`shades`. This is Discord `choices[].name` text (no `name_localizations` companion), which matches the prior audit's own "left open by design: F-03 phase 2 (option descriptions, **remaining choice lists**)" (`docs/audits/2026-08-20-discord-worker-i18n/README.md` line 42). **Rejected — already tracked, deliberately deferred, not a regression.**

No other dynamic-key patterns found in bot-logic (`localization.ts`, `moderators.ts`, `discord-markdown.ts`, `css-colors.ts`, and the remaining command files `gradient.ts`/`mixer.ts`/`contrast.ts`/`comparison.ts`/`dye-info.ts` searched via `Record<string, string>` and `` `${ ` `` / non-literal-`.t(`-argument greps — none found beyond the four above).

---

## Part 2 — `apps/moderation-worker` (green field)

### 2a. Architecture read

Read in full: `src/index.ts`, `src/services/i18n.ts`, `src/services/bot-i18n.ts`, `src/services/bot-i18n.test.ts`, `src/handlers/commands/preset.ts`, `src/handlers/buttons/preset-moderation.ts`, `src/handlers/buttons/ban-confirmation.ts`, `src/handlers/buttons/index.ts`, `src/handlers/modals/ban-reason.ts`, `src/handlers/modals/preset-rejection.ts`, `src/utils/response.ts` (partial — `errorEmbed`/`successEmbed`/`infoEmbed`), `src/utils/embed-text.ts` (confirmed pure sanitizer, no prose), `src/types/preset.ts` (`STATUS_DISPLAY`, icon+color only, no label text), `scripts/register-commands.ts` (full). Re-read `preset.ts` and `index.ts` a second time after the mid-review rebase (both had shifted — `preset.ts` 656→706 lines, `index.ts` 684→676 lines — from unrelated fixes landing in the same window); all citations below are against the post-rebase content.

`CLAUDE.md`'s own "Localization" section: *"6 languages... Locale order: 1. User preference in KV. 2. `interaction.locale`. 3. Default `en`."* — this describes `services/i18n.ts`'s `resolveUserLocale()` (i18n.ts:102-123) correctly and it **is** implemented correctly (KV → `discordLocaleToLocaleCode(interaction.locale)` → `'en'`, with a sensible mapping table at i18n.ts:64-73 including `en-US`/`en-GB`→`en`, `zh-CN`/`zh-TW`→`zh`). This ladder is a genuine positive control — it structurally mirrors discord-worker's model. What it feeds, however, is broken (below).

### 2b. `cand-mod-01` — the whole non-English "translation" is `enLocale` by reference

`apps/moderation-worker/src/services/bot-i18n.ts:112-119`:
```ts
const locales: Record<LocaleCode, LocaleData> = {
  en: enLocale,
  ja: enLocale, // Fallback to English
  de: enLocale,
  fr: enLocale,
  ko: enLocale,
  zh: enLocale,
};
```
There is no `locales/` JSON directory anywhere in `apps/moderation-worker` (`find apps/moderation-worker -iname "*.json" | grep -iv package\|tsconfig` → empty) and no other i18n data source — `enLocale` (bot-i18n.ts:30-107) is the **only** content that has ever existed for this bot. This is deliberate and tested, not an oversight: `bot-i18n.test.ts:49-56` and `:186-191` explicitly assert the aliasing —
```ts
it('should fallback to English for unsupported locales', () => {
  // All locales fallback to English in this simplified moderation bot
  const translator = new Translator('fr');
  expect(translator.t('common.error')).toBe('Error');
});
it('should fallback to English for non-English locale missing keys', () => {
  const translator = new Translator('ja');
  // Japanese locale is a copy of English in this simplified bot
  expect(translator.t('common.error')).toBe('Error');
});
```
Net effect: a moderator whose KV preference or Discord client locale is `ja`/`de`/`fr`/`ko`/`zh` gets the locale-resolution ladder working perfectly and 100% English content at the end of it, with nothing in the UI or in `CLAUDE.md`'s "Localization" section disclosing that only English content exists. Tier **P1** (wrong text — the resolved locale is not what's rendered) — filed as `cand-mod-01`. This is the single highest-impact finding in this review.

### 2c. `cand-mod-02`..`05` — the entire button/modal surface never even attempts translation

```
$ grep -c "t\.t(\|Translator" apps/moderation-worker/src/handlers/buttons/preset-moderation.ts   → 0
$ grep -c "t\.t(\|Translator" apps/moderation-worker/src/handlers/buttons/ban-confirmation.ts     → 0
$ grep -c "t\.t(\|Translator" apps/moderation-worker/src/handlers/modals/ban-reason.ts            → 0
$ grep -c "t\.t(\|Translator" apps/moderation-worker/src/handlers/modals/preset-rejection.ts      → 0
$ grep -c "t\.t(\|Translator" apps/moderation-worker/src/handlers/buttons/index.ts                → 0
```
Confirmed structurally in `index.ts` (re-verified post-rebase, `index.ts` is now 676 lines): `createUserTranslator()` is called exactly once, at `index.ts:249`, inside `handleCommand()` (starts index.ts:228) — the slash-command path only. `handleComponent()` (index.ts:516-546) and `handleModal()` (index.ts:551-587) call `handleButtonInteraction`/`handlePresetRejectionModal`/`handlePresetRevertModal`/`handleBanReasonModal` with signature `(interaction, env, ctx, logger)` — **no `t` parameter exists to pass.** Every button click (Approve/Reject/Revert on the moderation embed; Ban Confirm/Cancel) and every modal submission (ban reason, rejection reason, revert reason) is 100% hardcoded, unlocalizable-without-a-refactor English. Representative lines (all independently opened and read):

(all line numbers below independently re-verified against post-rebase HEAD `7bf5444e`; unchanged from my pre-rebase read except `ban-reason.ts`, which the rebase's `moderation-worker-09` fix expanded — see note below)

- `handlers/buttons/preset-moderation.ts:82,86,90` — `'Invalid button interaction.'`, `'Invalid preset ID format.'`, `'You do not have permission to approve presets.'`
- `handlers/buttons/preset-moderation.ts:146,151,165-166` — embed title `` `✅ Preset Approved` ``, field `{ name: 'Action', value: 'Approved by ${safeModerator}' }`, submission-log embed
- `handlers/buttons/preset-moderation.ts:234,242,247` — modal title `'Reject Preset'`, field label `'Reason for rejection'`, placeholder text
- `handlers/buttons/ban-confirmation.ts:66,70,84,88` — `'Invalid button interaction.'`, `'You do not have permission to ban users.'`, `'Invalid target user.'`, `'Invalid button data.'`
- `handlers/buttons/ban-confirmation.ts:95,103,108` — modal title `'Ban Reason'`, field label `'Reason for banning this user'`, placeholder
- `handlers/buttons/ban-confirmation.ts:144-145` — `title: '❌ Ban Cancelled'`, `description: 'The ban action was cancelled.'`
- `handlers/buttons/index.ts:97` — `'Unknown button action.'` (shifted from 110 pre-rebase — `ac96e79a` deleted 12 uncalled helpers including `isPresetModerationButton`'s duplicate export from this file)
- `handlers/modals/ban-reason.ts:45,49,63,68,91` — every `errorEmbed('Error', '...')` validation call (title `'Error'` itself is hardcoded even though `common.error` already exists as a key — see 2e); `:101,103` the "Processing Ban…" acknowledgement; `:161,165,173-182` the failure/success embeds posted to the moderation channel AND back to the moderator. The rebase added a **second, brand-new copy** of the same hardcoded "User Banned" content at `:189-197` (`moderation-worker-09`: the handler now also edits the original interaction response with the outcome instead of leaving a permanent spinner — a real bug fix, but it doubled this file's hardcoded-English surface rather than reducing it; `grep -c "t\.t(\|Translator"` on the file is still 0 post-rebase).
- `handlers/modals/preset-rejection.ts:48-49,56,60,66,99,104-105,119-122` (reject) and `:175,181,185,191,221-227,241-244` (revert) — same pattern across both flows, confirmed unchanged by the rebase

Filed as four rows: `cand-mod-02` (preset-moderation.ts, buttons), `cand-mod-03` (ban-confirmation.ts, buttons), `cand-mod-04` (ban-reason.ts, modal), `cand-mod-05` (preset-rejection.ts, modals ×2). All **P1** — raw English visible to a moderator on the bot's single busiest interaction surface (every approve/reject/ban click).

### 2d. `cand-mod-06` — command metadata has zero localization fields

`apps/moderation-worker/scripts/register-commands.ts:41-117` — the entire `commands` array (`/preset`, its three subcommands, every option, and the four `action` choice labels `📋 View Pending`/`✅ Approve`/`❌ Reject`/`📊 Statistics`) carries **no** `name_localizations` or `description_localizations` field anywhere (`grep -c "localizations" scripts/register-commands.ts` → 0, confirmed by full read). Discord silently shows the raw English `name`/`description` to every client locale. This is the same gap the 2026-08-20 audit filed as F-03 for discord-worker (phase 1 fixed there, commit `102a5520`) — moderation-worker has never had that fix applied because it was never audited. Tier **P2** (Discord's own behavior here is a silent fallback to the base string, functionally identical to a missing-key fallback) — filed as `cand-mod-06`.

### 2e. `cand-mod-07` — hardcoded status labels bypass keys that already exist

`apps/moderation-worker/src/handlers/commands/preset.ts:352-380` (`handleStatsAction`; shifted from 312-329 pre-rebase — `678514b3` landed *during* this review, fixing BUG-010: the fields used to read `stats.pending_count` etc., a key that doesn't exist in the API response, so every field silently rendered the string `"undefined"`; the commit renamed the reads to `stats.pending` etc. and added a 5th field for `actions_last_week`. The count-bug is now fixed — but the i18n bug I'm filing is untouched by it):
```ts
fields: [
  { name: '🟡 Pending', value: String(stats.pending), inline: true },
  { name: '🟢 Approved', value: String(stats.approved), inline: true },
  { name: '🔴 Rejected', value: String(stats.rejected), inline: true },
  { name: '🟠 Flagged', value: String(stats.flagged), inline: true },
  { name: '📅 Actions (7d)', value: String(stats.actions_last_week), inline: true },
],
```
`bot-i18n.ts:70-76` already defines exactly the first four labels as `preset.status.pending/approved/rejected/flagged` (plus `hidden`, unused by this embed) — unused anywhere (`grep -rn "preset.status" apps/moderation-worker/src --include=*.ts` matches only the definition in bot-i18n.ts and the test assertions in bot-i18n.test.ts:153-161, never a call site). Even after `cand-mod-01` is fixed with real translations, this specific embed would keep shipping English, because it never calls `t.t()` at all. Tier **P1** — filed as `cand-mod-07`.

### 2f. `cand-mod-08` — raw strings bypass the translator even on the one path that does call it

Within `handlers/commands/preset.ts` and `index.ts` (the only files that *do* construct/use a `Translator`), several strings are still hardcoded instead of calling `t.t()`. **All line numbers below are freshly re-verified against post-rebase HEAD `7bf5444e`** — `preset.ts` grew from 656 to 706 lines and `index.ts`'s numbering shifted in its second half during the rebase (unrelated fixes: `MIN_REJECTION_REASON_LENGTH` extraction, a rename from `editOriginalResponse`→`safeEditOriginalResponse`, and BUG-010 above), so every citation was re-opened at its current location, not carried over from my first pass:
- `preset.ts:149` — `'Invalid preset ID format.'` inside `validatePresetIdOrSendError` (sibling to `ctx.t.t('preset.moderation.missingId')` three lines above it)
- `preset.ts:323` and `:341` — `{ name: 'Reason', value: sanitizeReason(reason) }` (sibling fields in the same two embeds use `ctx.t.t(...)`; `:341` is inside a submission-log post that the rebase *newly added* to the reject flow, per its own comment "moderation-worker-05: rejection was the ONLY moderation action that never reached the submission log" — so this specific hardcoded field is brand-new code, not carried debt)
- `preset.ts:398` — `'This command must be used in the moderation channel.'` (the very first user-visible check in `handleModerateSubcommand`, before any `t.t()` call)
- `preset.ts:414` — `'Missing action'`
- `preset.ts:471` — `` `Unknown action: ${sanitizeEmbedText(action, 64)}` `` (en.json's own `errors.unknownSubcommand: "Unknown subcommand: {name}"` shows the intended pattern; no equivalent key exists here)
- `preset.ts:487-488` (`AUTHOR_BANNED_MESSAGE`), `:491` (`INVALID_USER_ID_MESSAGE`), `:519`, `:619`, `:668` fallback, `:679` description, `:682` field name `'User ID'` (vs. the *translated* `ban.discordId`="Discord ID" used three lines earlier in the confirmation embed at `:554` — two different English labels for the same concept, one keyed, one not), `:685`, `:703`
- `index.ts:239,261,266,530,543,563,586` — `'Unable to identify user. Please try again.'` (×3, verbatim identical to bot-logic's own `errors.unknownUser` string), `` `The `/${cmd}` command is not supported...` ``, `'An error occurred while processing your command.'` (verbatim identical to bot-logic's `errors.commandFailed`), `'This component type is not yet supported.'` (verbatim identical to bot-logic's `errors.unsupportedComponent`), `'Unknown modal submission.'` (verbatim identical to bot-logic's `errors.unknownModal`)

Tier **P1** — filed as `cand-mod-08` (representative line `preset.ts:398`, full list above).

### 2g. Moderation notices / DMs

```
$ grep -rn "createDM\|sendDM\|\bDM\b" apps/moderation-worker/src --include="*.ts" -i | grep -v test
(no matches)
```
The bot never DMs a banned or rejected user — all notices are either ephemeral interaction responses to the acting moderator, or posts to `MODERATION_CHANNEL_ID`/`SUBMISSION_LOG_CHANNEL_ID` (staff channels). "Are its moderation notices/DMs localized?" — N/A, there are no DMs; the channel-post notices are covered by the same P1s above (they're built by the same handler functions).

### 2h. Coverage table

| Surface | Locale-aware? | Evidence |
|---|---|---|
| Locale resolution ladder (KV → `interaction.locale` → `en`) | **Yes** — correctly implemented | `i18n.ts:102-123`, mirrors discord-worker's model |
| `/preset moderate\|ban_user\|unban_user` slash-command responses | **No** (machinery present, content is English-only) | `bot-i18n.ts:112-119` + `cand-mod-01`; plus raw strings even here, `cand-mod-08` |
| Preset moderation buttons (Approve/Reject/Revert) | **No** — no Translator wired at all | `cand-mod-02`, 0/0 `t.t(` hits |
| Ban confirm/cancel buttons | **No** — no Translator wired at all | `cand-mod-03`, 0/0 `t.t(` hits |
| Ban-reason / rejection / revert modals | **No** — no Translator wired at all | `cand-mod-04`, `cand-mod-05`, 0/0 `t.t(` hits |
| Command `name`/`description`/choice localizations | **No** — field absent entirely | `cand-mod-06` |
| Moderator DMs | N/A — bot never DMs | §2g |
| Autocomplete choice labels (usernames, preset names) | N/A by design | identifiers, not prose |

---

## Part 3 — `apps/stoat-worker` (green field, parked)

Read in full: `src/commands/info.ts`, `src/services/response-formatter.ts`; greeped `src/commands/about.ts`, `help.ts`, `ping.ts`, `src/services/dye-resolver.ts` for any locale handling.

**cand-stoat-01** — `apps/stoat-worker/src/commands/info.ts:38`:
```ts
const locale: LocaleCode = 'en'; // TODO: resolve from user preferences
```
This is the bot's *only* implemented command that calls into bot-logic's translated surface (`executeDyeInfo({ dye, locale })`, info.ts:90) — `ping`/`help`/`about` are stoat-local text with no bot-logic i18n involvement at all (`grep -n "locale\|Locale"` on all three → no hits). The app's own `CLAUDE.md` already documents this exact gap in its discord-worker/stoat-worker comparison table: *"Localization | Auto from `interaction.locale` | Currently hard-coded `'en'` in info.ts (TODO: per-user prefs)"* — so this is a known, self-disclosed limitation, not a fresh discovery, but the brief asks me to verify and report it. `resolveDyeInputMulti` (dye-resolver.ts:46) also defaults its own `locale` parameter to `'en'`.

Per the brief's carve-out ("at most P3 unless it ships user-visible English where bot-logic already has the key"): it does ship exactly that — `executeDyeInfo` has full six-locale support in bot-logic (verified Part 1), and stoat-worker deliberately never reaches past `en`. **The app is parked (no active investment per project memory) — tier P3.** Filed as `cand-stoat-01`.

Does Revolt carry a user locale the bot could read? I could not check the `revolt.js` SDK's own surface — the package is not present in this worktree's installed `node_modules` (only `@types`, `@vitest`, `@xivdyetools` scoped packages are there) and I did not install anything (read-only). What I can confirm from the code itself: nothing in `message-handler.ts`, `router.ts`, or `config.ts` reads any per-message or per-user language signal — the TODO in `info.ts:38` and the CLAUDE.md table both frame the gap as "not yet implemented," not as "no such signal exists," so I report this as unresolved rather than asserting revolt.js has no locale field.

`response-formatter.ts`'s own reply-building functions (`formatErrorReply`, `formatDisambiguationList`, `formatNoMatchReply`, lines 53-126) are all raw hardcoded English template strings — but these are stoat-specific formatting text with no bot-logic key to parallel, so under the brief's carve-out they don't independently qualify (folded into `cand-stoat-01`'s evidence, not filed separately).

---

## Rejected leads

| Lead | Reason rejected |
|---|---|
| `about.removedBody` starts lower-case in en/de/fr/ja/ko/zh (`"these commands have been removed — use..."`) | Checked all six — every locale does this identically (reads as a continuation clause under the `removedTitle` field name, not a new sentence). Consistent by design, not a bug. |
| `de.json` mixes en-dash `–` (`dyeCount: "3–6"`, `manual5.contrast: "1:1–21:1"`) with ASCII hyphen (`"2-10"`, `"~1-3 Sekunden"`) | En-dash for ratio/range notation (`1:1–21:1`) is used identically in en.json too — a deliberate typographic distinction between "ratio range" and "plain count range," not locale-specific sloppiness. The one plain-count outlier (`dyeCount: "3–6"`) is a single instance amid many ASCII-hyphen counts; borderline, but not clearly wrong (German typography does prefer en-dash for number ranges), so left unfiled rather than mis-tiered. |
| `getHarmonyTypeChoices()` autocomplete labels (`harmony.ts:332-351` post-rebase) hardcoded English | Explicitly commented as intentional Discord-choices text; matches prior audit's own "left open by design: F-03 phase 2... remaining choice lists" — not a regression. |
| `preferences.errors`/`values`/`validation` block **order** differs between locale files (e.g. zh.json puts `errors` before `values`; en.json puts `values` before `errors`) | JS/JSON object key order is irrelevant to dot-path lookup (`getNestedValue` in translator.ts walks by key name, never iterates). Checked whether any consumer does `Object.keys()`/`Object.entries()` over these specific sub-objects to render an ordered list — none found (`preferences.methods`/`blendingModes` choice ordering comes from core's `MATCHING_METHOD_TAGS`/`BLENDING_MODES`, not from JSON key order). Purely cosmetic in the source file, invisible to any user. |
| `localization.ts` returns raw English key/input on an uninitialized locale instance | Defensive fallback with its own dedicated test file (`localization.uninitialized.test.ts`); wraps `@xivdyetools/core` game-noun data, out of scope per the brief ("Game nouns come from core — never re-translate by hand"). |
| moderation-worker submission-log-channel embeds (`preset.ts:274`, `preset-moderation.ts:166`, `preset-rejection.ts:119`, `:241` revert) hardcode English | Posted only to `SUBMISSION_LOG_CHANNEL_ID`, an internal staff/audit channel — same class as the brief's explicit "/stats admin dashboards" exclusion. Not filed as a separate row; folded into the general hardcoded-string evidence for `cand-mod-02`-`05`/`08` rather than called out on its own. |
| `preset.ts:554` field value `user.discordId \|\| 'N/A'` (corrected — originally mis-cited as `ban-confirmation.ts`; the ban-confirmation embed is actually built in `preset.ts`'s `handleBanUserSubcommand`, not in the button handler file of a similar name) | Two-character code-style fallback token, same class as the brief's excluded "codes and tags." |

---

## Findings the rebase fixed out from under me

Worth recording explicitly, since it's unusual: partway through this review the worktree was rebased onto `origin/main` (PRs #158-#161 — the 2026-09-02 whole-monorepo deep-dive and the harmony-convergence work), landing new commits in files I had already read. I re-verified every citation against the post-rebase HEAD before filing anything (see the re-verification notes inline above), and in the process found that **one draft finding had already been fixed by the rebase itself**, independently and before I could file it:

- **bot-logic `harmony.ts`'s unreachable hardcoded-English `formats` fallback** in `getLocalizedHarmonyType` (the pre-rebase equivalent of what I was about to file as `cand-bl-01`) — deleted by the harmony-convergence commit `d376440e`, with a code comment (tagged `pkg-svg-bot-logic-08`) reasoning through the exact same "this can never run, `keyMap` covers every case" argument I had independently reached. See §1g item 3.

No other draft finding was invalidated — everything else in this report was re-opened and re-confirmed present at the (in several cases, shifted) line numbers cited. This is called out here rather than silently edited away because it's evidence the review method works (I caught the same bug a parallel workstream also caught) and because a coordinator diffing this report against an earlier draft should not read the disappearance of `cand-bl-01` as sloppiness.

---

## Positive controls

- bot-logic's three locale gates (parity, forward-orphan, reverse-existence) are all green and, on inspection, actually enforce what their names claim — read the full implementation, not just the pass/fail.
- ja.json and de.json each hold a single consistent register (polite です/ます; informal du) across 684 lines apiece with no slips found.
- `Translator.tc()`'s plural mechanism is safe for no-plural languages by construction (`has()` checked before use) and all six shipped `.tc()` keys carry grammatical en/de/fr forms and byte-identical ja/ko/zh `_one`/`_other` pairs.
- `accessibility.${lens}` and `SLOT_KEYS[slot.kind]` — the two genuinely dynamic key patterns bot-logic actually exercises — both resolve correctly in all six locales; I verified this independently rather than trusting the enumerated-key gate alone.
- moderation-worker's locale-*resolution* ladder (KV → Discord locale → en) is implemented correctly and mirrors discord-worker's model — the defect is entirely on the content side, not the plumbing.
- the rebase's own harmony-convergence work added two new `HarmonyType` members (`compound`, `shades`) and shipped complete, correct translations for both in all six locale files (verified `harmony.compound`/`harmony.shades` present and non-placeholder in en/ja/de/fr/ko/zh) — a fresh feature landed with full i18n coverage, not a regression waiting to be found later.

---

## Files covered (opened and read, or grepped with a specific check in mind)

bot-logic (26): `i18n/translator.ts`, `i18n/types.ts`, `i18n/index.ts`, `i18n/locales.test.ts`, `i18n/translator.test.ts`, `i18n/__tests__/locale-orphans.test.ts`, `i18n/locales/{en,ja,de,fr,ko,zh}.json` (6), `commands/harmony.ts`, `commands/swatch.ts`, `commands/accessibility.ts`, `commands/dye-info.ts`, `commands/gradient.ts`, `commands/contrast.ts`, `commands/comparison.ts`, `commands/mixer.ts`, `commands/types.ts`, `localization.ts`, `input-resolution.ts`, `moderators.ts`, `discord-markdown.ts`, `css-colors.ts`.

svg (supporting evidence, 3): `swatch-card.ts`, `frame.ts`, `base.ts`.

moderation-worker (12): `index.ts`, `services/i18n.ts`, `services/bot-i18n.ts`, `services/bot-i18n.test.ts`, `handlers/commands/preset.ts`, `handlers/buttons/preset-moderation.ts`, `handlers/buttons/ban-confirmation.ts`, `handlers/buttons/index.ts`, `handlers/modals/ban-reason.ts`, `handlers/modals/preset-rejection.ts`, `utils/response.ts`, `utils/embed-text.ts`, `types/preset.ts`, `scripts/register-commands.ts` (14, corrected count).

stoat-worker (6): `commands/info.ts`, `commands/about.ts`, `commands/help.ts`, `commands/ping.ts`, `services/response-formatter.ts`, `services/dye-resolver.ts`.

**Total: 49 files** opened/read or grepped with a specific check, across the three units.
