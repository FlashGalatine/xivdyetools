# [REFACTOR-002]: API Versioning Consistency

## Priority
LOW

## Category
Architecture

## Location
- File(s): `apps/presets-api/src/index.ts` (uses `/api/v1/`), `apps/oauth/src/` (no versioning), `apps/universalis-proxy/src/` (no versioning)
- Scope: All worker API endpoints

## Current State
The presets-api uses explicit API versioning (`/api/v1/presets`, `/api/v1/votes`, etc.), which is a good practice. However, the OAuth worker and universalis-proxy do not version their endpoints (`/auth/callback`, `/api/prices`). This inconsistency makes it harder to evolve the API surface across the ecosystem.

## Issues
- Inconsistent versioning strategy across services
- OAuth and proxy endpoints cannot be evolved without breaking changes
- No documented API versioning policy

## Proposed Refactoring
1. Add `/v1/` prefix to OAuth worker routes: `/v1/auth/callback`, `/v1/auth/authorize`
2. Add `/v1/` prefix to universalis-proxy routes: `/v1/api/prices`
3. Document the versioning policy in `docs/`
4. Consider using HTTP `Accept` header versioning as an alternative

## Benefits
- Consistent API surface across all services
- Ability to evolve endpoints without breaking existing clients
- Clear migration path for breaking changes

## Effort Estimate
MEDIUM (requires frontend URL updates)

## Risk Assessment
Medium risk - requires coordinated updates across web-app and all consuming services. Should be done during a planned migration window.
