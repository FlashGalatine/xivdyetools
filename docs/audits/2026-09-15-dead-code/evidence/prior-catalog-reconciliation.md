# Prior catalog reconciliation

Status basis: the deep-dive report's status table still broadly says OPEN, so this uses completed/partial sprint annotations in its remediation plan. It does not reclassify the historical catalog's other rows.

| Source | Explicitly outstanding item | Unit / action | Status certainty |
|---|---|---|---|
| 2026-09-02 deep-dive Sprint 18 | `webapp-v4-16` | web-app: add result-card context-menu/ΔE/tier/external-link suite | Explicitly remaining; test addition, not a repair. |
| 2026-09-02 deep-dive Sprint 18 | `webapp-v4-17` | web-app: create preset-tool and preset-detail suite for the 67 KB stateful surface | Explicitly remaining; test addition. |
| 2026-09-02 deep-dive Sprint 18 | `webapp-v4-18` | web-app: test overlapping deferred `loadToolContent` imports | Explicitly remaining; test addition. |
| 2026-09-02 deep-dive Sprint 19 | `REFACTOR-001` remainder | moderation-worker/discord-worker: response builders and REST helpers need a new Discord-specific shared package | Locale half is fixed (`1b67aadd`); remainder is blocked on maintainer decision and must follow current security work. |
| 2026-09-15 security | FINDING-001 | auth: bounded Discord body reader, then both bot consumer rollouts | OPEN; P0. |
| 2026-09-15 security | FINDING-002 | presets-api + discord-worker action producer: revision-bound preview approval | OPEN; P0. |
| 2026-09-15 security | FINDING-003 | discord-worker: bounded pre-HMAC GitHub webhook reader | OPEN; P0. |
| 2026-09-15 security | FINDING-004, FINDING-005 | presets-api: revision-conditioned owner edit and moderator revert | OPEN; P1. |
| 2026-09-15 security | FINDING-006 | og-worker: remove raw UA/full-URL/derived-title logging | OPEN; P2. |

## Dead-code interaction

No current removal conflicts with an open security fix. The moderation dead-code candidates `hideUserPresets`/`restoreUserPresets` are unaudited wrappers; deleting them complements FINDING-005 only if the batched statement-plus-audit-log path remains intact. `sanitizeHeaders` removal must retain `sanitizeUrl`/`sanitizeErrorMessage`; it does not remove a current security sink. `duplicateResponse`, `truncateUnicodeSafe`, `VoteRow`, `getPreference`, `Translator.getMeta`, API `CacheConfigKey`, and image `Env.ENVIRONMENT` do not overlap listed security work.

The current security plan correctly orders its fixes before the unfinished REFACTOR-001 response/REST convergence. The three web-app test rows have no removal conflict. Uncertainty: Sprint 3 says OPT-005/OPT-009 were deliberately not done, but the plan's execution notes do not give them a current standalone assignment; leave them in the deep-dive record rather than schedule them here.
