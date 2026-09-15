# FINDING-001: verifyDiscordRequest buffers the full body before enforcing its cap
**Severity:** MEDIUM · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** auth · **Rotation:** NONE · **CWE:** CWE-400

## Location
- `packages/auth/src/discord.ts:113` — reads all bytes as text; line 119 allocates another byte array before rejecting; cryptographic verification is at line 129.
- `apps/discord-worker/src/index.ts:685` and `apps/moderation-worker/src/index.ts:159` — public interaction routes call the helper without a preceding streaming body cap; per-user limiting follows verification.

## Evidence
- `node node_modules/tsx/dist/cli.mjs docs/audits/2026-09-15-security/evidence/scripts/probe-auth-stream.ts` passed: a synthetic 1 MiB stream without Content-Length was entirely consumed, never cancelled, before the 100,000-byte check rejected it. See [probe result](../evidence/auth-stream-probe.txt).
- Trigger: unauthenticated `POST /` with a current `X-Signature-Timestamp`, any nonempty `X-Signature-Ed25519`, and a streamed oversized body. No valid signature is needed to reach buffering.
- Availability risk, not an authentication bypass: [Cloudflare documents 128 MB isolate memory and recommends streaming](https://developers.cloudflare.com/workers/platform/limits/). The local probe proves unbounded-by-application consumption; a production crash/load test was not performed.

## Fix
- Read incrementally, count bytes and cancel immediately above the cap; decode only the bounded accepted buffer, then verify the original bytes. Guard with a stream-consumption test. Publish auth and roll the fix into both bot deployments.

## Status
OPEN
