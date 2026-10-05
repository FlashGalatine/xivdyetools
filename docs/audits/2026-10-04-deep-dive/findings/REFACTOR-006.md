# REFACTOR-006: auth JWTPayload doc falsely claims a re-export from types and mislabels sub
**Priority:** LOW · **Effort:** LOW · **Risk:** LOW · **Deploy unit:** packages/auth · **Origin:** MAIN

## Location
- `packages/auth/src/jwt.ts:22`

## Evidence
- auth/jwt.ts:22-23 says the interface is 're-exported from @xivdyetools/types', but auth is Level 0 with no types dependency and declares its own JWTPayload. That copy diverges: iss, username, global_name and avatar are optional, and auth_provider and discord_id are absent. The same doc labels sub 'Discord user ID', but oauth mints the internal user id (jwt-service.ts:129). Stale doc, no runtime defect.
  - Checked: packages/auth/src/jwt.ts:20-57 vs packages/types/src/auth/jwt.ts; apps/oauth/src/types.ts:22 re-exports the types version; jwt-service.ts:129 sub = user.id
- Origin: git log 8ecb878f..HEAD -- packages/auth/src/jwt.ts packages/types/src/auth/jwt.ts is empty

## Fix
- Comment-only: say it is a deliberately narrower verifier-side shape (auth must not depend on types) and that sub is the internal user id. Do not derive one from the other (layer violation). Doc-only, so no consumer deploy needed; it ships with the next auth publish.

## Status
OPEN
