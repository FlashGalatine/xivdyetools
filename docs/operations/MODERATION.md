# Preset Palettes Moderation

**Managing community presets and user bans via Discord**

> This guide covers the moderator-only commands for managing the Preset Palettes feature.

---

## Overview

The Community Presets feature allows users to share color palettes with the community. As a moderator, you have access to commands for:

- **Banning users** who submit inappropriate content
- **Unbanning users** to restore access
- **Reviewing flagged presets** (via the web moderation queue)

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
/preset ban_user user:<discord_user>
```

**What it does:**
1. Shows a confirmation embed with:
   - Username and Discord ID
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
You: /preset ban_user user:@SomeUser

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

     User ID: 123456789
     Presets Hidden: 5
     Banned By: YourName
     Reason: Inappropriate content in presets
```

---

### `/preset unban_user`

Restore a banned user's access to Preset Palettes.

**Usage:**
```
/preset unban_user user:<discord_user>
```

**What it does:**
1. Immediately processes the unban (no confirmation needed)
2. Marks the ban record as `unbanned`
3. **Restores all hidden presets** (sets status back to 'approved')
4. Posts a success embed

**Example:**
```
You: /preset unban_user user:@SomeUser

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
- Shows username and preset count
- **Excludes already-banned users**

### `unban_user` Autocomplete
- Searches **currently banned users only**
- Shows username and ban date
- Matches by username or Discord ID

---

## What Happens When a User is Banned

| Action | Effect |
|--------|--------|
| **Preset Status** | All 'approved' presets → 'hidden' |
| **Submit Access** | Cannot submit new presets |
| **Vote Access** | Cannot vote on presets |
| **Edit Access** | Cannot edit existing presets |
| **View Access** | Can still browse community presets |

The user is **not notified** of the ban via Discord DM. They will see "You have been banned from submitting presets" if they try to use preset features.

---

## What Happens When a User is Unbanned

| Action | Effect |
|--------|--------|
| **Preset Status** | All 'hidden' presets → 'approved' |
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
- Ban history is preserved (unbanning doesn't delete the record)

---

## Channel Restrictions

These commands **only work in the moderation channel**. Using them elsewhere returns:

```
This command can only be used in the moderation channel.
```

This prevents accidental public exposure of moderation actions.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MODERATOR_IDS` | Comma-separated Discord user IDs of moderators |
| `MODERATION_CHANNEL_ID` | Discord channel ID for moderation commands |

Example `.dev.vars`:
```
MODERATOR_IDS=123456789,987654321
MODERATION_CHANNEL_ID=1234567890123456789
```

---

## Audit Trail

All moderation actions are logged:

- **Ban actions**: Logged with target user, moderator, reason, and preset count
- **Unban actions**: Logged with target user, moderator, and restored preset count

Logs can be viewed in the Cloudflare Workers dashboard or via `wrangler tail`.

---

## Related Documentation

- [Community Presets Specification](../specifications/community-presets.md)
- [Discord Worker Deployment](../developer-guides/deployment.md)
- [Environment Variables](../developer-guides/environment-variables.md)
