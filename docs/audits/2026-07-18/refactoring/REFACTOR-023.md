# [REFACTOR-023]: api-worker handlers re-parse `?locale` in every route despite `localeMiddleware` already storing it

## Priority

LOW

## Category

Duplication / incomplete prior refactor (OPT-001, 2026-04-28)

## Location

- Redundant parses: `apps/api-worker/src/routes/dyes.ts:53, 93, 173, 214, 229`; `apps/api-worker/src/routes/match.ts:38, 101`
- Canonical source: `apps/api-worker/src/middleware/locale.ts:23` (`c.set('locale', locale)`)

## Current State

`localeMiddleware` runs on all `/v1/*` routes, validates `?locale=` via `parseLocale`, and stores the typed result at `c.var.locale`. Seven handler call sites nonetheless re-run `const locale = parseLocale(c.req.query('locale'))` themselves.

## Issues

1. The validation is executed twice per request for no benefit.
2. Two places to update if locale semantics change (e.g. adding an `Accept-Language` fallback in the middleware would silently *not* apply to handlers that re-parse the query directly — a latent divergence trap).
3. This is the leftover half of the 2026-04-28 OPT-001 refactor, which removed the per-handler `setLocale` calls but left the per-handler parses.

## Proposed Refactoring

Replace each `parseLocale(c.req.query('locale'))` with:

```ts
const locale = c.get('locale');   // typed via Variables in types.ts
```

Ensure `Variables` declares `locale: ValidLocale` so the read is fully typed. If BUG-006 (locale singleton race) is fixed by moving to an explicit-locale `TranslationProvider`, fold this change into the same pass — every handler will need to touch its locale line anyway.

## Benefits

- Single source of truth for locale resolution; future changes (header fallback, default flips) apply everywhere automatically.
- Removes 7 redundant validations per the routes' hot paths (micro, but free).

## Effort Estimate

Trivial (≤30 minutes including test run): mechanical substitution at 7 sites.

## Risk Assessment

Minimal. Middleware is registered on `/v1/*` before both routers, so `c.var.locale` is always populated for these handlers. Verify the two `parseLocale` unit-test suites still cover the middleware path.

> Source: evidence/edge-workers-analysis.md (2026-07-18 deep-dive, edge-workers area)

## Status

**DONE 2026-07-19** — all seven handler call sites read `c.get('locale')`; `parseLocale` runs once in the middleware (folded into the BUG-006 pass as suggested).
