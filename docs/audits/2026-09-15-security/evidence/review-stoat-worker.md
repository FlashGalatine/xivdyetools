# Stoat worker review
**Scope:** source-only review of parked `apps/stoat-worker` at `0332fcc5`.
## Route/authz matrix
| Input | Gate | Result |
|---|---|---|
| Revolt message | authenticated gateway session, bot-message exclusion, prefix parse, per-user throttle | public command input |
| stats/admin route | registered command lookup plus ULID allowlist | authorized users only |
| unknown command | own-property route lookup, sanitised/capped echo | public error reply |
## Candidates
No candidate verified.
## Positive controls
- Bot token is mandatory; admin ids are validated Crockford ULIDs and authorization compares against configured allowlist.
- Parser and router use own-property checks, avoiding prototype keys; unknown/user text is mention-defused, sanitised and capped before bot echo.
- Message handler ignores bot authors, throttles users, returns generic errors, and logging maps unknown commands to a fixed placeholder instead of storing message/channel/user data.
- No configured database, analytics, KV, R2, third-party request, or persistent log storage exists; planned Upstash/SQLite paths are not active.
## Rejected suspicions
- Prefix injection, prototype-key dispatch, bot loop, unauthorised stats, raw command logging, and active persistent personal-data storage were not reachable.
## Coverage and limits
- Covered 10 production TypeScript files and package config; no tests, production probes, or source edits. Revolt gateway permission behavior was not exercised.
