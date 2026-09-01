# DEAD-025: oauth `DISCORD_REQUIRED_SCOPES` and `isStateSigned` — exported, referenced nowhere, not even by tests — 14 lines

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/oauth · **Semver:** NONE (app-internal) · **Category:** Unused Export

## Location
- `apps/oauth/src/constants/oauth.ts:73-77` — `DISCORD_REQUIRED_SCOPES`
- `apps/oauth/src/utils/state-signing.ts:120-128` — `isStateSigned`

## Evidence
- knip *Unused exports* (`evidence/knip-root.txt`).
- `evidence/symrefs-oauth.txt`: both `prod=1 tests=0 other=0` — the export line is the only occurrence in the repo. Re-checked against `scripts/` and config (`evidence/recheck-nonsrc.txt`): no hits.
- The live scope list is built at the authorize step from a different constant; state signatures are verified unconditionally by `verifyState`, so the "is this even signed?" probe has no place in the flow.

## Fix
**REMOVE** both. `isStateSigned` is a predicate over the signed-state format — if it ever comes back it belongs next to `verifyState`, not as a standalone export. oauth CHANGELOG `### Removed`.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-oauth-worker`. **Deploy note:** oauth has no `[env.production]` — a bare `wrangler deploy` from `apps/oauth` **is** the production deploy.

## Status
FIXED 2026-09-01 `c99da102`.

