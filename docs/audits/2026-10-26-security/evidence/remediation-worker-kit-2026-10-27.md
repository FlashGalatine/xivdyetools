# A-WORKER-KIT implementation evidence — 2026-10-27

The maintainer selected the existing automatic consumer-deployment behavior and validation
of every affected app. This branch prepares worker-kit 1.6.0 and Discord 5.9.1. A merge,
npm publication and production verification remain separate actions.

## Scope and compatibility

- FINDING-004: `getClientIp` adds optional `ipv6Prefix64`, default false. Existing callers
  preserve their output, Cloudflare-header priority, X-Forwarded-For trust option and fallback.
  Opted-in valid IPv6 addresses share a canonical /64 network key, without a suffix. Mapped
  IPv4 dotted/hex forms become the embedded IPv4 address; unrelated mapped clients remain
  distinct. Invalid input keeps the existing trimmed/lowercase pass-through.
- Regression coverage includes equivalent spellings, fourth/fifth-hextet boundaries,
  compression, mapped/embedded IPv4, invalid forms and both header paths. Real memory-limiter
  requests demonstrate shared /64 quota consumption and separate neighboring networks.
  Generated bare keys redact to the non-identifying `ip` scope.
- FINDING-017: the shared glamour preset is exactly 5 requests per 60,000 ms without burst.
  The existing Discord lookup selects its existing RL_5 binding, including its native key
  and denial behavior. No command registration shape or workflow changes are required.
- All seven backend workflows already build workspace dependencies on worker-kit changes.
  A future separately authorized merge therefore redeploys them; npm publication does not gate those bundles.
  The IPv6 option remains off in every app until its owning adoption sprint explicitly enables it.

## Red, green and mutation verification

| Check | Result |
|---|---|
| New focused package regressions against the original code | Exit 1: 61 failed, 105 passed |
| New Discord RL_5 regression against the original code | Exit 1: 1 failed, 31 passed |
| Restored intended package suite | Exit 0: 405 tests in 14 files |
| Restored Discord rate-limiter test file | Exit 0: 32 tests |
| Package build, type-check and lint/knip | Exit 0 each |
| Force normalization despite opt-out | Exit 1: 28 regressions failed |
| Retain an /80 instead of the /64 | Exit 1: 29 regressions failed |
| Restore glamour to 15/minute | Exit 1: 3 package regressions and the Discord RL_5 regression failed |

Mutations were sequential and restored byte-for-byte, followed by rebuilding the intended
package and rerunning both final suites. The expected red assertions were distinguished from
pnpm's initial sandbox dependency-state refresh error; identical elevated retries succeeded.
No threshold, lockfile or implementation was changed to hide an environment failure.

## Broader gates and review

`pnpm turbo run build type-check lint test --concurrency=2` exited 0: 62/62 tasks succeeded,
36 cached. Test summaries total 16,310 passed: 6,031 executed in this run and 10,279 valid
cached replays. The focused changed-code runs above were executed after mutation restoration.

Discord's `check-bundle-size` gate exited 0 at 2,734.0 KiB gzip against its 3,072 KiB cap
(338.0 KiB headroom). All six other production bundle checks used Wrangler `deploy --dry-run`
and exited 0, with production environments selected except OAuth's existing default:

| Worker | Gzip size (KiB) |
|---|---:|
| API | 715.77 |
| Image | 646.88 |
| Moderation | 57.79 |
| OAuth | 44.15 |
| OpenGraph | 1,953.55 |
| Presets API | 60.72 |

Initial sandbox attempts could not write Wrangler diagnostic logs (`EPERM`); identical
dry-run commands succeeded with elevation. No live deployment command was run.

Documentation checks passed: 1,035 relative links across 258 documents, 34 version claims,
and all seven worker logging configurations. Whitespace checks passed.

`pnpm pack` produced a local 1.6.0 artifact with 95 files, the published dependency specifier
`@xivdyetools/logger: 2.3.0`, and the new optional declaration. Packed-JavaScript smoke checks
confirmed the prefix, mapped-IPv4 and unchanged-default paths. Its SHA-256 is
`1d369f3b8c2c1c993edf85a42c67dc14927e4b9fcd762b0f9cf1bdd3054b757a`.
This is a local packaging check, not a registry publication or provenance attestation.

Independent Sol/xhigh task review passed spec compliance and code quality. A separate
Sol/xhigh release review confirmed both version decisions and metadata. The final Astra/high
whole-branch code/security review found no remaining Critical, Important or Minor issue.

## Remaining release work

FINDING-004 remains open until API, presets-api and OAuth explicitly adopt and deploy the
new option. FINDING-017 remains open until the effective deployed Discord limit is verified.
The glamour cap reduces per-caller pressure on the shared service budget; it does not create
separate service budgets for users. No live abuse probe, deployment or npm publication was run.
