# DEAD-019: cross-app — 13 `@deprecated` type re-exports of `@xivdyetools/types` that nothing imports; the deprecation says "removed in the next major version" and three majors have shipped

**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/moderation-worker · apps/oauth · apps/presets-api · **Semver:** NONE (app-internal) · **Category:** Redundant Re-export

## Location
Per-name status in `evidence/shim-usage.txt`:
- `apps/moderation-worker/src/types/preset.ts` — **9 of 14 dead**: `PresetStatus`, `PresetCategory`, `CategoryMeta`, `PresetPreviousValues`, `PresetSubmission`, `PresetEditRequest`, `PresetSubmitResponse`, `PresetEditResponse`, `VoteResponse`
- `apps/oauth/src/types.ts` — 2 of 11 dead: `XIVAuthSocialIdentity`, `RefreshResponse`
- `apps/presets-api/src/types.ts` — 2 of 17 dead: `PresetSubmitResponse`, `PresetEditResponse`
- `apps/discord-worker/src/types/preset.ts` — 0 of 9 dead (all still imported locally)

## Evidence
- knip lists exactly these under *Unused exported types* (`evidence/knip-root.txt`); `evidence/scripts/shim-usage.py` independently resolves, per name, whether anything still imports it **from the local shim** rather than from `@xivdyetools/types` directly.
- Each block carries `@deprecated Import directly from '@xivdyetools/types' instead. These re-exports will be removed in the next major version.` The apps are now at oauth 3.0.0, presets-api 2.2.0, moderation-worker 1.6.0 — the promised majors came and went.

## Fix
**REMOVE** the 13 dead names now (mechanical, type-only, `tsc` is the safety net). Then finish the deprecation rather than leaving a half-shim: rewrite the ~30 surviving local imports to `@xivdyetools/types` and delete the blocks entirely — one commit per app, `type-check` proving each. Where a shim also holds app-specific types (`presets-api/src/types.ts` `Env`, `oauth/src/types.ts` `Env`), keep the file and remove only the re-export section.
Gate per app: `pnpm turbo run build type-check lint test --filter=<app>`.

## Status
FIXED 2026-09-01 `7d173835` — 13 dead names removed; moderation-worker's whole pass-through block went (5 live names now import from `@xivdyetools/types` directly). oauth and presets-api keep their remaining `@deprecated` re-exports — finishing those is a ~30-import refactor, still outstanding.

