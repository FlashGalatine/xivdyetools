# FINDING-019: User-controlled strings rendered into Discord embeds/messages without markdown or mention sanitisation; no `allowed_mentions` on outbound payloads

## Severity
**LOW** — Discord renders markdown/masked links inside embeds authored by the bot, so preset names, descriptions, tags, author names, `.chara` field values and search queries become bot-voiced phishing/spoof surfaces; `@everyone`/role pings are only possible in message `content` (none found today) but `allowed_mentions` is absent everywhere. Reviewer IDs: DW-1, DW-2, DW-16, PAPI-6, MOD-6, STOAT-4, DW-10.

## Category
CWE-74 Improper Neutralization of Special Elements in Output Used by a Downstream Component · CWE-451 UI Misrepresentation

## Location
- `apps/discord-worker/src/handlers/commands/preset.ts:953-960, 234-238, 1001-1012` — stored `name`/`description`/`tags`/`author_name` rendered raw in public embeds; the submission-log path skips the sanitiser the moderation path uses.
- `apps/discord-worker/src/handlers/commands/swatch.ts:76-78, 113-121` + `packages/core/src/services/chara/chara-parser.ts:196-202, 240-246, 258-268` — `.chara` field values echoed verbatim into a **public** error embed.
- `apps/discord-worker/src/handlers/commands/dye.ts:112-121, 134-141` — `/dye search` echoes the raw query into a public embed title.
- `apps/moderation-worker/src/handlers/commands/preset.ts:180, 454-457`, `services/preset-api.ts:486-488` — author-controlled names in moderator embeds.
- `apps/presets-api/src/services/validation-service.ts:253-272` — tags are length-checked only (no charset, never moderated).
- `apps/discord-worker/src/utils/discord-api.ts:60-73, 147-150, 283-297`, `apps/moderation-worker/src/utils/discord-api.ts` — no `allowed_mentions` on any payload.
- `apps/stoat-worker/src/services/response-formatter.ts:79,100`, `router.ts:63` — same pattern on the Revolt bot.

## Recommendation
One shared `escapeDiscordMarkdown()` / `sanitizeForEmbed()` in `@xivdyetools/bot-logic` applied to every user-sourced string (strip `[`, `]`, `(`, `)`, backticks, `*`, `_`, `~`, `|`, `>` or wrap in code spans); send `allowed_mentions: { parse: [] }` on every outbound message; add a charset rule for tags/names in presets-api.

## References
- Evidence: `../evidence/review-discord-worker.md` (DW-1, DW-2, DW-10, DW-16), `../evidence/review-presets-api.md` (PAPI-6), `../evidence/review-moderation-worker.md` (MOD-6), `../evidence/review-infra-stoat.md` (STOAT-4)
