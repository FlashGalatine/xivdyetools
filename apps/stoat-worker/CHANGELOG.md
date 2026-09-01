# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.3] - 2026-08-31

Security-audit remediation only (2026-08-29 security audit, `docs/audits/2026-08-29-security/`, Sprint 13 — the last sprint of that audit). The bot stays parked; if this bot is ever unparked, its logs no longer carry anything about who ran a command or what channel it ran in.

### Security

- **FINDING-031 — command logging carried identity and message content**: `message-handler.ts`'s per-command debug line used to attach `{ userId, channelId, args: parsed.rawArgs }` — the author's Stoat ULID, the channel id, and the raw message text — to every accepted command. The line now logs only `Command: <command>[.<subcommand>]`; the identifiers and free text are gone, not redacted or truncated. The sibling Discord bot's privacy policy forbids channel ids and message content in any record — stoat had no policy of its own, which is exactly why this line existed unfixed. The throttle-drop line (`FINDING-035`, 2026-08-21) had the same shape at a smaller scale — `{ userId: authorId }` is now `{ command, subcommand }` (ruling S13-R1), consistent with Sprint 9 of this same audit replacing the rate limiter's per-client key with a non-identifying scope on every other bot.
- **`parsed.command`/`subcommand` are not a validated vocabulary (ruling S13-R5)** — `parser.ts` returns whatever whitespace-delimited token the user typed as `command` whenever it isn't a registered alias, so the fields above could still carry the user's own text for any unrecognized command. `router.ts` gained an exported `isRegisteredCommand()` predicate — the same `COMMAND_ROUTES` lookup `routeCommand` itself now calls, so there is exactly one `Object.hasOwn` check on that table in the file, not two that could drift apart (own-property safety on `constructor`/`__proto__`/etc. carries over unchanged). `message-handler.ts`'s `loggableCommand()` swaps in a fixed `(unregistered)` placeholder — never a sanitised or truncated version of the token — for anything `isRegisteredCommand` doesn't recognize, on every log site below.
- **The error-handler log line was not already safe (ruling S13-R6)** — `message-handler.ts`'s unhandled-error branch logs `command`, `subcommand`, and `error.message` whenever `route()` throws. An earlier pass left it alone on the reasoning that an unregistered command never throws by itself — but `router.ts`'s "unknown command" fallback still makes a live, unguarded `sendMessage` call (the same one FINDING-019 sanitises the *echoed reply* of, not this log line), and that call can reject — a permission error, a rate limit, a network blip — on every mistype, not just a registered handler's bug. When it does, the user's own unregistered token was landing in this log line at `error`, a level the `info` default-pin below does not suppress. Now goes through the same `loggableCommand()` swap as the other two sites.
- **`index.ts` admin roster at boot (ruling S13-R2, not in the original finding)** — the boot-time `ready` handler used to `.join(', ')` the entire `authorizedUsers` list into one `info`-level line: the complete roster of privileged account ids, unconditionally, on every start. It now logs the count (`authorizedUsers.length`), keeping the `(none)` signal for an empty list. This was at `info`, not `debug`, so the level fix below would not have hidden it.
- **`index.ts` logger default** — `createLibraryLogger('stoat')` took the library preset's `level: 'debug'` default (`packages/logger/src/presets/library.ts`); this file now passes `{ level: 'info' }` explicitly, since it only ever calls `.info()`/`.error()`. `message-handler.ts` keeps its own `createLibraryLogger('stoat')` instance (a separate object) at the preset's debug default on purpose — its command-name debug lines carry no identifiers any more, so there's nothing left for that level to expose, and leaving it at debug keeps them visible to an operator by default.
- Swept the rest of the unit (`commands/**`, `services/**`, `router.ts`, `config.ts`) for other log lines carrying a user id, channel id, or message content — none found beyond the sites above.

### Tests

- `message-handler.test.ts`: cases assert on the logger's captured call arguments (not just "something was logged"), each pinned to fail if its source line regresses — a throttled command logs `{ command, subcommand }` and never the author id; an accepted command logs the bare `Command: <name>` string with no second argument at all; an unregistered command logs the fixed `(unregistered)` placeholder instead of the user's own typed token, on the throttle-drop line, the accepted-command line, and the error-handler line reached via a rejected `sendMessage`. `router.test.ts` and `prototype-keys.test.ts` cover the new `isRegisteredCommand()` predicate directly, including that it fails closed on inherited `Object.prototype` members the same way `routeCommand` always did.

## [0.2.2] - 2026-08-21

Security-audit remediation only (2026-08-21 security audit, `docs/audits/2026-08-21-security/`). The bot stays parked — these close the gaps the audit wanted fixed *before* any revival.

### Security

- **FINDING-035 / STOAT-2, STOAT-6 — abuse control**: the `messageCreate` gate moved out of `index.ts` into the unit-tested `src/message-handler.ts` (`createMessageHandler`); it now ignores messages from *any* bot (`message.author?.bot`, not only our own ID — no bot-to-bot loops) and applies a per-user sliding-window throttle (`src/services/command-throttle.ts`, `CommandThrottle`, default 5 commands / 10 s, in-memory, stale users pruned). Throttled commands are dropped silently so the throttle cannot itself be used to amplify; the error reply stays fixed text.
- **FINDING-027 / STOAT-3 — prototype-key lookups**: `SHORT_ALIASES` (parser), `COMMAND_ROUTES` (router) and `COMMAND_HELP` (help) are now consulted with `Object.hasOwn`, so `!xd constructor` / `!xd __proto__` / `!xd help constructor` are plain unknown commands instead of resolving to `Object.prototype` members.
- **FINDING-019 / STOAT-4 — echoed user text**: `No dye found matching "…"`, `Found N dyes matching "…"` and the unknown-command reply go through the new `sanitizeEcho()` (`response-formatter.ts`): Revolt `<@ULID>` mentions defused, then the shared `sanitizeEmbedText` from `@xivdyetools/bot-logic` (control / zero-width stripping, `@everyone`, markdown escaping) with a 64-char cap (32 for the unknown-command token).
- **FINDING-023 / STOAT-1 — dangling links**: `!xd about` links to `https://xivdyetools.app` and `https://developers.xivdyetools.app` instead of the unregistered `xivdyetools.com` / `docs.xivdyetools.com`.

### Tests

- New: `message-handler.test.ts`, `services/command-throttle.test.ts`, `services/echo-sanitisation.test.ts`, `commands/prototype-keys.test.ts`, `commands/about.test.ts`; `test-utils/revolt-mocks.ts` gained the `author.bot` marker.

## [0.2.1] - 2026-08-16

Monorepo 2.0 follow-through only — the bot is parked (no active investment, no deploy workflow) and gained no features; patch bump for the dependency retargets.

### Changed

- **Tier 1 package consolidation (2026-07-31)**: dependencies retargeted to the surviving packages — `@xivdyetools/bot-i18n` → `@xivdyetools/bot-logic/i18n` (`LocaleCode` imports in `src/commands/info.ts` and `src/services/dye-resolver.ts`), `@xivdyetools/rate-limiter` → `@xivdyetools/worker-kit` (`/rate-limiter` subpath; still only *planned* for the Upstash backend), and `@xivdyetools/color-blending` → `@xivdyetools/core/blending` (planned mixer command). No runtime behaviour change; the retired packages are documented in `xivdyetools/DEPRECATIONS.md`.
- Compiles cleanly against `@xivdyetools/bot-logic@2.0.0` / `@xivdyetools/core@4.0.0` / `@xivdyetools/svg@2.0.0` — the only bot-logic surface this app touches (`executeDyeInfo`, `resolveDyeInput*`, `dyeService`) survived the 5.0 API rewrite unchanged.
- `package.json` `license` corrected from `ISC` to `MIT` (matches the repo `LICENSE` and every other workspace package).
- Coverage gate: `vitest.config.ts` branches threshold raised 75 → 80 (statements/functions/lines stay at 85) as part of the monorepo-wide 90% packages / 80% apps coverage pass.
- Docs: `README.md`/`CLAUDE.md` re-audited — parked/"no deploy workflow" status called out, only `ping`/`help`/`about`/`dye info` listed as implemented (everything else tagged *planned*), shared-package table updated for the consolidated names, Blog link replaced with X/Twitter, MIT + Square Enix legal notice added.

### Removed (2026-08-18 dead-code audit)

- **Unused dependency declarations** dropped from `package.json` — `@xivdyetools/svg`, `@xivdyetools/core`, and `@xivdyetools/worker-kit` (zero imports; the bot's only live bot-logic surface — `executeDyeInfo`, `resolveDyeInput*`, `dyeService` — doesn't reach any of the three directly), plus the devDependency `@xivdyetools/test-utils` (zero imports from any test file).

## [0.2.0] - 2026-07-19

2026-07-18 audit remediation (Sprint 5).

### Fixed

- **BUG-038**: message context is keyed by the bot reply's message ID (reactions arrive on the reply, so handlers can actually find the context; multi-match responses no longer overwrite one another), and the dead reaction affordances were removed until a reaction listener ships.

## [0.1.4] - 2026-03-18

### Removed

- **REFACTOR-007**: Removed Phase 2 TODO comments from command routing table; planned commands are tracked in design documents

---

## [0.1.3] - 2026-03-09

### Changed

- Updated `@types/node` from 25.3.3 to 25.3.5

## [0.1.2] - 2026-03-01

### Changed

- Migrate `Dye` type import in `commands/info.ts` from `@xivdyetools/core` to `@xivdyetools/types` (DEAD-047 Phase 2)

## [0.1.1] - 2026-02-21

### Changed

- Resolve CI lint failures — fix async/unused-var/misused-promises violations

## [0.1.0] - 2026-02-20

### Added

- Initial project scaffold with revolt.js WebSocket client
- Prefix command parser (`!xivdye` / `!xd`) with short aliases and subcommand routing
- Command router with typed `CommandContext` and dispatch table
- Multi-strategy dye input resolution (ItemID, exact name, hex code, partial match, disambiguation)
- Message context store (LRU + TTL) for tracking reaction-based interactions
- Response formatter with shared embed/error formatting utilities
- Loading indicator service (⏳ react/unreact pattern)
- `ping` command — connectivity check with latency
- `help` command — full command reference with per-command detail
- `about` command — bot info embed with features and links
- `info` command — dye lookup via `@xivdyetools/bot-logic` (resolve → executeDyeInfo → embed)
- revolt.js mock factories for testing (Client, Message, Channel)
- 54 tests across parser, config, message context, and router

---

[0.1.0]: https://github.com/FlashGalatine/xivdyetools/releases/tag/stoat-worker-v0.1.0
