# [REFACTOR-007]: State expiry validation is caller-optional — move it into verifyState

## Priority
MEDIUM

## Category
Design Pattern / Security invariant enforced by caller discipline

## Location
- File(s): `apps/oauth/src/utils/state-signing.ts:53-96` (`verifyState` — no exp check); `apps/oauth/src/handlers/callback.ts:73-79` (inline check, tolerates missing `exp`); `apps/oauth/src/handlers/xivauth.ts:195-204` (uses `validateStateExpiration`, requires `exp`)
- Scope: function level (OAuth state verification primitive)

## Current State
`signState` always embeds `iat`/`exp` (authorize.ts:92-101, xivauth.ts:116-125), but `verifyState` verifies only the HMAC signature and never checks the timestamps. Each callback re-implements expiry differently:
- Discord's inline check `if (stateData.exp && stateData.exp < now)` **accepts** a state with no `exp` field.
- XIVAuth's `validateStateExpiration` (oauth-validation.ts:43-53) **rejects** a missing `exp`.

## Issues
- A security property (state replay-window limiting) depends on every caller remembering to add a second call — and the two existing callers already diverge on missing-`exp` semantics.
- Any future consumer of `verifyState` (new provider, tests, tooling) can silently accept eternal states.
- Duplicated expiry logic is one more surface for the provider-handler drift documented in REFACTOR-008.

## Proposed Refactoring
Validate expiry inside `verifyState` and delete the per-handler checks:
```ts
export async function verifyState(signedState: string, secret: string, allowUnsigned = false): Promise<StateData> {
  ...signature verification as today...
  const state = JSON.parse(json) as StateData;
  const now = Math.floor(Date.now() / 1000);
  if (!state.exp) throw new Error('State missing expiration timestamp');
  if (state.exp < now) throw new Error('OAuth state expired. Please try logging in again.');
  return state;
}
```
The `allowUnsigned` dev path may stay lenient (legacy unsigned states have no exp), keeping dev ergonomics unchanged.

## Benefits
- The replay-window invariant is enforced at the primitive, not by caller discipline.
- Removes the Discord/XIVAuth divergence and ~15 lines of duplicated handler code.
- Callers' error handling already routes thrown errors to the error-redirect path, so no new plumbing is needed.

## Effort Estimate
LOW

## Risk Assessment
LOW. Signed states have always carried `exp` (both authorize handlers set it), so tightening to "exp required" cannot reject legitimate production states. Only dev-mode unsigned states could lack it, and those are already gated behind `ENVIRONMENT === 'development'`.

> Source: evidence/d1-workers-analysis.md (2026-07-18 deep-dive, d1-workers area)

## Status

**DONE 2026-07-19** — `verifyState` enforces exp (missing or past → throw) for signed states; the divergent per-handler checks and `validateStateExpiration` were deleted. Dev-only unsigned states stay lenient.
