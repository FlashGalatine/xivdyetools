# A-OAUTH source preparation — 2026-10-27

**Base:** A-PRESETS PR #342, `db34eaad1620f7ad4baa783781c7f6c7361260d4`.
**Branch:** `codex/sprint7-oauth-20261027`. **Version:** OAuth 3.2.0 MINOR.
**Primary IDs:** FINDING-023, FINDING-032, FINDING-036. Companions: OAuth's IPv6 /64 opt-in
and security-header comments. All findings remain OPEN pending the relevant release acceptance;
the identity split additionally requires migration, consumers and separate activation.

The maintainer approved OAuth as the private identity provider, explicit private moderator
confirmation of stored linked IDs before expanding bans, and preservation of existing bans
across unlinking until moderator review. A-OAUTH prerequisites precede the retained
A-MODERATION name-removal patch and remaining linked-ban implementation.

No production migration, application deployment, main merge, npm publication or identity
activation was performed. The root announcement changelog and private correspondence were
not changed. No user/provider identifier was retrieved for this evidence.

## Read-only production preflight

The configured production users database was checked by an aggregate-only SELECT on
2026-10-27. The API returned success/200, `changed_db=false`, `changes=0`, `rows_written=0`.

| Aggregate | Result |
|---|---:|
| Users | 19 |
| Discord ID present | 18 |
| XIVAuth ID present | 5 |
| Both present | 4 |
| Neither present | 0 |

No identifiers, names or tokens were selected. These counts do not establish which stored
associations remain asserted by XIVAuth; no upstream account comparison was attempted.

## Prepared behavior

### FINDING-023 and private provider

- OAuth exports the named `IdentityLookup` service entrypoint through a small `worker.ts`
  wrapper, alongside its unchanged default Hono HTTP application. There is no public lookup
  route. Responses contain current internal UUID, nullable Discord ID and local revision;
  upstream XIVAuth IDs, names, characters and tokens are excluded.
- The internal UUID is `users.id`/JWT `sub`, not `users.xivauth_id`. Local session revisions
  are checked before minting and on `/auth/me`, after normal cryptography/revocation. A missing
  claim means zero only against an unchanged, nonpending revision-zero row.
- `IDENTITY_SPLIT_ENABLED` is explicitly **false in both environments**. No outbound
  continuity binding is declared in this provider release. Detected existing relationship
  changes are refused without association mutation, journal preparation or a stale-Discord
  token. Matching sign-ins and genuinely new rows continue.
- The prepared enabled split retains the Discord-anchored UUID and gives XIVAuth a fresh
  UUID without transferring the original UUID's ownership. A displaced XIVAuth association
  is preserved rather than overwritten. Further attachment requires a fresh assertion/sign-in;
  existing local accounts never silently merge.
- Durable operations reserve the exact user/provider resources and compare the expected
  associations/revisions inside atomic D1 batches. Pending rows cannot mint or validate
  sessions. The journal contains identifiers, expected relationships and operation metadata,
  without names, provider tokens, rosters or reasons.
- A particular existing ban is preserved for the departing session through the later presets
  continuity transaction. It is not a permanent equivalence between identities. ATTACH cannot
  silently expand effective ban scope; a durable refusal requires moderator review. Replays
  return their original terminal outcome rather than reconsidering later bans.
- Unknown/applied outcomes retain fencing. A verified refusal permits an unchanged-association
  abort with released locks; expiry plus authoritative remote-missing also permits abort.
  Acknowledgement is cleanup bookkeeping, not permission to undo a confirmed change.

The provider's continuity client is tested against local boundary stubs. This release does not
implement or claim the later presets transaction, its limits, moderator confirmation or a
two-database atomic commit. Requests authorized before a transition may finish. Validation
checks stored local relationships, not fresh upstream ownership on every request; unchanged
old sessions still have their normal expiration window.

### FINDING-032 and IPv6 adoption

`[env.development]` explicitly overrides `routes=[]` and `workers_dev=false`; the production
auth domain and top-level deployment convention are preserved. The OAuth IP extractor opts
into worker-kit /64 normalization. Equivalent/same-network IPv6 clients share a native key
and quota; adjacent networks remain distinct. IPv4, mapped IPv6 and trusted-header precedence
retain their behavior, with X-Forwarded-For still ignored by default. Shared defaults are unchanged.

### FINDING-036

New state HMAC input is `oauth-state-v1:` plus the encoded payload; JWT input and the two-part
state wire format are unchanged. Independent Web Crypto fixtures verify the prefix and that
the new state signature does not verify as raw JWT-data HMAC.

Legacy signed issuance has a fixed cutoff of **2026-10-28 00:00:00 UTC**. Authenticated legacy
states require finite integer timestamps, no future issuance, positive lifetime at most
600 seconds and unexpired state. Final legacy acceptance ends **00:10:00 UTC**, inclusively.
The deadline does not reset on requests or isolates. A later production deployment requires
old in-flight sign-ins to retry once; it does not extend this one-time window. Unsigned
development GET compatibility is separate; POST exchanges remain signed-only and PKCE-bound.

## Verification evidence

| Stage | Result |
|---|---|
| Frozen install / original baseline | 5 dependency-build tasks; 16 files / 384 tests; coverage 95.76/92.23/93.75/96.21; types/lint pass |
| State separation | Genuine RED 23 assertions; focused 179 tests; full 435 tests; independent signing-prefix, verification-prefix and cutoff mutants all assertion-killed |
| Config / IPv6 | Genuine RED 9 assertions; focused 84 tests; full 445 tests; separate route, workers.dev and /64-option mutants assertion-killed |
| Identity provider | Full 21 files / 546 tests; coverage 95.10/93.86/94.28/95.78; configured thresholds unchanged; final isolated RPC 3 and user-service 15 pass; types/lint pass |
| Migration / SQL | Actual migration applied to independently defined old schema with a seeded linked user; IDs/name/timestamps preserved, revision zero, fresh-schema parity, replay rejection, constraints/cascade and rollback covered |
| Real local runtime | Actual named entrypoint invoked through a separate local worker; HTTP non-exposure and continuity DTO boundary tested; no remote binding or actual account credential |
| Identity mutants | Eight type-clean assertion kills: stale retention, revision, pending state, CAS/locks, receipt-before-commit, canonical hash, private DTO and response hash; exact source bytes restored |
| Root build / types / lint | 45/45 tasks; no errors. Existing warnings outside OAuth remain; no gate suppressed |
| Root scripts / inventories | 167 script tests; script types pass; dead-code 632 production / 622 test files; 34 version claims; Workers Logs off in all 7 configs |
| Documentation | 1,053 relative links across 259 living documents resolve, including the final audit-status preparation |
| Production-config local dry run | Actual top-level Wrangler config bundles the wrapper and named provider: 189.20 KiB upload / 49.35 KiB gzip; splitting false, no continuity binding; exits without deployment |

Final adverse abort/acknowledgement proof: **37 focused tests pass**, including four abort races and 16 logical malformed-ack cases. Four additional type-clean assertion mutants (abort locks/revision and ack ID/timestamp) are killed and exactly restored; production bytes are unchanged. Scoped independent re-review confirms all requested proof additions are addressed with no new breakage.
Final-byte root test graph: **25/25 tasks pass; 17,047 tests across 589 files and 17 workspaces**, including OAuth **552/552**. The run preserves configured coverage gates and uses serial file/workspace scheduling on Windows; existing Turbo output-cache and Lit warnings remain.
Critical whole-branch review: **PASS for the inactive, binding-free preparation scope**. The mandatory availability gate before adding any continuity binding is recorded below; production acceptance remains pending.
Draft [PR #343](https://github.com/FlashGalatine/xivdyetools/pull/343) is stacked on #342 at source `d5955059`. The initial [CI run](https://github.com/FlashGalatine/xivdyetools/actions/runs/40587834759) exposed one clean-checkout fixture defect: the disk-restart test used an ignored scratch directory that happened to exist locally. It failed to open SQLite on the runner; the other 551 tests passed. Production code was unaffected.

The fixture now creates its own unique OS temporary directory, closes/reopens the actual database and removes only its own file and empty directory. Recovery assertions are unchanged. Independent scoped review confirms a fixture portability correction, with no gate weakening. Focused **37/37**, complete OAuth **552/552** with coverage **95.35/93.99/94.28/96.04**, and **7/7** scoped type/lint/dependency tasks pass. An unused path-conversion import was removed after the type check caught it. The initial failed run is retained as evidence.

Replacement source `80026b53e119f367de839067078ac41ef97c4d77`: [CI run 40589390369](https://github.com/FlashGalatine/xivdyetools/actions/runs/40589390369) **success**. All four jobs pass: lint/types/tests/build, production dependency audit, gitleaks and Chromium Playwright (**167/167**, 5.9 minutes). This is a branch/CI receipt, not a deployment receipt. PR #343 remains draft and unmerged; no OAuth beta, live migration, manual deployment, package publication or split activation was selected.

The identity writer disclosed a process deviation: most enabled handoff/recovery tests were
first written after implementation and initially passed. Initial inactive-stale/revision/DTO
groups and the exact-lock correction have genuine RED evidence; later mutation failures do
not retroactively make the remaining tests red-first. The rewritten legacy tests have an
explicit behavioral map to real SQLite cases, including no merge, creation/profile/timestamps,
uniqueness races and generic errors. Independent review found no Critical or Important
implementation defect and requested the additional adverse abort/ack proof.

Windows runs use native Git Bash with the filesystem module cache disabled, normal fork pool
and bounded workers. The full unit run used serial file scheduling after temp-SSR import
failures; those infrastructure errors are not counted as test proof. Final runtime fixtures
isolate the supported profile/config/cache/log paths before importing Wrangler and restore
their fake environment afterward. Node's SQLite ExperimentalWarning is expected toolchain
noise. Workerd execution is verified separately; its RPC counters are not included in Node
V8 coverage, and the RPC module is not excluded or globally mocked.

Knip normalizes `cloudflare:workers` to package `cloudflare`. The OAuth-only documented
exception covers that runtime builtin; no SDK/dependency or lockfile was added. Actual
runtime compilation, type checks and RPC integration remain gates.

## Decisions and release gates

| Decision | Reason and consequence |
|---|---|
| Retain Discord anchor / fresh XIVAuth UUID | Prevents stale Discord authority and preserves Discord's existing namespace; historical UUID ownership is not transferred |
| Particular-ban memberships | Preserves existing restrictions without making historical links ownership grants or applying unrelated future bans automatically |
| ATTACH refuses unconfirmed scope | Preserves explicit moderator control; an active partial ban may delay linking until review |
| Durable applied/refused receipts | A retry cannot widen the operation or reconsider a refused proposal after bans change; unresolved outcomes may require operator review |
| Fixed legacy-state window | Prevents perpetual old-protocol verification; a deployment after the deadline requires one sign-in retry |
| Provider first, inactive split | Avoids a binding to an undeployed entrypoint; automatic transitions wait for consumer verification |

Before the dependent production deployment, apply additive users migration
`0002_identity_transitions.sql` once with `wrangler d1 execute --file`; never replay migrations
with `d1 migrations apply`. Fresh databases use the fresh schema instead.

Next, complete the presets continuity/membership/session enforcement and A-MODERATION's
private exact-ID confirmation, including expansion of existing partial bans. Apply their
backward-compatible schema, deploy/verify provider before consumer bindings, and land all
required six-language disclosures before the new uses run. Only after all production receipts
prepare a separate OAuth activation change adding the continuity binding and enabling splits.
No activation or production-acceptance claim is made here.

Critical review identified an availability gate before adding any OAuth continuity binding:
remote apply/get-operation calls and acknowledgement/cleanup currently have no application
deadline. Cleanup scans terminal operations across users and is awaited by logins, so one hung
acknowledgement could delay unrelated sign-ins once a binding exists, even with splitting off.
The inactive release has no binding and cannot take that remote path. Before adding it, bound
RPC and cleanup work and prove timeout/retry quarantine, no late identity commit/session mint,
and progress for confirmed terminal operations and unrelated logins.

See [the full contract and rollout order](../../../architecture/identity-moderation.md).
