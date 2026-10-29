# H-LOGGER and H-AUTH implementation plan

> **For agentic workers:** use the subagent-driven-development workflow; follow the repository model-routing and one-writer rules.

**Status:** implemented and verified 2026-10-28; publication and consumer adoption remain separate.

**Goal:** prepare the logger redaction and auth canonical-encoding hardening from the approved [merged remediation plan](../../audits/2026-10-26-i18n/REMEDIATION_PLAN.md#sprint-h-logger--packageslogger).

**Architecture:** reuse the existing logger traversal and sanitization pipeline, preserving its safety budgets and configuration. Make authentication encoding checks strict at the shared decoder and signature-verification boundaries without changing token issuance or the v2 signing protocol.

**Tech stack:** TypeScript, Web Crypto, Vitest, pnpm and Turborepo.

**Spec:** security findings [044](../../audits/2026-10-26-security/findings/FINDING-044.md), [047](../../audits/2026-10-26-security/findings/FINDING-047.md) and [042](../../audits/2026-10-26-security/findings/FINDING-042.md). Package recheck base: `5a6dc2f92e70eadc35ccd976839a3276cd18c19e` (R-sprint PR #351), advanced to its portable test-fixture follow-up `e5795c48772586c2a20434bdba595f39856824fa` before final gates; package runtime baseline is unchanged.

## Global constraints

- Work only in the isolated hardening checkout. No package publication, deployment, merge, push to main, secret/policy/activation change or private user-data access.
- Coordinator owns versions/changelogs, lockfile, version tables, audit statuses/evidence, Git and external prose. Each implementation file has one assigned writer.
- Logger app call-site corrections and all downstream adoption releases remain in their owning H adoption sprints. Inventory current sites without changing apps here.
- No token protocol migration, session behavior change or generic hex-utility compatibility removal. Canonical valid issuer output remains accepted; malformed verification still returns the existing failure result.
- Write meaningful red-first tests and mutation checks. Preserve all thresholds, timeouts, assertion strength and existing redaction complexity controls. Use synthetic credentials only.
- Resolve local versus published versions before the coordinator's semver decision; record compatibility and the required publication/adoption order. No package is claimed published from local workspace tests.

### Task 1: Logger redaction hardening

Ownership: `packages/logger/src/core/base-logger.ts`, `base-logger.test.ts`, `hardening.test.ts`, package `README.md` and `CLAUDE.md`. Other package files require coordinator reassignment.

- [x] Recheck FINDING-044/047 at the base and record actual call-site inventory.
- [x] Write failing output-level tests for secret-bearing non-Error error objects, nested keys/arrays/cycles/toJSON, source nonmutation and both sanitization configurations.
- [x] Route non-Error values through the existing appropriate redaction traversal before serialization, preserving primitive/error contracts and safety limits.
- [x] Add Discord webhook/interaction URL redaction to value-shape and free-text handling. Cover messages, error messages and nested context/arrays, realistic full and relative URL forms, ordinary URL negatives, repetition and adversarial performance.
- [x] Run focused tests and mutations proving each fix is load-bearing; update only package implementation documentation and return exact changelog/version recommendations.

### Task 2: Auth canonical encodings

Ownership: `packages/auth/src/encoding/base64.ts`, its test, `src/hmac.ts`, `hmac.test.ts`, `bot-signature-v2.test.ts`, `jwt.test.ts`, package `README.md` and `CLAUDE.md`, plus only `packages/test-utils/tests/auth/jwt.test.ts` for private-consumer verification after reading that unit's instructions. Keep generic `encoding/hex.ts` compatibility; a targeted test may document that preserved contract if assigned.

- [x] Recheck the full FINDING-042, including lowercase hex at signature verification boundaries.
- [x] Write failing byte/string codec and real-signed JWT/HMAC/v2 tests: whitespace, padding, standard alphabet, impossible lengths, nonzero trailing bits and uppercase/mixed-case hex must reject where specified. Pin canonical valid/empty utility inputs and existing verifier failure contracts.
- [x] Enforce the Base64URL alphabet, length and byte re-encoding round trip; enforce lowercase 64-character hex for signature verification. Do not change canonical signing output or generic hex decoding.
- [x] Prove malformed signed fixtures were cryptographically equivalent before the fix, and canonical controls still pass both JWT verifier paths and bot verification.
- [x] Run focused tests/mutations and document precise consumer compatibility. Verify the private test-utils consumer in the combined gates without claiming its later adoption sprint shipped.

### Task 3: Metadata, packed-consumer and release checks

Coordinator owns package manifests/changelogs, root `README.md`, `docs/versions.md`, lockfile and any additive adoption checklist. Resolve registry versions and ordinary-verifier semver recommendations, then apply the selected unpublished versions. Preserve unrelated dependency resolutions and release-age policy. Build and pack both packages, test the actual tarballs and private test-utils/public subpaths against canonical and redacted output, and record explicit downstream publication waits. No real registry write.

### Task 4: Independent review and gates

- [x] Obtain independent regression review plus Astra security review of secret redaction and signature/encoding changes; return fixes to the assigned writer.
- [x] Run scoped package/dependent gates, root scripts/type/dead-code/docs/log checks, bundle/i18n checks as affected, and a final whole-repository graph with serialized application suites to avoid the known cold-import contention.
- [x] Keep source stable during full gates; preserve failed controls and exact retries. No threshold/timeout/skip changes.

### Task 5: Evidence and local completion

Coordinator adds dated evidence and execution updates while preserving historical audit snapshots, records source versus published/adopted status and validates secret-free owned paths. Create local commit(s) after verification and final review. Keep the private XIVAuth report outside Git. A new push/PR is separate from this implementation request.
