# Preset Palettes Moderation

**Managing community presets and user bans via Discord**

> This guide covers the moderator-only commands for managing the Preset Palettes feature.

---

## Overview

The Community Presets feature allows users to share color palettes with the community. As a moderator, you have access to commands for:

- **Banning users** who submit inappropriate content (see [Ban and unban status](#ban-and-unban-status))
- **Unbanning users** to restore access
- **Reviewing flagged presets** with `/preset moderate` (pending, approve, reject, stats) and the Approve / Reject / Revert buttons on each preset's review embed

---

## Ban and unban status

Since moderation-worker 1.9.0, `/preset ban_user` and `/preset unban_user` use a private, reviewed
confirmation flow. It stays switched off until a separate activation release turns on
`LINKED_BAN_CONFIRMATION_ENABLED`. The flag is `"false"` in both environments, and activation
waits for the OAuth identity provider, presets-api migration 0016 and the privacy disclosures to
be live.

**While it is off:**

- `/preset ban_user` and `/preset unban_user` reply privately: "Account ban confirmations are not
  active. No action was taken." Ban buttons, selectors and the reason modal give the same reply,
  including those on messages posted before 1.9.0. Nothing is written.
- The `user` and `additional_user` suggestions stay empty.
- **Existing bans are still enforced.** A banned user still cannot submit, edit or vote; their
  hidden presets stay hidden; and Approve and Revert still refuse a preset whose author is
  banned.
- `/preset moderate` and the Approve / Reject / Revert buttons keep working. Approve and Revert
  check the preset's current state first: a stale or older review message is refreshed instead of
  acted on.
- New channel and log posts for approvals, rejections, Reverts and bans no longer name the
  moderator. The database audit keeps the moderator ID. Older posts are unchanged.
- An urgent ban or unban goes to the maintainer, who can apply it by hand. See
  [Emergency ban and unban](#emergency-ban-and-unban-while-confirmations-are-off).

The sections below describe the commands once the flow is switched on.

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
5. In one database transaction: records the ban, **hides every approved preset** by the IDs in the ban's scope, and writes the audit rows. A ban embed is posted in the moderation channel, without your name

The review works once and only for you, and it expires after 15 minutes. If anything changed in the meantime (the matching bans, the scope, the expiry or the capacity), the transaction refuses and nothing is written.

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
4. Posts the result in the moderation channel, with the restored and still-hidden counts

---

## Autocomplete Behavior

Suggestions appear only for moderators, and only while the confirmation flow is on.

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
| **Preset Status** | All 'approved' presets by the IDs in the ban's scope → 'hidden' |
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
  banned_at TEXT NOT NULL,
  unbanned_at TEXT,
  unban_moderator_discord_id TEXT
);
```

Key fields:
- `unbanned_at` is NULL for active bans
- `reason` must be 10–500 characters
- Unbanning blanks the record's `username` and `reason` but keeps the row (with `unbanned_at`); presets-api deletes lifted bans 90 days after the unban (a daily cron, plus a best-effort sweep after its own moderation writes). The accountability history lives in the D1 `moderation_log` table, which keeps ban and unban rows for 12 months

presets-api migration `0016_ban_identity_continuity.sql` adds three tables:
- `ban_identity_memberships`: the extra IDs a particular ban covers
- `moderation_ban_confirmations`: the one-use review nonces
- `ban_continuity_operations`: the handoff that keeps a ban's coverage when OAuth changes an account's links

Moderation-worker 1.9.x reads `ban_identity_memberships` even while the flag is off, so 0016 must be applied before it deploys. See [stored identities and moderation continuity](../architecture/identity-moderation.md).

---

## Emergency ban and unban while confirmations are off

**Maintainer only.** This is for an urgent case while `LINKED_BAN_CONFIRMATION_ENABLED` is still
off. It writes production data by hand, so each run is its own decision. The SQL mirrors the
direct ban and unban of moderation-worker 1.8.2. presets-api 2.8.x enforces the rows it writes, and
the confirmation flow can lift them after activation.

> **Never use it once the flag is on.** A ban written this way has no memberships, and a manual
> unban ignores memberships. Use the bot instead.

**1. Check that the manual path is still safe.** The count must be 0. Any membership row means
the confirmation flow or the continuity handoff has run, so stop.

```sql
SELECT COUNT(*) AS memberships FROM ban_identity_memberships;
```

**2. Find the exact ID.** It must be a Discord ID (17–20 digits) or an XIVAuth ID (a lowercase
UUID), exactly as stored in `presets.author_discord_id`:

```sql
SELECT author_discord_id, author_name, COUNT(*) AS presets
FROM presets WHERE author_name LIKE '%<part of name>%'
GROUP BY author_discord_id ORDER BY presets DESC LIMIT 25;
```

**3. Check the current ban state.** Before a ban the count must be 0; before an unban, 1 or more.

```sql
SELECT COUNT(*) AS active FROM banned_users
WHERE (discord_id = '<TARGET>' OR xivauth_id = '<TARGET>') AND unbanned_at IS NULL;
```

**4. Fill in a copy of the template.** Keep the copy outside the repository: it holds a user ID
and a reason. In every value, double each `'`.

| Placeholder | Value |
|---|---|
| `<TARGET>` | the ID from step 2 |
| `<XIVAUTH>` | `'<TARGET>'` (quoted) when the target is an XIVAuth UUID; `NULL` (unquoted) for a Discord ID |
| `<USERNAME>` | the author name from step 2, or `<TARGET>` when there is none |
| `<MODERATOR>` | your own Discord ID |
| `<REASON>` | the ban reason, 10–500 characters |

Ban template:

```sql
INSERT INTO banned_users (id, discord_id, xivauth_id, username, moderator_discord_id, reason, banned_at)
VALUES (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
  '<TARGET>', <XIVAUTH>, '<USERNAME>', '<MODERATOR>', '<REASON>', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, reason, target_discord_id, created_at)
VALUES (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
  NULL, '<MODERATOR>', 'ban', '<REASON>', '<TARGET>', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, reason, target_discord_id, created_at)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
  p.id, '<MODERATOR>', 'hide', '<REASON>', '<TARGET>', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM presets p WHERE p.author_discord_id = '<TARGET>' AND p.status = 'approved';
UPDATE presets SET status = 'hidden', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE author_discord_id = '<TARGET>' AND status = 'approved';
```

The ban row comes first: a second active ban of the same ID fails on its unique index before
anything else is written. The hide audit comes before the update it describes, because the update
changes the status it selects on.

Unban template (the unban takes no reason):

```sql
UPDATE banned_users
SET unbanned_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), unban_moderator_discord_id = '<MODERATOR>', username = '', reason = ''
WHERE (discord_id = '<TARGET>' OR xivauth_id = '<TARGET>') AND unbanned_at IS NULL;
INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, reason, target_discord_id, created_at)
VALUES (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
  NULL, '<MODERATOR>', 'unban', NULL, '<TARGET>', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, reason, target_discord_id, created_at)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
  p.id, '<MODERATOR>', 'restore', NULL, '<TARGET>', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM presets p
WHERE p.author_discord_id = '<TARGET>' AND p.status = 'hidden'
  AND NOT EXISTS (SELECT 1 FROM presets o WHERE o.dye_signature = p.dye_signature AND o.id <> p.id AND o.status IN ('approved', 'pending'))
  AND NOT EXISTS (SELECT 1 FROM presets h WHERE h.author_discord_id = p.author_discord_id AND h.status = 'hidden' AND h.dye_signature = p.dye_signature AND h.id < p.id);
UPDATE presets SET status = 'approved', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE author_discord_id = '<TARGET>' AND status = 'hidden'
  AND NOT EXISTS (SELECT 1 FROM presets o WHERE o.dye_signature = presets.dye_signature AND o.id <> presets.id AND o.status IN ('approved', 'pending'))
  AND NOT EXISTS (SELECT 1 FROM presets h WHERE h.author_discord_id = presets.author_discord_id AND h.status = 'hidden' AND h.dye_signature = presets.dye_signature AND h.id < presets.id);
```

The unban audit row is written unconditionally. Step 3's count is what guarantees there was a
ban to lift. The two `NOT EXISTS` guards leave a preset hidden when its dye combination is taken,
as the bot does.

**5. Run it** from `apps/presets-api` in a checkout of `main`:

```bash
pnpm exec wrangler d1 execute xivdyetools-presets --env production --remote --file <path to the filled-in copy>
```

Do not assume `--file` runs all-or-nothing. If the command reports an error, run step 6 before
anything else, then finish or reverse the remaining statements by hand.

**6. Verify.** Run step 3's count again: 1 after a ban, 0 after an unban. Then count the
target's presets by status:

```sql
SELECT status, COUNT(*) AS presets FROM presets
WHERE author_discord_id = '<TARGET>' GROUP BY status;
```

After a ban there is no `approved` row. After an unban, any `hidden` presets are the ones whose
dye combination is taken.

Then tell the moderators what was done. The bot posts nothing for a manual change.

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
