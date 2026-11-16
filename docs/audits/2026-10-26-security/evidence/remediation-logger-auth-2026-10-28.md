# H-LOGGER and H-AUTH — execution evidence, 2026-10-28

**Branch:** `codex/sprint13-logger-auth-20261028`.
**Package recheck base:** `5a6dc2f92e70eadc35ccd976839a3276cd18c19e`.
**Final integration base:** `e5795c48772586c2a20434bdba595f39856824fa`, the R-sprint Linux
test-fixture correction; it changes no package runtime code.
**Scope:** [H-LOGGER and H-AUTH](../../2026-10-26-i18n/REMEDIATION_PLAN.md#sprint-h-logger--packageslogger).

Source preparation only. No package publication, application deployment, production merge,
policy/secret/activation change or live user-data operation is selected. Existing A/R holds
remain. The private XIVAuth report is excluded from Git. Package versions below describe
prepared releases, not registry availability or completed downstream adoption.

## Findings and implementation

### FINDING-044 — adapter error formatting

The base still serialized non-Error object arguments before field redaction. The logger now
normalizes those objects/arrays through the existing guarded key/value pipeline before
adapter/console serialization. Sensitive nested keys receive the same configured protection
as context values; benign fields, source nonmutation, `Unknown` error metadata, primitives
and ordinary Error behavior remain covered.

Root serializer hooks use the root key and existing ancestor/memo/depth/fan-out guards.
Review caught two object/array regressions before acceptance: subclass mapping could retain
an inherited serializer, and a callable serializer result could have its hook invoked again
as a new serialization root. Plain-array indexed copying and a fixed unserializable sentinel
for callable serializer results address these cases. Sparse/inherited indices, aliasing,
cycles and opt-out configurations have output-level regression tests.

Limits remain explicit: direct function/class **values** with custom `toJSON` retain the
pre-existing documented exception. Optional browser `errorTracker` forwarding remains on
its separate existing free-text-only non-Error path; this formatter change does not add field
redaction to that sink. Arbitrary user hooks may mutate their own values. Diagnostic error
strings are not promised to be parseable JSON. No new universal sanitization claim is made.

### FINDING-047 — Discord URL token shapes

Both flagless context predicates and global free-text replacement cover webhook/follow-up
and interaction callback token paths. Messages, error messages, non-Error object fields and
nested context/array values are exercised. Path matching is host-independent; context shape
matches replace the whole value, while free text retains the route and unrelated suffixes.
Field/value-shape protection remains active with `sanitizeErrors: false`; free-text and stack
handling retain the existing opt-out. Ordinary URLs, incomplete paths, repeated matches,
idempotence and the unchanged adversarial performance budget are tested.

### FINDING-042 — canonical authentication encodings

The byte decoder rejects characters outside the unpadded Base64URL alphabet, impossible
lengths and nonzero unused bits by an exact byte re-encoding check. The string decoder shares
that rule. Canonical empty utility input remains valid.

`hmacVerifyHex` and `verifyBotSignatureV2` require exactly 64 lowercase hex characters; the
v2 guard runs before body access/hashing. General `hexToBytes` retains uppercase/mixed-case
and empty-input support. Codec failures throw; HMAC verification returns `false`, JWT
verification returns `null`. Debug-only `decodeJWT` still decodes only the payload.

Tests use genuine signatures and prove malformed spellings are byte-equivalent and natively
cryptographically valid. Mutated JWT header/payload segments are re-signed over their raw
text, so rejection does not merely test a broken signature. Canonical signers, v2 bytes/fields/
headers/freshness, session behavior and exports remain unchanged. OAuth's separate direct
`atob` development-state path is outside this change.

Primary references: [JWS unpadded encoding](https://www.rfc-editor.org/rfc/rfc7515#section-2),
[canonical pad bits](https://www.rfc-editor.org/rfc/rfc4648#section-3.5), and
[Discord interaction callbacks](https://docs.discord.com/developers/interactions/receiving-and-responding#interaction-callback).
These support the encoding/path contracts; they are not evidence of a live exploit or leak.

## Version and compatibility decision

Read-only registry receipts report logger **2.3.0** and auth **2.0.2**, matching the starting
manifests. Both require new versions. Independent Astra contract review selected:

- **Logger 2.4.0 MINOR**, following its existing 2.3.0/2.2.0 observable-output precedent.
  Public signatures and configuration remain unchanged; emitted redaction output changes.
- **Auth 3.0.0 MAJOR** for the full requested scope. Strict Base64URL alone enforces the
  documented unpadded contract, but the public general hex verifier previously accepted valid
  hex without a lowercase restriction. External uppercase/mixed-case signature producers must
  emit lowercase. Existing `^2` consumers need an explicit upgrade. This is not a v3 signing
  protocol. The previous Unreleased documentation notes ride this release.

Manifests, technical changelogs and the two version-table authorities agree. Lockfile-only
refresh and frozen installation pass with no dependency-resolution or lockfile change. No
release-age exemption or build-script permission was added.

## Publication and adoption handoff

Publish each prepared package through the reviewed Actions workflow only after its stack and
release prerequisites are accepted. Verify each exact version/tarball in the registry before
its dependent adoption. Logger and auth are independent; neither publication depends on the
other. Select the intended packages explicitly rather than treating every locally modified
package in this stacked branch as authorized for publication.

Logger propagates first through separate core/worker-kit adoption releases, then SVG and
bot-logic where applicable, followed by the named application sprints. Auth requires separate
Discord, moderation, presets and OAuth adoption plus the private test-utils verification gate.
Local private producer tests do not close the post-publication H-TEST-UTILS gate. Packed
workspace pins and compatible version sizes must be checked again at each release boundary.

The five historical context-as-error locations have shifted, and five additional instances
are present. They remain in their owning application adoption sprints; this package-only work
does not change any of them:

| Application | Current `logger.error(message, context)` sites at the package recheck base | Owner |
|---|---|---|
| Discord | `src/index.ts:339`, `:736`, `:936` | H-DISCORD |
| Moderation | `src/index.ts:243`, `:359`, `:545`, `:582` | H-MODERATION |
| Presets | `src/retention-job.ts:88` | H-PRESETS |
| Stoat | `src/index.ts:70`, `:97` | H-STOAT; remains parked |

Use `logger.error(message, undefined, context)` in those later sprints. Do not combine their
deploys or silently change the signature of `Logger.error` to accommodate mispositioned calls.

## Verification and review

- Logger final package checks: **337 tests / 9 files**; build, type-check, lint, formatting and
  coverage pass (**96.52% statements / 92.13% branches / 100% functions / 96.46% lines**).
  Initial three mutations separately restore raw object serialization, remove shape detection
  and remove free-text handling; each is caught. Two further mutations restore subclass
  mapping and callable-result handling; each is caught. Failed controls are retained.
- Auth: **181/181** package tests, build/type-check/direct ESLint pass. Three targeted
  mutations restore permissive round trips, direct hex or early v2 verification; each is caught.
  A pnpm store-access failure occurred before one ESLint invocation; the installed CLI pass is
  separate proof, with no configuration workaround.
- Private test-utils JWT producer: **13/13**, using public `/jwt` and `/encoding` imports,
  canonical segments, native crypto, Unicode/null fields and expiry controls.
- Independent Sol regression and Astra security review accept the repaired source; generic
  hex compatibility and the documented serializer/tracker limits remain explicit.
- Actual tarballs: **8/8 packed-consumer cases pass**, using the real public logger root
  and auth `/jwt`, `/hmac`, `/encoding` imports. Native canonical JWTs, strict encoding
  rejection, unchanged generic hex, v2 signing parity, adapter configuration and both
  repaired serializer cases are exercised. The reviewed publisher's strict USTAR/identity/
  dependency checks accept both packages. [Artifact hashes and case receipt](remediation-logger-auth-packed-2026-10-28.json).
  The local handoff identity is explicitly synthetic, not CI provenance or an npm release.
  An initial smoke-harness assertion expected an unquoted sentinel; the existing diagnostic
  string is JSON-quoted. Correcting that exact expectation produced the pass without any
  package-code change; both the initial output and final proof are retained locally.
- Final whole graph: **62/62 tasks**, **zero cached**, **17 test tasks / 608 files /
  17,770 tests passed**. This includes the package dependents, both bot font gates and full
  private test-utils checks. The first restricted run stopped at a core filesystem test's
  temporary-directory rename (`EPERM`), before its assertion. The unchanged focused file
  passes **15/15** on the normal host, and the identical full serial command then passes.
  No source, timeout, coverage threshold or assertion was weakened.
- Root scripts **220/220**, script type-check, dead-code (**648 production / 646 test files**),
  docs (**34 version claims; 1,138 links / 264 documents**) and **7 Worker Logs configs** pass.
  Six-language i18n (**1,197 keys / locale**) and web bundle budgets (**2.17 / 2.20 MB**
  payload) pass. The intermediate missing-bundle check after the aborted graph is retained
  separately from the successful post-build check.
- Gitleaks **8.30.1** filename-preserving staged scan passes. An earlier stdin diff scan
  lost file paths and flagged the deliberately synthetic private-consumer test secret; the
  existing `.test.ts` fixture policy applies when paths are retained. No scanner rule,
  allowlist, fingerprint or source fixture was weakened to obtain the pass.

## R-sprint prerequisite follow-up

PR #351's first Linux CI failed a duplicate-manifest fixture because GNU tar generated a
hardlink for its repeated file path. The validator correctly rejected it. The portable fixture
uses two explicit regular USTAR entries, retaining the exact uniqueness assertion and runtime
validator. Local scripts pass **220/220** and removing the uniqueness guard makes the repaired
test fail. Commit `e5795c48` is pushed to the already-authorized R branch and included here;
the read-only GitHub refresh at that exact head confirms security audit, Gitleaks,
lint/type-check/test/build and Playwright checks all **SUCCESS**.
