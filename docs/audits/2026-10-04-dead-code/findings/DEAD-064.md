# DEAD-064: stoat-worker: five more parked-feature leftovers (MessageContextStore.get/delete/size, isAuthorized, the Upstash config fields, HELP_TOPICS, two StoatMessage fields) — 54 source + 106 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/stoat-worker · **Semver:** NONE · **Category:** Dead Path · **Origin:** MAIN

## Location
- `apps/stoat-worker/src/services/message-context.ts:32` — MessageContextStore.get/delete/size (+CONTEXT_TTL_MS)
- `apps/stoat-worker/src/config.ts:57` — isAuthorized
- `apps/stoat-worker/src/config.ts:9` — BotConfig.upstashRedisUrl / upstashRedisToken
- `apps/stoat-worker/src/commands/help.ts:39` — HELP_TOPICS
- `apps/stoat-worker/src/services/response-formatter.ts:27` — StoatMessage.attachments / StoatMessage.interactions

## Evidence
- MessageContextStore is write-only in production: only info.ts:124 calls .set(); get/delete/size (and the TTL check) are read only by message-context.test.ts and info.test.ts:101-105,222. No messageReactionAdd listener exists.
  - Commands: git grep -n -E 'ContextStore\.(get|delete|size)' -- apps/stoat-worker ':!*.test.ts' -> 0 hits; messageContextStore prod refs: index.ts:43,79, message-handler.ts:55,125, router.ts:32, info.ts:124 (.set only); git grep messageReaction apps/stoat-worker -> only CLAUDE.md:132 and comment info.ts:108
- Applies to isAuthorized only. Its sole callers are config.test.ts:84-105. authorizedUsers is NOT dead: loadConfig validates STATS_AUTHORIZED_USERS and throws on a bad ULID (config.ts:39-44), and index.ts:60 logs the count.
  - Commands: git grep -n -w isAuthorized -- apps/stoat-worker -> config.ts:57 def, config.test.ts:6,84-103, CLAUDE.md/CHANGELOG docs only; discord-worker stats.ts:71 isAuthorized is a separate private function, not an import
- upstashRedisUrl/upstashRedisToken are read from env at config.ts:49-50 and never read again. Throttling is the in-memory CommandThrottle; command-throttle.ts:7 calls Upstash 'a future option'. Only config.test.ts:75-81 asserts them.
  - Commands: git grep -n -w -E 'upstashRedisUrl|upstashRedisToken' -- apps/stoat-worker -> config.ts:10,12,49,50 and config.test.ts:79-80 only; UPSTASH_* in stoat: config.ts:49-50, config.test.ts:35-36,76-77, .env.example:11-12, README/CLAUDE docs
- HELP_TOPICS (help.ts:39) has no production reader; handleHelpCommand looks topics up in COMMAND_HELP. Only help.test.ts:8,138 imports it, as the BUG-103 parity-gate input. Nothing ties it to COMMAND_HELP's keys.
  - Commands: git grep -n -w HELP_TOPICS -- . (excl. audits) -> help.ts:39 decl, help.test.ts:8,138 only; help.ts:66-68 uses Object.hasOwn(COMMAND_HELP, topic), never HELP_TOPICS
- No production caller sets StoatMessage.attachments or .interactions. info.ts sends embeds/replies/masquerade, and the formatters build content/replies only. Both are type-only optional fields; interactions is the BUG-038 reaction scaffolding and attachments mirrors Revolt's send shape.
  - Commands: git grep -n -w -E 'interactions|attachments|restrict_reactions' -- apps/stoat-worker/src -> response-formatter.ts:27,34,36 decls, info.ts:107 comment; revolt-mocks.ts:37,51 'attachments' is the mock Message's own field, not StoatMessage
- Origin: git grep at 8ecb878f shows the same wiring (index.ts:43,79; message-handler.ts:55,125; router.ts:32; info.ts:124 .set only); pr-delta.txt: no open PR touches message-context.ts, info.ts, router.ts or message-handler.ts

## Fix
**KEEP.** The app is parked, so these join the 2026-09-15-dead-code/DEAD-019 entry. Revisit trigger: Stoat is resumed or retired (docs/research/discord-alternatives/07-2026-10-refresh.md recommends parking or archiving it). On retirement the whole app goes; on resumption each item is re-judged against the new command set. HELP_TOPICS needs a refactor first, since help.ts builds its text inline.

Steps: On trigger (retire): delete apps/stoat-worker/src/services/message-context.ts (76 lines) and message-context.test.ts (67); drop the import and construction in index.ts:14,43 and the arg at :79; drop the import and field in message-handler.ts:20,55,125 and router.ts:11,31-32; drop the comment and set block in info.ts:118-130; remove `messageContextStore: new MessageContextStore()` and the imports from about/help/index/info/ping/prototype-keys/router/message-handler/echo-sanitisation tests and info.test.ts:101-105,222. Then run pnpm turbo run build type-check lint test --filter=xivdyetools-stoat-worker (stoat is outside dead-code:check).

Steps (isAuthorized): On trigger: delete config.ts:54-59 (docblock + isAuthorized); delete config.test.ts:84-105 and drop isAuthorized from the import at config.test.ts:6; update the CLAUDE.md:71 tree comment. Keep BotConfig.authorizedUsers, the STATS_AUTHORIZED_USERS parse/validation and index.ts:60. Then run pnpm turbo run build type-check lint test --filter=xivdyetools-stoat-worker.

Steps (BotConfig.upstashRedisUrl / upstashRedisToken): On trigger: delete config.ts:9-12 (two fields + docs) and :49-50; delete config.test.ts:75-81 (the 'loads optional Upstash config' test) and the stubs at :35-36; drop the UPSTASH lines from apps/stoat-worker/.env.example:10-12, README.md:106-107, CLAUDE.md:98-99 and docs/developer-guides/environment-variables.md:361-362. Then run pnpm turbo run build type-check lint test --filter=xivdyetools-stoat-worker plus pnpm docs:check-links.

Steps (HELP_TOPICS): In help.ts: add `type HelpTopic = (typeof HELP_TOPICS)[number];`. Type COMMAND_HELP as `Record<HelpTopic, string>`. Add the guard `function isHelpTopic(t: string): t is HelpTopic { return Object.hasOwn(COMMAND_HELP, t); }`, and use `if (topic && isHelpTopic(topic))` at :66 so COMMAND_HELP[topic] at :68 type-checks under strict mode, keeping the FINDING-027 own-property check. No test change. Then run pnpm turbo run build type-check lint test --filter=xivdyetools-stoat-worker.

Steps (StoatMessage.attachments / StoatMessage.interactions): On trigger (retire): delete response-formatter.ts:27 (attachments) and :34-37 (interactions block), together with DYE_INFO_REACTIONS per 2026-09-15-dead-code/DEAD-019. Then run pnpm turbo run build type-check lint test --filter=xivdyetools-stoat-worker.

## Status
KEEP (register) — revisit on the trigger above
