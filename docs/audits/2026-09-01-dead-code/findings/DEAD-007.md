# DEAD-007: web-app `resolvePresetDye` legacy-itemID branch — the gate named in `POST_MERGE_CHECKLIST.md` §3 passed on 2026-08-28, and no producer writes legacy IDs any more

**Confidence:** MEDIUM · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE (app-internal) · **Category:** Dead Path (gated removal)

## Location
- `apps/web-app/src/services/dye-service-wrapper.ts:41-50` — `id > 0 && id <= 254 ? getByStainId(id) : getDyeById(id)`; the `else` is the 4.x itemID path
- Consumers: `preset-edit-form.ts`, `my-submissions-modal.ts`, `v4/preset-detail.ts`, `v4/preset-tool.ts`, `hybrid-preset-service.ts`

## Evidence
- Gate satisfied: `docs/operations/POST_MERGE_CHECKLIST.md:282-291` records the stainID D1 rewrite as **Done 2026-08-28 ~23:45Z**, 16 UPDATEs applied and verified (`… WHERE CAST(json_extract(dyes,'$[0]') AS INTEGER) > 254` → 0). §3's row for this item names exactly that gate.
- No producer left: the bot now sends stainIDs (`apps/discord-worker/src/handlers/commands/preset.ts:453,814` — the 5.0.0 "Known issues" deferral was closed in 5.1.0) and the web-app form rejects `id >= 5000` (`preset-submission-service.ts:141,184,523`).
- No stale client cache to survive the migration: community presets are cached in memory only, 5-minute TTL (`community-preset-service.ts:81-120`) — nothing is persisted across sessions.

## Fix
**REMOVE WITH CAUTION.** Re-run the verification query against production D1 **on the day of the change** (`SELECT COUNT(*) FROM presets WHERE CAST(json_extract(dyes,'$[0]') AS INTEGER) > 254` → expect 0, and the same over `previous_values`). Then collapse the function to `dyeService.getByStainId(id) ?? undefined`, keep the range guard as a validation error rather than a silent fallback, and update the docblock + `POST_MERGE_CHECKLIST.md` §3 row. Note the checklist attributes this path to presets-api; it is web-app code — fix that line too.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app`.

## Status
FIXED 2026-09-01 `20eec62a` — gate verified first: a production D1 read on the day of removal showed **16 presets, 0 legacy IDs across every position of every `dyes` array** (`json_each`, stricter than the checklist's `$[0]` query) and `previous_values` empty on all 16 rows. Fallback branch dropped; out-of-range now returns `undefined` and logs. The tripwire test was **inverted, not deleted** — it pins that the pre-migration itemIDs resolve to nothing.

