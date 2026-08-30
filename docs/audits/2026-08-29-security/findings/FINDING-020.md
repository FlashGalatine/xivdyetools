# FINDING-020: the limiter-exempt `/about`, `/manual` and `/changelog` commands still perform three hot-key KV counter writes per call, and their configured 30/min tiers are never consulted
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** discord-worker · **Rotation:** NONE · **CWE:** CWE-770

## Location
- `apps/discord-worker/src/index.ts:686` — `if (commandName && !['about','manual','changelog'].includes(commandName))` skips `checkRateLimit`
- `apps/discord-worker/src/services/analytics.ts:256-263` — every finished command increments `total`, `cmd:<name>`, `success|failure` (+ `usertrack:` read/write); `packages/worker-kit/src/presets/configs.ts:98-99` defines `about`/`manual` tiers that nothing reads

## Evidence
- KV allows one write per second per key; three shared hot keys are the cheapest denial-of-service in the worker (`analytics.ts:236-242` states the hot-key rationale) and skew the public `/stats`.

## Fix
- Apply the configured tiers to the three commands, or make their tracking Analytics-Engine-only (the pattern already used for rate-limited requests).

## Status
FIXED 2026-08-30 6c14889f, d28f76a4 (discord-worker 5.1.0: the exemption is gone — `/about` and `/manual` take the preset's 30/min tier, `/changelog` a discord-worker-local 30/min override until Sprint 9 adds the preset entry; rate-limited calls stay AE-only in analytics.)
