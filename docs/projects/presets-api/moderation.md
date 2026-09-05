# Content Moderation Pipeline

Content moderation runs on preset submission (`POST`) and edit (`PATCH`) when the name or
description changes. The pipeline uses a two-tier filtering strategy: a fast local profanity filter
followed by an optional external toxicity check. On `PATCH`, a per-user daily cap is spent
**before** either tier runs — see [Daily cap in front of the pipeline](#daily-cap-in-front-of-the-pipeline).

---

## Two-Tier Filtering

### Tier 1: Local Profanity Filter

- Six-language word lists located in `src/data/profanity/` (`en.ts`, `ja.ts`, `de.ts`, `fr.ts`, `ko.ts`, `zh.ts`).
- Combined via the `profanityLists` export from `src/data/profanity/index.ts`.
- Fast, synchronous check against submitted text.
- A match short-circuits the pipeline (Tier 2 is not called) and returns `passed: false`. That does
  **not** block the submission: the preset is still created, with `status = 'pending'`, and goes to
  a moderator. Nothing in this API refuses a write because of a word-list hit.

### Tier 2: Google Perspective API (Optional)

- External API call with a **5-second timeout** (`PRESETS-HIGH-001`).
- Requests five attributes: `TOXICITY`, `SEVERE_TOXICITY`, `IDENTITY_ATTACK`, `INSULT`, `PROFANITY`.
  Any summary score at or above **0.7** is a flag. (There is no `THREAT` attribute in the request.)
- Sends `doNotStore: true` and passes the key in the `x-goog-api-key` header, never the query string
  (FINDING-006).
- **Fail-closed** (FINDING-005). With a key configured, a timeout, a non-2xx response or a
  malformed body resolves to `moderationUnavailable()` — `passed: false`,
  `method: 'perspective_unavailable'` — which callers treat exactly as they treat flagged content:
  the preset lands in the moderator queue rather than publishing unjudged. The *only* thing that
  skips this tier is an **absent** `PERSPECTIVE_API_KEY`, in which case the local word list alone
  decides. That is the intended degradation, and it is the reason the key must be deleted before
  Perspective shuts down on 2026-12-31 (see `DEPRECATIONS.md`).

---

## Daily cap in front of the pipeline

`PATCH /api/v1/presets/:id` charges a `text_edit` slot (`DAILY_TEXT_EDIT_LIMIT` = 30 per UTC day,
recorded in `submission_events`) **before** calling `moderateContent`, whenever `name` or
`description` is present in the body — for every preset status. Over the cap the edit is refused
with `429 RATE_LIMITED` and nothing is moderated or written. The older `flagged_edit` cap (10/day)
is charged *after* the call and only to edits that actually reach a moderator, so it cannot bound
the Perspective call itself (FINDING-005). Full table in [rate-limiting.md](rate-limiting.md).

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
3. **If clean, the preset is auto-approved** — `status = moderationResult.passed ? 'approved' : 'pending'`.
   Only content that trips a tier (or that nobody could judge) lands as `pending`.
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
- **Service binding only** — `notifyDiscordBot` calls
  `env.DISCORD_WORKER.fetch('https://internal/webhooks/preset-submission')` with
  `Authorization: Bearer <INTERNAL_WEBHOOK_SECRET>`. There is no outbound Discord webhook path; if
  either the binding or the secret is missing the call logs and returns, which is why both are
  production-required in `validateEnv` (a silent fan-out failure is exactly what that check exists
  to stop).
- Retry with exponential backoff: 3 retries, 1--10 s delays (`PRESETS-CRITICAL-003`).
- Fire-and-forget: notification errors never fail the user's request (`PRESETS-REF-002`); a delivery
  that exhausts its retries lands in `failed_notifications` (BUG-015).

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
| `action` | `approve` \| `reject` \| `flag` \| `unflag` \| `requeue` \| `revert` (this API) · `ban` \| `unban` \| `hide` \| `restore` (moderation-worker). `requeue` records a move back to `pending` |
| `reason` | Optional reason text |
| `target_discord_id` | The moderated user — set for `ban` \| `unban` \| `hide` \| `restore` |
| `created_at` | Timestamp |

The log is queryable via `GET /api/v1/moderation/:id/history`, which filters on `preset_id` — so a
preset hidden by its author's ban now shows the `hide` row that explains it. `GET
/api/v1/moderation/stats` counts every row from the last 7 days, ban-related ones included.

---

## Input Validation

Nothing is sanitized — `src/services/validation-service.ts` **validates** and a violation is a
`400`, never a silent rewrite. There is no Zalgo (combining-mark stacking) rule.

| Field | Rules |
|---------------|---------------------------------------------------------------|
| Name | 2–50 characters. No C0 / DEL / C1 control characters, no zero-width, bidi-mark, bidi-override, bidi-isolate, BOM or line/paragraph-separator characters (FINDING-028) |
| Description | 10–200 characters. Same character rule, except TAB / LF / CR stay legal — a description is multi-line |
| Tags | Max 10 tags, each max 30 characters, each matching `TAG_PATTERN`: starts and ends with a letter or digit, with letters / marks / digits / spaces / hyphens / underscores / apostrophes between (Unicode-aware, so CJK tags work). Markdown, brackets, URLs and other punctuation are out — a tag is rendered verbatim in Discord embeds and never passes content moderation (FINDING-019) |
| Dyes | 3–6 stainIDs, integers 1–254 |

The one nuance in the invisible-character rule is U+200D (zero-width joiner): it is the glue inside
emoji sequences, so it is allowed **only** between two emoji code points and rejected between
ordinary letters, where it is the hidden-padding trick the rule exists to stop.

### Unicode-safe truncation (unused)

`truncateUnicodeSafe()` splits by code points with `Array.from()` (`PRESETS-HIGH-003`) so a
truncation cannot break an emoji or CJK surrogate pair. It is exported and unit-tested, but
**nothing in presets-api calls it** — no moderation or notification path currently truncates a
string. Treat it as available, not as part of the pipeline.

---

## Related Documentation

- [Endpoints](endpoints.md)
- [Database](database.md)
- [Rate Limiting](rate-limiting.md)
- [Overview](overview.md)
