# DEAD-002: Stale comments and docs around the xivcharakit facade still describe the legacy parser as the live path, and two @entrypoint tags are inert
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** core (comments + npm README/NOTICE text) and docs; no code or API change · **Semver:** NONE · **Category:** Legacy
**Merged:** D29 (same root cause, per the calibration pass)

## Location
- `packages/core/scripts/build-character-colors.ts:18`
- `packages/core/src/index.ts:202-203`
- `packages/core/src/chara.ts:9-12`

## Evidence
- sed of each cited line: build-character-colors.ts:18 'Only the .chara resolver reads them'; but chara-palette-provider.ts:12,121,136 call charaShaderHex. git grep parseCharaFile in apps/ and packages/bot-logic: 0 production hits (only core barrel :184 and docs); gearModels built in chara-library.ts:230-241. Worker tracked, imports '@xivdyetools/core/chara' (chara-inspection.worker.ts:24) and calls resolveCharaWithProvider (:88). Bridge createCharaPaletteProvider at chara-palette-provider.ts:105. inspectCharaForTools passes maxBytes MAX_CHARA_FILE_BYTES (chara-library.ts:143). package.json:17,78 has ./chara and xivcharakit, but none of the 5 dep listings name them; README credits omit xivcharakit; NOTICE:28 covers it. npm view core latest 5.15.0 == local.
- Every primary claim checks out against the code at HEAD 88189ee8. These rows are wording fixes to comments and docs, not code removal, so lines_removed is 0 (about 13 comment lines plus doc rows are rewritten). One correction to core-legacy-08's cascade: chara-shader-colors.ts:10-12 and core CLAUDE.md:230 already name the palette provider and need no edit. core-legacy-09: parseCharaFile is published API (core 5.15.0 on npm) and still emits gearModels for npm consumers, so the reword should add the facade beside the parser rather than drop it. The README/NOTICE fix reaches npm only with the next core publish. It changes no API, so semver is NONE. The supply-harness rows stay as described (doc refactors). No code is removed.
- Still live: N/A (comments and docs). Facts they should describe: apps/web-app/src/workers/chara-inspection.worker.ts:24,88; packages/bot-logic/src/commands/chara-identity.ts:51; chara-palette-provider.ts:121,136.

## Fix
- **REMOVE** — Reword only, nothing deleted: (1) build-character-colors.ts:18 name the palette provider and the legacy resolver; (2) index.ts:202-203 name the facade (resolveCharaWithProvider) as the emitter, with legacy parseCharaFile kept for npm; (3) chara.ts:9-12 keep @entrypoint with a reason naming the landed worker file, no sibling symbols; (4) chara-library-types.ts:31-32 example to resolveCharaWithProvider; (5) parity test header drop 'Task 2'; (6) the docs rows. Then run pnpm dead-code:check, docs:check-links and docs:check-versions, plus the gate with --filter=@xivdyetools/core.
- Cascade: None in code. Reworded @entrypoint reason in chara.ts must not name sibling symbols (self-reference trap) and must keep a reason. core-legacy-08 cascade is partly moot: chara-shader-colors.ts:10-12 and CLAUDE.md:230 already mention the palette provider.
- Published: core 5.15.0 local == npm latest. No export changes; README.md and NOTICE ship in the tarball ("files": dist, README.md, NOTICE), so the credits fix appears on the next core publish only.

## Status
OPEN
