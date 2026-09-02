# DEAD-017: moderation-worker hand-rolls base64url while depending on `@xivdyetools/auth/encoding`, and the `encode` half is already dead

**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/moderation-worker · **Semver:** NONE (adopting an existing package export) · **Category:** Legacy (duplicate implementation)

## Location
- `apps/moderation-worker/src/utils/response.ts:293-307` `encodeBase64Url` (dead — see DEAD-014), `:309-330` `decodeBase64Url` (live, one caller)
- Live caller: `src/handlers/modals/ban-reason.ts:78` — decoding a legacy encoded username
- The package that already owns this: `@xivdyetools/auth/encoding` — `base64UrlEncode` / `base64UrlDecode` (`packages/auth/src/encoding/base64.ts:22,101`), and `@xivdyetools/auth` is already a declared dependency of moderation-worker

## Evidence
- `evidence/symrefs-moderation-worker.txt`: `encodeBase64Url prod=1 tests=14` (declaration only) vs `decodeBase64Url` with a real caller.
- The implementation is the usual `btoa(String.fromCharCode(...bytes))` + `replace(/\+/g,'-')…` — the same shape `@xivdyetools/auth/encoding` exports, and the same duplication class the 2026-08-18 audit filed against HMAC signing (DEAD-019 there, adopted in its follow-up plan Task 2).
- `String.fromCharCode(...bytes)` also spreads the whole array into arguments, which is a latent stack limit for long inputs — a second reason not to keep a private copy.

## Fix
**REFACTOR FIRST (adopt), then remove.** Delete `encodeBase64Url` with DEAD-014; replace `decodeBase64Url`'s body with the `@xivdyetools/auth/encoding` import (or delete the wrapper and import at the one call site). Pin a fixture first: assert the current output for one known input, then assert the same value after the swap. moderation-worker CHANGELOG `### Changed`; note the adoption in the auth CHANGELOG if it gains its first consumer here.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-moderation-worker --filter=@xivdyetools/auth`.

## Status
FIXED 2026-09-01 `ac96e79a` — `base64UrlEncode`/`base64UrlDecode` from `@xivdyetools/auth/encoding` adopted at the one production call site and in the three test files; the local pair deleted.

