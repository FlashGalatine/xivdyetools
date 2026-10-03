# Review: stoat-worker (2026-10-03)

Scope: apps/stoat-worker (Node + revolt.js, parked, no deploy workflow: docs/operations/OPEN_ITEMS.md:144).

## 1. Entry points and authz matrix
| Entry | Who | Guards before handler | Caps |
|---|---|---|---|
| gateway `messageCreate` (src/index.ts:79 -> message-handler.ts:228) | any Revolt user able to post where bot is present | self/bot filter (:230-231), empty content drop (:234), prefix parse (:237), per-user throttle 5/10 s (:241, command-throttle.ts:420) | message length = Revolt platform cap; no local cap |
| `!xd ping` / `help` / `about` (router.ts:368-376) | any user | none beyond above | fixed text |
| `!xd info <dye>` (info.ts:25) | any user | same | up to 4 replies per call ("multiple", info.ts:72); throttled |
| unknown command fallback (router.ts:354) | any user | sanitizeEcho cap 32 | - |
| admin/stats | NOT implemented: `authorizedUsers`/`isAuthorized` (config.ts:158) have no caller in src (not routed) | n/a | n/a |
No HTTP listener, no inbound webhook, no custom_id/components, no reaction handler (info.ts:105-108). Outbound: only revolt.js gateway/REST to Stoat; no fetch( in src (grep clean). Upstash config is read (config.ts:150) but unused in src.

## 2. Positive controls
- Token only from env BOT_TOKEN (config.ts:130), passed once to loginBot (index.ts:92); never logged ("Configuration loaded" only, index.ts:40); .env gitignored (.gitignore), .env.example blank.
- FINDING-031 verified FIXED: logger pinned to info (index.ts:28); admin ULIDs not logged, count only (index.ts:59); throttle line has no user id (message-handler.ts:253); accepted-command line uses loggableCommand placeholder for unregistered text (:275-278); error path too (:298-303). No userId/channelId/rawArgs anywhere in log calls.
- Own-property route lookup (router.ts:330, parser.ts:106) blocks prototype keys.
- Bot/self loop guard (message-handler.ts:230-231); fixed-text error reply, no internals (:307).
- Every outgoing reply uses `replies: [{mention:false}]` (router.ts:356, info.ts:111, help.ts, about.ts:239).
- Echoed user text sanitised: sanitizeEcho defuses `<@ULID>`, then sanitizeEmbedText strips control/bidi, defuses @everyone/@here, escapes markdown, caps length (response-formatter.ts:454-456; bot-logic discord-markdown.ts:61-72). Used on all three echoes (router.ts:355, formatter :471, :492).
- Suggestions/disambiguation lists come from the dye DB, not user text (dye-resolver.ts:329, formatter :467).
- Edit-distance capped and length-gated (dye-resolver.ts:373-386): no ReDoS/CPU blowup.
- Pii: nothing stored (MessageContextStore is in-memory, 500 cap + 1 h TTL, keyed by bot-message id, holds dye id/hex only: message-context.ts:340-361, info.ts:124-129); no analytics, KV/D1/R2, or third-party bodies. Throttle map holds author ULIDs in memory only, pruned per window (command-throttle.ts:446-455).

## 3. Rejected
- Throttle key 'unknown' when authorId missing (message-handler.ts:240): shared bucket, only self-DoS of unattributed messages; not security.
- `<#channel>` mentions not defused: renders a channel link, no ping.
- Unbounded throttle map from many ULIDs: bounded by platform user population; pruned.
- Token in `client.user.username` log (index.ts:51): bot's own name, not personal data.
- Masquerade name/colour from dye DB (info.ts:112-115), not user text.
- Admin gate bypass: no admin commands exist.
- Pasting exposure `executeDyeInfo` embed: static dye data.

## 4. Files covered
apps/stoat-worker/src/{index,config,message-handler,router}.ts; commands/{parser,info,help,about,ping}.ts; services/{command-throttle,message-context,response-formatter,loading-indicator,dye-resolver}.ts; package.json, .env.example, .gitignore, CLAUDE.md (head); packages/bot-logic/src/discord-markdown.ts:20-110; docs/operations/OPEN_ITEMS.md:144, SECRET_ROTATION.md:60. Test files not read.

## 5. Candidates
| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | INTERNET-AUTH | apps/stoat-worker/src/services/response-formatter.ts:454 | Revolt `@online` mass mention is not defused (only @everyone/@here); echoed query reaches content under bot identity, so a user lacking MentionEveryone could ping online members if the bot holds that permission |
| c2 | INFO | INTERNET-UNAUTH | apps/discord-worker/PRIVACY_POLICY.md (silent) | Policies cover Discord only; stoat is not deployed anywhere in repo and writes/logs nothing personal, so no document is false today. If ever deployed, a note/policy is needed first |

## 6. Handoffs
- help.ts HELP_OVERVIEW is accurate, but about.ts:231-233 advertises `!xd random` (unrouted -> "Unknown command") and "6 algorithms/harmony/accessibility" features not implemented (P3 docs/bug).
- config.ts: upstashRedisUrl/Token and STATS_AUTHORIZED_USERS/isAuthorized are read/validated but unused (P3 dead code).
- messageContextStore written but no reaction reader (P3).
