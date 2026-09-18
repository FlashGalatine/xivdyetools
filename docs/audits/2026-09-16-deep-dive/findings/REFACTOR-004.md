# REFACTOR-004: api-worker builds its error envelope two ways and error `meta` never carries `locale`
**Priority:** P3 · **Effort:** LOW · **Risk:** LOW · **Deploy unit:** api-worker

## Location
- `apps/api-worker/src/index.ts:206-246` (`ApiError`) vs `routes/match.ts:52-65` (hand-rolled 404)

## Evidence
- Reviewer row `api-worker-04`

## Fix
- Route the 404 through `ApiError`; include `locale` in error `meta` for parity with success responses (documented in the VitePress contract)

## Status
FIXED (Sprint 11, `1cf37231`) — the match 404 is thrown as `ApiError`; error `meta` carries `locale` wherever the `/v1/*` locale middleware ran; `docs/guide/errors.md` updated.
