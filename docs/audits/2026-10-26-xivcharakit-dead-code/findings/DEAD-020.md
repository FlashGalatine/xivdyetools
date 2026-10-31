# DEAD-020: Move MAX_CHARA_FILE_BYTES out of the legacy parser (only runtime edge from the live facade into chara-parser.ts)
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** core · **Semver:** NONE · **Category:** Legacy

## Location
- `packages/core/src/services/chara/chara-parser.ts:65-81`
- `packages/core/src/services/chara/chara-library.ts:24,139-143`
- `packages/core/src/index.ts:184`

## Evidence
- git grep "chara-parser" in packages/apps/scripts: the only production value import is chara-library.ts:24 (MAX_CHARA_FILE_BYTES); chara-models.ts:21 and chara-resolver.ts:34-40 are `import type`; index.ts:184/197 is the barrel. chara.ts (the /chara subpath) re-exports chara-library, so the module graph reaches chara-parser.ts (615 lines by wc). The constant has 1 definition (chara-parser.ts:81); its consumers are chara-library.ts:143, the root barrel, discord-worker and web-app (via '@xivdyetools/core'), and one test. npm view: core 5.15.0, and './chara' does not export it. Doc :75-79 lists only the transports, but inspectCharaForTools enforces it at :143. Built worker dist: 8192 is inlined, with 0 '.chara field' or 'unparseable' strings.
- The claim holds. The constant is the only runtime edge from the live xivcharakit facade (and the /chara subpath) into the legacy parser module, so it has to move before core-legacy-03 can delete chara-parser.ts. The doc at chara-parser.ts:75-79 is stale: it says each transport enforces the cap, but inspectCharaForTools now enforces it too. One nuance: the cost is at the module-graph level only. The shipped web-app worker bundle tree-shakes the parser body and inlines 8192, so there is no bundle-size gain. The value of the move is that it unblocks the removal. The public export name and value stay the same, so the change is semver NONE (patch).
- Still live: packages/core/src/services/chara/chara-library.ts:143 (inspectCharaForTools); apps/discord-worker/src/utils/chara-attachment.ts:14; apps/web-app/src/services/chara-file-loader.ts:13; apps/web-app/src/components/chara-file-card.ts:19. These import the root barrel, whose public name is unchanged.

## Fix
- **REFACTOR FIRST** — 1) Create packages/core/src/services/chara/chara-limits.ts holding the moved constant and its doc. Name inspectCharaForTools as an enforcer and drop the 'parser does not check it' framing. 2) chara-library.ts:24: import from './chara-limits.js'. 3) index.ts:184: split into `export { parseCharaFile } from chara-parser` and `export { MAX_CHARA_FILE_BYTES } from chara-limits`. 4) Delete chara-parser.ts:65-81. 5) chara-library.test.ts:16: import from '../chara-limits.js'. 6) Run pnpm turbo run build type-check lint test --filter=...@xivdyetools/core, then pnpm dead-code:check.
- Prerequisite: None. This is itself the first step, and it lands in the same PR as core-legacy-03 or before it.
- Cascade: Prerequisite for core-legacy-03 (removing parseCharaFile/resolveCharaColors). Once it lands, chara-parser.ts has no production value importer. The type-only importers in chara-models.ts and chara-resolver.ts remain and are handled by core-legacy-02.
- Published: Exported from the root of @xivdyetools/core 5.15.0 (npm latest) and not from /chara. Moving the definition between internal modules while keeping the root export leaves the published API unchanged.

## Status
OPEN
