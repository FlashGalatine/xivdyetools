# A-PRESETS source-preparation evidence — 2026-10-27

Scope: nine primary findings in the merged remediation plan, stacked on A-API PR #341 at
`239cac2b3ef1e2b229815b8ecfec0f3d7a9b5cc8`. Prepare presets-api 2.7.0 MINOR,
Discord 5.9.5, moderation 1.8.4 and web 5.16.2 PATCH companions. These apps bundle workspace
source; no shared package version, dependency or schema change is selected. Private XIVAuth
correspondence remains outside Git. No main merge, package publication, live migration or
manual deployment is authorized by this evidence.

## Approved choices and activation boundary

The maintainer explicitly selected both recommendations: extend existing moderation to tags
and decoded example-link path text, with changed metadata consuming the text-edit quota;
retain preview-upload slots on decoding/processing failures and timeouts while refunding
cheap validation and confirmed storage/database failures. Narrow six-language privacy
alignment is included. Perspective-sunset Terms of Service/key-removal changes remain deferred.

FINDING-016 is **implemented but inactive**. Both Wrangler environments explicitly set
`PRESET_METADATA_MODERATION_ENABLED = "false"`; only exact `"true"` activates extra scorer
fields, tag/link-only charging/status transitions and link capture in new snapshots. Existing
name/description checks remain active. Both compatible review consumers must first have
verified **production** deployments, followed by a later activation-only API PR. A parallel
multi-app deployment or successful beta alone does not establish that ordering.

Derived link text excludes hostnames, credentials, queries and fragments; supplied links are
never fetched. Current/replaced link wire fields are additive. Explicit snapshot link values
remain validated/restored even after disabling the flag. Only genuinely missing legacy targets
depend on mode: disabled preserves current state; enabled clears the link and exposes an
effective null in privileged review views. Raw stored snapshot JSON remains the CAS token;
generic row parsing is unchanged. Historic snapshots are not retroactively scored.

## Baseline and local runtime evidence

Frozen installation leaves the lockfile unchanged. The scoped baseline graph passes 8/8 cached
tasks; fresh explicit coverage passes 1,018 tests across 40 files, S95.54/B91.43/F97.11/L96.33%.
API thresholds remain statements/functions/lines 85%, branches 80%. Node 22.21, pnpm 11.17,
Wrangler 4.152 and Vitest 5.0.5 are used. Installed Workers types 5.20261023.1 are compared with
the current 5.20261027.1 contract without upgrading dependencies.

The D1 harness uses the installed Wrangler `getPlatformProxy`, a D1-only temporary config,
`remoteBindings:false`, no env files and nonpersistent storage. It initializes the actual
schema's tables/indexes/triggers and seeds, and always closes/disposes temporary resources.
Local workerd proves SQL batch rollback, conditional-admission and race outcomes; it does
not prove production cross-colo scheduling. D1 executes a batch transactionally.
[D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/).

A pre-existing Windows Vitest fsModuleCache replay defect is reproduced on unchanged auth
tests: fresh cache passes, replay fails before assertions. Local invocations disable that
cache; native MSYS/loopback sandbox restrictions require identical elevated commands. No
startup failure or timeout counts as RED/mutation evidence, and no config/threshold is weakened.
Standard Linux CI remains separate acceptance evidence.

## Signed batch, active-ban guards and IPv6

`POST /api/v1/presets/batch` requires verified v2 bot authentication, a configured signing
secret and acting user, including development. Common auth/body/user limits remain; JWT,
anonymous and unsigned requests fail. Validate one to fifty raw IDs before deduplication,
then parameterize approved-only SQL and preserve unique request order. Public serialization
omits identity/revision/snapshot/raw-key fields. Missing IDs and request failures are distinct.
The logical read intentionally mounts outside mutation-ban middleware; banned accounts can
read while their writes remain blocked. This prepares A-DISCORD's later favorites adoption.

Approval and Revert SQL enforce active author bans using both stored identity columns while
retaining revision/status/raw-snapshot comparisons and atomic audit gating. IPv6 /64 grouping
is an explicit app adoption; service-binding IP exemption, user throttles and shared defaults
remain unchanged. Linked-identity discovery/FINDING-025 is not implemented here.

Task 1's focused suite passes 76/76; full API coverage then passes 1,087 tests in 43 files with
S95.81/B91.77/F97.20/L96.53%. Seven isolated mutants fail through assertions and exact source
restoration. Sol/xhigh ordinary and Astra/high security reviews pass; the minor body-limit
test refinement separately passes 35/35 and a scoped rereview.

## Submission admission, metadata, categories and response

Admission uses one conditional event `INSERT … SELECT … RETURNING id` before moderation.
Usage is current-window events plus same-user current-window preset rows without any retained
same-user/kind/preset event. The anti-join deliberately has no window filter. Denied requests
write no event and run no scorer/create/vote/notification; admission DB failure returns 503.
Preallocated IDs match reservation and creation. Known duplicate-to-vote conversions remain
free; post-moderation collisions/create failures retain the attempt. Reporting shares the same
formula/window. Age-only pruning remains best-effort without making admission fail open.

Effective primary/secondary categories are validated after merging stored state and the patch;
pagination is bounded to 10,000 before offset arithmetic, and creation returns the committed
auto-vote count. The other reservation kinds retain their existing fail-open backend policy;
this is not an unconditional ceiling for all work or ten guaranteed successful creations.

Task 2's initial RED establishes 36 behavioral failures after excluding six fixture defects;
final explicit coverage after
the rollout amendment passes 1,197/1,197 in 49 files, S96.77/B92.77/F97.33/L97.54%. Types,
lint/knip and root dead-code checks pass. Seventeen initial and 19 amendment mutations have
behavioral assertion proof and exact restoration; enabled-path mutations are repeated under
explicit true fixtures. Obsolete app-private post-create quota helpers are removed, with live
prune/order/failure tests retained. Sol/xhigh core review and Astra/high full amendment review
pass. No new public export or dead-code exemption is added.

## Review consumer compatibility and policy alignment

Discord preserves current, replaced and snapshot link metadata without inheriting current values
into a missing legacy field. Both apps use the same byte-run path decoding and visible escaping,
complete code-wrapped fields, query-only change explanations and effective Revert targets. Unsafe
or oversized required details withhold the corresponding action; Reject stays available. No
author-supplied URL is made clickable or fetched, and outgoing messages disable mentions.

Moderation refreshes and typed-ID confirmations use the same rendering. Approval/Revert compare
fresh revision/status and stable displayed fields; any known current or snapshot link requires a
current marker, including approval with otherwise missing current metadata. Only wholly unknown
legacy metadata retains the old compatibility path. An independently found missing-current/
known-snapshot edge is repaired with genuine RED and no-write/no-audit boundary tests.

Discord's final suite passes 1,712 tests in 73 files, S92.45/B84.87/F92.80/L93.24%, with types,
ESLint/knip and ten assertion-killed mutations. Moderation passes 802 in 31 files,
S93.29/B86.44/F94.73/L93.93%, with types/lint/knip. Mutation accounting is 18 original plus five
follow-up assertion kills and one independently blocked survivor. A footer-assumption TypeError
in the initial mutation test is corrected, retained as invalid historical evidence and excluded
from behavioral proof. Frozen manifests and source restoration are independently verified.
Sol/xhigh ordinary and Astra/high critical reviews approve both corrected consumers.

All twelve privacy variants disclose the optional extra text, excluded URL parts, no account IDs
attached to scorer requests, `doNotStore`, link snapshots, submission-attempt accounting and
preview failure/refund boundaries. Tag/link-only accounting and scorer delivery are expressly
conditional on enabled extended checks. Independent six-language wording checks and mechanical
policy parity pass; fixed historical dates and all Terms of Service text remain unchanged.

## Image lifecycle and final acceptance

Upload attachment compares current owner, captured key and captured preview status, inspects
affected rows and cleans only its own unreferenced new object on a known loss. Whole deletion
captures the actual removed key atomically and applies current owner/moderator authorization to
every dependent delete. Image-only deletion compares captured state before clearing/cleanup.
Real local D1 races cover both upload/delete orders, moderation and ownership rekey, including
preservation of every dependent table when a stale owner loses authorization.

Typed processing/storage failures implement the approved accounting boundary. A generic D1
transport exception cannot prove rollback: matching the unique new key confirms commitment;
changed/missing state only proves it is unreferenced now, possibly after commitment. Unknown
outcomes retain the slot and return the fixed retryable 503. Unreadable state retains a possibly
live object. Authoritative zero-row CAS refunds; confirmed committed attempts stay charged after
supersession. Cheap/proven storage refunds can permit additional decoding, and the existing
reservation backend policy remains fail-open. No unconditional decode ceiling is claimed.

Independent review finds and repairs a normal-success notification window during awaited old-key
cleanup. The final authoritative read occurs after cleanup, immediately before dispatch, for both
ordinary and reconciled commits. Only the still-current pending key notifies. An unreadable final
view skips notification without changing confirmed success or its charge. Twelve genuine RED
cases exercise actual moderation, nested replacement, both deletions and unreadable state during
that window. The remaining post-read delivery race is not eliminated by this check.

Final API explicit coverage passes **1,254/1,254 in 50 files**, S96.92/B92.77/F97.35/L97.67%, with
unchanged thresholds, types/lint/knip and root dead-code checks. Thirteen original and four
notification-guard mutations fail through behavioral assertions and restore exact hashes. All
At the Task 3 handoff, 20 nonoverlapping Task 2 paths retain their hashes; three owned handler/image-test overlaps are
documented, with existing assertions preserved. Ordinary Sol/xhigh and critical Astra/high
reviews approve the corrected source, evidence and release boundary.

D1, R2 and Discord do not form one transaction. Crashes, cleanup/refund failures, unreadable
outcomes or lost receipts can leave orphans or omit a notice. Minimum key/status CAS does not
invalidate null→image→null ABA. No image-generation migration or crash-proof garbage collection
is introduced, and no live referenced object is deliberately removed as uncertain cleanup.

## Final local gates

| Gate | Result |
|---|---|
| Frozen install | Pass; lockfile unchanged |
| `pnpm turbo run build type-check lint --concurrency=2` | 45/45 tasks; 33 cached |
| `pnpm turbo run test --concurrency=1 -- --fsModuleCache=false --pool=forks --maxWorkers=2` | 25/25 tasks, zero cached; 584 files / 16,879 tests in 17 workspaces; 9m26s |
| `pnpm test:scripts`, `pnpm type-check:scripts` | 167/167; types pass |
| `pnpm dead-code:check` | Pass; 622 production / 603 test files scanned |
| Version and link gates | 34 claims match; 1,043 relative links across 258 living documents resolve |
| Worker logging invariants | All seven configs keep Workers Logs off |
| Policy locale parity | Pass, zero problem groups |
| Web `build:check` | Pass; one-locale JS payload 2.17 MB / 2.20 MB |
| Discord bundle budget | Pass; 2,736.6 / 3,072 KiB gzip |
| Discord integration suite | 28/28 |
| Production Wrangler dry runs | Upload/gzip KiB: API 248.75/63.02; Discord 8,640.85/2,736.69; moderation 680.04/163.19; no deployment |

The initial parallel/thread test graph is not accepted as a pass: one unchanged moderation
dynamic-import test times out under contention, and a web timezone precondition fails because
the thread override does not apply its in-test timezone change. Focused normal-fork proofs
pass 30/30 web and 136/136 Discord, and isolated moderation passes 7/7. The complete serial fork
run above passes without source/config/assertion/timeout changes; internal D1 race barriers
remain active. Ordinary Sol/xhigh review accepts this runner correction. Standard Linux CI
remains independent acceptance evidence. Existing lint, Lit/Vite and Turbo missing-output
warnings remain nonblocking.

Final staging removes an EOF-only blank line from one new test. No assertion or production
code changes after the gates above; the final source inventory records that whitespace-only hash.

## Remote acceptance

Source commit `fa018bfa56503e5d2c63999e77c110f4420e1e9f` passes
[CI run 40565487013](https://github.com/FlashGalatine/xivdyetools/actions/runs/40565487013).
Secret scanning, lint, affected types/tests/builds, script types and 167 self-tests, dead-code,
documentation, bundle and logging checks pass. Affected tests are API 1,254/50 files,
Discord 1,712/73, moderation 802/31 and web 4,416/144. The separate Chromium job passes all
**167 Playwright tests**. Production-only dependency audit reports no known vulnerabilities;
the full-tree report-only audit retains five development-tool advisories (one high, three
moderate, one low), outside this sprint. Staged and 16-commit stacked-history Gitleaks scans pass.

[Discord beta run 40565416626](https://github.com/FlashGalatine/xivdyetools/actions/runs/40565416626)
passes tests and deploys version `45f2ee34-88cb-4399-9a70-a102cb4c8a8b`, at 2,736.69 KiB gzip.
The registration log confirms all **18 guild-scoped commands** registered. No public beta
health or live review-interaction test is claimed by that workflow.

[Web beta run 40565416619](https://github.com/FlashGalatine/xivdyetools/actions/runs/40565416619)
passes tests/build/bundle/beta checks and publishes the immutable
[d93a70b1 deployment](https://d93a70b1.xivdyetools-beta.pages.dev). Its smoke test confirms
`beta.xivdyetools.app` serves that deployment (SHA256 prefix `312a3290ad2f`), with noindex,
security headers and the reader license notice. The one-locale payload remains 2.17 MB/2.20 MB.

[Draft PR #342](https://github.com/FlashGalatine/xivdyetools/pull/342) is stacked on #341's
unchanged `239cac2b` base. The source-head inventory contains these three workflows and no
production deployment. This receipt follow-up changes this evidence and the living plan only.
Production acceptance and later metadata activation remain pending.

The existing feature-branch paths select **web and Discord beta** workflows for this diff.
No presets/moderation beta workflow is added, and beta receipts cannot close the production
activation gate. Root player-facing announcement changelog, locale JSON and fonts remain
unchanged. All twelve privacy variants move together; actual sunset policy edits remain deferred.

All nine primary IDs remain OPEN pending release/production acceptance; FINDING-016 additionally
requires later activation. Audit accounting stays 133 IDs: 7 fixed, 101 outstanding (including one
partial and one eligibility-blocked), 23 KEEP and 2 superseded. Preparation never increments fixed
counts.
