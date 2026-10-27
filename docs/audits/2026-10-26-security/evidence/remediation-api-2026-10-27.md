# A-API source-preparation evidence — 2026-10-27

Scope: the seven primary A-API findings in the merged remediation plan, stacked on
A-BOT-LOGIC PR #340 at `3e2213600de7f270091d4f523be1fdd5681582ad`. Prepare private API
worker 0.21.1. No merge, package publication, manual deployment or API beta is selected.
The deleted API dev worker remains retired. Private XIVAuth correspondence is outside Git.

## Baseline and platform contract

Frozen installation changes no lockfile. The API/dependents baseline gate passes 11/11
tasks, cached; a fresh API run passes 840 tests across 42 files. Coverage is not enabled
by ordinary API `test`, so these baseline counts are not coverage measurements. Final
source groups use `test:coverage` explicitly with unchanged thresholds: statements,
functions and lines 90%, branches 80%. The hermetic workerd ownership harness passes 2/2.
Initial MSYS/DNS/loopback restrictions are resolved by identical elevated commands, with
no source or test weakening.

Registry reads return core 5.15.0, worker-kit 1.5.0 and SVG 4.4.0; the inherited source
stack prepares 5.16.0 / 1.6.0 / 4.4.1. Workspace apps bundle local source independently of
npm publication. Latest Workers types 5.20261027.1 are retrieved into ignored evidence,
without changing installed dependencies, and agree with the installed RateLimit interface.
Wrangler's installed schema and generated production types validate the binding shapes.

Cloudflare documentation confirms account-wide namespace identity and approximate
per-location counters, with 10/60-second periods. The new declaration uses public
1061/1062 and service 1063/1064 (production/development). GET-only inventory/settings
reads of all 14 deployed workers succeed and find those IDs unused on 2026-10-27. No
live setting is changed or namespace reserved by this check. Recheck allocation before
deployment if other account projects change it.
[Rate-limiting semantics](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

## IPv6, telemetry and internal export group

Existing API, no-client-IP classification, telemetry and Universalis extractors opt into
worker-kit 1.6.0's `/64` normalization. Native/KV application tests prove same-/64 sharing,
different-/64 separation, mapped/dotted IPv4 identity, trusted-header precedence and the
fixed service scope. Worker-kit defaults, existing budgets and failure policies are unchanged.
The classification-only call still compares the same `unknown` sentinel, so reverting its
option alone is equivalent; the three functional extractors have independent mutation proof.

FINDING-038 stores only the literal numeric version triple in blob8, with 1–4 ASCII digits
per component and a fully validated optional prerelease suffix that is discarded. Invalid
inputs map to `invalid`; no partial numeric clamp, suffix text, trailing whitespace or
layout change is accepted. Tests cover all five event schemas. DEAD-019 removes only the
private CharaTwinRules re-export, retaining the import and local field type.

Original-source RED produces 19 assertion failures. Intended focused tests pass 106/106;
full explicit coverage passes 884/884 across 42 files (S95.27%, B92.36%, F94.94%, L95.94%).
Types and lint/knip pass, with nine existing warnings. Five isolated mutants fail through
4/4/2/4/11 assertions and restore exact hashes. A failed default-encoding edit of one owned
test is recovered from its byte-exact baseline Git blob; fresh gates and independent
diff review confirm no accidental test deletion or encoding drift. Sol/xhigh specification
and quality review approves the eight paths.

## Chara upstream boundary group

FINDING-002 streams search/Glasses responses through the existing byte-budget reader,
with 2 MiB / 32 KiB caps before parsing. Oversize, invalid JSON syntax and stream-read failures
become uncached 503s. The request 8 KiB, metadata 32 KiB and PNG 1 MiB limits remain.
One pure Node-compatible cleaner strips C0/C1, soft hyphen and explicit bidi controls,
normalizes whitespace and caps at 128 code points. Upstream and runtime regional lookups
share it; row shape 6 excludes existing unsanitized Item/Glasses entries. Historical regional
JSON remains intact, including the known raw Korean RLM entries, and independent font
readers retain their existing treatment. DEAD-018 removes the redundant 503 disjunct while
preserving >=500/429 handling. Coupled cache/context/cast comments are corrected.

FINDING-005 adds distinct native/KV Chara soft budgets: public 30/minute and service
600/minute in production, 60/1200 in local development. They use isolated namespaces and
`chara:ip:` / `chara:svc:` prefixes. Actual owned Item search batches, Glasses calls and icon
fetches/revalidations each cost one; a cold combined resolve costs two. Cached/negative
entries and existing Item/Glasses waiters cost zero. Independent icon misses each pay for
their actual fetch. Metadata discovery remains bounded/memoized outside this data budget.

Explicit denial prevents that upstream operation. Runtime backend exceptions retain the
documented public-read fail-open policy; malformed configured bindings fail configuration
validation. These are soft limits, not guaranteed protection during outages or worldwide
quotas. A shared quota failure carries typed data, with every owner/waiter formatting its
own request ID/locale, 429, retry/budget headers and no-store. An app-local wrapper preserves
downstream quota headers after the general limiter runs, while retaining general admission
and success semantics. Its two paths transfer from the completed first writer before edits.

Explicit icon keys must equal the configured canonical game pin or captured current
discovered key, including last-known-good refresh fallback. A game pin alone needs no schema
discovery. Mismatch is 400 before icon cache/asset access; unavailable authority is 503 for
an explicit key. Unversioned uncached bootstrap fallback, ignored query noise and successful
300-second / 30-day browser policies are preserved. No new icon coalescer is introduced.

The initial full group passes 948 tests in 45 files with enforced coverage (S96.15%,
B92.85%, F95.45%, L96.77%), source/docs types, lint/knip, docs build, generated binding types
and unchanged 2/2 workerd cases. Production `.mjs` is included in coverage and its helper
has 100% coverage. App-local `allowJs` supplies the ESLint project service; adjacent
declarations are checked, but this does not claim TypeScript checks the JS implementation.
One additional TypeScript-style return-type warning remains on its JSDoc-typed JS function;
the other nine lint warnings predate this change.

Most group regressions were added after implementation, with isolated guard/old-operation
mutants proving failures; only cleaner and header cases have pre-fix RED records. This
ordering is disclosed. Independent review finds one mutation-evidence defect: a byte-counting
mutant times out on an unclosed stream before reaching finite multibyte assertions. The
repair separates finite exact/cap-plus-one/UTF-8 tests from open-stream cancellation. Three
rerun cap/byte mutants produce 2/2/4 relevant assertion failures without timeouts, restoring
source hashes; the other 25 proofs remain. The corrected covering run passes 124/124 and
types pass. No timeout is counted as finite byte-versus-character proof.

A proposed trailing-newline defect is refuted by native probes, ten actual-route 400
controls and the non-multiline [ECMAScript assertion rules](https://tc39.es/ecma262/2024/multipage/text-processing.html#sec-runtime-semantics-compileassertion).
Original production icon validators remain unchanged; the initial contrary test result was a
memoized-middleware spy fixture error, which is corrected. Sol/xhigh and Astra/high scoped
rereviews approve the repaired evidence and retain their production approvals.

Final review also narrows the new 503 wording to byte limits, invalid JSON syntax and failed
body reads. Pre-existing decoded-shape errors (such as JSON `null`) can still produce 500;
this slice neither claims complete response-shape validation nor changes that behavior.

## Future builder provenance and historical boundary

The future builder resolves Teamcraft staging and datamining master once per run to
validated lowercase 40-hex commits. Regional and CSV data use immutable URLs; a local
datamining clone supplies pinned Git blobs through direct read-only argument arrays, with
an explicit 128 MiB capture bound. Dirty working-tree bytes are never attributed to HEAD.
Each affected language records source repository, relative blob path, commit and SHA256
of the exact raw bytes. Local provenance omits personal paths and remote credentials.

Fatal UTF-8 decoding, record/CSV validation, shared name cleaning and serialization finish
for every selected language before any output write. Untouched language tables retain byte
identity and their metadata values; legacy shared metadata is preserved. This provides
acquisition/validation atomicity, not a filesystem transaction if an output write fails.

Actual-CLI offline tests run byte-identical source/helper copies with rejecting fetch/Git
fixtures. The original builder fails 21 assertions (five passes); the prepared builder
passes all 26 cases. All eight isolated provenance/content/early-write mutants fail through
assertions, with exact source restoration. A fresh full API coverage run passes 990 tests
in 46 files (S96.15%, B92.85%, F95.45%, L96.77%); types and lint/knip pass. Worker-source
percentages do not measure the subprocess builder: emitted-output assertions and mutation
checks provide that evidence. Tests run on Node 22; Node 18 itself is not exercised, and
local Git is a command mock. Historical JSON/meta have no diff against the sprint base.

FINDING-029 remains OPEN: future-builder remediation is prepared in this slice, while
historical source provenance is unresolved pending a controlled data/font refresh. Runtime
sanitation does not authenticate old data or independent build-time readers. An unknown
August staging SHA is not invented or retrofitted into retained metadata.

## Final gates, review and remote acceptance

Independent Sol/xhigh and Astra/high reviews approve the three implementation groups and
the whole branch, including Task 2's repaired mutation evidence, Task 3's historical boundary
and API 0.21.1 PATCH release scope. Review preserves the analytics spec body, updating only its Status link to the living
contract. No private correspondence, historical game data, fonts, shared package sources,
lockfile, workflow or root player-facing changelog is changed.

| Final local gate | Result |
|---|---|
| `pnpm turbo run build type-check lint test --concurrency=2` | 62/62 tasks, 42 cached, 17 packages; 2m46s |
| `pnpm test:scripts` | 167/167 |
| `pnpm type-check:scripts`, `pnpm dead-code:check` | Pass |
| `pnpm docs:check-versions` | 34 claims match |
| `pnpm docs:check-links` | 1,043 links across 258 documents resolve after final Status-link refresh |
| `pnpm workers:check-logs` | All seven configs keep Workers Logs off |
| API `pnpm test:coverage` | 990/990 in 46 files; S96.15%, B92.85%, F95.45%, L96.77% |
| API `pnpm test:chara-runtime` | Unchanged workerd ownership cases, 2/2 |
| API production Wrangler dry run | 5,243.82 KiB upload / 717.04 KiB gzip; 54 assets; new bindings resolved |

API lint has zero errors and ten warnings (nine pre-existing, one JSDoc `.mjs` return-type
style warning). Turbo missing-output warnings and existing Vite/rolldown build/test warnings
remain nonblocking. Sandbox MSYS failures are rerun identically with elevation, without
weakening source or checks. No deployment command runs without `--dry-run`.

API-only source/docs paths select the production API workflow on a future main merge.
Existing feature-branch beta filters do not select these paths; no beta workflow is added.
Source preparation, dry-run validation, CI and production acceptance remain separate.
Feature PR and actual remote CI receipts are pending.

The audit count stays 133 IDs: 7 fixed, 101 outstanding (including one partial and one
eligibility-blocked), 23 KEEP and 2 superseded. Source preparation does not increase fixed
counts. Merge, registry publication where applicable and production acceptance are pending.
