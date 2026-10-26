# FINDING-052: xivcharakit releases have no git tags; source traceability relies only on npm provenance
**Severity:** INFO · **Exposure:** LOCAL · **Deploy unit:** core (xivcharakit dependency) · **Rotation:** NONE · **Policy:** NONE · **CWE:** n/a

## Location
- `packages/core/package.json:78` — xivcharakit releases have no git tags; source traceability relies only on npm provenance

## Evidence
- packages/core/package.json:78 "xivcharakit": "0.1.0-beta.4"; pnpm-lock.yaml:4049 integrity sha512-fIW3xEd3fHaP+...Mw== equals the npm dist.integrity; gh api .../tags returns []
- Reach: No attacker path: this is a supply-chain traceability gap at install/build time. A maintainer or auditor who wants to tie xivcharakit@0.1.0-beta.4 to source has no tag or release to diff against and must rely on the npm SLSA provenance attestation.
- packages/core/package.json:78 exact-pins "xivcharakit": "0.1.0-beta.4" and pnpm-lock.yaml:4049 integrity equals the registry dist.integrity (sha512-fIW3xEd3...), so the artifact is locked. GET repos/FlashGalatine/XIVCharaKit/tags returns [] and releases returns 0 on the public repo, and the npm repository field names only the URL and directory packages/chara, no ref. Provenance exists and is consistent per the reviewer, so there is no direct effect: INFO hardening only. Preconditions: None. The facts were checked with GET-only gh api calls and npm view, and they match the repo pin and lockfile.
- Live state the repo cannot show: The upstream GitHub tag and release state and the npm provenance attestation are live registry and GitHub state, read on 2026-10-26.

## Fix
- In the upstream XIVCharaKit publish.yml, create and push a git tag (e.g. chara-v0.1.0-beta.4) or a GitHub release on each publish, and backfill a tag at 18a91afe for 0.1.0-beta.4. Keep the exact pin and lockfile integrity as they are.

## Status
OPEN
