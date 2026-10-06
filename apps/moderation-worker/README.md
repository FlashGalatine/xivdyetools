# xivdyetools-moderation-worker

> The moderation Discord bot for XIV Dye Tools community presets — a **separate Discord application** from the main bot, running as a Cloudflare Worker on HTTP Interactions.

Deployed at `moderation-bot.xivdyetools.app`.

## Why it's a separate application

Moderation lives in its own Discord app, not as more commands on `discord-worker`, for two reasons:

1. **Blast radius.** Approve, reject, and ban are destructive writes against community data. Keeping them behind a distinct application means the moderation token can be scoped, rotated, and revoked without touching the public bot.
2. **Button routing.** Discord routes a message component interaction back to the application that *posted* the message. `discord-worker` posts moderation embeds using `MODERATION_BOT_TOKEN` precisely so approve/reject buttons land here. When that secret is unset, `discord-worker` omits the buttons and points moderators at `/preset moderate` instead.

## Commands

| Command | Description |
|---------|-------------|
| `/preset moderate` | Four actions on the required `action` option — `pending` (browse the queue), `approve`, `reject`, `stats` — plus an optional autocompleted `preset_id`. `approve` and `reject` do not act on a typed id: they show the preset's **current** text with one confirm button (see below), and the rejection reason is typed in the modal the confirm click opens |
| `/preset ban_user` | Ban a `user` (a Discord snowflake or an XIVAuth `sub` UUID) from submitting presets |
| `/preset unban_user` | Lift a submission ban for a `user` and restore their presets (see [Bans](#bans)) |

Interactive approve/reject **buttons** on moderation-channel embeds route here as well, so a moderator normally never types a command.

### Moderation buttons name the text that was reviewed

A decision applies to the exact version the moderator looked at (FINDING-017, 2026-10-03 audit). Every approve / reject / revert button and reject / revert modal carries the preset's `content_revision` and the status the moderator saw, and this worker forwards both to `presets-api` as `expected_revision` / `expected_status`; a mismatch comes back as a `409` and nothing changes.

| `custom_id` | Meaning |
|-------------|---------|
| `preset_approve_<uuid>:<revision>:<status>` | Approve button |
| `preset_reject_<uuid>:<revision>:<status>` | Reject button — opens the reason modal |
| `preset_revert_<uuid>:<revision>:<status>` | Revert button — opens the reason modal |
| `preset_reject_modal_<uuid>:<revision>:<status>` / `preset_revert_modal_<uuid>:<revision>:<status>` | The modals those buttons open |

`<revision>` is a non-negative integer with no leading zeros; `<status>` is the full status word (`pending`, `approved`, `rejected`, `flagged`, `hidden`). Every id stays within Discord's 100-character cap. The one strict parser is `src/utils/review-custom-id.ts`; anything that does not match exactly is ignored.

**Refresh-and-reclick.** A button that cannot name a revision — one on a message posted before this change (bare `preset_approve_<uuid>`), or any click whose `expected_*` values `presets-api` refuses with a `409` — never acts. The handler fetches the current preset, edits the message to show its **current** text with fresh revision-bound buttons, and tells the moderator to review it and click again. A preset that is no longer pending has nothing left to review: a channel message keeps its embed (so a concurrent moderator's "Approved by" or rejection reason stays), loses its buttons, and states the new status in the message content, while the private `/preset moderate` confirmation is rebuilt from the current preset. If `presets-api` cannot load the preset, the message and its buttons are left as they are. `/preset moderate approve|reject <id>` is the same flow with a confirm step: it answers privately with the current text and one button bound to the revision just fetched.

## Routes

| Path | Auth | Purpose |
|------|------|---------|
| `GET /health` | None | Health probe |
| `POST /` | Ed25519 | Discord interactions (commands, buttons, modals) |

## Bans

Bans are written **directly to D1** (`services/ban-service.ts`), in one `db.batch` with their `moderation_log` rows and the preset hide/restore, so a failure leaves nothing half-applied. The tables belong to `presets-api`.

- **Target.** A ban target is a Discord snowflake or an XIVAuth `sub` UUID. `banned_users.discord_id` takes whichever the moderator picked; a UUID is **also** written to `banned_users.xivauth_id` (FINDING-014), so the ban can still be matched once `presets-api` resolves the same person by a different id. Every ban read in this worker (the already-banned check, approval's banned-author check, the pickers, the active-ban lookup, unban) matches a target in `discord_id` **or** `xivauth_id`. Rows written before this change carry the UUID in `discord_id` only and keep matching.
- **While a ban is active** its `username` copy and free-text `reason` are kept — ban search selects and sorts by `username`.
- **On unban** the same statement that sets `unbanned_at` also blanks `username` and `reason` to `''` (both columns are `NOT NULL`; FINDING-005). The lifted row itself is not deleted here: how long lifted bans and `moderation_log` reasons are kept is `presets-api`'s retention rule.
- **Unban restores hidden presets** to `approved`, except those whose dye combination (`dye_signature`) is now held by another approved or pending preset, and all but one of the author's own hidden twins — restoring them would trip the unique `dye_signature` index and abort the whole unban (FINDING-021). Those stay hidden and the confirmation embed says how many and why; the `restore` audit rows list only the presets that actually flipped. If a submission races the batch anyway and the index trips, the unban rolls back and the moderator gets "Unban blocked: a restored preset duplicates an existing one".

## Observability

`wrangler.toml` pins `[observability] enabled = false` in both blocks (FINDING-022), and `tests/wrangler-config.test.ts` fails if it is enabled or a `logpush` / `tail_consumers` sink appears. Enabling persistent logs needs both privacy policies updated in the same change.

## Development

```bash
# From the monorepo root
pnpm install
pnpm --filter xivdyetools-moderation-worker run dev          # wrangler dev
pnpm --filter xivdyetools-moderation-worker run test
pnpm --filter xivdyetools-moderation-worker run type-check
pnpm --filter xivdyetools-moderation-worker run lint
```

### Registering commands

```bash
pnpm --filter xivdyetools-moderation-worker run register-commands
```

Requires `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` for the **moderation** application (`1453806659708129374`), not the main bot's. Setting `DISCORD_GUILD_ID` publishes guild commands, which appear instantly instead of taking up to an hour.

## Deployment

```bash
pnpm --filter xivdyetools-moderation-worker run deploy              # DEV worker (xivdyetools-moderation-worker-dev)
pnpm --filter xivdyetools-moderation-worker run deploy:production   # Production
```

> ⚠️ A bare `wrangler deploy` targets the **dev** worker here. Production always needs `--env production`. See [`docs/operations/DEPLOY_ENVIRONMENTS.md`](../../docs/operations/DEPLOY_ENVIRONMENTS.md).

## Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `KV` | KV Namespace | Rate limiting and moderation state |
| `DB` | D1 (`xivdyetools-presets`) | Shared preset database — same D1 instance as `presets-api` and `discord-worker` |
| `PRESETS_API` | Service Binding → `xivdyetools-presets-api` | Approve / reject / ban writes |
| `DISCORD_CLIENT_ID` | Var | Moderation application ID |
| `PRESETS_API_URL` | Var | `https://api.xivdyetools.app` — HTTP fallback for local dev |

### Required Secrets

```bash
wrangler secret put DISCORD_TOKEN            # Moderation application's bot token
wrangler secret put DISCORD_PUBLIC_KEY       # Moderation application's Ed25519 public key
wrangler secret put MODERATOR_IDS            # CSV of Discord IDs allowed to moderate
wrangler secret put MODERATION_CHANNEL_ID    # Channel every moderation command is restricted to
```

All four are checked by `validateEnv`. `MODERATION_CHANNEL_ID` is genuinely required, not optional: the channel gate reads it on every command, so an unset value blocks the whole bot.

Additional secrets for authenticating outbound calls to `presets-api` (`BOT_API_SECRET`, `BOT_SIGNING_SECRET`) are **optional** in this worker's `Env` and follow the same names and semantics as in `discord-worker`. `BOT_SIGNING_SECRET` must be min. 32 characters (checked by `validateEnv`; `@xivdyetools/auth` rejects shorter keys).

The production worker (`ENVIRONMENT = "production"`) additionally **requires** the two native rate-limit bindings `RL_COMMAND` and `RL_AUTOCOMPLETE`: while either is unbound, `validateEnv` fails and the worker answers every request — `/health` included — with `500 {"error":"Service misconfigured"}` rather than degrading silently to the KV limiter (FINDING-013, `docs/audits/2026-08-29-security`). Both stay optional on the dev worker and in tests.

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@xivdyetools/auth` | Discord Ed25519 verification, HMAC bot signatures |
| `@xivdyetools/bot-logic` | Shared command business logic and bot UI strings |
| `@xivdyetools/types` | Preset and moderation type definitions |
| `@xivdyetools/logger` | Structured logging with secret redaction |
| `@xivdyetools/worker-kit` | Request ID, logger, and rate-limit middleware |

This Worker uses a custom `sanitizePath` on `loggerMiddleware` so preset IDs and user IDs are redacted out of logged URLs.

## Related Projects

- [`apps/presets-api`](../../apps/presets-api/) — the API this Worker writes through (Service Binding).
- [`apps/discord-worker`](../../apps/discord-worker/) — posts the moderation embeds whose buttons route here.

## Connect With Me

**Flash Galatine** | Midgardsormr (Aether)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
🐦 **X/Twitter**: [@AsheJunius](https://x.com/AsheJunius)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## License

MIT © 2025-2026 Flash Galatine — see [LICENSE](./LICENSE).

## Legal Notice

**FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**
**FINAL FANTASY XIV © SQUARE ENIX CO., LTD.**

XIV Dye Tools is an unofficial fan project and is **not affiliated with, endorsed by, or sponsored by Square Enix Co., Ltd.**
