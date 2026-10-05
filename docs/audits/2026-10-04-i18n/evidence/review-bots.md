# Review: bots slice (discord-worker + bot-logic code), i18n audit 2026-10-04

Scope: `git log 5c80fcba..HEAD -- apps/discord-worker/src packages/bot-logic/src` (/glamour, localize.ts, #227 /stats preferences removal, chara-attachment, swatch refactor).

## Candidates

| id | prefix | tier | where | origin | claim |
|----|--------|------|-------|--------|-------|
| B1 | HC | P1 | packages/bot-logic/src/commands/chara-identity.ts:24 (used glamour.ts:438, swatch.ts:247) | MAIN | `tribeDisplay()` prints the English clan from the enum ("SEEKER OF THE SUN", "KEEPER OF THE MOON") on the /glamour card header in every locale; core has localized `clans` (core `data/locales/de.json` clans.seekerOfTheSun = Goldtatze) and web-app localizes them via `LanguageService.getClan`. bot-logic only has `getLocalizedRace`. Same defect at BASE in /swatch. |
| B2 | HC | P2 | apps/discord-worker/src/utils/chara-attachment.ts:62,69,95,102; handlers/commands/glamour.ts:84-88 | MAIN | Reasons are English literals inside the localized `card.swatchParseError` ("Could not read the file — {message}"): `file too large (N bytes)`, `attachment must be uploaded to Discord`, `download failed (404)`, `file too large (over 1048576 bytes)`; core parser AppError text (`.chara file is not valid JSON`, chara-parser.ts:346) and api-worker's own English reason (relayed since f5e3aac2) land in the same slot. Half-English reply in de/fr/ja/ko/zh. |
| B3 | TERM | P2 | packages/bot-logic/src/i18n/locales/de.json:618 | MAIN | `card.glamourStatusDye` = "FARBEN" (de = colors); house rule: dye = Farbstoff. Same family as web `glamour.fact.dye` "FARBE x{n}" (web slice). |
| B4 | TERM | P3 | locales/{en,de,fr,zh}.json:619 | MAIN | `card.glamourStatusGlamour`: "NO GLAM" / "KEINE PROJ" / "NON MIRAGE" / "无法幻化" vs web `glamour.fact.noGlamour` "NO GLAMOUR" / "KEINE PROJEKTION" / "PAS DE MIRAGE" / "不可幻化": two names for one verdict; de "PROJ" is an invented abbreviation (dictionary: the game has no short forms). ja/ko match web. |
| B5 | I18N | P3 | locales/en.json:614 (de/fr :614) | MAIN | `card.glamourLooks` = "+{n} LOOK" / "+{n} OPTIK" / "+{n} ASPECT" is a count shown through `t()` (glamour.ts:424), not `tc()`; reads "+3 LOOK". |
| B6 | I18N | P3 | locales/en.json:688 (characterFile body, all locales) | MAIN | The embed footer sends users to `/manual topic:👤` ("More on character files") but that topic's body names only /swatch, never /glamour. The `/manual` command list does cover /glamour (manual.glamour.*, all six). |
| B7 | I18N | P3 | locales/ko.json:819 (and :833 swatch, BASE) | MAIN | Option tooltip "`.chara` 캐릭터 파일 ..." has literal backticks; Discord does not render markdown in option descriptions. |

## Checked and right

- localize: `commands.glamour.description` and `commands.glamour.options.file.description` present in ja/de/fr/ko/zh, longest de 92 / fr 95, all <=100. Changed `commands.harmony.options.wheel`, `commands.swatch`, `...set.clan` present in all. `commands.stats.options.preferences.description` removed in all six (PR #227), no residual reference in code or locales. Ran `vitest manual.test.ts localize.test.ts glamour.test.ts` in discord-worker: 69 passed.
- Dynamic keys: `card.glamourSlot.*` 12/12 in 6 locales (== CharaGearSlotId union, core chara-parser.ts:70-82); `FIXED_KEYS`, `BLOCKED_KEYS` and the five status keys all exist; every `glamour*` key present in all 6 (39 each). Slot labels equal dictionary Equipment Slots.
- Plurals: `glamourPieces/Worn/Dyes/FootShown/FootShownWorn/FootTwins/FootBlocked` all via `.tc()` with `_one/_other`; count 0 guarded (NoDyes / NoGear).
- Glamour terms equal dictionary (ミラプリ / Projektion / Mirage / 코디 / 幻化; 投影できません / 투영 불가 kept for the can't-be-a-glamour verb). Grand Company wording equals web. de du, fr vous throughout.
- Locale threading: handler uses `createUserTranslator(KV pref -> interaction.locale -> en)`, then re-creates the translator from `t.getLocale()` for the deferred step; theme from prefs; guard replies, errors, race and dye names localized. No buttons/components in /glamour.
- Limits: embed description budget 4000 with truncation; title <256; error text capped 1024; /manual embed totals and field limits asserted for all locales by manual.test.ts (passes with new field); option descriptions <=100.
- HC triage of hc-sentences-apps-discord-worker.txt (187 lines): logger/Error text, schema descriptions (localized by localize.ts), env-validation, moderator preview-image / preset-notifications (English by decision), /stats admin. bot-logic file (2 lines): JSDoc and a logger string. No user-visible English besides B1/B2.
- GPOSERS list labels English by decision; `/GLAMOUR` card chip is the command name.

## Rejected

- `SUBRACE_DISPLAY_NAMES` English clan names for /preferences clan choices (apps/discord-worker/src/types/preferences.ts:202): unchanged since BASE, outside the diff.
- `firstRun.body` names /swatch only: announcement-class text.
- ja `glamourDyes` "{n}色": ambiguous with colors but ja house style.

## Files covered

packages/bot-logic/src/commands/{glamour,chara-identity,swatch}.ts, localization.ts, i18n/locales/*.json (delta bot-logic.tsv 68 keys, all 39 card.glamour*), apps/discord-worker/src/commands/{localize,schemas,registry}.ts, localize.test.ts, handlers/commands/{glamour,manual,swatch}.ts, utils/chara-attachment.ts, index.ts diff, both hc-sentences files, svg glamour-card.ts header.
