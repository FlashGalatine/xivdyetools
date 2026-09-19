# Documentation audit — cluster: discord-worker

Worktree HEAD: `0fec18f4` (origin/main, 2026-09-18). Read-only review.

## Coverage

| file | sections reviewed | result |
|------|--------------------|--------|
| `docs/projects/discord-worker/commands.md` | all (roster table, rate limits, every command section) | reviewed |
| `docs/projects/discord-worker/interactions.md` | all | reviewed |
| `docs/projects/discord-worker/overview.md` | all | reviewed |
| `docs/projects/discord-worker/rendering.md` | all except the exact CJK codepoint counts (SC 1,129 / JP 556 / KR 489) — no source constant found to check them against without running `scripts/subset-cjk-fonts.py`; not asserted false, just unverified | partial (font-count claim unverified) |
| `docs/user-guides/discord-bot/command-reference.md` | all | reviewed |
| `docs/user-guides/discord-bot/faq.md` | all | reviewed |
| `docs/user-guides/discord-bot/favorites-collections.md` | all | reviewed |
| `docs/user-guides/discord-bot/getting-started.md` | all, except the ΔE2000 band table (5/10/20 cuts, SAME/CLOSE/NEAR/FAR) — could not locate the numeric-threshold source in `@xivdyetools/core`/`bot-logic`/`@xivdyetools/svg` to confirm or contradict the cut points (only the display labels `card.cmpTag0..3` were found); not flagged since no contradicting source was opened | partial (ΔE2000 band cut-points unverified) |

## Candidates

| cand-id | sev | kind | file:line | one-line claim vs reality | evidence pointer (source path:line) |
|---------|-----|------|-----------|----------------------------|--------------------------------------|
| C1 | MEDIUM | WRONG | `docs/projects/discord-worker/interactions.md:95` | Claims only `/webhooks/github` "re-checks the actual body length after reading it since Content-Length can be missing or spoofed", implying `/webhooks/preset-submission`'s 10 KB cap is Content-Length-only | `apps/discord-worker/src/index.ts:277-288` (calls shared `readTextCapped`) + `apps/discord-worker/src/utils/read-text-capped.ts:20-26` (streams and cuts off actual bytes past the cap, added by BUG-013 / PR #184, commit `3f72fc9e`, merged 2026-09-15/16 — after the 2026-09-05 audit). Both webhook routes now defend against a lying/missing `Content-Length`, not just the GitHub one. |

Only one net-new drift candidate found in this cluster since the 2026-09-05 audit. Everything else checked (see POSITIVE below) still matches.

## POSITIVE (checked and confirmed correct)

- `COMMAND_REGISTRY` = 17 registrations / 16 distinct commands (`apps/discord-worker/src/commands/registry.ts:29-59`), matching `commands.md:13` and `overview.md:106`.
- `/harmony wheel` choices (`rgb`/`ryb`/`munsell`/`oklch-hue`/`oklch-lightness`) match `COLOR_WHEEL_IDS` (`packages/core/src/services/dye/wheels/ColorWheel.ts:17`, asserted by `registry.test.ts:16`).
- `/harmony type` — all 10 harmony types (incl. `compound`/`shades`) in `schemas.ts:28-39` match the docs' list; default `triadic` confirmed at `apps/discord-worker/src/handlers/commands/harmony.ts:47`.
- `/budget quick preset` — 22 `QUICK_PICKS` entries (`apps/discord-worker/src/services/budget/quick-picks.ts:20-178`) match the full list transcribed in `command-reference.md:212-217` and the "22 choices" claim in `commands.md:224`.
- `/budget find max_distance` default 8, clamped 2-20 — `DEFAULT_MATCH_LINE = 8` (`apps/discord-worker/src/services/budget/budget-calculator.ts:49,126`).
- `/budget` tier pricing "Type-A = min(vendor 216, board 52254)" — confirmed at `apps/discord-worker/src/services/budget/budget-calculator.ts:76` and `budget-ledger-model.test.ts:89`.
- Rate limits table in `commands.md`/`getting-started.md`/`faq.md` — every figure matches `packages/worker-kit/src/rate-limiter/presets/configs.ts:68-103` (`DISCORD_COMMAND_LIMITS`) plus `apps/discord-worker/src/services/rate-limiter.ts:189-192` (`LOCAL_COMMAND_LIMITS.changelog = 30/min`) and `wrangler.toml`'s six `[[ratelimits]]` tiers (5/10/15/20/30/70).
- All `wrangler.toml` bindings/vars in `overview.md` (`KV`, `ANALYTICS`, `PRESETS_API`, `UNIVERSALIS_PROXY`, `IMAGE_WORKER`, `RL_5`…`RL_70`, and the 4 vars `ENVIRONMENT`/`DISCORD_CLIENT_ID`/`PRESETS_API_URL`/`ANNOUNCEMENT_CHANNEL_ID` declared in both blocks) match `apps/discord-worker/wrangler.toml` verbatim; no diff since the 2026-09-05 audit (`git diff 39e08c32 HEAD -- wrangler.toml` empty).
- Secrets list (required: `DISCORD_TOKEN`, `DISCORD_PUBLIC_KEY`; optional: `BOT_API_SECRET`, `BOT_SIGNING_SECRET`, `INTERNAL_WEBHOOK_SECRET`, `GITHUB_WEBHOOK_SECRET`, `MODERATOR_IDS`, `MODERATION_CHANNEL_ID`, `MODERATION_BOT_TOKEN`, `SUBMISSION_LOG_CHANNEL_ID`, `STATS_AUTHORIZED_USERS`) matches `apps/discord-worker/src/types/env.ts` exactly; no diff since 2026-09-05.
- Webhook body caps: 100,000-byte interaction cap (`packages/auth/src/discord.ts:42`, "100 KB"), 10,240-byte preset-submission cap and 1,048,576-byte (`GITHUB_WEBHOOK_MAX_BYTES`) GitHub cap (`apps/discord-worker/src/index.ts:100,281`) all match the numbers quoted (only the *symmetry* of the actual-byte-count defence is stale — see C1).
- `announced:v:<version>` KV memo TTL = 90 days (`apps/discord-worker/src/index.ts:122`); first-run notice flag TTL = 180 days (`apps/discord-worker/src/index.ts:769`) — both match `interactions.md`/`faq.md`/`getting-started.md`.
- `/changelog` COLLAPSED_COUNT = 5 (`apps/discord-worker/src/handlers/commands/changelog.ts:30`) matches "five collapsed one-liners".
- `MAX_PRESET_FAVORITES = 50` (`apps/discord-worker/src/services/preset-favorites.ts:34`) and the exact "reached the limit of {max}" copy (`packages/bot-logic/src/i18n/locales/en.json:245`) match `favorites-collections.md`.
- `PresetCategory` union (8 values, `community` retired) matches `packages/types/src/preset/core.ts:18-26` and `PRESET_CATEGORY_CHOICES` (`schemas.ts:95-104`).
- `DyeTypeFilters` — 8 filters (metallic/pastel/dark/cosmic/ishgardian/expensive/vendor/craft) match `packages/types/src/dye/dye-filters.ts:22-39` and `schemas.ts:801-848`.
- `MIXER_SWEEP_RATIOS = [25, 40, 50, 65, 80]` (`packages/bot-logic/src/commands/mixer.ts:56`) matches "12F ratio sweep (25/40/50/65/80%)".
- All 13 `@xivdyetools/svg` generator names in `rendering.md`'s table (`generateDyeInfoCard` … `generatePresetSwatch`) exist verbatim as exported functions in `packages/svg/src/*.ts`.
- Card-frame tags (11A harmony, 11B dye-info/random, 12F mixer, 12H gradient, 13A/13B/13C·1 contrast, 13D/13E/13H accessibility, 13G budget, 14A/14C·2/14C comparison, 14J·2 extractor-color/swatch-slot, 14K extractor-image) all confirmed in the corresponding `packages/bot-logic/src/commands/*.ts` and `apps/discord-worker/src/handlers/commands/*.ts` header comments.
- `COMMAND_REGISTRY`/`schemas.ts` diff since the last audit (`git diff 39e08c32 HEAD`) is only the REFACTOR-003 `min_length`/`max_length` enforcement on `/preset submit`/`edit` name+description — already documented as "2-50"/"10-200 characters", so no drift.
- `/extractor image prevent_duplicates` — defaults to `true`, only an explicit `false` disables it (`apps/discord-worker/src/handlers/commands/extractor.ts:465-467`), matching both docs.
- `deploy-discord-worker.yml` runs `wrangler deploy --env production` then `register-commands`; the beta workflow registers guild-scoped — matches `overview.md`'s deployment claims.
- All relative links in the 8 reviewed files resolve (`developer-guides/deployment.md`, `operations/DEPLOY_ENVIRONMENTS.md`, `operations/IMAGE_WORKER_SPLIT.md`, `user-guides/web-app/favorites-collections.md`, `reference/glossary.md` all exist).
- No version-number table in any of the 8 files (all correctly defer to `versions.md`); mentions of v4.0.x/v4.1.x/v5.0.0 are past-release references, which the living-tier rule allows.

## Rejected (looked wrong, turned out right)

- `/manual` now conditionally defers for `topic:spectrum_prices` when the user has a stored world (BUG-008, `apps/discord-worker/src/handlers/commands/manual.ts`) — this is new since the 2026-09-05 audit, but neither doc makes any claim about `/manual`'s response timing/defer behaviour, so it is not a contradiction.
- Considered flagging `faq.md`'s "Preset submissions also have a daily cap of 10" / "Rate limit (10/day maximum)" as unverified — but this limit is presets-api's own enforcement, outside this cluster's source of truth (`apps/discord-worker/`, `bot-logic`, `svg`). No contradicting source was opened, so left unflagged per the brief's rule (both doc line and contradicting source must be opened).
- Considered flagging the CJK subset codepoint counts (SC 1,129/JP 556/KR 489) and the ΔE2000 band cut-points (5/10/20) as WRONG, but no source constant was found either confirming or contradicting either figure — left as unverified coverage gaps, not candidates.
