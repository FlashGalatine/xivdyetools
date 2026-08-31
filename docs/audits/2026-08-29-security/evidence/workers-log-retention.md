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

---

**Update (2026-08-30, Sprint 9):** the guardrail's condition is now met. FINDING-011 (personal fields —
display names, free-text ban reasons, option values, preset names) closed in Sprint 4 across
moderation-worker/discord-worker/presets-api; FINDING-010's remaining piece (the rate-limiter's raw
client-IP / Discord-id key on fail-open and backend-error log lines) closed here in `@xivdyetools/worker-kit`
1.2.0 — those lines now carry a non-identifying `keyScope` instead. Workers Logs / Logpush / tail consumers
may now be enabled on any of the scripts above; still spot-verify the redaction on a sampled request before
flipping the toggle, since this table describes the settings at audit time, not a live guarantee.
