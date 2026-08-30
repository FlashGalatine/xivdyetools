# Workers log retention check (2026-08-29, coordinator)

Several candidates (oauth `logUserAgent: true`, api-worker telemetry access log, presets-api `logUserAgent: true`,
moderation-worker `User banned` line with `targetUsername` + free-text `reason`) put personal fields into
`logger.info(...)` calls. Whether that is *retained* anywhere decides their severity, so the production
scripts' settings were read from the Workers API (read-only, `GET /accounts/<id>/workers/scripts/<name>/settings`):

| Script | `observability` | `logpush` | `tail_consumers` |
|---|---|---|---|
| xivdyetools-api-worker | unset (null) | false | [] |
| xivdyetools-oauth | unset | false | [] |
| xivdyetools-presets-api | unset | false | [] |
| xivdyetools-moderation-worker | unset | false | [] |
| xivdyetools-discord-worker | unset | false | [] |
| xivdyetools-og-worker | unset | false | [] |
| xivdyetools-image-worker | unset | false | [] |
| xivdyetools-discord-worker-dev | unset | false | [] |
| xivdyetools-og-worker-dev | unset | false | [] |

No `[observability]` block exists in any `wrangler.toml` either (`git ls-files '*/wrangler.toml' | xargs grep -n observability` → nothing).

**Conclusion:** `console`/`logger` output from these workers is not persisted — it is visible only in a live
`wrangler tail` / dashboard real-time log session. The log-line findings are therefore filed **LOW**
("code contradicts the written promise; latent until Workers Logs, Logpush or a tail consumer is enabled")
rather than MEDIUM, with the guardrail that enabling Workers Logs on any of these scripts must be preceded
by removing the personal fields from the log calls.

A Workers Observability aggregate query (`count` grouped by `$metadata.service`, last 7 days) returned a time
axis with no counts, consistent with the above.
