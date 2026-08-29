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
| `blob2` | Discord user id (pseudonymous; use only for `uniq()`) |
| `blob3` | `guild` \| `dm` |
| `blob4` | `1` \| `0` success |
| `blob5` | outcome class: `ok`, `rate_limited`, `upstream_universalis`, `upstream_presets`, `image_input`, `render`, `unknown` |
| `blob6` | subcommand (`info`, `browse`, `find`, …) or button kind (`copy_hex`, `copy_rgb`, `copy_hsv`) |
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

### 3. Failure share by outcome class

```sql
SELECT blob1 AS command, blob5 AS outcome, sum(_sample_interval) AS runs
FROM xivdyetools_bot_analytics
WHERE blob8 = 'command' AND blob4 = '0' AND timestamp > now() - INTERVAL '30' DAY
GROUP BY command, outcome ORDER BY runs DESC
```

Known gap: handler validation replies and non-exception error embeds (e.g. "no matches") still
count as `ok` — only thrown errors and rate limits are classified.

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
SELECT toStartOfDay(timestamp) AS day, uniq(blob2) AS users
FROM xivdyetools_bot_analytics
WHERE timestamp > now() - INTERVAL '30' DAY
GROUP BY day ORDER BY day
```
