# Dead-code review: bot slice (key `bot-discord`)

Deploy unit: `@xivdyetools/bot-logic` 4.11.0 (published 2026-10-26T21:13Z, per `npm view @xivdyetools/bot-logic time`) + `xivdyetools-discord-worker` 5.9.0 (not published).
HEAD 88189ee8. Read-only. Advisor/Fable not used (worker role; usage gate not checked, so not escalated).

## Module map

| File | Role | Reads the .chara through |
|---|---|---|
| `packages/bot-logic/src/commands/chara-identity.ts` | shared read + identity line | `readCharaForTools` → core `inspectCharaForTools` → `resolveCharaForTools` (chara-identity.ts:46-52) |
| `packages/bot-logic/src/commands/swatch.ts` | /swatch | `readCharaForTools` only (swatch.ts:405). No `parseCharaFile` / `resolveCharaColors` in production code |
| `packages/bot-logic/src/commands/glamour.ts` | /glamour | `readCharaForTools` only (glamour.ts:444) |
| `packages/bot-logic/src/commands/__fixtures__/chara-fixtures.ts` | test fixture texts + helpers | n/a |
| `apps/discord-worker/src/utils/chara-attachment.ts` | attachment guards + capped download | n/a |
| `apps/discord-worker/src/handlers/commands/{swatch,glamour}.ts` | adapters | call `executeSwatch` / `executeGlamour` |

Legacy-parser check: `git grep -n -E "parseCharaFile|resolveCharaColors" -- packages/bot-logic apps/discord-worker apps/stoat-worker ':!*.md'` → only `packages/bot-logic/src/commands/swatch.test.ts` lines 8, 9, 33, 226, 386, 410, 454. No production code in the slice calls the legacy parser or resolver. The only production use of the legacy *types* is `ResolvedCharaSlot` / `ResolvedCharaCharacter` in swatch.ts:33-34, 102, 270-373 (the `SwatchResult.character` back-mapping) and `ResolvedCharaCharacter['…']` field types in glamour.ts:41, 311, 436-440 (structural; `ImportedCharaCharacter extends Omit<ResolvedCharaCharacter,'slots'>`, chara-library-types.ts:43).

## Reference tables

`bash docs/audits/2026-10-26-xivcharakit-dead-code/evidence/scripts/symrefs.sh packages/bot-logic <syms>`:

```
DUSKWIGHT_HETEROCHROMIA   prod=1 tests=4  other=0 | prod: __fixtures__/chara-fixtures.ts
HROTHGAR_HELIONS          prod=1 tests=2  other=0 | prod: __fixtures__/chara-fixtures.ts
charaFixtureObject        prod=1 tests=2  other=0
CHARA_CANARY_PATTERN      prod=1 tests=20 other=0
withCharaCanaries         prod=1 tests=4  other=0
charaBytes                prod=1 tests=10 other=0
charaBytesWithInvalidUtf8 prod=1 tests=4  other=0
charaTextOfBytes          prod=2 tests=8  other=0
getCharacterColors        prod=2 tests=0  other=0 | prod: chara-identity.ts only
readCharaForTools         prod=5 tests=0  other=0 | chara-identity.ts glamour.ts swatch.ts
CharaFileSource           prod=2 tests=0  other=0 | chara-identity.ts only
producerToken/genderSymbol prod=5 tests=0          | chara-identity.ts glamour.ts swatch.ts
tribeDisplay              prod=5 tests=10 other=0
SwatchCharacter           prod=5 tests=1  other=2 | swatch.ts index.ts | docs/research/2026-10-22-xivcharakit-integration.md docs/versions.md
toSwatchCharacter/toLegacySlot/legacyError prod=2 tests=0 other=0 | swatch.ts only
SwatchSlotOption          prod=5 tests=0  other=1 | apps/discord-worker/src/handlers/commands/swatch.ts
GlamourResolveAnswer      prod=4 tests=26 other=1 | apps/discord-worker/src/handlers/commands/glamour.ts
```
(“prod” for the fixture symbols is the fixture file itself, which symrefs buckets as prod because `__fixtures__/` is not in its test pattern.)

Readers of `SwatchResult.character`: `git grep -n -E 'result\.character|\.character\b' -- apps packages ':!*.md'` → no hit in any adapter (`apps/discord-worker/src/handlers/commands/swatch.ts` reads only `svgString`, `embed`, `error`, `errorMessage`: lines 125-157). Hits only in `packages/bot-logic/src/commands/swatch.test.ts` (251-256, 318-322, 364-365, 438) and `swatch-library.test.ts` (270-406, 549-716). `git grep -l -E 'executeSwatch|executeGlamour' -- apps packages` → no `apps/stoat-worker` file.

Locale keys (scratch `keyrefs.py`, quoted-literal search over tracked .ts/.js in apps+packages, stoat excluded, en.json keys matching swatch|glamour|chara|slot|grid|lip|tattoo|limbal|manual|matchImage): every `card.swatch*`, `card.slot*`, `card.charaFileReason.*`, `card.swatchSlotName.*`, `card.glamour*`, `card.glamourSlot.*` key has prod ≥ 1 **except** the `_one/_other` plural pairs (`card.swatchFootKey`, `card.glamourPieces/Worn/Dyes/Looks/FootShown/FootShownWorn/FootTwins/FootBlocked`) — all reached through `t.tc(base, n)` at swatch.ts:576 and glamour.ts:519-528 — and the dynamic `manual5.topics.*` / `commands.<cmd>.options.*` families (built by `/manual` and `localize.ts`). `commands.swatch.options.*` holds exactly `file`, `order`, `slot`, matching `schemas.ts:906-937`; `commands.glamour.options.*` holds `file` (schemas.ts:945-951). **No locale key survives from the removed 4.x `/swatch color|grid` subcommands.** `matchImage.*` keys are live in `extractor.ts`; `matchImageHelp.*` are live as the `/manual topic:match_image` page (manual.ts:33-110, 456; schemas.ts:594) — outside this slice.

## Candidates

### bot-discord-01 — `SwatchResult.character` and its legacy back-mapping are read by no adapter (REFACTOR FIRST, MAJOR)
- Source: swatch.ts:90-102 (`SwatchCharacter` doc + type), 109-110 (field), 270-373 (`LegacyVerdict`/`LegacyInertReason`/`LegacyError`, `LEGACY_VERDICTS`, `LEGACY_INERT_REASONS`, `legacyError`, `toLegacySlot`, `toSwatchCharacter`), 403/406 and the two `character` members of the returns (539, 632). index.ts exports `SwatchCharacter` `/** @public */`.
- Proof: grep above — zero production readers; discord adapter swatch.ts:125-157 never touches `result.character`. Shipped since 2026-08-08 (`ac701b32`, `SwatchResult.character: ResolvedCharaCharacter`) and as `SwatchCharacter` since `1e124e6c` (2026-08-29); published in every version up to 4.11.0 (`npm view` → 4.11.0 on npm). Removing a field of a published result type = MAJOR.
- Lines: ~122 source + swatch-library.test.ts 88-102, 545-716 (~187) + swatch.test.ts 251-257, 318-322, 364-365, 438 (~15) ≈ 324.
- Cascade: removes bot-logic's only production use of core `ResolvedCharaSlot` (and the `CharaSlotInertReason` / `CharaSlotErrorCode` legacy unions through it), a precondition for retiring core's legacy resolver types; the verdict assertions in swatch-library.test.ts §1 (270, 290, 311, 352-353, 385-386, 398, 406) must first be re-pinned on the card/embed or on `resolveCharaForTools`. `docs/versions.md` / research doc mention `SwatchCharacter`.
- Fix: in a 4.x minor mark `SwatchResult.character` and `SwatchCharacter` `@deprecated` (CHANGELOG note); in bot-logic 5.0.0 delete the field, the type, swatch.ts:270-373 and test §2.
- Keep trigger: an external npm consumer of `result.character` is found (npm dependents / issue), or the next bot-logic major is cut.

### bot-discord-02 — the test fixture module ships in the published tarball (REMOVE from dist, NONE)
- `packages/bot-logic/tsconfig.build.json` excludes `**/*.test.ts` and `**/__tests__/**` but not `**/__fixtures__/**`; `package.json` `files: ["dist","README.md"]`.
- Proof: `npm pack @xivdyetools/bot-logic@4.11.0 --dry-run --json` (run in the scratchpad) lists `dist/commands/__fixtures__/chara-fixtures.{js,d.ts,js.map,d.ts.map}`; local `packages/bot-logic/dist/commands/__fixtures__/` holds the same four. The `exports` map is `.` and `./i18n` only, so no consumer can import it → semver NONE.
- Also inflates coverage: `vitest.config.ts:13-20` includes `src/**/*.ts` and does not exclude `__fixtures__`.
- Only importers: swatch.test.ts:18, swatch-library.test.ts:34, glamour-library.test.ts:21. `scripts/check-dead-code.ts:69` already treats `__fixtures__/` as test-side.
- Fix: add `"**/__fixtures__/**"` to tsconfig.build.json `exclude` and `'src/**/__fixtures__/**'` to the coverage `exclude`. Tracked lines removed: 0 (removes ~4 files / two inline .chara documents from the tarball).
- Cascade: none.

### bot-discord-03 — `downloadCharaAttachment`'s text-only shape and the adapters' `fileText` are dead in production (REMOVE, NONE)
- chara-attachment.ts:92-96 (`DownloadedChara<B>` generic), 107-111 (`withBytes?: B`), 125-126 (decode + conditional shape). Both production callers pass `true` (`git grep -n 'downloadCharaAttachment(' -- apps` → glamour.ts:140, swatch.ts:100; the 6 text-only calls are all in chara-attachment.test.ts:131-178).
- The decoded `text` is passed on as `fileText` (glamour.ts:137,146,157; swatch.ts:74,110) but bot-logic reads `file.fileBytes ?? file.fileText` (chara-identity.ts:47) and both adapters always set `fileBytes`, so `fileText` is never read in production. swatch.ts:108-109's "the text stays for callers that read it" names no caller.
- Fix: return `{ ok: true, bytes }` always, drop the generic, the `TextDecoder` and both adapters' `fileText`; re-point chara-attachment.test.ts assertions at bytes and drop glamour.test.ts:153 / swatch.test.ts:218 `fileText` expectations. ~15 lines.
- Keep: bot-logic's `SwatchInput.fileText` / `GlamourInput.fileText` stay (published, see 08).

### bot-discord-04 — stale `resolveCharaColors` spy in swatch.test.ts (REMOVE, NONE)
- swatch.test.ts:27-36 wraps `resolveCharaColors: vi.fn(actual.resolveCharaColors)`. `git grep -n -E 'vi\.mocked|mockImplementationOnce' -- packages/bot-logic/src/commands/swatch.test.ts` → only `generateSwatchCard` (483) and `resolveCharaForTools` (524). The spy is never inspected and production never calls `resolveCharaColors`. The comment (28-29) says it "stays wrapped for the tests that compute expectations with it", but an expectation computed by a call does not need a spy. 1 line + 2 comment lines.

### bot-discord-05 — swatch.test.ts uses the legacy parser/resolver as its oracle (REFACTOR FIRST, NONE)
- swatch.test.ts:8-9, 226 (`parseCharaFile(WITH_NICKNAME).nickname` as the nickname guard), 386, 410, 454 (`resolveCharaColors(parseCharaFile(text), …)` to compute lip / highlights expectations). These are the only bot-slice references keeping core's legacy `parseCharaFile` / `resolveCharaColors` imported from bot-logic. Production uses the library facade, so these tests are a legacy-parity harness, not a test of the code path.
- Cascade: core's legacy parser removal (other reviewers' scope) breaks this file; do this first. swatch-library.test.ts already pins the same behaviors on literals (header 13-15).
- Fix: replace with `inspectCharaForTools(…)`'s nickname / `resolveCharaForTools` projection, or literal hexes as swatch-library.test.ts does. ~20 lines changed, ~6 removed.
- Keep trigger: keep while core still ships the legacy parser and wants bot parity checked.

### bot-discord-06 — unreachable `?? 'card.slotSkin'` fallback (REMOVE, NONE)
- swatch.ts:446 `t.t(SLOT_KEYS[slot.kind] ?? 'card.slotSkin')`. `SLOT_KEYS` (125-137) is typed `Record<string,string>` and covers all 10 values of the library's `kind` union `AppearanceSlot | 'tattoo' | 'limbalOrTattoo'` (`node_modules/.pnpm/xivcharakit@0.1.0-beta.4/node_modules/xivcharakit/dist/appearance/types.d.ts:3,17`): skin, hair, highlights, leftEye, rightEye, lip, facePaint, tattoo, limbalOrTattoo, limbal. Fix: type it `Record<ImportedCharaSlot['kind'], string>` and drop the fallback, so a new library kind becomes a compile error instead of a silent "SKIN" label. 1 line.

### bot-discord-07 — redundant `export` on module-internal helpers (REMOVE, NONE)
- chara-identity.ts:27 `export function getCharacterColors` and :33 `export interface CharaFileSource`: symrefs prod=2/tests=0/other=0, both references inside chara-identity.ts. Not in index.ts; not reachable through the exports map. Drop the two `export` keywords (0 lines removed).

### bot-discord-08 — `fileText` on the published inputs is test-only in-repo (KEEP)
- `SwatchInput.fileText` (swatch.ts:72-76), `GlamourInput.fileText` (glamour.ts:97-101), `CharaFileSource.fileText`, and the `NO_INPUT` throw (chara-identity.ts:48-50): every production caller passes `fileBytes` (see 03). Used by 69 test lines (`git grep -c fileText`). Published optional input since 4.11.0 CHANGELOG "fileText stays accepted". KEEP; trigger: bot-logic 5.0.0 (make `fileBytes` required, drop `fileText`, fold with 01).

### bot-discord-09 — `familySize ?? twins.length` / optional resolve fields (KEEP)
- glamour.ts:350; api-worker always emits `familySize` (apps/api-worker/src/chara/resolver.ts:144; types.ts:47 required). The fallback is dead for this repo's resolver but `GlamourResolvedItem` is a published `@public` resolver contract (index.ts:114-120). KEEP; trigger: next bot-logic major.

### bot-discord-10 — `FIXED_KEYS.noItem` entry is unreachable (KEEP)
- glamour.ts:363-368: `fixed.problem` is `lowest.problems[0]` (355-357), and `charaTwinProblems` (packages/core/src/services/chara/chara-game-rules.ts:146-152) only pushes `dye`/`glamour`/`wear`. `noItem` comes only from `readPiece`'s no-item branch (`blocked: 'noItem'`, glamour.ts:327), which sets `fixed: null`. Kept because `Record<CharaPieceProblem, string>` requires the key; removing it needs `Exclude<CharaPieceProblem,'noItem'>`. KEEP (1 line, type exhaustiveness).

### bot-discord-11 — stale "the parser echoes field VALUES" / legacy parse-rule comments (Legacy docs, NONE)
- apps/discord-worker/src/handlers/commands/swatch.ts:7-10 ("core parse rules: key presence not TypeName, gamma on the floats, flag gating, never Base64Image" — the legacy `parseCharaFile` rule list) and :15-17, :132-135; glamour.ts:177-178. The library's refusals carry fixed messages (`xivcharakit/dist/errors.d.ts` `messages` table) and bot-logic never relays any message (swatch.ts:417, glamour.ts:430). Keep the sanitiser; reword the rationale to "defense in depth".
- packages/bot-logic/README.md:67 example `[swatch] parse failed: AppError INVALID_INPUT` is the legacy parser's error; the facade throws `CharaInputError` with `DUPLICATE_KEY` / `INVALID_UTF8` / … (tests assert `\S+ DUPLICATE_KEY`, swatch.test.ts:519, swatch-library.test.ts:868). failure-kind.ts:6-7 "the .chara parser quotes field values" likewise.

## Not dead / notes
- REFUSED_FIELD_CODES is duplicated verbatim (swatch.ts:225, glamour.ts:233) and the clan·gender·producer `charSub` line is built twice (swatch.ts:477-482, glamour.ts:549-551): duplication, not dead code — candidate for chara-identity.ts.
- `UNUSABLE_REASONS` contains `missingShaderReference` (swatch.ts:209): whether the bot's palette provider can ever lack a shader reference was not proven — not covered.
- `/glamour` has no own entry in worker-kit `DISCORD_COMMAND_LIMITS` (configs.ts:91 has `swatch`), and stats.ts:326 `v5NewCommands` omits `glamour`: missing coverage, not dead code.
- No skipped tests, `.only`, snapshots or commented-out code in the slice (`git grep` for `.skip(|.todo(|.only|xit(` → rc=1; commented-statement grep → prose only).
- chara-fixtures.ts exports: every one has test importers (symrefs tests ≥ 2).

## FILES COVERED
packages/bot-logic/src/commands/{swatch.ts, glamour.ts, chara-identity.ts, failure-kind.ts, __fixtures__/chara-fixtures.ts, swatch.test.ts (full outline + legacy sections), swatch-library.test.ts (outline + §2), glamour.test.ts (header + AppError/log sections)}, packages/bot-logic/src/index.ts (chara exports), packages/bot-logic/src/i18n/locales/en.json (key scan; other five via the parity gate), packages/bot-logic/{README.md, CLAUDE.md, tsconfig.build.json, vitest.config.ts, package.json}, apps/discord-worker/src/handlers/commands/{swatch.ts, glamour.ts}, apps/discord-worker/src/utils/chara-attachment.ts + chara-attachment.test.ts (download section), apps/discord-worker/src/commands/{schemas.ts (swatch/glamour), registry.ts}, apps/discord-worker/src/handlers/commands/{stats.ts, manual.ts, about.ts} (grep), packages/worker-kit/src/rate-limiter/presets/configs.ts (grep).
Not read in full: glamour-library.test.ts, chara-identity.test.ts, discord-worker swatch.test.ts / glamour.test.ts (grep only), ja/de/fr/ko/zh locale JSON.
