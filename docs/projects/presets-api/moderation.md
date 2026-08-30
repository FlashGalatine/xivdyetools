# Content Moderation Pipeline

> Presets API v2.0.0

Content moderation runs on preset submission (`POST`) and edit (`PATCH`) when the name or description changes. The pipeline uses a two-tier filtering strategy: a fast local profanity filter followed by an optional external toxicity check.

---

## Two-Tier Filtering

### Tier 1: Local Profanity Filter

- Six-language word lists located in `src/data/profanity/` (`en.ts`, `ja.ts`, `de.ts`, `fr.ts`, `ko.ts`, `zh.ts`).
- Combined via the `profanityLists` export from `src/data/profanity/index.ts`.
- Fast, synchronous check against submitted text.
- Blocks submission immediately if a match is found.

### Tier 2: Google Perspective API (Optional)

- External API call with a **5-second timeout** (`PRESETS-HIGH-001`).
- Evaluates content for toxicity, profanity, threat, and insult signals.
- **Fail-open**: if the API is slow or unavailable, the submission proceeds with Tier 1 results only.
- Requires the `PERSPECTIVE_API_KEY` environment variable to be set. When absent, Tier 2 is skipped entirely.

---

## Moderation States

Presets progress through the following states:

| Status | Description |
|------------|---------------------------------------------------|
| `pending` | Awaiting moderator review (new submissions or flagged edits) |
| `approved` | Visible to the public |
| `rejected` | Declined by a moderator |
| `flagged` | Content flagged during an edit, needs re-review |
| `hidden` | Hidden from the public (soft delete) |

---

## Moderation Workflow

### New Submission

1. User submits a preset.
2. Content moderation runs (Tier 1 + Tier 2).
3. If clean, status is set to `pending`.
4. A Discord notification is sent to the moderation channel (fire-and-forget via `waitUntil`).
5. A moderator reviews the preset in the moderation channel or via the moderation-worker bot.
6. The moderator approves or rejects.

### Edit of an Approved Preset

1. User edits the name or description.
2. Content moderation re-runs.
3. If flagged: stores `previous_values`, sets status to `pending`.
4. If clean: stays `approved`.
5. `PRESETS-CRITICAL-004`: `previous_values` are **not** cleared on a successful moderation pass. This preserves the audit trail.

### Revert

- Moderators can revert flagged edits via `PATCH /api/v1/moderation/:id/revert`.
- Restores all fields from `previous_values`.
- Clears the `previous_values` column.
- Sets status back to `approved`.

---

## Discord Notifications

- Sent to the configured moderation channel.
- Uses a Discord webhook or service binding to `discord-worker`.
- Retry with exponential backoff: 3 retries, 1--10 s delays (`PRESETS-CRITICAL-003`).
- Fire-and-forget: notification errors never fail the user's request (`PRESETS-REF-002`).

---

## Ban System

**This API has no ban routes** — [`endpoints.md`](endpoints.md) ("Bans") is the authority. Bans are
written by `xivdyetools-moderation-worker` (`/preset ban_user`, `/preset unban_user`) directly on the
shared `xivdyetools-presets` D1, in one atomic `db.batch()`:

- a `banned_users` row (closed with `unbanned_at` on unban, never deleted);
- the author's `approved` presets flipped to `hidden`, and back to `approved` on unban;
- since moderation-worker 1.6.0 (2026-08-29 audit, FINDING-018) the matching `moderation_log` rows —
  one `ban` / `unban` per user action, plus one `hide` / `restore` per preset actually flipped.

This API only *checks* the table: banned users receive `403` on submissions, edits and votes
(`requireNotBanned` / `middleware/ban-check.ts`).

---

## Moderation Log

Every moderation action creates an entry in the `moderation_log` table (full schema in
[database.md](database.md)):

| Column | Purpose |
|------------------------|--------------------------------------------------------------|
| `id` | UUID v4 |
| `preset_id` | The preset acted upon — NULL for the user-level `ban` / `unban` |
| `moderator_discord_id` | Discord ID of the moderator |
| `action` | `approve` \| `reject` \| `flag` \| `unflag` \| `revert` (this API) · `ban` \| `unban` \| `hide` \| `restore` (moderation-worker) |
| `reason` | Optional reason text |
| `target_discord_id` | The moderated user — set for `ban` \| `unban` \| `hide` \| `restore` |
| `created_at` | Timestamp |

The log is queryable via `GET /api/v1/moderation/:id/history`, which filters on `preset_id` — so a
preset hidden by its author's ban now shows the `hide` row that explains it. `GET
/api/v1/moderation/stats` counts every row from the last 7 days, ban-related ones included.

---

## Input Sanitization

| Field | Rules |
|---------------|---------------------------------------------------------------|
| Name | Remove control chars, invisible Unicode, Zalgo text; max 50 chars |
| Description | Remove control chars, invisible Unicode, Zalgo text; max 200 chars |
| Tags | Max 30 chars each, max 10 tags per preset |

### Unicode Safety

`truncateUnicodeSafe()` uses `Array.from()` to split by code points (`PRESETS-HIGH-003`), preventing broken emoji or CJK surrogate pairs in notification text.

---

## Related Documentation

- [Endpoints](endpoints.md)
- [Database](database.md)
- [Rate Limiting](rate-limiting.md)
- [Overview](overview.md)
