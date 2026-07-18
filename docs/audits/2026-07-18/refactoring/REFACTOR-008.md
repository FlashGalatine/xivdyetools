# [REFACTOR-008]: Discord and XIVAuth OAuth handlers are ~80% duplicated

## Priority
MEDIUM

## Category
Duplication / Architecture (provider abstraction missing)

## Location
- File(s): `apps/oauth/src/handlers/authorize.ts:32-119` vs `xivauth.ts:58-143` (authorize); `callback.ts:31-120` vs `xivauth.ts:150-238` (GET callback); `callback.ts:132-324` vs `xivauth.ts:248-534` (POST exchange)
- Scope: handler/module level (entire provider flow)

## Current State
Both providers repeat the same pipeline with copy-paste variations: PKCE param validation → redirect-uri allowlisting → state signing → error-redirect construction → state verification + expiry → redirect validation → token exchange with timeout → scope validation → user-field validation → `findOrCreateUser` → JWT mint → sanitized catch block. Small drifts are already observable and have produced real findings:
- Three different redirect-URI allowlists (BUG-018).
- Divergent state-expiry semantics (REFACTOR-007).
- Discord's POST logs less diagnostic detail than XIVAuth's; XIVAuth logs more user metadata.
- The rate-limit path matcher treats the two providers' callbacks differently (BUG-007).

Every security fix must currently be applied in two (sometimes four) places, and this audit shows it consistently isn't.

## Issues
- ~600 lines of near-duplicate security-critical code.
- Drift between copies is the direct root cause of two confirmed bugs in this audit.
- Adding a third provider would triple the divergence surface.

## Proposed Refactoring
Provider-config-driven flow:
```ts
interface OAuthProviderConfig {
  name: 'discord' | 'xivauth';
  authUrl: string;
  tokenUrl: string;
  scopes: string;                     // requested
  requiredScopes: string[];           // validated on token response
  callbackPath: string;               // e.g. '/auth/callback'
  buildTokenParams(env: Env, code: string, verifier: string): Record<string, string>;
  fetchUser(tokens: TokenResponse, env: Env): Promise<NormalizedUser>; // provider-specific mapping
}
```
Shared factories `buildAuthorizeHandler(config)` and `buildCallbackHandlers(config)` implement the pipeline once (including the shared allowlist helper from BUG-018's fix and `verifyState` with built-in expiry from REFACTOR-007). Provider files shrink to a config object plus the user-info mapping.

## Benefits
- Halves the security-critical surface; makes allowlist/expiry drift structurally impossible.
- New providers become a config + mapper, not 300 new lines of flow code.
- Existing per-provider tests can largely be retargeted at the factories.

## Effort Estimate
MEDIUM-HIGH

## Risk Assessment
MEDIUM. This touches the live auth path end-to-end; behavior must be preserved exactly (redirect error formats, `provider=` query markers, logging levels). Mitigate by porting the existing `authorize/callback/xivauth` test suites first and diffing responses against the current handlers before switching routes over.

> Source: evidence/d1-workers-analysis.md (2026-07-18 deep-dive, d1-workers area)
