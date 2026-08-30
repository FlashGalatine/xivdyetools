# Analytics Engine query cookbook

The web-app section is added by PR #149; this file currently covers the Discord bot only.

## Discord bot analytics — reading the data

Dataset: `xivdyetools_bot_analytics` (production); `xivdyetools_bot_analytics_beta` is the dev
worker and can be ignored. Written by `apps/discord-worker/src/services/analytics.ts`; lifecycle in
`services/command-trace.ts`. Spec: `docs/superpowers/specs/2026-08-29-bot-analytics-tier-a-design.md`.
Retention ~3 months. Always aggregate with `sum(_sample_interval)`.

Rows written before 2026-08-29 have `blob5 = ''`, `blob6..8 = ''` and `double2 = 0`; filter
`blob8 = 'command'` (or `'button'`) to restrict to Tier A rows.

### Column layout

| Column | Content |
|---|---|
| `index1` / `blob1` | command name (`extractor_image` / `extractor_color` split kept) or `button` |
| `blob2` | Discord user id (pseudonymous; use only for `count(DISTINCT blob2)`) |
| `blob3` | `guild` \| `dm` |
| `blob4` | `1` \| `0` success |
| `blob5` | outcome class: `ok`, `rate_limited`, `upstream_universalis`, `upstream_presets`, `image_input` (the uploaded image or `.chara` file could not be read), `render`, `unknown` |
| `blob6` | subcommand (`info`, `browse`, `find`, …) or button kind (`copy_hex`, `copy_rgb`, `copy_hsv`); subcommand groups are `<group>_<sub>` (`favorite_add`) |
| `blob7` | locale bucket `en ja de fr ko zh other` |
| `blob8` | `command` \| `button` |
| `double1` | success 1/0 · `double2` latency ms (deferred work included) · `double3` 1 |

### 1. Commands and subcommands, last 30 days

```sql
SELECT blob1 AS command, blob6 AS subcommand, sum(_sample_interval) AS runs
FROM xivdyetools_bot_analytics
WHERE blob8 = 'command' AND timestamp > now() - INTERVAL '30' DAY
GROUP BY command, subcommand ORDER BY runs DESC
```

### 2. Latency p50 / p95 per command

```sql
SELECT blob1 AS command,
       quantileExactWeighted(0.5)(double2, _sample_interval) AS p50_ms,
       quantileExactWeighted(0.95)(double2, _sample_interval) AS p95_ms
FROM xivdyetools_bot_analytics
WHERE blob8 = 'command' AND blob4 = '1' AND timestamp > now() - INTERVAL '30' DAY
GROUP BY command ORDER BY p95_ms DESC
```

`blob4 = '1'` restricts this to successful runs on purpose — a rate-limited request returns near-
instantly, so mixing it in would drag the median toward 0 and understate real latency. Rows whose
work stalled past the 20 s drain deadline are `unknown` with `double2 ≈ 20000`, so they are
excluded here too.

### 3. Failure share by outcome class

```sql
SELECT blob1 AS command, blob5 AS outcome, sum(_sample_interval) AS runs
FROM xivdyetools_bot_analytics
WHERE blob8 = 'command' AND blob4 = '0' AND timestamp > now() - INTERVAL '30' DAY
GROUP BY command, outcome ORDER BY runs DESC
```

How a row gets its class (`services/command-trace.ts` `classifyError` + the handlers' marks):

- **Validation replies count as `ok`** — "no matches", a missing option, a `.chara` slot that is
  not in the file, and a **4xx other than 429 from presets-api / Universalis** (not the owner,
  duplicate vote, unknown world …): the handler answered the user, nothing of ours failed.
  `429`, `5xx` and a network/binding failure are `upstream_*`.
- **A lost card counts as `render`** even when the user still got an answer: bot-logic's
  `GENERATION_FAILED`, a resvg/PNG failure, and `/dye`'s text fallbacks (its card commands degrade
  to a text embed instead of an error). This is how a renderer outage on the busiest command shows
  up at all.
- **`image_input`** is image-worker rejecting the image (marker table in
  `services/image-input-errors.ts`: URL, size, format, timed-out fetch) plus a `/swatch`
  attachment that could not be downloaded or parsed. A `/extractor image` failure AFTER the pixels
  came back is `render`; one during the round trip that matches no marker is `unknown`.
- **`rate_limited`** rows are AE-only: they do not move the KV `total` / `failure` / `cmd:*`
  counters behind `/stats` (those count commands that ran; the limiter exists to absorb bursts and
  KV allows one write per second per key).
- **`unknown`** also covers a command whose deferred work had not settled 20 s after the response
  (`DRAIN_DEADLINE_MS`) — the row is written then rather than lost with the isolate.

Known blind spots: a Discord edit that fails (`safeEditOriginalResponse` returning `false` — a
429/5xx on the PATCH or the PNG upload timing out) is still `ok`; and `double2` spans I/O only —
Workers freeze `Date.now()` between I/O events, so CPU spent after a handler's last await is not
in the latency.

### 4. Locale mix (Discord client language, not the stored preference)

```sql
SELECT blob7 AS locale, sum(_sample_interval) AS runs
FROM xivdyetools_bot_analytics
WHERE blob8 = 'command' AND timestamp > now() - INTERVAL '30' DAY
GROUP BY locale ORDER BY runs DESC
```

### 5. Copy-button usage

```sql
SELECT blob6 AS button, sum(_sample_interval) AS clicks
FROM xivdyetools_bot_analytics
WHERE blob8 = 'button' AND timestamp > now() - INTERVAL '30' DAY
GROUP BY button
```

### 6. Daily unique users

```sql
SELECT toStartOfDay(timestamp) AS day, count(DISTINCT blob2) AS users
FROM xivdyetools_bot_analytics
WHERE timestamp > now() - INTERVAL '30' DAY
GROUP BY day ORDER BY day
```

Analytics Engine's SQL has no `uniq()`; `count(DISTINCT …)` is the documented distinct count. Note
this counts sampled rows, not `sum(_sample_interval)` — at the bot's volume nothing is sampled.
