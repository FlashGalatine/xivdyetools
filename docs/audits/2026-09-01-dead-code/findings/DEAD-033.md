# DEAD-033: `DEPRECATIONS.md` still lists `LocalStorageCacheBackend` as an Active Deprecation with an open removal checklist — the class was removed some time ago

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** repo docs (no deploy) · **Semver:** NONE · **Category:** Legacy (stale register)

## Location
- `DEPRECATIONS.md:302-321` — the `LocalStorageCacheBackend` (web-app) section, with three unchecked boxes: "Confirm … is not used in any active code paths", "Remove the class from the web-app", "Clean up any associated localStorage keys"

## Evidence
- `git ls-files apps/web-app | xargs grep -ln "LocalStorageCacheBackend"` → `apps/web-app/CHANGELOG.md` only. The class is gone from source.
- The other open boxes in the file are genuine ops items pending a cutover window (`:97` api-docs Pages project, `:135` the old universalis-proxy worker) — those stay.
- A deprecation register that lists already-done work is a cost on every future audit: this section was re-read and re-verified in this pass for nothing.

## Fix
**REMOVE the section** (or move it to a "Completed" area of the file if one is wanted), and tick or delete the three boxes. If any `localStorage` key the backend wrote is still being read by a migration path, say so in the web-app CHANGELOG instead of leaving the box open here.
No gate needed — docs only.

## Status
FIXED 2026-09-01 `45be904f` — section marked complete with the evidence.

