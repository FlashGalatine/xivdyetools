# Package review — standard depth

Read-only reviewer pass at `main@0332fcc5`. Root collector owns Knip/tsc/gates; this pass used tracked-file `git grep` and the syntax survey, including `apps/stoat-worker`, `packages/test-utils/integration`, root scripts, package scripts, and every published subpath. No source files changed.

## Coverage

| Package | Tracked non-test src | Tests/integration | Scripts | Result |
|---|---:|---:|---:|---|
| auth | 9 | 9 | 0 | root + `/encoding`, `/jwt`, `/hmac`, `/timing`, `/discord`, `/revocation` checked |
| bot-logic | 20 | 20 | 0 | root + `/i18n`; Stoat imports included |
| core | 46 | 59 | 8 | root + `/blending`; generators and calibration scripts checked |
| logger | 13 | 9 | 0 | root + `/browser`, `/worker`, `/library` checked |
| svg | 18 | 20 | 0 | root-only published surface checked |
| test-utils | 18 | 14 | 0 | private root + four subpaths and integration suite checked |
| types | 31 | 4 | 0 | root + eight type-domain subpaths checked |
| worker-kit | 17 | 11 | 0 | root + middleware/rate-limiter/backend/preset subpaths checked |

`git grep -n -E 'from .@xivdyetools/(auth|logger|worker-kit|core|svg|bot-logic|test-utils|types)...' -- 'apps/**' 'packages/**' 'scripts/**'` was the consumer sweep. It confirmed live direct imports for `/encoding`, `/blending`, `/rate-limiter`, and `/i18n`; package manifests established the remaining entrypoints. `apps/stoat-worker` contributes live `executeDyeInfo`, `resolveColorInput`, `resolveDyeInput`, `sanitizeEmbedText`, `createLibraryLogger`, `Dye`, and `LocaleCode` consumers.

## Candidates and verdicts

| Item | Location | Evidence / estimate | Verdict |
|---|---|---|---|
| Public surface without in-repo references | all seven publishable package barrels | Every such syntax-survey lead is either `@public`, documented, or reached through a published subpath; removing a published export is MAJOR unless a future major already exists. | **KEEP** — revisit only in the package's next independently justified major. |
| `getSharedColors`, `getRaceSpecificColors`, instance/static `getAvailableLocales` | `packages/core/src/services/{CharacterColorService.ts:154,248;LocalizationService.ts:550}` | Previous `DEAD-006` remains accurate: no repo consumer, ~25 lines, core version previously matched registry. | **KEEP / MAJOR** — next core major. |
| `capGradientRows`, `MIXER_SWEEP_RATIOS`, `parseDyeIdInput` | `packages/bot-logic/src/{commands/gradient.ts:94,commands/mixer.ts:56,input-resolution.ts:39}` | Syntax survey under-counted same-file refs; production calls at `:308`, `:113`, `input-resolution.ts:55,75,206`. | Rejected suspicion (0 lines). |
| `hexToRyb`, `rybToHex` | `packages/core/src/services/ColorService.ts:676,686` | Test-only in-repo callers, but documented core public API in README/CLAUDE; published removal is MAJOR. | **KEEP / MAJOR** — next core major. |
| `GLYPH_SETS`, `bandSlices`, `placeGlyph` | `packages/svg/src/{icons/tool-icons.ts:342,palette-grid.ts:111,frame.ts:244}` | `GLYPH_SETS` is an explicit `@testonly` fixture; `bandSlices` and `placeGlyph` have production same-file callers. Former barrel-only trims already landed (DEAD-015). | Rejected suspicion (0 lines). |
| `createMockD1`, `authHeaders`, JWT/factory/mock helpers | `packages/test-utils/src/{cloudflare/d1.ts:477,auth/headers.ts:25,auth/jwt.ts:69}` | Private test toolbox: integration setup and Worker tests import helpers; `createMockD1` is retained for its own compatibility/test surface. | **KEEP** — revisit only if the integration/test callers are retired. |
| `WORKER_SPECIFIC_REDACT_FIELDS`, `looksLikeSecretValue` | `packages/logger/src/{constants.ts:44,core/base-logger.ts:594}` | Raw syntax count misses construction/internal calls; worker redaction array composes it and stringify/redaction paths call the predicate. | Rejected suspicion (0 lines). |
| rate-limiter Upstash/presets and backend subpaths | `packages/worker-kit/src/rate-limiter/index.ts:52-95` | Root apps consume `/rate-limiter`; Upstash is a documented published backend and presets have active app adapters. | **KEEP / MAJOR** — next worker-kit major if deprecation is planned. |

No orphan production modules, stale skipped tests, unreferenced package scripts, or removable dependencies were confirmed. The core generators are package-script/manual-maintenance entrypoints; `munsell-anchors.json` is explicitly test data used by the Munsell test. The prior audit's test-utils and svg removals are present, so they were not re-filed.

Limit: this standard-depth review did not query npm or inspect external consumers. In-repo zero-reference results for published APIs are therefore KEEP/MAJOR leads, never safe deletion evidence; dynamic/computed property access was checked only for the listed syntax-survey leads.
