# Local release prerequisites — 2026-10-29

**Scope: local source and release-handoff preparation. Production activation remains held.**
Base is [PR #363](https://github.com/FlashGalatine/xivdyetools/pull/363) at
`d132dc5e554473c67e5b7c5cc5e2e2846ad740ab`. The user authorized remaining prerequisites
that can be completed while Cloudflare's reply is pending. No production merge, deployment,
npm publication, remote migration, new hosted test or activation is part of this work.

## OAuth continuity availability prerequisite

The source review found the release contract's remaining local gate: direct waits on continuity
lookup, apply and acknowledgements. Global request-triggered acknowledgement cleanup could
therefore delay an unrelated login even with splitting off after a binding was added.

Only remote promises receive application deadlines. Lookup and apply share five seconds;
terminal acknowledgement has one second. Cleanup attempts at most eight acknowledgements
concurrently under one shared second, isolates malformed rows and rotates candidates with a
best-effort cursor for that isolate/D1 handle. Retention deletion selects at most eight eligible
terminal records. The cursor is scheduling state, not authority; it resets with the handle and
does not establish eventual cleanup across isolates or restarts.

An unknown timeout leaves the original operation, payload hash, revision quarantine and locks
in place. A later login retries that same operation rather than assuming refusal or creating
another identity. Late replies cannot resume local identity writes, acknowledgement recording
or session issuance. Confirmed applied/refused transactions survive an acknowledgement timeout.
Remote effects can still finish after a timeout; this is not cancellation or cross-database
atomicity. D1 and platform execution remain outside these remote-wait budgets, so no total
login-latency guarantee is claimed.

The actual HTTP handlers await identity resolution before JWT creation and response creation.
Local Workerd checks use a synthetic caller of the real `findOrCreateUser` and
`createJWTForUser` functions with local D1 and a separate synthetic service worker. They are
not an upstream OAuth login or a deployed-provider acceptance check.

This folds into pending OAuth **3.2.0**. Both `IDENTITY_SPLIT_ENABLED` flags stay false;
no outbound continuity binding, schema, protocol, claim, policy or secret changes are introduced.

### Focused verification and review

The initial seven cases fail ordinary behavioral assertions before the source change, without
using a test-runner timeout as the failure. A separate cursor control also fails before rotation
is added. Later edge cases are added after implementation and verified by applicable mutations;
they are not retroactively called red-first. Final deterministic coverage passes **18/18**.
Seven mutations fail the intended assertions: doubled remote wait, independent apply budget,
missing reply-time deadline check, missing timer disposal, serial housekeeping, missing cursor
advance and uncapped deletion. Exact production source is restored after each control.

The real local Workerd group passes **3/3**. Delayed success and rejection deliberately finish
remotely after the caller's 503; local identities, pending journal, four locks and zero actual
JWT-mint markers remain unchanged. Same-operation retry recovers with one mint. A hung terminal
acknowledgement preserves the confirmed result and allows an unrelated login. Deterministic
tests also cover expired replies before timer callbacks run, handled late rejection, timer
disposal, all eight stalled cleanup calls, poisoned-row rotation, mixed terminal progress, and
exact retention boundaries with pending/unacknowledged survivors.

The complete OAuth suite passes **575 tests /23 files**. Coverage is **95.52% statements,
94.23% branches, 94.73% functions and 96.30% lines**; type checking, ESLint and knip pass.
The first local runtime bootstrap encounters sandbox loopback denial; a local-only normal-host
rerun passes. No assertion, global timeout, coverage threshold or exclusion is weakened.
Independent regression review and escalated Astra security review accept the prepared source.
Cursor-error/concurrent scheduling and slow D1 behavior are source-reviewed limitations, not
separately demonstrated runtime guarantees.

## Offline real-package handoff

The [normalized artifact receipt](release-prerequisites-artifacts-2026-10-29.json) binds six
fresh pnpm archives to the existing package manifests and built output. All **596** dist files
match; all six bot locale/manual JSONs match source content; **608** source/package/dist/manual
files are hashed. Pack lifecycle scripts are disabled to preserve those already verified outputs.
The actual publisher's `writeRelease` and `verifyRelease` accept the complete handoff.

Five offline scenarios pass: dependency ordering, missing upstream, upstream verification failure,
logger failure with independent auth progression, and tampered-archive rejection before either
injected callback. Both publication operations are inert replacements and global fetch is
disabled. The manifest identity is explicitly synthetic local data, not a GitHub/OIDC attestation.
This is not publication, a fresh npm installation or post-publication adoption.

Current public-registry observations still show all six selected versions absent:

| Package | Registry latest | Pending version |
|---|---|---|
| logger | 2.3.0 | 2.4.0 |
| auth | 2.0.2 | 3.0.0 |
| core | 5.15.0 | 5.16.0 |
| worker-kit | 1.5.0 | 1.6.0 |
| SVG | 4.4.0 | 4.4.1 |
| bot-logic | 4.11.0 | 4.12.0 |

The collector recorded the six observations during this session; their original exact lookup
time was not retained. The receipt's `recordedAt` is the capture time, not a claimed lookup time.
The separate types 3.3.0 availability lookup is timestamped. Recheck exact versions, artifact
integrity and compatible pins immediately before each real release.

## Remaining release checkpoint

| Gate | State after this preparation |
|---|---|
| OAuth/presets additive schema rehearsals | Existing local migration, data-preservation, constraints and transaction-rollback receipts already exist; no duplicate rehearsal is presented as new work. Live migrations remain pending. |
| Private provider compatibility | Existing actual local Workerd provider/consumer checks already exist. Deploy/verify providers before consumer bindings; local success does not establish deployed availability. |
| Package release | Logger/auth → core/worker-kit → SVG → complete bot-logic source, checking the registry at every boundary. Repeat private test-utils verification after auth publication. |
| Consumer release and identity activation | Apply reviewed additive migrations once; verify provider, disclosures and each consumer separately. Consumer activation and later OAuth binding/split activation remain distinct gated changes. |
| Image manual | All six corrected manual locales are integrated in #363. Publication and verified deployed delivery must precede lower-cap activation. |
| Image resource acceptance | Effective preview CPU policy and aggregate-memory acceptance remain unresolved. The previous hosted attempt failed and stopped; local CPU samples do not close this gate. |
| Private notification cutover | Verify Discord named provider, then presets binding companion, then real submission/edit/preview delivery and external callers before any binding-only activation. |
| API item-name provenance | Historical tables remain unproven; a controlled data/font refresh has its own review and acceptance boundary. No historical commit/checksum is fabricated. |
| Repository operations | Pages-retention live acceptance/activation, default-branch Dependabot closure and scanner eligibility remain separate operational gates. |
| Major/font sequence | M sprints still require shipped/adopted deprecations and explicit beta acceptance. Terminal F sprints remain after final major/text adoption. |

The stack's current source checks and offline artifacts are release preparation. Automatic
production workflows do not enforce a hold or provider-first order by themselves. Do not merge
the whole stack as a substitute for the selected release sequence. Existing finding statuses
and audit counts remain unchanged until their required release and acceptance evidence exists.

## Integration receipts

The forced serialized repository build/type-check/lint/test gate passes **62/62 tasks**, zero
cached, with **17,873 tests /612 files /17 test workspaces**. Root script self-tests pass
**220/220**; script types, production/test reachability, **34** version claims and all **seven**
Workers Logs pins pass. The link gate resolves **1,143** links across **266** living documents.
Initially the new evidence target was not yet staged: the tracked-path link check and its two
root self-tests correctly failed. Staging the owned evidence resolves the failures; no gate
or assertion changes are made.

The actual top-level OAuth production configuration bundles locally at **192.11 KiB upload /
50.14 KiB gzip**, with an isolated profile and fake credential, then exits before upload.
Configuration flags and bindings are unchanged. Filename-aware staged and outgoing-history
secret scans are required before the feature push; the private support packet and XIVAuth
report remain outside the tracked paths.

### CI fixture follow-up

The first [CI run 40874021209](https://github.com/FlashGalatine/xivdyetools/actions/runs/40874021209)
at `f5b4b4f8` passes the security scan, production dependency audit and Chromium job, but the
OAuth suite has **574 passes /one timeout**. The new shared-deadline test advances fake time
after journal persistence, before asynchronous WebCrypto decoding necessarily starts the remote
timer. It can then await a signal whose timer has not been advanced. Production code is unchanged.

A controlled real-WebCrypto completion barrier reproduces that race with an ordinary assertion
failure. The corrected fixture waits for an explicit timer-installed signal, retains the 4s + 1s
shared-deadline assertions and restores its crypto spy in `finally`. The independent-apply-budget
mutation still fails; exact production bytes are restored. Focused **18/18**, full OAuth
**575/575**, unchanged coverage, types and lint/knip pass. No timeout or assertion is weakened.
