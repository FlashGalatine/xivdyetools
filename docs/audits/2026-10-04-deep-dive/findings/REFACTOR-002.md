# REFACTOR-002: searchPresetsForAutocomplete is called without logger, so its catch returns [] silently while the user-presets path logs.
**Priority:** LOW · **Effort:** LOW · **Risk:** LOW · **Deploy unit:** apps/discord-worker · **Origin:** MAIN

## Location
- `apps/discord-worker/src/index.ts:1137`
- `apps/discord-worker/src/index.ts:1137` — searchPresetsForAutocomplete called without logger, so presets-api autocomplete failures are silent

## Evidence
- Reproduction: presets-api timeout during /preset show autocomplete -> empty choices, no log
- index.ts:1137 passes only { status: 'approved' }. searchPresetsForAutocomplete logs in its catch only when options.logger is set (preset-api.ts:516-522), so a presets-api failure on the show/vote/favorite-add autocomplete returns [] with no log line, while the edit and favourites paths do log.
  - Checked: index.ts:1137; services/preset-api.ts:482-522
- Found independently from another slice: Confirmed observability gap: neither layer logs without a logger, and the sibling own-presets path does pass one.
- Origin: git show 8ecb878f:apps/discord-worker/src/index.ts:1136 same call without logger

## Fix
- Pass { status: 'approved', logger } at index.ts:1137.

## Status
FIX COMMITTED, NOT DEPLOYED — `a9dac980` (branch `fix/remediation-2026-10-04-sprint9`, discord-worker 5.8.4; PR #257, open, on PR #256).
