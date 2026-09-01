# FINDING-031: stoat-worker logs user ULID + channel id + raw command text at `debug`, and its library logger defaults to level `debug` (parked bot — P3)
**Severity:** LOW (P3, parked unit) · **Exposure:** LOCAL (Node host stdout) · **Deploy unit:** stoat-worker · **Rotation:** NONE · **CWE:** CWE-532

## Location
- `apps/stoat-worker/src/message-handler.ts:56` (`userId` on throttle drop), `:60-64` — `logger.debug('Command: …', { userId, channelId, args: parsed.rawArgs })`
- `packages/logger/src/presets/library.ts:71-79` — `createLibraryLogger` defaults to `level: 'debug'` (stoat `index.ts:17`)

## Evidence
- The sibling bot's policy forbids channel ids and message content in any record; stoat has no policy of its own and this line ships free text per command to whatever captures stdout. Introduced by the 2026-08-21 FINDING-035 throttle gate.

## Fix
- Log command name only (drop `channelId`, `args`); default stoat's logger to `info`.

## Status
FIXED 2026-08-31 (stoat-worker 0.2.3) — commits `25285961`, plus the fix round below.

The two sites the finding names are fixed — the throttle-drop and accepted-command lines no longer
carry `userId`, `channelId` or `args` (the last being raw message content) — and the logger is
pinned to `info` at stoat's own call site rather than taking `createLibraryLogger`'s `debug`
default (verified in `packages/logger/src/presets/library.ts`; the preset default is deliberate for
library consumers and was left alone).

**Two sites the finding did not name, both found by sweeping the unit rather than working the
list:**
1. `index.ts:41-43` logged the **complete roster of authorized admin ids** — `config.authorizedUsers.join(', ')`
   — at **`info`**, on every boot, so the `debug` → `info` change would not have hidden it. It now
   logs the count, keeping the "(none)" signal that is the operationally useful part.
2. `parsed.command` is not a validated vocabulary: a message matching the bot's prefix but no
   registered route put the user's own token into both log lines verbatim. `router.ts` already
   treats that exact value as untrusted — its unknown-command reply sanitises and caps it
   (2026-08-21 FINDING-019) — so logging it raw one function away contradicted the file's own
   reasoning. The command is now logged only when it is a registered route, tested with the same
   `Object.hasOwn` check the router uses so `constructor` / `__proto__` cannot read as known;
   anything else logs a fixed placeholder rather than a truncated token, because a log line has no
   reason to carry it at all.

**Deliberately not done:** stoat still has no privacy policy of its own, which is what makes the
sibling bot's policy the only written rule here. Writing one for a parked, undeployed bot was not
this sprint's job — recorded rather than done.
