# Implementation verification — XIVAPI worker

**Source baseline:** 0cf9d00c79f4d669fc76e72a0d39ecd46e071f69.

**Reviewed implementation head:** d1d46ad5222b6967f3e7196137226b368e494b03.

**Verified fix head:** c1ddc96825e23f99423a1f3c2b1a1f19e09e8cde.

**Method:** Native implementation and test-first regressions, then actual unit/graph/runtime gates. This is not a production load or p95 latency measurement.

## Gates

| Command | Result |
|---|---|
| pnpm --filter xivdyetools-api-worker run test | 42 files / 840 tests passed after the review fix |
| pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker | 11/11 tasks passed |
| pnpm --filter xivdyetools-api-worker run test:chara-runtime | 2/2 real local workerd ownership checks passed |
| pnpm turbo run build type-check lint test --concurrency=1 | 62/62 tasks passed; original run 54 cached / 8 executed; final post-fix run 62 cached after affected tasks reran successfully |
| pnpm type-check:scripts | Passed |
| pnpm test:scripts | Passed |
| pnpm dead-code:check | Passed; new loader/CLI test script connected |
| pnpm docs:check-versions | Passed; 34 claims |
| pnpm docs:check-links | Passed; 1,019 relative links in 257 living docs |
| Dated-archive relative-link check | Passed; 11 links resolve to tracked files |
| pnpm workers:check-logs | Passed; seven worker configs |
| git diff --cached --check | Passed |
| gitleaks git --staged --no-banner --redact | Clean; Task 4 about 33.9 KB; final handoff 13.70 KB |
| gitleaks git --no-banner --redact --log-opts=origin/main..HEAD | Six outgoing implementation commits clean through c1ddc968; 137.72 KB scanned |

Normal API-worker tests use mocked HTTP and a real cache adapter over the test Cache API. The runtime checks spawn the installed local Wrangler/workerd with a fixture-only upstream, validate outgoing pins, disconnect the first client and require the waiter to finish as a MISS with one Item and one Glasses call. The moving-selector case also requires exactly one discovery probe. They check runtime error output and clean up only their own process tree/state. Windows state-file release uses bounded filesystem cleanup retries.

The initial no-coalescing adapter failed the actual one-call/overlap/cap assertions; the registry passed all 19 loader tests. Tests cover overlapping families, independent context/operation keys, shared nulls, failed owners/retries, truncation, saturation and exact-entry cleanup after an overflow owner completes.

Task 1 tests first failed for the missing context API. Additional red regressions caught coercible non-string identity fields and discovery that changed an explicit canonical pin; strict validation made them green. Icon route regressions first failed for missing version/header behavior; conditional refresh first failed for missing If-None-Match/304 reuse.

Final review exposed a partial bootstrap identity bug. The new route regressions omit real identity fields rather than using the default-injecting fixture helper, force discovery failure, and exercise both conflict directions and successful missing-metadata responses without persistence. Before the fix, three schema-conflict cases incorrectly returned 200 and two compatible missing-schema cases incorrectly returned 503. After comparing known version/schema coordinates independently, all seven cases and 840/840 worker tests passed. The 11-task affected gate, 62-task serial graph and two real workerd scenarios also passed after this fix.

## Unrelated graph timeout

Two concurrency-2 graph runs failed only the unchanged moderation-worker test:
src/env-validation-gate.test.ts > FINDING-013: production refuses requests while a rate-limit binding is missing > answers a command interaction with 500 Service misconfigured when RL_COMMAND is missing.

Both exceeded its existing 5000-ms timeout. Exact-file isolation passed 7/7; the complete moderation suite passed 31 files / 757 tests; the identical graph passed 62/62 when package tasks were serialized. Resource contention is consistent with these observations; no root-cause claim about the unrelated test is asserted, and no timeout/assertion/source change was made.

## Docs and source preservation

The built API docs reference/chara.html was parsed: exactly one optional icon-version input exists, and the browser policy, 304/seven-day refresh and 256-key coalescing copy is rendered. The worker's technical changelog and both central version tables carry 0.21.0.

The only Wrangler diff updates explanatory comments. No app binding or production variable changed. Git comparison against baseline confirms no changes under packages/, canonical character/acquisition datasets, pnpm-lock.yaml or pnpm-workspace.yaml.

## Scanner provenance

- Tool: Gitleaks 8.30.1, official Windows x64 archive.
- [Official checksum file](https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_checksums.txt).
- Archive SHA-256: d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e.
- The existing archive was hashed against the newly fetched official checksum before extracting a plan-local scanner copy. No global installation or package dependency was added.
- The implementation scan through c1ddc968 passed for all six outgoing commits. The handoff documents are scanned staged before their commit; the complete outgoing range is scanned again before push and recorded in the PR validation.

Full execution logs lived in the plan's ignored skill workspace. This durable summary records the commands, outcomes and limitations; the temporary workspace is removed only after final review and commits.
