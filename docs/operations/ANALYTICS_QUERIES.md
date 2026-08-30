# Analytics Engine query cookbook

Two Workers Analytics Engine datasets on the same Cloudflare account, one cookbook:

| Section | Dataset | Written by |
|---|---|---|
| [Web-app analytics](#web-app-analytics--reading-the-data) | `xivdyetools_web_analytics` | api-worker `POST /v1/telemetry` (opt-in, PR #149) |
| [Discord bot analytics](#discord-bot-analytics--reading-the-data) | `xivdyetools_bot_analytics` | discord-worker `services/analytics.ts` (Tier A, PR #150) |

Both datasets keep ~3 months of rows and neither has a rollup yet — if history matters, add a
monthly cron that copies the aggregates you care about into KV/D1.

## Running a query

```bash
curl -s https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/analytics_engine/sql \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  --data "<SQL>"
```

Always aggregate with `sum(_sample_interval)` — Analytics Engine samples under
load and `count()` under-reports.

## Web-app analytics — reading the data

Dataset: `xivdyetools_web_analytics` (production worker; `env` blob separates
`production` from `beta`). `xivdyetools_web_analytics_dev` receives only local
`wrangler dev` traffic and can be ignored. Written by `POST /v1/telemetry` on
api-worker; schema in `apps/api-worker/src/telemetry/schema.ts`. Spec:
`docs/superpowers/specs/2026-08-29-web-analytics-design.md`.

### Column layout (fixed — every event uses the same slots)

| Column | Content |
|---|---|
| `index1` / `blob1` | event: `tool_view`, `tool_leave`, `dye_pick`, `chara_parse`, `theme_change` |
| `blob2` | tool id (`''` for chara_parse / theme_change) |
| `blob3` | `entry` (initial/share/nav) · `via` (drawer/grid) · `ok` (true/false) · `to` (theme) |
| `blob4` | `stainID` (dye_pick) · `producer` (chara_parse) · `''` |
| `blob5`–`blob9` | locale · theme · viewport (m/t/d) · app version · env |
| `double1` | `active_s` for tool_leave, else 0 |

What counts (the hooks are deliberately narrow):

- `entry`: `initial` = the tool the page loaded into; `share` = the page loaded from a share link
  (ShareService's `v=` marker) or a preset deep link (`/presets/<id>`); `nav` = every later switch.
  A `?dye=` / `?dc=` left in the address bar by an in-app hand-off, and a reload of it, is
  `initial`. Re-navigating to the tool already showing (the Welcome modal's "Get started", Presets'
  own history entries) is a remount, not a view — no `tool_leave`/`tool_view` pair.
- `dye_pick`: accepted, explicit picks only. `grid` = a click in a tool's dye grid **or its
  Favorites strip** that the selector kept (a click that removes an already-selected dye, or is
  dropped at the selection cap, is not a pick); `drawer` = a palette-drawer swatch a tool took.
  Random-dye buttons never count. Budget's quick picks and the preset editor do not go through
  either hook, so they are not counted.
- `theme_change`: every deliberate switch — the theme modal and Shift+T. The envelope `theme`
  (`blob6`) is the theme in force when the batch's events happened: a switch sends the pending
  batch first.

### 1. Tool popularity — deliberate opens only (last 30 days)

```sql
SELECT blob2 AS tool, sum(_sample_interval) AS views
FROM xivdyetools_web_analytics
WHERE index1 = 'tool_view' AND blob3 <> 'initial' AND blob9 = 'production'
  AND timestamp > now() - INTERVAL '30' DAY
GROUP BY tool ORDER BY views DESC
```

`blob3 <> 'initial'` removes the Harmony-by-default bias. Add `AND blob3 = 'share'`
to see which tools arrive via share links.

### 2. Median visible time per tool

```sql
SELECT blob2 AS tool, quantileExactWeighted(0.5)(double1, _sample_interval) AS median_s,
  sum(_sample_interval) AS leaves
FROM xivdyetools_web_analytics
WHERE index1 = 'tool_leave' AND blob9 = 'production'
  AND timestamp > now() - INTERVAL '30' DAY
GROUP BY tool ORDER BY median_s DESC
```

Caveat: `tool_leave` fires only on a tool switch or `pagehide`. Mobile browsers can discard a
hidden tab without firing `pagehide`, so the last tool of such a session has a `tool_view` but no
matching `tool_leave` — dwell here is biased toward desktop sessions.

### 3. Most-picked dyes (overall / per tool)

```sql
SELECT blob4 AS stainID, sum(_sample_interval) AS picks
FROM xivdyetools_web_analytics
WHERE index1 = 'dye_pick' AND blob9 = 'production'
  AND timestamp > now() - INTERVAL '30' DAY
GROUP BY stainID ORDER BY picks DESC LIMIT 20
```

Add `blob2 AS tool` to the SELECT/GROUP BY for per-tool lists. Map stainIDs to
names with `GET https://data.xivdyetools.app/v1/dyes/stain/<id>`.

### 4. .chara parses per week

```sql
SELECT toStartOfWeek(timestamp) AS week, blob3 AS ok, blob4 AS producer, sum(_sample_interval) AS parses
FROM xivdyetools_web_analytics
WHERE index1 = 'chara_parse' AND blob9 = 'production'
GROUP BY week, ok, producer ORDER BY week
```

`toStartOfWeek` treats Monday as the first day of the week (fixed — no mode argument), but this is
not full ISO-8601 week numbering. Queries 4 and 5b deliberately carry no `timestamp` window — they
report weekly history over the full retention window, not a rolling 30 days.

### 5. Theme preference

The default theme is a fixed `standard-dark` (no OS-preference check), so the
share of batches on Dark over-counts preference. Read both:

```sql
-- (a) theme in use — Light share is the floor for "chose Light"
SELECT blob6 AS theme, sum(_sample_interval) AS views
FROM xivdyetools_web_analytics
WHERE index1 = 'tool_view' AND blob9 = 'production'
  AND timestamp > now() - INTERVAL '30' DAY
GROUP BY theme

-- (b) deliberate switches per week (no time window — see §4)
SELECT toStartOfWeek(timestamp) AS week, blob3 AS switched_to, sum(_sample_interval) AS switches
FROM xivdyetools_web_analytics
WHERE index1 = 'theme_change' AND blob9 = 'production'
GROUP BY week, switched_to ORDER BY week
```

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
