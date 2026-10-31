# Preset Palettes Moderation

**Managing community presets and user bans via Discord**

> This guide covers the moderator-only commands for managing the Preset Palettes feature.

---

## Overview

The Community Presets feature allows users to share color palettes with the community. As a moderator, you have access to commands for:

- **Banning users** who submit inappropriate content
- **Unbanning users** to restore access
- **Reviewing flagged presets** with `/preset moderate` (pending, approve, reject, stats) and the Approve / Reject / Revert buttons on each preset's review embed

---

## Ban and unban status

Since moderation-worker 1.9.0, `/preset ban_user` and `/preset unban_user` use a private, reviewed
confirmation flow. `LINKED_BAN_CONFIRMATION_ENABLED` turns it on: `"true"` in production since
1.9.2, and `"false"` on the routeless development worker. While it is `"false"`, both commands, the
confirm and cancel buttons, the parent-ban selector and the reason modal reply privately "Account
ban confirmations are not active. No action was taken." and write nothing, and user suggestions
come back empty. Ban controls on messages posted before 1.9.0 never write anything. Existing bans
stay enforced either way.

If the bot refuses a ban or unban (the flag is off, or the OAuth identity lookup is unavailable),
escalate to the maintainer. Do not write `banned_users` or ban memberships by hand: a manual ban
has no memberships, and a manual unban ignores them. Recovery is a coordinated decision.

Approve and Revert check the preset's current state first: a stale or older review message is
refreshed instead of acted on. New channel and log posts for approvals, rejections, Reverts and
bans no longer name the moderator. The database audit keeps the moderator ID.

---

## Prerequisites

To use moderation commands:

1. Your Discord ID must be in the `MODERATOR_IDS` environment variable
2. Commands must be used in the designated **moderation channel** (`MODERATION_CHANNEL_ID`)
3. You must have the Discord bot in your server
4. For `ban_user` and `unban_user` only: `LINKED_BAN_CONFIRMATION_ENABLED` must be on (see above)

---

## Moderation Commands

### `/preset ban_user`

Ban a user from the Preset Palettes feature.

**Usage:**
```
/preset ban_user user:<username search> [additional_user:<username search>]
```

The `user` option is a text field with autocomplete, not a Discord user picker. Type part of a username, then pick one of the suggestions, each labeled `Username (discord:<id>) - N presets` (or `xivauth:<id>` for an author known only by their XIVAuth ID). Typing an @mention does not work. The optional `additional_user` names one more ID for the same ban. The bot never infers linked accounts from names or from earlier bans.

**What it does:**
1. Shows you, privately, the exact stored IDs the ban would cover and the one ban it would create or expand
2. If the IDs already match several active bans, asks you to choose one parent ban. More than 16 matching bans is refused for manual review
3. Expands an existing ban only when you confirm the additional IDs. One ban covers at most 64 IDs
4. On confirmation, opens a **modal** for the ban reason (10–500 characters, checked by the server)
5. In one database transaction: records the ban, **hides every approved preset** by the IDs this confirmation adds (for a new ban, all of its IDs), and writes the audit rows. Expanding a ban by IDs it already covers changes nothing. A ban embed is posted in the moderation channel, without your name

The review works once and only for you. It expires 10 minutes after you run the command, and choosing a parent ban does not extend it. If anything changed in the meantime (the matching bans, the scope, the expiry or the capacity), the transaction refuses and nothing is written.

---

### `/preset unban_user`

Restore a banned user's access to Preset Palettes.

**Usage:**
```
/preset unban_user user:<username search>
```

Like `ban_user`, `user` is an autocomplete text field: pick a currently banned user from the suggestions rather than typing an @mention.

**What it does:**
1. Asks you to select and review one recorded ban
2. Lifts only that ban. It uses the ban's recorded scope, not today's account links, and blanks its stored `username` and `reason`
3. **Restores hidden presets** in that scope (sets status back to 'approved'). A preset stays hidden when:
   - its author is still covered by another active ban; or
   - its dye combination is held by another approved or pending preset. If several hidden presets share a combination, only the lowest-ID one is restored.
4. Replaces your private review with the result: the restored and still-hidden counts. Nothing is posted in the moderation channel, so tell the other moderators yourself

---

## Autocomplete Behavior

Suggestions appear only for moderators, and only while `LINKED_BAN_CONFIRMATION_ENABLED` is on.

### `ban_user` Autocomplete (`user` and `additional_user`)
- Searches users who have **submitted presets**, by display name
- Shows username, ID kind and ID, and preset count (for example `SomeUser (discord:123456789) - 5 presets`)
- Includes users who are already banned, so that an existing ban can be expanded

### `unban_user` Autocomplete
- Searches **currently banned users only**
- Shows username and ID (for example `SomeUser (discord:123456789)`, or `xivauth:<id>` for an XIVAuth-only ban); no ban date
- Matches by username, Discord ID or XIVAuth ID

---

## What Happens When a User is Banned

| Action | Effect |
|--------|--------|
| **Preset Status** | All 'approved' presets by the IDs the ban adds → 'hidden' |
| **Submit Access** | Cannot submit new presets |
| **Vote Access** | Cannot vote on presets |
| **Edit Access** | Cannot edit existing presets |
| **View Access** | Can still browse community presets |

The user is **not notified** of the ban via Discord DM. The API rejects their writes with the `USER_BANNED` error code and the message "You have been banned from using Preset Palettes.", but neither client shows that sentence. The web app maps the code to its localized `preset.bannedFromPresets` string (in English, "You have been banned from submitting community presets.") on submit and edit, and shows its generic vote-failure message on a vote. The Discord bot shows its generic `preset.api.permissionDenied` message ("Permission denied.") on `/preset submit` and `/preset edit`, and `preset.voteFailed` ("Failed to process vote.") on `/preset vote`.

---

## What Happens When a User is Unbanned

| Action | Effect |
|--------|--------|
| **Preset Status** | Hidden presets in the lifted ban's scope → 'approved', except those still covered by another active ban or whose dye combination is now held by another approved or pending preset (reported as still hidden) |
| **All Access** | Restored, unless another active ban still covers the same ID |

---

## Database Schema

Bans are tracked in the `banned_users` table:

```sql
CREATE TABLE banned_users (
  id TEXT PRIMARY KEY,
  discord_id TEXT,
  xivauth_id TEXT,
  username TEXT NOT NULL,
  moderator_discord_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  banned_at TEXT DEFAULT (datetime('now')),
  unbanned_at TEXT,
  unban_moderator_discord_id TEXT,
  CHECK (discord_id IS NOT NULL OR xivauth_id IS NOT NULL)
);
CREATE UNIQUE INDEX idx_banned_users_discord_active
  ON banned_users(discord_id) WHERE discord_id IS NOT NULL AND unbanned_at IS NULL;
CREATE UNIQUE INDEX idx_banned_users_xivauth_active
  ON banned_users(xivauth_id) WHERE xivauth_id IS NOT NULL AND unbanned_at IS NULL;
```

Key fields:
- `unbanned_at` is NULL for active bans; the two partial unique indexes allow one active ban per ID
- `reason` must be 10–500 characters. The bot enforces this, not the database
- Unbanning blanks the record's `username` and `reason` but keeps the row (with `unbanned_at`); presets-api deletes lifted bans 90 days after the unban (a daily cron, plus a best-effort sweep after its own moderation writes). The accountability history lives in the D1 `moderation_log` table, which keeps ban and unban rows for 12 months

presets-api migration `0016_ban_identity_continuity.sql` adds three tables:
- `ban_identity_memberships`: the extra IDs a particular ban covers
- `moderation_ban_confirmations`: the one-use review nonces
- `ban_continuity_operations`: the handoff that keeps a ban's coverage when OAuth changes an account's links

Moderation-worker 1.9.x reads `ban_identity_memberships` even while the flag is off, so 0016 must be applied before it deploys. See [stored identities and moderation continuity](../architecture/identity-moderation.md).

---

## Channel Restrictions

These commands **only work in the moderation channel**. Using them elsewhere returns:

```
This command can only be used in the moderation channel.
```

(`/preset moderate` words it "This command must be used in the moderation channel.")

This prevents accidental public exposure of moderation actions.

---

## Secrets

Both of these are **secrets**, not `[vars]` — they never appear in `wrangler.toml`.

| Secret | Description |
|--------|-------------|
| `MODERATOR_IDS` | Comma-separated Discord user IDs of moderators |
| `MODERATION_CHANNEL_ID` | Discord channel ID for moderation commands |

Set them per environment:
```bash
pnpm --filter xivdyetools-moderation-worker exec wrangler secret put MODERATOR_IDS --env production
pnpm --filter xivdyetools-moderation-worker exec wrangler secret put MODERATION_CHANNEL_ID --env production
```

For local development only, the same names can go in an untracked `.dev.vars`:
```
MODERATOR_IDS=123456789,987654321
MODERATION_CHANNEL_ID=1234567890123456789
```

The worker's full secret list is `DISCORD_TOKEN`, `DISCORD_PUBLIC_KEY`, `BOT_API_SECRET`,
`BOT_SIGNING_SECRET`, `MODERATOR_IDS`, `MODERATION_CHANNEL_ID`, `SUBMISSION_LOG_CHANNEL_ID`.

---

## Audit Trail

Every ban, unban, hide and restore writes rows to the D1 `moderation_log` table in the same
transaction as the change. The rows carry the moderator ID, the target ID and, for bans, the
reason. Channel posts no longer name the moderator; the database keeps the ID.

Workers Logs are off for this worker (`[observability] enabled = false`, FINDING-022), so the worker's own log lines are not stored: watch them live with `pnpm exec wrangler tail --env production` from `apps/moderation-worker` (or the dashboard's real-time logs). The reason text is in `moderation_log`, not in the logs.

---

## Related Documentation

- [Stored identities and moderation continuity](../architecture/identity-moderation.md)
- [moderation-worker README](../../apps/moderation-worker/README.md)
- [Community Presets Specification](../specifications/community-presets.md)
- [Discord Worker Deployment](../developer-guides/deployment.md)
- [Environment Variables](../developer-guides/environment-variables.md)
