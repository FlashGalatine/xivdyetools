# Deprecations

This file tracks deprecated features, APIs, and environment variables across the xivdyetools monorepo.
Each entry includes a target removal date and migration guide.

---

## Active Deprecations

### `STATE_TRANSITION_PERIOD` (oauth worker)

| Field       | Value |
|-------------|-------|
| Deprecated  | 2026-02-19 |
| Remove by   | 2026-06-30 |
| Severity    | Security-sensitive |

**What it is:** A legacy environment variable in the OAuth worker that, when set to `'true'`, disables
OAuth state signature verification. This weakens CSRF protection by allowing unsigned state parameters
in the OAuth callback flow.

**Why it existed:** It was introduced as a compatibility flag during the migration to signed OAuth states,
allowing old clients to continue working during a transition period.

**Migration:** All OAuth clients must use signed state parameters (the default behavior). Remove
`STATE_TRANSITION_PERIOD` from wrangler.toml and all environment configurations. The variable is now
**blocked in production** by `apps/oauth/src/utils/env-validation.ts`.

**Removal checklist:**
- [ ] Confirm no active clients rely on unsigned states
- [ ] Remove `STATE_TRANSITION_PERIOD` from `apps/oauth/src/handlers/callback.ts` (line ~64)
- [ ] Remove `STATE_TRANSITION_PERIOD` from `apps/oauth/src/types.ts`
- [ ] Remove the production guard added in `apps/oauth/src/utils/env-validation.ts`

---

### `LocalStorageCacheBackend` (web-app)

| Field       | Value |
|-------------|-------|
| Deprecated  | ~2025-12 |
| Remove by   | TBD |
| Severity    | Low |

**What it is:** A localStorage-based cache backend for the Universalis API service in the web-app.
The `IndexedDBCacheBackend` is the preferred replacement, offering larger storage capacity and better
performance for structured data.

**Migration:** Use `IndexedDBCacheBackend` (already the default in `api-service-wrapper.ts`). Remove
all references to `LocalStorageCacheBackend`.

**Removal checklist:**
- [ ] Confirm `LocalStorageCacheBackend` is not used in any active code paths
- [ ] Remove the class from the web-app
- [ ] Clean up any associated localStorage keys if needed

---

## Process

1. When deprecating something, add an entry here with a realistic removal date
2. Add a `@deprecated` JSDoc tag to the relevant code with the removal date
3. On the removal date, open a PR that removes the deprecated code and this entry
