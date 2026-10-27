# A-MODERATION implementation preparation — 2026-10-27

Scope: moderation's portion of FINDING-001 and FINDING-025, with the required presets
continuity/membership/session companion for the approved OAuth identity design. Both primary
findings remain OPEN pending release acceptance; FINDING-001 also needs the separate
A-DISCORD preview-image companion. OAuth FINDING-023 remains OPEN pending activation and
production verification.

This is source preparation on a stacked branch. No main merge, live migration, manual
deployment, command registration or package publication is selected. The private XIVAuth
report and correspondence are excluded from Git.

## Approved decisions and prerequisite

The maintainer selected OAuth as the private canonical provider, private review of stored IDs
with explicit confirmation before expanding a ban, and existing bans surviving unlinking until
moderator review. Canonical UUID means OAuth `users.id` / JWT `sub`, never the upstream
XIVAuth identifier. Historical sanction membership grants no ownership or moderator authority.

[OAuth PR #343](https://github.com/FlashGalatine/xivdyetools/pull/343) prepares the provider with
splitting disabled and no outbound continuity binding. Source `80026b53` has passing
[CI](https://github.com/FlashGalatine/xivdyetools/actions/runs/40589390369), including 167 Chromium
Playwright tests. Its clean-checkout fixture correction and receipts are integrated here;
the final prerequisite receipt commit is `88b00a5b`, whose
[final-head CI](https://github.com/FlashGalatine/xivdyetools/actions/runs/40591143714) also passes.
No provider deployment is claimed.

Versions prepared here: presets-api **2.8.0 MINOR**, moderation-worker **1.9.0 MINOR**,
Discord **5.9.6 PATCH** and web **5.16.3 PATCH** for privacy disclosures. Dependencies,
lockfile, shared packages and workflows are unchanged. The root announcement changelog is
untouched; unit changelogs record the policy update.

## Prepared behavior

| Area | Source behavior |
|---|---|
| Neutral moderation decisions | Newly generated approval, rejection, Revert and ban channel/log text omits moderator names/IDs; database actor attribution remains. Historical posts and the separate Discord preview-image companion are unchanged |
| Private identity lookup | Bounded named OAuth lookup returns stored internal/Discord IDs and revision. Authoritative missing permits only the explicit target; pending/error/malformed replies refuse. No upstream IDs, names or rosters are looked up for confirmation |
| Explicit scope | `ban_user` resolves `user` and optional `additional_user` independently. The moderator sees exact IDs and one parent ban privately. Multiple parents require selection; more than 16 refuses for manual review. Existing partial bans can be explicitly expanded; independent parents never merge implicitly |
| One-use review | Actor-bound nonces expire within 15 minutes. Selection consumes its nonce and creates a fresh immutable review. Current authorization, exact mapping/revision, database-time expiry, scope/parent set equality and capacity are checked before mutation |
| Atomic ban/unban | Claim, memberships, hide/restore, audits and finalization share a D1 batch. A failed claim leaves no mutation/audit. Existing active restrictions survive unlinking. Unban selects one recorded parent, retains its memberships and excludes other active bans from restoration |
| Restoration and counts | Approved/pending signature collisions stay hidden. Across the restoring scope only the lowest-ID eligible hidden twin restores. Audit INSERT SELECT and UPDATE share predicates; preset counts exclude content-revision trigger writes |
| API enforcement | Active legacy/member scope is checked by middleware, all five rekey mutations and approval/Revert SQL. Revision/status/raw-snapshot/audit protections remain. Membership is negative authorization only |
| Session admission | JWT signature/issuer/expiry/revocation precede bounded private session validation and ownership/moderator/rekey context. Runtime stale/missing is 401; pending/error/malformed reply/timeout is 503. Enabled invalid config follows the existing production 500 guard. Bot HMAC remains separate |

Both `OAUTH_SESSION_CHECK_ENABLED` and `LINKED_BAN_CONFIRMATION_ENABLED` remain **false in both
environments**. All new moderation ban/unban, selection, button and modal paths refuse privately
while inactive, including legacy target-only controls. No unsafe single-ID fallback is retained.
This also defers confirmation storage and private ID display until disclosures are live.

## Continuity protocol and schema

Additive presets migration `0016_ban_identity_continuity.sql` matches the fresh schema and adds:

- `ban_identity_memberships`: particular-ban confirmed/continuity IDs, parent-delete cascade
  and a distinct effective legacy/member scope cap of 64.
- `ban_continuity_operations`: immutable ID/hash-bound applying/applied/refused receipts,
  durable overflow/review refusal, stable first acknowledgement and integer deadlines.
- `moderation_ban_confirmations`: actor/action/mode/phase-bound nonce and immutable proposal/hash,
  explicit nullable CHECK guards and at most 900 seconds to expiry. A new reviewed parent does
  not exist yet, so its selected ID has no parent FK.

The actual named presets `BanContinuity` entrypoint preserves default HTTP and scheduled
exports, adds no public route and enforces decisions inside one D1 transaction. DETACH adds
only the departing fresh UUID to each matched active ban; it never silently expands a legacy
Discord-only ban to the retained UUID. ATTACH refuses any new effective coverage until a
moderator explicitly expands the particular ban. More than 16 matching parents or 64 effective
IDs produces a durable no-membership overflow refusal. Same-hash terminal replay returns the
original outcome; a changed payload conflicts and cannot reconsider later bans.

SQL-time expiry prevents a delayed expired call creating a new receipt. Unknown outcomes
remain quarantined in OAuth; only exact applied/refused/missing recovery semantics authorize
its commit/abort. This is not cross-database atomicity. Already-authorized in-flight requests
may finish after a later identity transition.

Daily scheduled retention prunes at most 128 eligible receipts and 128 expired confirmations
per category. Receipts require matching terminal acknowledgement and
`max(expires_at, acknowledged_at)+86400`; applying/unacknowledged receipts remain. Memberships
follow their parent's existing 90-day lifted-ban retention. Cleanup eligibility does not promise
an exact deletion time.

## Verification

| Stage | Evidence |
|---|---|
| Preserved name-removal patch | Genuine RED; focused 91 and full 818 tests; coverage 93.25/86.51/94.73/93.89; three original-module assertion mutants with exact restoration. Ten reviewed files checkpointed before OAuth integration |
| Continuity/schema/retention | Genuine invariant RED; 125 Node/SQLite tests and 3 actual local Workerd tests; typecheck/ESLint/dry-run pass. Eleven typed assertion mutants before formatting/type-only refinements, plus two final schema null-CHECK mutants; exact restoration recorded |
| API session/enforcement | Genuine RED: 32 session and 11 membership failures; later strict-own-fields RED. Final 292 focused tests, including 32 real Workerd/D1 cases; original 190 legacy tests unchanged. Ten independent type-clean assertion mutants killed and restored |
| Initial moderation implementation | Genuine membership and inactive-modal RED; actual D1 exposed trigger-inflated UPDATE counts. Focused 307 and actual Workerd 4 pass, types/ESLint pass. Eight type-clean assertion mutants killed/restored; obsolete target-only APIs map to nonce-native behavior proofs |
| Presets full configured coverage | 57 files / 1,394 tests; 96.29/92.99/94.92/97.09; all configured thresholds pass |
| Policy parity and meaning | All 12 privacy variants updated together; mechanical parity passes. Independent five-language meaning review and scoped correction review pass; original Perspective/ToS and F001 name-policy choice unchanged |
| Independent presets review | PASS across frozen 28 paths; all hashes match. Canonical receipts, transaction/caps/expiry, schema/retention, session ordering and every membership guard confirmed |
| Moderation review corrections | Three-file fix wave: 9 genuine failing assertions, final 320 focused tests / Workerd 4 pass, six additional type-clean assertion mutants restored. Independent scoped re-review confirms per-identity audits, full recorded-scope parent-set CAS and informational previews addressed; no new breakage |
| Moderation full configured coverage | 35 files / 846 tests; 93.28/89.71/95.77/94.30; all configured thresholds pass |
| Static/docs/web gates | 167 script tests, script types, 34 version claims, 1,062 links / 259 docs, all 7 Workers Logs configs, all policy variants and 7 web build tasks pass; web bundle budget passes |
| Production-config local dry runs | Presets 263.42 KiB / 66.51 gzip; moderation 690.64 / 166.30; Discord 8,641.11 / 2,736.60. All use actual production configs and exit without deployment |
| Discord checks | 28 integration tests pass; bundle budget 2,736.8 KiB gzip / 3,072 KiB, with 335.2 KiB remaining |
| Combined final gates | 45/45 build/type/lint tasks; dead-code scan 640 production / 635 test files; full graph 25/25 tasks, **17,231 tests across 600 files and 17 workspaces**. No gate weakened; source stayed frozen through the run |
| Critical whole-branch review | PASS for source preparation across all 104 owned paths. No remaining Critical/Important/Minor correction; per-group continuity/schema/retention/session/membership/moderator/privacy/release checks confirmed. Final graph and remote CI remain separate gates |
| Secret scanning | Redacted staged scan passes; full stacked-history scan is required before push |
| Remote receipts | Branch publication, actual CI and automatic beta receipts follow source verification |

Windows Vitest temporary SSR/import failures are classified as infrastructure, never RED or
mutation proof. Focused commands use the normal fork pool, disabled filesystem module cache
and bounded workers. Workerd needs short OS temporary paths here; deep scratch temp paths
caused local D1 bootstrap errors. Fake supported profile/config/cache paths and fake credentials
are installed before lazy Wrangler import; no real account or remote binding is used.
Workerd execution is separate proof from Node V8 coverage; runtime-only counters are not
excluded or globally mocked.

Knip normalizes `cloudflare:workers` to package `cloudflare`; the documented presets-only
exception covers that runtime builtin, matching OAuth's established scope. No SDK dependency,
global exemption or fake production use was added.

The first full moderation run caught one legacy rate-limit fixture that left the new feature
inactive while expecting autocomplete choices. Independent review classified the fixture as
outdated; only that active-case setup now enables the flag and supplies a structural fake
binding. All original search/choice/warning assertions remain, and the three focused tests
plus the full 846-test coverage run pass. A genuine inline type reference also escaped Knip's
reachability graph; replacing it with an explicit erased type import makes the existing Env
use visible. Final unit types and lint pass without an exemption or production behavior change.

## Disclosure and release order

English and generated German, French, Japanese, Korean and Chinese paragraphs were added to
both web and bot privacy families. They explain stored association/session revision checks,
private exact-ID review and Discord ephemeral responses without a deletion-time promise,
particular-ban scope/continuity, confirmation expiry/cleanup, and interrupted-link recovery
retention/operator review. A scoped language review corrected location-dependent wording and
clarified unresolved remote-applied/unknown outcomes. English remains governing.

1. Apply and verify the additive OAuth migration, then deploy/verify the inactive named provider
   through its separately authorized release.
2. Apply presets migration `0016` once with `wrangler d1 execute --file` before either consumer
   deployment. Never `d1 migrations apply` or a fresh-schema replay. Membership-aware queries
   require the new tables even while feature flags are false.
3. Deploy and verify both disclosure units before any new confirmation storage/display. Prepare
   a separate consumer activation enabling session checks and linked-ban confirmation, then
   verify private replies, exact ban/expansion/unban scope and session denial in production.
4. Before adding any OAuth outbound continuity binding, implement/test bounded apply/get/ack
   and global cleanup. The prepared OAuth source awaits these calls directly; a hung global
   acknowledgement could otherwise delay unrelated logins even with splitting off once a
   binding exists. Unknown timeouts remain pending and cannot late-commit/mint.
5. Verify all consumers, then use a separate OAuth activation-only change and production proof
   before closing FINDING-023. Metadata moderation remains independently disabled.

Production workflows deploy units independently; one merge does not prove ordering. Optional
moderation command arguments register through the existing deployment workflow. Source pushes
also select the existing web/Discord beta workflows because their policy/changelog paths are
included; no presets/moderation beta or manual deployment is selected here.

See [the complete contract](../../../architecture/identity-moderation.md).
