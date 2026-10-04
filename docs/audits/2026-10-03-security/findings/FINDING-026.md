# FINDING-026: stoat-worker sanitizeEcho does not defuse Revolt's @online mass mention in echoed command tokens and dye queries
**Severity:** LOW · **Exposure:** LOCAL · **Deploy unit:** stoat-worker + bot-logic · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-116

## Location
- apps/stoat-worker/src/services/response-formatter.ts:69,78-79 — REVOLT_MENTION handles only <@ULID>; sanitizeEcho then delegates to sanitizeEmbedText
- packages/bot-logic/src/discord-markdown.ts:46-48 — defuseMentions inserts a ZWJ only for @everyone/@here (Discord set), not @online
- apps/stoat-worker/src/router.ts:88 and response-formatter.ts:95,116 — unknown-command token and dye query are echoed under the bot identity ('!xd @online' makes '@online' the command token)

## Evidence
- export function sanitizeEcho(text: string, maxLength = 64): string {
  return sanitizeEmbedText(text.replace(REVOLT_MENTION, '@$1'), maxLength);
}
- function defuseMentions(text) { return text
    .replace(/@(everyone|here)/gi, `@${ZWJ}$1`)
    .replace(/<@[!&]?(\d+)>/g, '@$1'); }
- git grep -n -i online -- apps/stoat-worker/src packages/bot-logic/src/discord-markdown.ts -> no output, exit=1

## Fix
- In sanitizeEcho, defuse @online with a ZWJ after '@', the same way @everyone is handled (e.g. text.replace(/@(online)/gi, '@‍$1') before sanitizeEmbedText), and add a unit test covering all three echo sites
- Check Revolt/Stoat's role-mention syntax (the schema has role_mentions) and defuse it in the same place
- Before any redeploy, confirm the bot role does not hold a mention-everyone permission

## Status
FIX COMMITTED, NOT MERGED (parked app, no deploy) — `01465700` (branch `fix/security-2026-10-03-sprint12`, stoat-worker 0.3.2; PR #234). sanitizeEcho now strips invisible characters first, rewrites `<%ULID>` tokens to plain text, and after the shared sanitiser inserts a ZWJ after the `@` of everyone/online/here. That last pass runs after sanitizeEmbedText because the latter strips U+200D, so this audit's suggested 'before' ordering would not have worked. There is no word-boundary condition, because Stoat's backend matching is unverified. 13 tests cover the three echo sites. packages/bot-logic is unchanged. Before any redeploy, confirm the bot's role cannot mention everyone.
