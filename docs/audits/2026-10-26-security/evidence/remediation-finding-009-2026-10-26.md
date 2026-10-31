# FINDING-009 execution evidence — 2026-10-26

The maintainer explicitly authorized deleting all superseded Pages deployments in
`xivdyetools` and `xivdyetools-beta`, plus the v4-ui-migration alias, keeping the
current production and beta deployments. Times below are UTC; all actions occurred
on October 26 in America/New_York (EDT).

## Inventory and protection

The complete [saved inventory](pages-prune-2026-10-26.inventory.json) was collected
at 2026-10-27 03:29:45 UTC, with all pages read before any deletion. It contained
762 globally unique deployment UUIDs, all in terminal success/failure states:

| Project | Initial total | Deleted | Protected deployment |
|---|---|---|---|
| xivdyetools | 522 | 521 | 970e253a-083a-4d97-bdb2-8e8e2792dee4 |
| xivdyetools-beta | 240 | 239 | 5a3fb28b-2091-47e7-a6b3-2495c5a52090 |

The totals included the two protected deployments. Exactly 760 records were
eligible. Eight superseded preview deployments had aliases, including
v4-ui-migration on deployment 1c989934-ee7c-425c-b02c-b28962246aa6; no eligible
deployment's aliases matched a live project domain.

## Guarded execution — 2026-10-27 03:33:08–03:43:05 UTC

An independent read-only verifier (gpt-6.1-sol, xhigh) confirmed the inventory,
protected IDs, alias scope and [executor template](pages-prune-2026-10-26.executor.js)
before execution. Its 31 mocked batches and nine rejection cases passed.

The coordinator substituted each batch's project and candidate rows from the saved
inventory into the template. Each batch re-read the project and required unchanged
canonical/latest protected IDs and domains. All candidate UUIDs were validated,
the protected ID excluded, and live-domain aliases rejected before any deletion.
The API force option was enabled only for preview records with aliases.

The v4 alias deployment was deleted first, then the remaining candidates in
sequential batches of at most 25. All 760 requests returned HTTP 200 / success true.
The [append-only receipt log](pages-prune-2026-10-26.deletions.jsonl) has 32 batch
records. No project, current deployment, DNS record or application code was changed.

## Verification

- [Fresh API reads](pages-prune-2026-10-26.live-after.json), at 03:43:40 UTC, show
  exactly one deployment per project: the original protected canonical/latest ID.
  Domain lists are unchanged. The former v4 deployment GET returns 404 / 8000009.
- [Public probes](pages-prune-2026-10-26.public-after.json) show all six live URLs
  return 200, with HTML SHA-256 and CSP identical to the [before record](pages-prune-2026-10-26.live-before.json):
  the production/beta custom domains, Pages domains and protected hash hosts.
- v4-ui-migration.xiv-colorexplorer.pages.dev, 66496174.xiv-colorexplorer.pages.dev,
  ecc7fb76.xivdyetools-beta.pages.dev and 1c989934.xiv-colorexplorer.pages.dev all
  return 404, with successful curl execution.
- The same independent verifier reconciled every receipt against the original
  eligible UUID set: exactly 521 + 239 successful, unique receipts, neither
  protected ID deleted, and all preservation/public-probe checks confirmed.

OPS-PAGES-HISTORY is complete. FINDING-009 remains PARTIAL because automatic
retention after future deployments and alias/hash-host probe integration are
scheduled in R-CI. No deploy, publish or workflow change was performed here.
