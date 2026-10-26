# review-stoat-worker (apps/stoat-worker 0.3.3, parked Node/revolt.js bot)

Deploy unit: stoat-worker (parked). Not a Cloudflare Worker: no Hono, no routes, no D1/KV/R2, no HTTP server. The only inbound is the revolt.js WebSocket `messageCreate`; the only outbound is revolt.js `sendMessage`/`edit`/`react`. No `fetch`/`http` call in src (`git grep fetch|http` yields only two doc URLs in about.ts:26).

## Command table (src/router.ts:93-109, COMMAND_ROUTES)

| Command | Handler | Authz | Notes |
|---|---|---|---|
| `ping` | commands/ping.ts | none (any non-bot user) | send + edit |
| `help [topic]` | commands/help.ts:60 | none | `Object.hasOwn` topic lookup |
| `about` | commands/about.ts | none | static embed |
| `dye.info` (`info`) | commands/info.ts:25 | none | resolver -> bot-logic `executeDyeInfo`; up to 4 messages for 2-4 matches |
| unknown | router.ts:78 | none | echoes `sanitizeEcho(key, 32)` |

Authz matrix: all commands are public; no admin command is routed. `isAuthorized` (config.ts:57) and `STATS_AUTHORIZED_USERS` are defined but unused by any route (git grep: only config.ts + tests).

## Gate order (message-handler.ts:68-141)
own/other-bot author filter -> empty-content filter -> `parseCommand` prefix match -> per-user throttle (5/10 s, in-memory, silent drop) -> route -> try/catch with fixed-text error reply.

## Positive controls
- Token: `BOT_TOKEN` read only from env (config.ts:29), passed only to `loginBot` (index.ts:98); never logged; `.env` gitignored (.gitignore:6-7); `.env.example` has empty values.
- Logging: logger pinned to `info` in index.ts:25; no user id, channel id or message text is logged; unregistered command tokens replaced with `(unregistered)` (message-handler.ts:41-47,125-130); error replies are fixed text (message-handler.ts:134).
- Echo of user text: `sanitizeEcho` (response-formatter.ts:103-109) strips invisibles, defuses `<@ULID>`, `<%ULID>`, `@everyone/@here/@online`, escapes markdown, caps length; used on every echo path (router.ts:79, response-formatter.ts:128,155).
- Prototype keys: `Object.hasOwn` on SHORT_ALIASES (parser.ts:84), COMMAND_ROUTES (router.ts:54), COMMAND_HELP (help.ts:62).
- Parser has no unbounded regex (only `/\s+/` split, `/^\d+$/`); `editDistance` (dye-resolver.ts:117) is length-gated and row-capped against ~125 names, so Revolt's content cap bounds the work.
- Throttle map pruned each window (command-throttle.ts:55-62); MessageContextStore capped at 500 + 1 h TTL (message-context.ts).
- Startup validates admin ULIDs (config.ts:36-40). `process.on('error')`-style gateway handler present (index.ts:60).
- No `[vars]`/wrangler, no secrets in repo; no CI deploy workflow references stoat (`git grep stoat .github` matches only ci.yml generic filters).

## Rejected
- Bot-loop via `message.author` undefined (message-handler.ts:73): only matters if another bot's uncached author slips through AND its text starts with `!xd`; bot replies never start with the prefix. No reachable loop.
- Echo/mention injection: covered by FINDING-019/026 fixes, no regression found (sanitizeEcho intact).
- Amplification (info = up to 4 msgs x 5 cmds/10 s per user, no global cap): bounded by platform rate limits; hardening only, not filed.
- Gateway/fatal error `.message` logging (index.ts:62,100): could contain library text but no evidence a token appears; speculative.
- `Logged in as <bot username>` (index.ts:46): bot's own public name, not personal data.
- Unused `upstashRedisUrl/Token` plumbing: no outbound use; filed as INFO only.

## FILES COVERED
~22 source/config files read in full: apps/stoat-worker/{src (index, config, message-handler, router, commands/{parser,info,help,about,ping}, services/{dye-resolver,response-formatter,message-context,command-throttle,loading-indicator}), package.json, .env.example, .gitignore} + packages/bot-logic/src/discord-markdown.ts (sanitizeEmbedText). Tests, CHANGELOG, README, CLAUDE.md not read.
