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
OPEN
