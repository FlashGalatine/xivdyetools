# FINDING-023: Deployed bots emit links to `xivdyetools.com` / `docs.xivdyetools.com`, which do not resolve — potential phishing target

## Severity
**LOW** (PLAUSIBLE) — both hostnames return no DNS answer (checked 2026-08-21 against 1.1.1.1); if the `.com` domain is not owned by the project it is registrable by a third party, who would then receive clicks from bot-authored "official" links. Reviewer IDs: DW-8, MOD-7, STOAT-1.

## Category
CWE-601-adjacent (dangling reference) · CWE-451 UI Misrepresentation

## Location
- `apps/discord-worker/src/handlers/commands/stats.ts:175-176` — `https://xivdyetools.com`, `https://docs.xivdyetools.com` (diverges from `PRODUCT_LINKS`).
- `apps/moderation-worker/src/handlers/commands/preset.ts:34` — `PRESETS_WEB_URL = 'https://xivdyetools.com'`.
- `apps/stoat-worker/src/commands/about.ts:26`.

## Recommendation
Point all three at the canonical `https://xivdyetools.app` / `https://developers.xivdyetools.app` via the shared `PRODUCT_LINKS`; confirm ownership of `xivdyetools.com` (keep it registered and redirecting, or remove every reference).

## References
- Evidence: `../evidence/review-infra-stoat.md` (STOAT-1), `../evidence/review-discord-worker.md` (DW-8), `../evidence/review-moderation-worker.md` (MOD-7)

## Status
**IN PROGRESS 2026-08-21** — per-app adoption below (discord-worker `/stats` pending).
- moderation-worker 1.5.0 (MOD-7): `PRESETS_WEB_URL` → `https://xivdyetools.app`; stoat-worker 0.2.2 (STOAT-1): about card → `.app` hosts.
