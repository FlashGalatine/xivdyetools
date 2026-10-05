# Review: core + API workers + moderation + stoat (i18n audit 2026-10-04)

Result: no candidates filed. Nothing in this slice is a defect under the brief's rules.

## Checked
- Acquisition data (api-worker #229 and earlier): `apps/api-worker/src/chara/acquisition.ts:1-17` states the table is English-only. Decision D2 in `docs/superpowers/specs/2026-09-27-glamour-acquisition-design.md:44` documents it (GPOSERS is an English form; item and dye names in the export follow the app language). `apps/api-worker/docs/reference/chara.md:69` repeats "one English line", and the field is omitted when unknown. Documented and deliberate.
- GPOSERS slot labels: `packages/core/src/services/chara/chara-gposers.ts:15-17` says the labels are deliberately not localised. This matches the brief's deliberately-English list.
- Core new data: `character_colors/shader/*.json` are hex arrays with no names. `index.json` has only a version and description change. `chara-game-rules`, `chara-twins` and `chara-shader-colors` hold no user-visible strings; `names.en.startsWith('Dated ')` in `chara-twins.ts:85` is logic, not UI. The only change to `TranslationProvider.ts` is a comment. `consolidated-ids.ts` has no BASE to HEAD diff, and its six-locale names are complete.
- api-worker: the chara routes take a body or `?ids`, and item `names` carry all locales, so `?locale=` does not apply. Dye search still uses the shared `localeMiddleware`: `routes/dyes.ts:61-67` gives non-en `searchByLocalizedName`. The docs change in `docs/reference/dyes.md` matches `foldForSearch` use in `DyeService.ts:350-361`. All error responses carry an `ErrorCode`. The new rate-limit `message` is paired with `ErrorCode.RATE_LIMITED`.
- presets-api and oauth (#224, #228): new rejection text is English wire `message` beside an `ErrorCode`. `USER_BANNED` is still mapped by the client in `apps/web-app/src/services/preset-submission-service.ts:71-72`. The new codes (`DUPLICATE_RESOURCE` and the `REVISION_REQUIRED` / `STALE_REVIEW` details in `handlers/moderation.ts:69,95-108`) are moderator-facing only. The retention job and identity re-key add no user text. `oauth` only changes the allow-list; its `error=` redirect text is logged and dropped by `auth-service.ts:215-258` and never shown.
- moderation-worker (#225): the English-only decision still holds in code. `services/bot-i18n.ts:113-117` documents it and `enLocale` is the only data. The bot-i18n PR diff only removes five orphaned keys and adds `presetsStillHidden` and `presetsStillHiddenWhy` (ban section). I scripted a check of every `.t('…')` key used in `apps/moderation-worker/src` against `enLocale`: 32 used, 0 missing, so no raw key can show. Nothing is sent to non-moderators: there is no DM or channel-create call, and ban and review posts go only to the moderation channel (FINDING-008 removes the author and account ID). New modal and button labels ("Reason for rejection", "Reason for reverting") sit on moderator-only paths.
- stoat-worker (#234): the only change is the mention-defusal in `services/response-formatter.ts`; there are no new user strings. The English fallbacks in `commands/info.ts:31,62` and `response-formatter.ts:153` predate BASE. The app is parked, and this is not a regression.
- HC triage: all six `hc-sentences-*` files are logs, thrown `Error`s, env-validation text, `ErrorCode` messages, or admin/mod-only text. None is a finding.

## Positive controls
- The key check would print `MISSING <key>` for any used key absent from `enLocale`; it printed none (45 defined, 32 used). No injected-failure run was done.
- `bot-logic` en.json has `blendingModes.*`, and the Discord worker uses it instead of the English `BLENDING_MODES.description` in core.

## Rejected
- Web-app shows the presets-api English `message` as toast `details` (`preset-submission-service.ts:20-31,336-341`). The comment documents this as the deliberate wire-message design. The "unsupported characters" suffix exists at MAIN (`8ecb878f`); PR#224 only reuses it for example links. Not filed.
- `preferences.ts` `BLENDING_MODES` English descriptions in core: not user-visible (the bot uses locale keys).
- Moderation "You do not have permission" in English could be seen by a non-moderator. It only appears inside the moderation channel and guild, so it falls under the English-only decision.
- Unused `ban.presetsHidden`, `ban.alreadyBanned`, `ban.userBanned` and `meta.*` keys in moderation `enLocale`: a dead-code matter, not i18n.

## Covered
`git diff 5c80fcba HEAD` stat for the six slices (128 files); `apps/api-worker/src/chara/*`, `routes/dyes.ts`, `middleware/rate-limit.ts`, docs `chara.md` and `dyes.md`; core `chara-*` and `consolidated-ids.ts`; presets-api `handlers`, `middleware/ban-check.ts` and `validation-service.ts`; moderation `bot-i18n.ts` (+ PR diff) and handlers; stoat `response-formatter.ts`; the six HC evidence files.
