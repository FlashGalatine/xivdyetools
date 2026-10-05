# Review gap 8 — discord-worker option contract + web-app i18n gate scripts

Branch preview/integration-2026-10-04 @80262a2f. Read-only review; no suite run (validate-i18n.js and one throwaway scan in the scratchpad were run read-only).

## Map

| Command (schemas.ts) | Handler | Options diffed handler vs schema | Result |
|---|---|---|---|
| harmony :155 | harmony.ts:31-44 | color,type,wheel,companions(1-3),matching,strict_matching,prevent_duplicates | match; companions clamp 1-3 at bot-logic harmony.ts:214 |
| dye search/info/list/random :217 | dye.ts:104,166,298,361 | query,name,category,unique_categories | match; category choices = the 8 categories in dyes.json |
| extractor color/image :291 | extractor.ts:230-234,413-467 | color,count(1-10),matching,image,colors(3-10),prevent_duplicates | match; MIN/MAX at :68-80 equal the schema |
| gradient :376 | gradient.ts:36-41 | start_color,end_color,steps(2-12),color_space,matching | match; steps NOT clamped (client-only, pinned by gradient.test.ts:318) |
| mixer :437 | mixer-v4.ts:38-41 | dye1,dye2,mode,matching | match |
| accessibility/a11y :496,501 | accessibility.ts:39-47 | dye,dye2,vision | match (prefix scan `dye*`) |
| contrast :510, comparison :917 | contrast.ts:36, comparison.ts:35-38 | dye1-4 | match |
| manual :545 / changelog :567 / stats :581 | manual.ts:438, changelog.ts:69, stats.ts:99 | topic,version,4 subcommands | match (stats comment says "5 subcommands", only 4) |
| preferences :609 | preferences.ts:99,320,481,705 | 15 set options, reset key, filters set 8 booleans | names match via OPTION_NAME_TO_KEY; choices match core BLENDING_MODES / MATCHING_METHODS; count 1-10 = isValidCount |
| swatch :862 / glamour :901 | swatch.ts:64-65, chara-attachment.ts:54 | file,order,slot | match; slot choices = SLOT_VALUES |
| rate limits | rate-limiter.ts:198, worker-kit configs.ts:68 | per-command tiers | glamour and stats have no tier (default 15/min) — not filed |

i18n scripts: apps/web-app/scripts/validate-i18n.js (key refs, cross-locale, order, whitespace), i18n-parity.mjs (dups, missing, extra, placeholders, empty, identical, same-English), i18n-parity-gate.test.js (runs both under vitest).

## Candidates

### gap8-01 [BUG] MEDIUM — /preferences advertises effects that no handler implements
- File: apps/discord-worker/src/services/preferences.ts:633-653 (`getAffectedCommands`); schemas.ts:674,681; origin MAIN.
- Claim: the schema text and the success embed's "Affects" field name consumers that never read the preference.
  - `clan` and `gender` ("Default clan for /swatch", schemas.ts:674) have NO reader anywhere. `/swatch` reads race, clan and gender from the `.chara` file (bot-logic swatch.ts:247 `character.tribe/gender`), and swatch.ts:61 reads only `theme`. grep of `prefs.clan` / `prefs.gender` finds only the writers (preferences.ts:194,197).
  - `matching` lists `/swatch`, but swatch.ts takes no matching method; `/harmony` does read it (harmony.ts:80) and is not listed.
  - `blending` lists `/gradient`, but gradient.ts:39-40 reads only `color_space` (default 'hsv') and never calls `resolveBlendingMode`; only mixer-v4.ts:68 does.
- Failing input → wrong outcome: `/preferences set clan:Raen gender:female` → green embed "Affects: /swatch"; `/swatch file:x.chara` is unchanged. `/preferences set blending:oklab` → "Affects /mixer, /gradient"; `/gradient` still interpolates in HSV.
- Why tests miss it: preferences.test.ts:468 pins the returned strings only, never that a handler consumes the key. Covered by a test: no.
- Excerpt:
  ```
  case 'blending': return ['/mixer', '/gradient'];      // :637
  case 'matching': return ['/mixer','/gradient','/extractor','/swatch','/budget'];  // :639
  case 'clan': case 'gender': return ['/swatch'];       // :643
  ```
- Fix direction: either wire the readers (gradient default colour space from `resolveBlendingMode`) or delete the clan/gender options and trim the lists; add a table test mapping each key to a handler that reads it.

### gap8-02 [BUG] LOW — free-text options echoed raw and uncapped into error embeds; the 6000-character default is only fixed for `world`
- Files: accessibility.ts:74, comparison.ts:59-61, contrast.ts:61, gradient.ts:61,73, harmony.ts:66, mixer-v4.ts:54,62, extractor.ts:257, dye.ts:172 (`errors.dyeNotFound`); schemas.ts (no `max_length` on `dye`, `color`, `start_color`, `dye1..` etc.; only :698,1023-1132,1255,1304,1334); origin MAIN.
- Claim: `t.t('errors.invalidColor', { input })` puts the raw option into an embed description with no `sanitizeEmbedText`. `/dye search`, `/budget` and `/changelog` (dye.ts:117, budget.ts:207, changelog.ts:86) already do this through FINDING-019. The sibling sites were not swept.
- Failing input → wrong outcome: `/harmony color:<5,000 characters>` → the template adds about 130 characters, the description exceeds 4096, Discord rejects the type 4 callback, and the user sees "The application did not respond". A short string with `**`, a backtick or a mention renders unescaped (ephemeral, so self-only).
- Why tests miss it: schemas.test.ts:38,113-116 pins only the world cap and the 25-choice limit. Covered: no.
- Fix direction: `sanitizeEmbedText(input, 100)` at the nine echo sites, or one `invalidColorEmbed(t, input)` helper; add `max_length` (about 100) to the dye and colour STRING options plus a schema test that every STRING option without `choices` has one.

### gap8-03 [UNTESTED] LOW — validate-i18n.js has paths that exit 0 on bad input; it sees only literal single-line calls
- File: apps/web-app/scripts/validate-i18n.js:117 (getFiles catch), :249 and :299 (locale load catch), :36-41 (PATTERNS), :386-392; origin MAIN.
- Claim:
  - A locale file that fails to read or parse is logged and skipped (`continue`) in `compareLocales` and `checkOrderAndWhitespace`, then the run prints "All locale files have matching key structure" and exits 0 (summary loop prints "⚠️ Error reading file" but the exit code stays 0 via the clean shape report). A missing `SRC_DIR` yields "All 0 translation key references are valid", exit 0; there is no file-count floor.
  - PATTERNS match only `LanguageService.t('literal')` and `tInterpolate('literal',` on ONE line (`\s*` cannot cross the line split at :127). It misses a call that prettier wraps, template-literal keys (19) and the local `t('x.y')` alias (62 calls in src, e.g. advanced-options-panel.ts:216).
- Failing input → wrong outcome: a bad `ja.json` or a typo key in a wrapped call → validate-i18n.js alone exits 0.
- Mitigation found: i18n-parity.mjs reads all five locales unguarded (it throws on a bad file), and gate.test.js runs it. My scratch scan of all three call shapes (multi-line, alias, `this.t`) found 0 missing keys today, so this is latent.
- Covered by a test: partly (parity covers the locale half; nothing covers wrapped or alias calls). Fix direction: exit 1 on an unreadable locale and on `files.length === 0`; scan with a multi-line regex and the alias; add a test with a wrapped call.

## POSITIVE
- Every handler option name and type matches schemas.ts for the 15 non-preset/budget commands; no required-after-optional ordering found.
- Choice lists derive from, or are pinned to, core (HARMONY_TYPE_LABELS is a total Record; matching and blending sets equal core's constants; swatch slots equal SLOT_VALUES).
- min/max values equal the handlers' clamps (companions 1-3, count 1-10, colors 3-10, max_distance 2-20 against budget-calculator.ts:126).
- Autocomplete: every autocomplete option falls in a handled branch (default dye branch, preferences clan/world, preset, budget); 25-choice slicing present.
- i18n-parity.mjs is a real tokenizer (catches duplicate keys JSON.parse hides), and the gate asserts group counts so the same-English rule cannot be vacuous.

## REJECTED
- gradient `steps` unclamped (gradient.ts:38): schema is the only guard, but Discord validates integer min/max before delivery, and gradient.test.ts:318 documents it. No defence-in-depth defect reachable.
- extractor `colors` `Number(value)` NaN (extractor.ts:449): Discord guarantees an integer.
- manual `topic in TOPIC_KEYS` (manual.ts:~456): prototype keys would pass `in`, but `topic` is restricted to six registered choices.
- glamour/stats rate-limit tier absent from DISCORD_COMMAND_LIMITS: they fall to the 15/min default, a policy choice, not a defect.
- stats schema comment says "5 subcommands", there are 4: cosmetic.
- i18n identical/placeholder checks: no arrays or `{{ }}`/`%s` forms exist in en.json, so the `{name}`-only regex and string-only comparison are sufficient today.

## COVERED
11 files read: apps/discord-worker/src/commands/schemas.ts (all option tables), schemas.test.ts, src/index.ts (handleAutocomplete 1025-1260), src/handlers/commands/{harmony,gradient,mixer-v4,extractor,contrast,comparison,accessibility,dye,changelog,manual,stats,swatch,preferences}.ts (option reads), src/services/{preferences,rate-limiter}.ts, src/types/preferences.ts, packages/worker-kit rate-limiter presets/configs.ts, packages/bot-logic input-resolution.ts + commands/{gradient,swatch}.ts excerpts, apps/web-app/scripts/{validate-i18n.js,i18n-parity.mjs,i18n-parity-gate.test.js}, apps/web-app/src/services/language-service.ts (tInterpolate).
