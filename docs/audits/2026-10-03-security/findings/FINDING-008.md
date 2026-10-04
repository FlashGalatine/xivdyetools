# FINDING-008: Preset submissions post the author name, a `<@id>` mention, name and description to private Discord moderation / submission-log channels — bot policy §5 says "All data is stored on Cloudflare" and web PRIVACY.md item 3 is silent
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** discord-worker + web-app (documents); code in discord-worker + presets-api · **Rotation:** NONE · **Policy:** AMEND `apps/discord-worker/PRIVACY_POLICY.md` §5 (+ §7 deletion) and `apps/web-app/PRIVACY.md` §Network access item 3 — variants: `PRIVACY_POLICY.md` + `.ja/.ko/.zh/.de/.fr`, `PRIVACY.md` + `.ja/.ko/.zh/.de/.fr` (12 files) · **CWE:** CWE-359
**Reconcile case:** 2 — a new recipient/store (Discord channel history) for both documents; moderation needs the post, so minimize then AMEND

## Location
- `apps/discord-worker/src/handlers/commands/preset-notifications.ts:102,114,197` — moderation embed with author name + `(<@author_discord_id>)`, preset name and description, sent to `MODERATION_CHANNEL_ID`.
- `apps/discord-worker/src/index.ts:427-452`, `src/handlers/commands/preset.ts:1083-1103` — submission-log embed (name, description, author) sent to `SUBMISSION_LOG_CHANNEL_ID`; web submissions reach it via `apps/presets-api/src/handlers/presets.ts:1025-1037` (`notifyDiscordBot` carries `author_name` + `author_discord_id`).
- `apps/discord-worker/PRIVACY_POLICY.md:101-107` (storage table = KV, D1, Analytics Engine; "All data is stored on Cloudflare's infrastructure") and `apps/web-app/PRIVACY.md:65-74` (item 3: no Discord post mentioned).

## Evidence
- `preset-notifications.ts:114`: `` **Author:** ${safeAuthor}${preset.author_discord_id ? ` (<@${preset.author_discord_id}>)` : ''} `` — the messages persist in Discord channel history, outside Cloudflare and outside the D1 retention table.
- The fields themselves are disclosed (bot §2 User ID / Username; Discord listed as a third party at §6), but neither document names this recipient or says whether a deletion request removes those channel messages.

## Fix
- Minimize: consider dropping the `<@id>` mention from the submission-log embed (moderators can resolve the author via `/preset moderate`); keep it only where moderation needs it.
- Then AMEND both documents: add a §5 row "Discord — private moderation and submission-log channels: preset name, description, dyes, tags, author name and a mention of the author's account; kept in Discord's message history", replace the "All data is stored on Cloudflare" sentence, and say in bot §7 / web Questions? whether a deletion request removes those messages. Twelve-file edit; an AMEND is a significant change, so bot policy §11 calls for a Discord announcement.

## Status
FIX COMMITTED, NOT DEPLOYED — bot policy AMEND (every kind of moderation post; no Discord User ID in posts made since the Last Updated date) in PR #227. Account IDs are removed from moderation posts: discord-worker embed mention (`d1fdb89a`), moderation-worker refreshed embed (`10a3b137`), ban post `User ID` field (`aaa4467b`) and its ID fallback (`3a69828c`) (PR #225). Web AMEND `59cc1d6a` (branch `fix/security-2026-10-03-sprint8`, web-app 5.14.0; PR #230, open, stacked on #223). Posts already in the channels before the deploy may still carry IDs; both documents say so, and a deletion request removes them.
