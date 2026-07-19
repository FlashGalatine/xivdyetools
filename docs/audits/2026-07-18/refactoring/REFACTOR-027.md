# [REFACTOR-027]: Bot HMAC signature covers only timestamp:userId:userName; moderation-worker docs claim method/path/body are signed

## Priority
LOW (security hardening + documentation drift)

## Category
Security design / docs-code divergence

## Location
- `apps/discord-worker/src/services/preset-api.ts:52` and `apps/moderation-worker/src/services/preset-api.ts:73` — `const message = \`${timestamp}:${userDiscordId || ''}:${userName || ''}\`;`
- `apps/moderation-worker/CLAUDE.md` — documents the signature as HMAC over `timestamp:method:path:body`
- Verifier: presets-api (out of this audit's scope, but party to any change)

## Current State
Both bot workers sign presets-api requests with HMAC-SHA256 over **timestamp and user identity only**. The HTTP method, path, and body are not bound to the signature. The moderation-worker's own CLAUDE.md documents the stronger scheme (`timestamp:method:path:body`) as if it were implemented.

## Issues
- **Replay/redirection within the 5-minute window:** a captured "approve preset X" request's headers are byte-reusable for *any* method/path/body — e.g. as "reject preset Y" — by whoever can reach presets-api with those headers. The service-binding topology makes external interception unrealistic (hence LOW, not a vulnerability report), but the `PRESETS_API_URL` fallback path (dev/misconfiguration) travels the public internet where this matters.
- **Docs drift:** the moderation CLAUDE.md promises guarantees the code does not provide; future maintainers will reason from the wrong threat model.

## Proposed Refactoring
1. Land REFACTOR-010 first (single shared signer).
2. Introduce signature v2: `HMAC(timestamp:method:path:sha256(body):userId:userName)` with a version header (`X-Signature-Version: 2`).
3. presets-api verifies v1-or-v2 during rollout, then drops v1.
4. Update the moderation CLAUDE.md (immediately, even before the code change, to state what is actually signed).

## Benefits
- Defense-in-depth on the URL-fallback path; a leaked/observed request can no longer be repurposed against a different endpoint or payload.
- Documentation and implementation re-converge; the spec referenced in code comments (`docs/HMAC_SIGNATURE_SPEC.md`) becomes trustworthy.

## Effort Estimate
Small once REFACTOR-010 lands — one signer change, one verifier change, versioned rollout; ~half a day plus coordinated deploys.

## Risk Assessment
Moderate-care, low-probability: a mismatched rollout order breaks all bot→presets-api calls. Mitigated by the version header (verify both formats until both bots are confirmed on v2). No user-visible behavior change.

> Source: evidence/bot-workers-analysis.md (2026-07-18 deep-dive, bot-workers area)

## Status

**PARTIAL (docs corrected) 2026-07-19** — moderation-worker's CLAUDE.md now states what is actually signed (`timestamp:userId:userName`) with an explicit note on the replay scope. Signature v2 (binding method/path/body-hash) deliberately waits for the shared signer extraction (REFACTOR-010).
