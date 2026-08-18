# [DEAD-010]: Stale "legacy" comments, one unreachable branch, one defect — and the compat code that must stay (KEEP register)

## Category
Dead Code Path / Legacy

## Location
**Remove now (0 behaviour change):**
- `handlers/commands/index.ts:6-10, 24` and `index.ts:28` — "Legacy commands (deprecated in v4, kept for backward compatibility)" — the listed handlers (accessibility, contrast, manual, changelog, comparison, preset, stats, budget) are all live 5.0 commands; the actually-deprecated match/match-image handlers were deleted in cfb5f85. Comment cleanup.
- `index.ts:1107` — unreachable `ENVIRONMENT === 'development'` branch (see DEAD-007).

**Defect surfaced (not dead code — fix separately):**
- `handlers/commands/stats.ts:462` tests `env.UNIVERSALIS_PROXY_URL` (never set in wrangler.toml) instead of the `UNIVERSALIS_PROXY` service binding, so `/stats` always reports Universalis "Not configured".

**KEEP (compat still load-bearing) — with removal triggers:**

| Code | Lines | Keep until |
|---|---|---|
| `services/preferences.ts` `LEGACY_I18N_PREFIX`, `LEGACY_WORLD_PREFIX`, `migrateLegacyPreferences` (466-525) | ~60 | the v5 KV cleanup has run. Nothing writes the legacy keys any more (read-side migration only). ⚠ `scripts/cleanup-v4-kv.ts` deletes `i18n:user:*` but has **no step for `budget:world:v1:*`** — add one or the migration can never be retired. |
| `services/i18n.ts:94-150` legacy `i18n:user:` fallback in `resolveUserLocale` | ~25 | same trigger (second reader of the same key; cannot reuse the preferences migration because of a circular import) |
| `services/preset-favorites.ts:45,65` v1 bare-ID → v2 entries | small | a KV sweep |
| `services/analytics.ts:275-280` "old data" counter fallback | 6 | KV verified free of pre-OPT-002 `stats:total` keys (LOW confidence it still triggers) |
| `handlers/commands/about.ts:125` "Removed in v5" field + `about.removedTitle/Body` keys | small | 5.1 (intentional one-release carry, cfb5f85) |
| `types/preset.ts` `@deprecated` re-export blocks | — | see DEAD-006 |
| GitHub webhook route → `announcements.ts` / `changelog-parser.ts` | — | LIVE — root `CHANGELOG-laymans.md` exists, `ANNOUNCEMENT_CHANNEL_ID` set in prod, `GITHUB_WEBHOOK_SECRET` declared |

## Evidence
See `evidence/track-A-discord-worker.md` §5. `grep -rn "budget:world:v1" apps/discord-worker/scripts/cleanup-v4-kv.ts` → 0.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH for the comment/branch cleanup; the KEEP rows are MEDIUM by design |
| **Blast Radius** | NONE for the removals |
| **Reversibility** | EASY |

## Recommendation
**REMOVE** the stale comments + unreachable branch; **KEEP** the compat rows and record their triggers; file the `stats.ts` defect and the missing `budget:world:v1:*` cleanup step as follow-ups.
