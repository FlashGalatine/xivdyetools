# FINDING-021: bot-logic sanitizeEmbedText leaves Discord <...> syntax live (channel, slash-command, emoji, timestamp) and omits bidi isolates, Arabic letter mark and tag characters
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** bot-logic (consumed by discord-worker, moderation-worker, stoat-worker) · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-74
**Merged:** G19 (same root cause)

## Location
- `packages/bot-logic/src/discord-markdown.ts:15` — sanitizeEmbedText leaves Discord <...> syntax (channel, slash-command, emoji, timestamp, guild-nav) live in bot-voiced embeds
- `packages/bot-logic/src/discord-markdown.ts:14` — escapeDiscordMarkdown leaves Discord angle-bracket syntax live
- `packages/bot-logic/src/discord-markdown.ts:22` — sanitizeEmbedText does not strip bidi isolates, Arabic letter mark or tag characters

## Evidence
- const MARKDOWN_SPECIALS = /([*_~`|>#\\[\]()])/g; ... .replace(/<@[!&]?(\d+)>/g, '@$1');
- Reach: An authenticated user submits a community preset (or author name) such as "</ban:123> <#456>" through /preset submit or the web app. presets-api accepts it, and discord-worker's /preset list (preset.ts:238, embed description) and preset notifications render it through sanitizePresetName/sanitizePresetDescription, which wrap sanitizeEmbedText.
- MARKDOWN_SPECIALS at line 15 is /([*_~`|>#\\[\]()])/g with no '<', and defuseMentions (lines 46-50) only rewrites @everyone/@here and <@id>/<@!id>/<@&id>. So <#id>, </cmd:id>, <:e:id>, <t:...> and <id:customize> still render as live channel links, slash-command mentions, emoji, timestamps or guild navigation in bot-authored embed descriptions and field values. presets-api validation-service.ts:184-221 checks only length and control/invisible characters, so '<' reaches the sink. No ping is possible (ALLOWED_MENTIONS_NONE on every payload, discord-api.ts:31-32), so the impact is bounded bot-voiced spoofing and misdirection, which FIN… Preconditions: Needs a valid Discord identity or JWT to submit a preset. Presets that wait for moderation are seen only after approval, though the moderator embeds render the text too. The echo sinks (budget, dye, harmony and others) are mostly ephemeral replies to the user's own input, so self-only.
- Live state the repo cannot show: Discord client rendering of <#id>, </cmd:id> and <t:...> inside embed descriptions and field values (they do not render in embed titles).

## Fix
- Add '<' to MARKDOWN_SPECIALS (Discord shows a literal \< and kills every <...> form), keeping defuseMentions first. Add tests for <#id>, </cmd:id>, <:e:id>, <t:0> and <id:customize>. Then bump bot-logic, publish it, and redeploy both bots.

## Status
OPEN — source prepared; release pending. [A-BOT-LOGIC evidence](../evidence/remediation-bot-logic-2026-10-27.md).
