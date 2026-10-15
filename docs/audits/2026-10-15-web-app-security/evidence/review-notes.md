# Review evidence and limitations

## Provenance

Review date: 2026-10-15. Source snapshot: `e4fd9fc0f5e45e398e14010e6894eed12d272dbc`. Source inspection and initial tests were read-only in the main checkout; documents were subsequently written in the isolated `codex/glamour-import-audit` worktree at the same commit. No dependencies were installed or rebuilt for this documentation task.

The initial independent parser review used `gpt-6.1-sol` at `medium`; the final independent security verification used `gpt-6-astra` at `high`. Both reviewed code read-only and directly probed the supplied files. The coordinator reviewed UI and equipment-API boundaries. Model/effort pairs were explicitly selected using the project routing policy; the role templates did not override them.

The notes below summarize observed tool results; they are not claimed to be raw test logs. The accompanying JSON is freshly captured output of the saved probe script. User pose files are not copied into this audit.

## Source map

| Boundary | Source at reviewed commit | Observation |
| --- | --- | --- |
| Tool wiring | `apps/web-app/src/components/glamour-tool.ts:84` | Reader creates shared CharaFileCard |
| Drop/picker | `apps/web-app/src/components/chara-file-card.ts:225,241` | Picker hint; any first dropped file forwarded |
| Read/parse/publish | `apps/web-app/src/services/chara-file-loader.ts:51,57,68,89` | Pre-read cap, local text read, parse, publish only after success |
| Cap | `apps/web-app/src/shared/constants.ts:127` | 20 × 1024 × 1024 bytes |
| Parse guard | `packages/core/src/services/chara/chara-parser.ts:384,388,408` | JSON, object and recognized-key checks |
| Malformed fields | `packages/core/src/services/chara/chara-parser.ts:268,281,323` | Whole-field splitting and error interpolation/serialization |
| Object handling | `packages/core/src/services/chara/chara-parser.ts:341,360,521` | Own-property enum lookups and selected-field reconstruction |
| Labels | `apps/web-app/src/components/chara-ui.ts:98`; `chara-file-card.ts:287,309` | Producer/name/filename rendered as text |
| Errors | `apps/web-app/src/components/toast-container.ts:164,171` | Message and details rendered as text |
| Equipment request | `apps/web-app/src/services/chara-resolve-service.ts:171,181,192` | Numeric model/facewear data only |
| API boundary | `apps/api-worker/src/chara/router.ts:46,67,83,156` | 8 KiB streamed cap, slot/count/uint16 checks |
| Telemetry | `apps/web-app/src/services/chara-file-loader.ts:73,83`; `telemetry-service.ts:177` | Parse outcome and normalized producer bucket, not raw TypeName |

## Supplied samples

| File | Bytes | Bones | Top-level fields | Parser result |
| --- | --- | --- | --- | --- |
| Trick & Treat Duo (L) F Middie Hyur.pose | 40,782 | 195 | FileExtension, TypeName, Position, Rotation, Scale, Bones | Rejected: no character colour fields |
| Trick & Treat Duo (R) F Middie Hyur.pose | 39,007 | 189 | Same six fields | Rejected: no character colour fields |

Both declare `Anamnesis Pose`; neither contains character colour keys. Producer text is not used as an authenticity or security check.

## Reproduction

From a checkout with existing `tsx` and core dependencies available, run the saved script against that checkout's source. Arguments are source root, then optional sample paths. It reads files and prints JSON only; it performs no network requests, writes or large stress allocations.

```powershell
node --import tsx docs/audits/2026-10-15-web-app-security/evidence/scripts/probe-chara-import.mjs . 'path/to/left.pose' 'path/to/right.pose'
```

For this capture the script lived in the document worktree and ran from the original checkout using its installed dependencies, with that original checkout as the explicit source root. Both checkouts were at the recorded source commit. The worktree itself did not have dependencies installed.

Synthetic cases cover a minimal valid field, the current null-only acceptance policy, ignored `__proto__` data, an HTML-shaped nickname retained as data, and a small deeply nested malformed field. The script checks expected outcomes; its probe is not a substitute for UI or integration tests.

## Focused test attempts from the initial review

| Command | Observed result |
| --- | --- |
| `pnpm --filter xivdyetools-web-app exec vitest run src/services/__tests__/chara-file-loader.test.ts src/components/__tests__/chara-file-card.test.ts --coverage.enabled=false` | Loader suite: 12 passed. File-card suite failed to load a transformed module from the sandbox temporary directory (`ENOENT`); no component assertions ran. Overall command exit 1. |
| `pnpm --filter xivdyetools-api-worker exec vitest run src/chara/router.test.ts --coverage.enabled=false` | Suite failed during import: `TypeError: CHARA_WEAR_RACE_COLUMNS is not iterable` at `src/chara/xivapi.ts:62`; 0 tests ran. Overall command exit 1. |

The core constant exists in source exports but was absent from the installed `dist/index.d.ts`, indicating stale built dependencies. No rebuild or test/source repair was performed. The component temporary-file error was not root-caused. Neither failure proves an import vulnerability; neither may be reported as a passing integration check.

## Limits

- No live production/browser penetration test, broad dependency audit, full privacy-policy reconciliation, or other core-consumer review was performed.
- A caught nested-input error was reproduced; actual browser unresponsiveness and peak memory were not measured.
- No secret rotation, policy amendment, release or deployment follows from the confirmed evidence.
- Re-run source probes and tests against the implementation branch before closing either finding.
