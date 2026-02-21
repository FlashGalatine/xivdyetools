# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
