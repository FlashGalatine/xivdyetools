# FINDING-021: GitHub release-announcement webhook trusts payload fields it should pin (`repository.full_name` → fetch URL, `html_url` → posted link), accepts any event type, and has no delivery de-duplication (a *Redeliver* double-posts — seen 3× on 2026-08-29)
**Severity:** LOW · **Exposure:** INTERNET-AUTH (HMAC-gated) · **Deploy unit:** discord-worker · **Rotation:** NONE · **CWE:** CWE-20, CWE-345

## Location
- `apps/discord-worker/src/index.ts:481-535` — no `X-GitHub-Event` allowlist; `https://raw.githubusercontent.com/${payload.repository.full_name}/main/CHANGELOG-laymans.md` (:503) built from the payload; `payload.repository.html_url` passed to `sendAnnouncement`
- `apps/discord-worker/src/services/announcements.ts:57-70` — that URL becomes the masked "full release notes" link and the footer
- `apps/discord-worker/src/utils/github-verify.ts:35-44` — HMAC-SHA256 timing-safe, fail-closed, 1 MiB cap (positive); no `X-GitHub-Delivery` / version memo

## Evidence
- Whoever holds (or shares) `GITHUB_WEBHOOK_SECRET` can point the fetch at any repository's changelog and any link into the announcement channel; a GitHub *Redeliver* (needed anyway because the hook fires before the deploy — `docs/operations/SECRET_ROTATION.md`) re-posts the same version. `index.test.ts:539-560` covers the cap only.

## Fix
- Pin `full_name`/`html_url` to constants (or a `GITHUB_REPO` var); require `X-GitHub-Event: push`; remember the last announced version (KV) and skip repeats.

## Status
OPEN
