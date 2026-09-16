# Dead-code audit — xivdyetools (2026-09-15)

- **Snapshot:** `main@0332fcc5768a4477301ed5b15590eee16a772f87`; all 17 workspaces plus root scripts/configuration.
- **Depth:** standard — direct Knip, unused-local/parameter checks, custom reachability gate, syntax/member survey, targeted manual path/type/asset/CSS/i18n review and independent verification.
- **Totals:** **21 catalog entries: 17 cleanup candidates and 4 KEEP decisions.** All are HIGH-confidence classifications; a KEEP classification does not assert safe removal.
- **Removal scope:** **197 source declaration/body lines and 527 dedicated test-block lines**, across 16 source and 9 test files. These include a conditional cascade and two type refactors. No whole-file deletion is proposed. Comments, whitespace, import cleanup, and adjusted fixture lines are excluded from these measured totals.
- **Audit changes:** documentation/evidence only. No tracked application source, dependencies or configuration changed. Local build/test outputs were refreshed. No deployment, database operation, commit or push.
- **Sprint 0:** no urgent dead-code change. Existing security priorities remain first; see the [coordinated cleanup plan](CLEANUP_PLAN.md).

## Catalog

| ID | Title | Conf | Blast | Semver | Deploy unit | Rec |
|---|---|---|---|---|---|---|
| [DEAD-001](findings/DEAD-001.md) | IndexedDBService.getWithContext and GetResult — 36 source lines | HIGH | LOW | NONE | web-app | REMOVE |
| [DEAD-002](findings/DEAD-002.md) | SavedPresetsService.isSaved — 4 source lines | HIGH | LOW | NONE | web-app | REMOVE |
| [DEAD-003](findings/DEAD-003.md) | ShareService.getBaseUrl — 7 source lines | HIGH | LOW | NONE | web-app | REMOVE |
| [DEAD-004](findings/DEAD-004.md) | ThemeService.getRequiredColor — 15 source lines | HIGH | LOW | NONE | web-app | REMOVE |
| [DEAD-005](findings/DEAD-005.md) | BaseComponent.setStyle — 7 source lines | HIGH | LOW | NONE | web-app | REMOVE |
| [DEAD-006](findings/DEAD-006.md) | EmptyState.setOptions — 4 source + 39 test lines | HIGH | LOW | NONE | web-app | REMOVE |
| [DEAD-007](findings/DEAD-007.md) | OfflineBanner subscription and refresh helpers — 18 source + 44 test lines | HIGH | LOW | NONE | web-app | REMOVE |
| [DEAD-008](findings/DEAD-008.md) | getPreference single-key reader — 11 source + 23 test lines | HIGH | LOW | NONE | discord-worker | REMOVE |
| [DEAD-009](findings/DEAD-009.md) | Unbatched preset-status wrappers — 8 source + 77 test lines | HIGH | LOW | NONE | moderation-worker | REMOVE WITH CAUTION |
| [DEAD-010](findings/DEAD-010.md) | Unused fetch logging wrappers — 29 source + 124 test lines | HIGH | LOW | NONE | moderation-worker | REMOVE |
| [DEAD-011](findings/DEAD-011.md) | Header helper cascade — 36 source + 139 test lines | HIGH | LOW | NONE | moderation-worker | REMOVE WITH CAUTION |
| [DEAD-012](findings/DEAD-012.md) | Translator.getMeta — 3 source + 25 test lines | HIGH | LOW | NONE | moderation-worker | REMOVE |
| [DEAD-013](findings/DEAD-013.md) | truncateUnicodeSafe — 9 source + 38 test lines | HIGH | LOW | NONE | presets-api | REMOVE |
| [DEAD-014](findings/DEAD-014.md) | duplicateResponse — 3 source + 9 test lines | HIGH | LOW | NONE | presets-api | REMOVE |
| [DEAD-015](findings/DEAD-015.md) | VoteRow orphan type — 5 source + 9 test lines | HIGH | NONE | NONE | presets-api | REMOVE |
| [DEAD-016](findings/DEAD-016.md) | CacheConfigKey belongs to its test — 1 source line | HIGH | NONE | NONE | api-worker | REFACTOR FIRST |
| [DEAD-017](findings/DEAD-017.md) | Inert image-worker environment member — 1 source line | HIGH | NONE | NONE | image-worker | REFACTOR FIRST |
| [DEAD-018](findings/DEAD-018.md) | Core APIs without local callers — 28 source lines retained | HIGH | HIGH | MAJOR | core | KEEP |
| [DEAD-019](findings/DEAD-019.md) | Parked Stoat feature scaffolding retained | HIGH | LOW | NONE | stoat-worker | KEEP |
| [DEAD-020](findings/DEAD-020.md) | Reachable rate-limit fallback paths retained | HIGH | HIGH | NONE | api-worker / discord-worker / moderation-worker / oauth | KEEP |
| [DEAD-021](findings/DEAD-021.md) | InteractionResponseBody assertion contract retained | HIGH | LOW | NONE | discord-worker | KEEP |

## Quick wins

1. **DEAD-001–007:** seven web-app findings, eight methods, 91 source lines and 83 test lines. Five methods have no test caller either; three additional methods are only exercised by their own tests.
2. **DEAD-008:** unused single-preference reader, 11 source + 23 test lines.
3. **DEAD-010, DEAD-012–015:** small unused wrappers/accessors/types with bounded tests. Preserve surrounding live behavior.

**DEAD-009** requires care around retained batched moderation tests. **DEAD-011** follows DEAD-010 in a later gated step. **DEAD-016–017** are low-benefit type hygiene; they have no runtime bundle saving.

## KEEP register

| ID | Item | Reason | Revisit trigger |
|---|---|---|---|
| [DEAD-018](findings/DEAD-018.md) | Core APIs without local callers — 28 source lines retained | getSharedColors, getRaceSpecificColors, both getAvailableLocales methods and hexToRyb/rybToHex remain documented/exported API. Repository-only absence cannot establish absence of npm consumers. | Next independently justified core major, after publication and external-consumer review. |
| [DEAD-019](findings/DEAD-019.md) | Parked Stoat feature scaffolding retained | parseMultiDyeArgs, withLoadingIndicator and DYE_INFO_REACTIONS have only test callers; the app documents deferred command/reaction features and remains parked. Its live imports into bot-logic still count. | Stoat is explicitly resumed or retired. |
| [DEAD-020](findings/DEAD-020.md) | Reachable rate-limit fallback paths retained | Native binding selectors still route to KV/memory when bindings are absent. Development/test and degradation contracts are concrete consumers; elapsed calendar time does not satisfy the old production-evidence gate. | Fallback retirement is designed, local/test replacements exist, and the prior operational evidence gate is satisfied. |
| [DEAD-021](findings/DEAD-021.md) | InteractionResponseBody assertion contract retained | The interface is imported by 12 tracked test files to type real handler responses. It has a concrete test-support role and erases from the runtime bundle. | A scoped Discord test-support module reorganization is approved. |

Other retained controls: published package subpaths and deliberate `@public` surfaces; test reset/observation hooks; live OAuth/presets deprecated re-exports. Their existence is not a removal finding. Public package Semver=MAJOR is the conservative constraint for already-published API; the current registry version/external consumer set was not queried at standard depth.

## Evidence and baseline

| Check | Result |
|---|---|
| Root Knip, run directly | Exit 1: exactly the 3 documented root/local differences — two web-app declaration files and its kept wrangler devDependency |
| Web-app Knip; OG normal and production Knip | All exit 0, no findings |
| Custom dead-code gate | Exit 0; 550 production / 482 test files, 34 test-only, 4 entrypoint and 7 public exemptions |
| `tsc --noEmit --noUnusedLocals --noUnusedParameters` | All 17 units pass after refreshing stale dependency outputs; initial 4 failing units and final reruns preserved |
| Web locale orphan analyzer | 1,128 / 1,128 keys used; zero reported orphans |
| Bot locale tests | 72 tests, 4 files passed, including orphan/parity checks |
| `pnpm turbo run type-check lint test --continue --concurrency=2` | Exit 0; **59/59 tasks**, 16 cache hits; dependency builds included. This is not a claim that all tests reran uncached |
| Root script type-check and tests | Exit 0; 107 script tests passed |
| Documentation link/version checks | Both exit 0 |
| Worker bundle baselines | All 7 `wrangler deploy --dry-run` commands exit 0; no deployment performed |
| Supplementary syntax survey | 1064 tracked TS/JS files; 2099 export declarations and 894 public members inventoried; candidates individually triaged |

Exact commands, statuses and tool logs: [initial collection](evidence/collection-results.json), [final collection](evidence/collection-final-results.json), [verification](evidence/verification.md). The initial bootstrap failure directory records sandbox failures and the discarded helper invocation with dropped arguments; neither is interpreted as code evidence. The corrected runner records full argument lists.

### Bundle before (KiB)

Default configured environment, locally bundled; API-worker excludes production-only Static Assets. Sizes are per-worker baselines, not production-state verification.

| Worker | Raw | Gzip |
|---|---:|---:|
| api-worker | 3854.87 | 577.39 |
| discord-worker | 7448.58 | 2282.85 |
| image-worker | 1666.45 | 645.50 |
| moderation-worker | 220.64 | 51.50 |
| oauth | 159.27 | 41.19 |
| og-worker | 6393.90 | 1944.43 |
| presets-api | 215.94 | 53.48 |

No bundle reduction is claimed: type erasure and tree shaking can make the runtime saving much smaller than source-line removal. Measure the same environment after cleanup.

## Dependency cleanup

No removable dependency was confirmed. `wrangler` in web-app pins the deployment tool; `.d.ts` files serve JavaScript imports. VitePress/Vue, ambient types, build CLIs, font tooling and test tooling have configuration or operational consumers. No ts-prune/depcheck or new installation was used.

## Positive controls

- Knip is gated in 16/17 units; parked Stoat is the documented exception. The root cross-check remains at its documented three findings.
- Public library APIs are evaluated with package export maps and all monorepo consumers, including Stoat and test-utils integration.
- API docs helpers are used by `.vue` components; Pages middleware and Lit registrations are convention/side-effect entrypoints.
- Tool CSS is loaded both in the shell shadow root and page scope; modal mount paths remain live. No CSS or asset deletion is proposed.
- Static root OG cards, beta icon generation inputs, and source font files remain operationally used. OG extractor/presets/budget generators have live route dispatch.
- Test isolation/readback hooks observe real state or clean up timers/singletons; they are distinct from tests that exercise otherwise unused public behavior.
- Retired package/app directories are absent from the tracked tree. Remaining old package names in source are commentary, not active imports. Active deprecation integrations require their own retirement gates.

## Rejected suspicions and corrections

- Package exports used only outside their own package, published subpaths, and methods called within their own file are live; zero external-file references alone are insufficient.
- `ModalService.dismissAll` and `ToastService.dismissAll` clear real singleton state/timers between tests and stay. Conversely, `EmptyState.setOptions` and the two OfflineBanner methods are not reset/observation hooks; follow-up verification reclassified them as cleanup candidates.
- Coalescer observation methods, locale/registry assertions, mock factories and cache reset hooks are purposeful test support.
- `sanitizeHeaders` has real source callers until the fetch wrappers are removed; it is a separately sequenced cascade.
- Reviewer-estimated test ranges were corrected with TypeScript AST measurement. In particular, header tests end at line 292: the live error-message tests starting at 294 must survive. The measured spans, not preliminary reviewer ranges, govern cleanup.
- No newly confirmed dead CSS, assets, skipped executable tests or runtime-unreachable routes were found in the bounded sweeps. This is not a proof of whole-repository absence.

## Recommendations

1. Extend the reachability gate's member survey to zero-test-reference methods and test-only types; use TypeScript syntax for declarations and comment-free evidence.
2. Periodically review `@testonly` reasons: retain genuine reset/observation support and retire unshipped APIs tested only for their own sake.
3. Keep direct root Knip in audit/CI cross-checks; cross-workspace consumer changes can evade a cached unit lint result.
4. Preserve explicit handling for published API, computed calls, custom-element registration, Vue templates and package subpaths.
5. Recount coverage after deleting covered dead code; percentage denominators change. Preserve the web-app coverage ratchet and meaningful surrounding behavior tests.
6. Re-grep before every edit; another session shares this checkout. Measure dependency/bundle effects only after each triggering removal passes.

## Coverage and limits

The tracked syntax inventory spans all 17 units and root scripts. Manual review was candidate-driven, with explicit per-unit limits in [web-app](evidence/review-web-app.md), [packages](evidence/review-packages.md), [worker candidates](evidence/review-worker-candidates.md) and [other workers](evidence/review-other-workers.md). Numeric-name matching can still collide; arbitrary reflective/computed access and external consumers cannot be proven absent by a static survey. Dynamic locale prefixes were checked at a bounded family level, not exhaustively enumerated beyond the existing analyzers. No browser/E2E run, live traffic/log inspection, external consumer audit, full git archaeology or production deployment parity check was performed. The syntax helper excludes Vue templates, which were checked separately for the relevant docs candidates.

## Remediation status

| ID | Status | Commit |
|---|---|---|
| DEAD-001 | DONE | `2d1695af` |
| DEAD-002 | DONE | `2d1695af` |
| DEAD-003 | DONE | `2d1695af` |
| DEAD-004 | DONE | `2d1695af` |
| DEAD-005 | DONE | `2d1695af` |
| DEAD-006 | DONE | `2d1695af` |
| DEAD-007 | DONE | `2d1695af` |
| DEAD-008 | DONE | `4f4e5c13` |
| DEAD-009 | DONE | `c6aa8c73` |
| DEAD-010 | DONE | `c6aa8c73` |
| DEAD-011 | DONE | `225df738` |
| DEAD-012 | DONE | `c6aa8c73` |
| DEAD-013 | DONE | `8f7b292b` |
| DEAD-014 | DONE | `8f7b292b` |
| DEAD-015 | DONE | `8f7b292b` |
| DEAD-016 | DONE | `6fce09cf` |
| DEAD-017 | DONE | `f9b469af` |
| DEAD-018 | KEEP | — |
| DEAD-019 | KEEP | — |
| DEAD-020 | KEEP | — |
| DEAD-021 | KEEP | — |

## Next steps

Use [CLEANUP_PLAN.md](CLEANUP_PLAN.md) after authorizing implementation. It coordinates this catalog with the current security priorities and records historical backlog status limitations. No removal has begun.
