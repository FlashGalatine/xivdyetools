# Web-app analytics — reading the data

Dataset: `xivdyetools_web_analytics` (production worker; `env` blob separates
`production` from `beta`). `xivdyetools_web_analytics_dev` receives only local
`wrangler dev` traffic and can be ignored. Written by `POST /v1/telemetry` on
api-worker; schema in `apps/api-worker/src/telemetry/schema.ts`. Spec:
`docs/superpowers/specs/2026-08-29-web-analytics-design.md`.

**Retention is ~3 months.** No rollup exists yet — if history matters, add a
monthly cron that copies these aggregates into KV/D1.

## Column layout (fixed — every event uses the same slots)

| Column | Content |
|---|---|
| `index1` / `blob1` | event: `tool_view`, `tool_leave`, `dye_pick`, `chara_parse`, `theme_change` |
| `blob2` | tool id (`''` for chara_parse / theme_change) |
| `blob3` | `entry` (initial/share/nav) · `via` (drawer/grid) · `ok` (true/false) · `to` (theme) |
| `blob4` | `stainID` (dye_pick) · `producer` (chara_parse) · `''` |
| `blob5`–`blob9` | locale · theme · viewport (m/t/d) · app version · env |
| `double1` | `active_s` for tool_leave, else 0 |

## Running a query

```bash
curl -s https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/analytics_engine/sql \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  --data "<SQL>"
```

Always aggregate with `sum(_sample_interval)` — Analytics Engine samples under
load and `count()` under-reports.

## 1. Tool popularity — deliberate opens only (last 30 days)

```sql
SELECT blob2 AS tool, sum(_sample_interval) AS views
FROM xivdyetools_web_analytics
WHERE index1 = 'tool_view' AND blob3 <> 'initial' AND blob9 = 'production'
  AND timestamp > now() - INTERVAL '30' DAY
GROUP BY tool ORDER BY views DESC
```

`blob3 <> 'initial'` removes the Harmony-by-default bias. Add `AND blob3 = 'share'`
to see which tools arrive via share links.

## 2. Median visible time per tool

```sql
SELECT blob2 AS tool, quantiles(0.5)(double1) AS median_s, sum(_sample_interval) AS leaves
FROM xivdyetools_web_analytics
WHERE index1 = 'tool_leave' AND blob9 = 'production'
  AND timestamp > now() - INTERVAL '30' DAY
GROUP BY tool ORDER BY median_s DESC
```

## 3. Most-picked dyes (overall / per tool)

```sql
SELECT blob4 AS stainID, sum(_sample_interval) AS picks
FROM xivdyetools_web_analytics
WHERE index1 = 'dye_pick' AND blob9 = 'production'
  AND timestamp > now() - INTERVAL '30' DAY
GROUP BY stainID ORDER BY picks DESC LIMIT 20
```

Add `blob2 AS tool` to the SELECT/GROUP BY for per-tool lists. Map stainIDs to
names with `GET https://data.xivdyetools.app/v1/dyes/stain/<id>`.

## 4. .chara parses per ISO week

```sql
SELECT toStartOfWeek(timestamp) AS week, blob3 AS ok, blob4 AS producer, sum(_sample_interval) AS parses
FROM xivdyetools_web_analytics
WHERE index1 = 'chara_parse' AND blob9 = 'production'
GROUP BY week, ok, producer ORDER BY week
```

## 5. Theme preference

The default theme is a fixed `standard-dark` (no OS-preference check), so the
share of batches on Dark over-counts preference. Read both:

```sql
-- (a) theme in use — Light share is the floor for "chose Light"
SELECT blob6 AS theme, sum(_sample_interval) AS views
FROM xivdyetools_web_analytics
WHERE index1 = 'tool_view' AND blob9 = 'production'
  AND timestamp > now() - INTERVAL '30' DAY
GROUP BY theme

-- (b) deliberate switches per week
SELECT toStartOfWeek(timestamp) AS week, blob3 AS switched_to, sum(_sample_interval) AS switches
FROM xivdyetools_web_analytics
WHERE index1 = 'theme_change' AND blob9 = 'production'
GROUP BY week, switched_to ORDER BY week
```
