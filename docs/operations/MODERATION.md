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

## Prerequisites

To use moderation commands:

1. Your Discord ID must be in the `MODERATOR_IDS` environment variable
2. Commands must be used in the designated **moderation channel** (`MODERATION_CHANNEL_ID`)
3. You must have the Discord bot in your server

---

## Moderation Commands

### `/preset ban_user`

Ban a user from the Preset Palettes feature.

**Usage:**
```
/preset ban_user user:<username search>
```

The `user` option is a text field with autocomplete, not a Discord user picker. Type part of a username, then pick one of the suggestions, each labeled `Username (discord:<id>) - N presets` (or `xivauth:<id>` for an author known only by their XIVAuth ID). Typing an @mention does not work; the bot replies "Invalid user ID. Pick a user from the suggestions."

**What it does:**
1. Shows a confirmation embed with:
   - Username and ID (the field is labeled **Discord ID** or **XIVAuth ID**, depending on the target)
   - Total number of presets they've submitted
   - Links to their 3 most recent presets
2. Presents **Yes/No buttons** to confirm
3. If confirmed, opens a **modal** to enter a ban reason (min 10 characters)
4. On completion:
   - Creates a ban record in the database
   - **Hides all approved presets** by that user (sets status to 'hidden')
   - Posts a confirmation embed in the moderation channel

**Example Flow:**
```
You: /preset ban_user user:Some  [pick "SomeUser (discord:123456789) - 5 presets"]

Bot: [Confirmation Embed]
     ⚠️ Confirm User Ban

     Are you sure you want to ban this user from Preset Palettes?

     Username: SomeUser
     Discord ID: 123456789
     Total Presets: 5
     Recent Presets:
     • My Cool Palette (link)
     • Another Palette (link)

     [Yes, Ban User] [Cancel]

You: [Click "Yes, Ban User"]

Bot: [Modal]
     Enter Ban Reason
     ┌─────────────────────────────────┐
     │ Reason: ________________________│
     │ (minimum 10 characters)         │
     └─────────────────────────────────┘

You: [Enter reason, submit]

Bot: [Success Embed]
     🔨 User Banned

     SomeUser has been banned from Preset Palettes.

     Presets Hidden: 5
     Banned By: YourName
     Reason: Inappropriate content in presets
```

---

### `/preset unban_user`

Restore a banned user's access to Preset Palettes.

**Usage:**
```
/preset unban_user user:<username search>
```

Like `ban_user`, `user` is an autocomplete text field: pick a currently banned user from the suggestions rather than typing an @mention.

**What it does:**
1. Immediately processes the unban (no confirmation needed)
2. Marks the ban record as lifted (sets `unbanned_at`) and blanks its stored `username` and `reason`
3. **Restores hidden presets** (sets status back to 'approved'), except any whose dye combination is now held by another approved or pending preset; those stay hidden and are reported as **Presets Still Hidden**
4. Posts a success embed

**Example:**
```
You: /preset unban_user user:Some  [pick "SomeUser (discord:123456789)"]

Bot: [Success Embed]
     ✅ User Unbanned

     Successfully unbanned SomeUser.

     User ID: 123456789
     Presets Restored: 5
```

---

## Autocomplete Behavior

Both commands feature smart autocomplete:

### `ban_user` Autocomplete
- Searches users who have **submitted presets**
- Shows username, ID kind and ID, and preset count (for example `SomeUser (discord:123456789) - 5 presets`)
- **Excludes already-banned users**

### `unban_user` Autocomplete
- Searches **currently banned users only**
- Shows username and ID (for example `SomeUser (discord:123456789)`, or `xivauth:<id>` for an XIVAuth-only ban); no ban date
- Matches by username, Discord ID or XIVAuth ID

---

## What Happens When a User is Banned

| Action | Effect |
|--------|--------|
| **Preset Status** | All 'approved' presets → 'hidden' |
| **Submit Access** | Cannot submit new presets |
| **Vote Access** | Cannot vote on presets |
| **Edit Access** | Cannot edit existing presets |
| **View Access** | Can still browse community presets |

The user is **not notified** of the ban via Discord DM. The API rejects their writes with the `USER_BANNED` error code and the message "You have been banned from using Preset Palettes.", but neither client shows that sentence. The web app maps the code to its localized `preset.bannedFromPresets` string (in English, "You have been banned from submitting community presets.") on submit and edit, and shows its generic vote-failure message on a vote. The Discord bot shows its generic `preset.api.permissionDenied` message ("Permission denied.") on `/preset submit` and `/preset edit`, and `preset.voteFailed` ("Failed to process vote.") on `/preset vote`.

---

## What Happens When a User is Unbanned

| Action | Effect |
|--------|--------|
| **Preset Status** | Hidden presets → 'approved' (a preset whose dye combination is now held by another approved or pending preset stays hidden and is listed as **Presets Still Hidden** in the unban embed) |
| **All Access** | Fully restored |

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
  banned_at TEXT NOT NULL,
  unbanned_at TEXT,
  unban_moderator_discord_id TEXT
);
```

Key fields:
- `unbanned_at` is NULL for active bans
- `reason` must be at least 10 characters
- Unbanning blanks the record's `username` and `reason` but keeps the row (with `unbanned_at`); presets-api deletes lifted bans 90 days after the unban (a daily cron, plus a best-effort sweep after its own moderation writes). The accountability history lives in the D1 `moderation_log` table, which keeps ban and unban rows for 12 months

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

All moderation actions are logged:

- **Ban actions**: Logged with target user ID, moderator ID, preset count, and reason length (the reason text itself is recorded in the D1 `moderation_log` table, not in the logs)
- **Unban actions**: Logged with target user ID, moderator ID, restored preset count, and still-hidden count (unban takes no reason)

Workers Logs are off for this worker (`[observability] enabled = false`, FINDING-022), so these lines are not stored: watch them live with `pnpm exec wrangler tail --env production` from `apps/moderation-worker` (or the dashboard's real-time logs). The ban reason and the action history are in the D1 `moderation_log` table.

---

## Related Documentation

- [Community Presets Specification](../specifications/community-presets.md)
- [Discord Worker Deployment](../developer-guides/deployment.md)
- [Environment Variables](../developer-guides/environment-variables.md)
