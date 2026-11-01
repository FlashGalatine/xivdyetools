# DEAD-037: config-controller scrub of the retired swatch.fileProvided key
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** web-app · **Semver:** NONE · **Category:** Legacy

## Location
- `apps/web-app/src/services/config-controller.ts:478-484`
- `apps/web-app/src/services/__tests__/config-controller.test.ts:139-151`
- `docs/projects/web-app/components.md:174`

## Evidence
- git grep -n -w fileProvided: no production reader; only the scrub at config-controller.ts:483, its unit test :139-151, e2e swatch-chara-session.spec.ts:235 (seeds the key), CHANGELOG, two docs. The scrub sits in loadFromStorage, called at :246/:286 on every swatch config load (getConfig at swatch-tool.ts, cross-tab reload at :207), so it runs in production. mergeWithDefaults (:125-138) copies every stored key, unknown ones included, so without the delete a pre-5.12.7 fileProvided would be written back on each setConfig. Only importConfigs (:426) sanitizes through sanitizeConfigPartial. CONFIG_STORAGE_PREFIX is a fixed 'xivdyetools_v4_config_' (:35), and there is no per-key storage version. Key retired 2026-09-…
- The code runs on every swatch config load. It stops persisted data from an older build from echoing back into storage forever, because loadFromStorage keeps unknown keys. Removing it would not break the lock, since nothing reads the key. It would only let stale data round-trip, so removing it gains about 7 lines and gives up hygiene for returning visitors. The reviewer's trigger names a storage-version mechanism that does not exist. The trigger below replaces it.
- Still live: ConfigController.loadFromStorage (config-controller.ts:246, :286) on every swatch config load

## Fix
- **KEEP** — revisit trigger: Remove it when either of these becomes true: (a) loadFromStorage passes stored values through sanitizeConfigPartial, so undeclared keys are dropped as importConfigs already does at :426, which makes the delete redundant; or (b) CONFIG_STORAGE_PREFIX changes from 'xivdyetools_v4_config_', which abandons all pre-5.12.7 storage. Either can be checked with a git grep on config-con…
- Cascade: Removal also takes the unit test at config-controller.test.ts:139-151 and the doc sentence at components.md:174. The e2e spec at :226-244 stays, because it asserts the lock reads CharaSessionService and passes with or without the scrub.

## Status
OPEN
