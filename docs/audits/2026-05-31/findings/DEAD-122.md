# DEAD-122: preferences.ts legacy KV migration shim (live — monitor)

## Category
Legacy/Deprecated

## Location
- File(s): `apps/discord-worker/src/services/preferences.ts`
- Symbol(s): `LEGACY_I18N_PREFIX` (L47), `LEGACY_WORLD_PREFIX` (L48), `migrateLegacyPreferences()` (L451)

## Evidence
New finding. These constants feed a one-time migration that reads old KV keys (`i18n:user:{id}`, `budget:world:v1:{id}`)
and folds them into the unified preferences record. Unlike typical dead migration code, this shim is **still wired and
live** — `migrateLegacyPreferences()` is called on the preference-read path:
```
preferences.ts:87   const migrated = await migrateLegacyPreferences(kv, userId, logger);
preferences.ts:461  const legacyLanguage  = await kv.get(`${LEGACY_I18N_PREFIX}${userId}`);
preferences.ts:468  const legacyWorldData = await kv.get(`${LEGACY_WORLD_PREFIX}${userId}`);
```
This is the migration that **superseded** the (now-deleted) `user-preferences.ts` and the (now-deleted)
`setUserLanguagePreference`/`clearUserLanguagePreference` (Feb DEAD-029, executed) — so it is the correct, active path.

## Why It Exists
To transparently upgrade users who still have V3-era language/world keys in KV the first time they touch preferences,
without data loss. It must stay until enough of the user base has migrated.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH that it is currently **needed** (live, user-facing back-compat) |
| **Blast Radius** | HIGH if removed prematurely — un-migrated users silently lose stored language/world prefs |
| **Reversibility** | MODERATE — touches persisted user data, not a pure code revert |
| **Hidden Consumers** | External: existing KV entries from prior app versions |

## Recommendation
**KEEP-MONITOR**

### Rationale
- This is intentional, active migration code — documented here for completeness, not for removal now.

### If Acting (later)
1. Decide a migration sunset (e.g. N months after the unified-preferences release, or once a KV scan shows ~0 legacy keys).
2. At sunset, delete the two prefixes + `migrateLegacyPreferences()` and its call at L87; add a removal-target note until then.
