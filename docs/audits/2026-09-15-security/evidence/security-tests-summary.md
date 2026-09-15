# Targeted security test evidence

Commands used `pnpm --filter ... exec vitest run`; exact full logs are beside this file. No tests or source files were modified. Ignored compiled dependency outputs were refreshed to resolve stale-build failures.

## Final results

**957 tests passed across 6 units; all final commands exited 0.** Existing suites verify established controls; the new findings have separate local/source evidence and remain OPEN.

| Unit | Final run | Tests passed | Log |
|---|---|---:|---|
| auth | Complete package suite | 122 | `auth-tests.txt` |
| logger | Complete package suite | 251 | `logger-tests.txt` |
| presets-api | Four targeted moderation/upload suites | 119 | `security-tests-presets-api.txt` |
| oauth | Complete app suite including configured coverage gate | 346 | `security-tests-oauth-final.txt` |
| image-worker | Five targeted limits/dimensions/SSRF suites | 75 | `security-tests-image-worker.txt` |
| api-worker | Three telemetry suites | 44 | `security-tests-api-worker-retry.txt` |

OAuth's final coverage: statements 95.57%, branches 92.18%, functions 93.75%, lines 95.99%; existing thresholds passed unchanged.

## Initial runs and diagnosis

| Unit | Tracked test paths | Result | Tests | Notes |
|---|---|---:|---:|---|
| presets-api | `tests/handlers/moderation.test.ts`, `tests/middleware/body-validation-preview.test.ts`, `tests/services/moderation-service.test.ts`, `tests/services/preview-image-service.test.ts` | PASS (exit 0) | 119 passed | 4 files passed |
| oauth | `src/__tests__/authorize.test.ts`, `src/__tests__/body-validation.test.ts`, `src/__tests__/callback.test.ts` | TESTS PASS; command FAIL (exit 1) | 81 passed | Vitest global coverage thresholds failed because this focused run covered only 66.44% lines, 65.62% functions, 66.22% statements, 57.1% branches |
| image-worker | `src/dimensions.test.ts`, `src/index-limits.test.ts`, `src/photon-gate.test.ts`, `src/validators-cap.test.ts`, `src/validators.test.ts` | PASS (exit 0) | 75 passed | 5 files passed |
| api-worker | `src/telemetry/schema.test.ts`, `src/telemetry/origin.test.ts`, `src/telemetry/router.test.ts` | FAIL (exit 1) | 25 passed | 2 files passed; `telemetry/router.test.ts` failed during suite setup with `TypeError: Cannot convert undefined or null to object` |

## Artifacts

- `security-tests-presets-api.txt` / `.status.txt`
- `security-tests-oauth.txt` / `.status.txt`
- `security-tests-image-worker.txt` / `.status.txt`
- `security-tests-api-worker.txt` / `.status.txt`

## Follow-up commands and causes

- API import failure: current `src/lib/validation.ts` consumes `HARMONY_OFFSETS`, absent from stale core `dist`. Direct core compilation also encountered stale types (`ColorWheelId`/`LocaleData.colorWheels`). `pnpm turbo run build --filter=@xivdyetools/core...` refreshed all dependencies in order; the same three telemetry suites then passed all 44 cases. Logs: `core-dist-refresh.txt`, `core-dependency-build.txt`, `security-tests-api-worker-retry.txt`.
- OAuth focused coverage failure was expected for a partial suite under an always-enabled global gate. A full run initially exposed stale worker-kit output (rate-limit key missed the current tier suffix). `pnpm turbo run build --filter=xivdyetools-oauth-worker...` refreshed dependencies; `pnpm --filter xivdyetools-oauth-worker exec vitest run` then passed 346 tests and coverage. Logs: `security-tests-oauth-full.txt`, `oauth-dependency-build.txt`, `security-tests-oauth-final.txt`.
- No thresholds, snapshots, tests or source were relaxed or changed. The final git check showed only the new audit directory. This was targeted security verification, not the full monorepo release gate.
