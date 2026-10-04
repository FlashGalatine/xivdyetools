# FINDING-022: No worker's wrangler.toml pins [observability] off, and the CI wrangler-invariants step does not assert it, so the 'Workers Logs is off' promise in both privacy policies rests on unchecked dashboard state
**Severity:** LOW · **Exposure:** LOCAL · **Deploy unit:** api-worker + discord-worker + image-worker + moderation-worker + oauth + og-worker + presets-api + CI · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-1188

## Location
- apps/discord-worker/wrangler.toml:12 — top-level beta worker block (and [env.production]) has no [observability] section; the same holds for the moderation-worker, presets-api, image-worker, api-worker, oauth and og-worker wrangler.toml files
- apps/discord-worker/PRIVACY_POLICY.md:120 — §5 promises persistent Workers Logs are switched off and that the policy will be updated before they are enabled (apps/web-app/PRIVACY.md:148 makes the same promise for every worker)
- .github/workflows/ci.yml:174 — the 'Wrangler config invariants' step does not check observability, so turning it on in the dashboard or in config would not fail CI

## Evidence
- git grep -n -i -E "observability|logpush|tail_consumers|head_sampling" -- 'apps/*.toml' 'apps/**/wrangler*' -> no output (searched at 0ab33466)
- docs/audits/2026-08-29-security/evidence/workers-log-retention.md:8-20 — the production settings API showed observability 'unset (null)' for all seven scripts; the setting is controlled from the dashboard, not the repo
- docs/operations/OPEN_ITEMS.md:57-62 — 'Workers Logs / Logpush stay OFF until the redaction is spot-verified' is tracked only as a manual dashboard item

## Fix
- Add `[observability]\nenabled = false` to every wrangler.toml, at the top level and under [env.production], or confirm the key inherits, so a deploy enforces the state the policy describes
- Extend the CI wrangler-config invariants step to fail when any worker's observability is enabled or a logpush / tail_consumers key appears, unless PRIVACY.md and PRIVACY_POLICY.md (and their translations) are updated in the same change
- Keep OPEN_ITEMS.md §Workers Logs as the gate for deliberately turning logs on; flipping this pin should be the reviewed step that triggers the policy update

## Status
OPEN — discord-worker part fixed (`8ecb878f`); presets-api part in `f1b54a0f` (local branch `fix/security-2026-10-03-sprint3`, presets-api 2.4.0; PR #224, open); moderation-worker part in `c7fd9eba` (local branch `fix/security-2026-10-03-sprint4`, moderation-worker 1.8.0; PR #225, open); the remaining workers and CI are Sprints 6, 7, 9, 10 and 11.
