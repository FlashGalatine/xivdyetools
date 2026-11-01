# Review: core-legacy (displaced `.chara` parse-and-resolve cluster in `@xivdyetools/core`)

HEAD 88189ee8, read-only. Reviewer key `core-legacy`, deploy unit tag `core`.
References were counted over tracked files only (`git grep -n -w`, `symrefs.sh`, `members.py`).

## Module map (who imports whom, runtime vs type)

```
chara.ts (/chara subpath) ──► chara-library.ts ──runtime──► chara-parser.ts   (MAX_CHARA_FILE_BYTES only, :24)
                                              ──type────► chara-resolver.ts (StainIdLookup, ResolvedGearDye, :26)
                                              ──type────► chara-models.ts   (CharaGearModel, :25)
index.ts ──► chara-library-resolve.ts ──runtime──► chara-palette-provider.ts ──runtime──► chara-shader-colors.ts ──dyn import──► data/character_colors/shader/*.json
                                    ──type────► chara-resolver.ts (StainIdLookup, :15)
          chara-palette-provider.ts ──type──► CharacterColorService (interface sheets, data/character_colors/{shared,race_specific})
chara-library-types.ts ──type──► chara-resolver.ts (ResolvedCharaCharacter, :8)
chara-models.ts ──type──► chara-parser.ts (CharaGearSlotId, :21)
LEGACY: chara-parser.ts ──runtime──► chara-models.ts (isWornCharaModel, isCharaWeaponSlot), utils (clamp), @xivdyetools/types
        chara-resolver.ts ──runtime──► chara-shader-colors.ts (charaShaderHex), ColorConverter; type ► chara-parser, CharacterColorService
```

Answer to "which tables does the facade read": `createCharaPaletteProvider` (chara-palette-provider.ts:79-139) reads the
**host** interface sheets through `CharacterColorService` (getEyeColors … getSkinColors/getHairColors) and the host
**shader** tables through `charaShaderHex` (:121, :136). xivcharakit's own bundled corpus (`createDefaultPaletteProvider`)
is imported only by two tests (chara-palette-provider.test.ts:2,6 and chara-library-parity.test.ts:21,355); the provider
test pins host == bundled. So `data/character_colors/**` is the live data source of the facade, not a duplicate that
can go (decision 5.15.0 CHANGELOG: "so no second palette corpus ships").

## Reference table (legacy symbols)

Command: `git grep -n -w <sym> -- apps packages scripts e2e ':!docs' ':!**/CHANGELOG*'` minus the defining file.

| Symbol | Production refs (outside defining file) | Test refs | Verdict |
|---|---|---|---|
| `parseCharaFile` | index.ts:184 only | core chara-parser.test.ts, chara-parser-proto.test.ts, chara-resolver.test.ts, chara-library-parity.test.ts:28,241, chara-library.test.ts:45; bot-logic swatch.test.ts:8,226,386,410,454 | test-only |
| `resolveCharaColors` | index.ts:199 only | chara-resolver.test.ts, parity :29,242, chara-library.test.ts:46, bot-logic swatch.test.ts:9,33,386,410,454 | test-only |
| `OFF_GRID_DELTA_E2000` (@public) | index.ts:200 only | chara-resolver.test.ts:6,142,160; swatch.test.ts:66 (comment) | test-only |
| `ParsedCharaFile` (@public) | index.ts:187; chara-resolver.ts (legacy); chara-library-types.ts:3 (comment) | parity note :3260 | legacy-only |
| `CharaColorSlotRaw` (@public) | index.ts:189 only (+ parser/resolver) | 0 | legacy-only |
| `CharaGearDye` (@public) | index.ts:191 only (+ parser) | 0 | legacy-only |
| `MAX_CHARA_FILE_BYTES` | chara-library.ts:24,143; web-app chara-file-card.ts; discord-worker chara-attachment.ts | several | LIVE (lives in legacy file) |
| `CharaSlotId` | web-app chara-sheet.ts:23, swatch-tool.ts:32; bot-logic swatch.ts:30 | | LIVE type |
| `CharaGearSlotId` | chara-models.ts:21, api-worker, web-app glamour-block/glamour-list-actions | | LIVE type |
| `CharaSlotInertReason`, `CharaSlotVerdict`, `CharaSlotErrorCode` | members of ResolvedCharaSlot | | LIVE via ResolvedCharaSlot |
| `ResolvedCharaSlot` | bot-logic swatch.ts:34,270-272,333,339 (toLegacySlot → svg card) | | LIVE type |
| `ResolvedCharaCharacter` | chara-library-types.ts:43 (base of ImportedCharaCharacter); bot-logic swatch.ts:102, glamour.ts:41,311,436-440 | web-app glamour-sheet.test.ts:7 | LIVE type |
| `ResolvedGearDye` | chara-library.ts:26,231; web-app glamour-block.ts:35,624,832 | | LIVE type |
| `StainIdLookup` | chara-library.ts:26,212; chara-library-resolve.ts:15,36 | | LIVE type |
| `charaShaderHex` / `CharaShaderPalette` | chara-palette-provider.ts:12,121,136 (+ legacy resolver) | chara-shader-colors.test.ts | LIVE |
| `CharacterColorService` (all 14 methods) | members.py: every method extSrc >= 1 (palette provider, og-worker character-cells.ts:18, web-app swatch-tool.ts:28) | | LIVE |
| `isWornCharaModel` / `isCharaWeaponSlot` | api-worker chara/router.ts:20,117,121 (+ legacy parser) | | LIVE |

No production hit in apps/web-app, apps/discord-worker, apps/api-worker, apps/og-worker, apps/stoat-worker, scripts/ or
any e2e dir for `parseCharaFile` / `resolveCharaColors`. Only consumers outside core: bot-logic **tests**.

## npm / semver

- `npm view @xivdyetools/core version` → 5.15.0; local packages/core/package.json:3 → 5.15.0 (already published, so no
  pending entry to fold into; the [Unreleased] section holds only the audit:dyes note).
- `git log -S parseCharaFile -- packages/core/src/index.ts` → 3fe098c1 2026-08-07 (local version 3.0.0 then); the
  CHANGELOG lists the pair under [5.0.0] (:1008-1009). `npm view @xivdyetools/core versions` has no 5.0.0, so the first
  npm release carrying them is 5.1.0; every release since (5.1.0 … 5.15.0) exports `parseCharaFile`, `resolveCharaColors`,
  `OFF_GRID_DELTA_E2000`, `ParsedCharaFile`, `CharaColorSlotRaw`, `CharaGearDye`, `CharaSlotVerdict`, `CharaSlotErrorCode`.
- Removing any of them from the barrel = **MAJOR (core 6.0.0)**. Relocating the live types/constant under the same
  exported names = NONE.
- packages/core/CLAUDE.md:191 records the decision "the legacy parser/resolver stay for now"; the 5.15.0 CHANGELOG (:17)
  says the contracts are unchanged. Memory: beta acceptance of the integration and the npm publish are still owed.

## Parity harness (chara-library-parity.test.ts, 8,186 lines)

- 261 cases (`classification`: 138 preserved, 123 intentional), registered three ways (:8184-8186): `[register]`
  integrity, `[host]` legacy runner (:239-345, imports parser/resolver by relative path :28-29, so knip and the
  public-surface scan never see it), `[library]` runner on xivcharakit's bundled provider (:355-523).
- Host half size (scratch script parity_count.py): 1,393 lines in multi-line `host: {…}` blocks + 126 single-line
  `host:` rows + HostSlotExpect/HostExpect (:38-75) + runner/assertHost/assertDelta (:232-317) + :338-345 ≈ 1,650 lines.
  Library half: 3,189 + 38 lines of `lib:` blocks.
- Decision: REFACTOR FIRST. The library half is the only case-level regression pin on an exact-pinned **beta**
  dependency (`xivcharakit@0.1.0-beta.4`) and must survive; the host half dies with `parseCharaFile`. The integrity
  test (:328-335) requires a non-empty `host` per case and must be rewritten. The `note` strings are the source of the
  frozen register docs/research/2026-10-22-xivcharakit-integration.md (dated research tier, never edited), so keep
  them. Revisit trigger: the legacy-removal change (candidate 03) — do both in one PR.

## Candidates (detail)

core-legacy-01 REFACTOR FIRST — move `MAX_CHARA_FILE_BYTES` out of chara-parser.ts.
  Proof: chara-library.ts:24 `import { MAX_CHARA_FILE_BYTES } from './chara-parser.js'` is the ONLY runtime edge from the
  live facade into the legacy module; chara.ts:16 → chara-library.ts → chara-parser.ts means the `/chara` subpath (web-app
  inspection worker) has the legacy parser in its runtime closure (chara-entry.test.ts:69-131 allows it because it only
  forbids color/dye/palette modules). Its doc (chara-parser.ts:75-79) says "`parseCharaFile` does not check it … Each
  caller enforces it where the bytes are" — stale since inspectCharaForTools enforces it (chara-library.ts:143).
  Fix: define it in chara-library.ts (or a tiny chara-limits.ts), re-export unchanged from index.ts:184; update the doc.
  Semver NONE. Must precede 03.

core-legacy-02 REFACTOR FIRST — relocate the live legacy type contracts.
  Live types declared in legacy files: chara-parser.ts:84-102 (CharaSlotId, CharaGearSlotId, CharaSlotInertReason) and
  chara-resolver.ts:53-129 (CharaSlotVerdict, CharaSlotErrorCode, ResolvedCharaSlot, ResolvedGearDye,
  ResolvedCharaCharacter, StainIdLookup). Consumers in the table above. `ResolvedCharaCharacter.race` is typed
  `ParsedCharaFile['race']` (chara-resolver.ts:110) — replace with `Race | null`. Move into chara-library-types.ts (or a
  chara-types.ts) and repoint chara-models.ts:21, chara-library.ts:26, chara-library-resolve.ts:15,
  chara-library-types.ts:8, index.ts:185-197,260-271. Semver NONE (same names, same shapes). Must precede 03.

core-legacy-03 REMOVE WITH CAUTION (MAJOR) — `parseCharaFile` + `resolveCharaColors` and their tests.
  Proof: reference table rows 1-2 (zero production references in any workspace). Removes the remaining bodies of
  chara-parser.ts (~575 of 615 lines after 01/02) and chara-resolver.ts (~365 of 453), chara-parser.test.ts (660),
  chara-parser-proto.test.ts (46), chara-resolver.test.ts (349), chara-library.test.ts:45-46, index.ts:184 (function
  half), :198-199. Keep trigger: the integration's beta acceptance (web-app 5.16.0 / discord-worker 5.9.0 confirmed in
  production) and a planned core 6.0.0; CLAUDE.md:191 "stay for now" is the maintainer's standing decision.
  Security note: the parser carries FINDING-002/-027 and BUG-133 hardening; nothing in production runs it any more, so
  removing it also removes un-exercised attack surface for npm consumers who still call it — say so in the 6.0.0 notes.

core-legacy-04 REMOVE WITH CAUTION (MAJOR) — legacy-only public symbols `ParsedCharaFile`, `CharaColorSlotRaw`,
  `CharaGearDye`, `OFF_GRID_DELTA_E2000` (all `/** @public */`, index.ts:186-191,200). Zero consumers beyond the legacy
  pair and its tests (table rows 3-6). They only describe `parseCharaFile` input/output and the legacy threshold; the
  facade's off-grid verdict comes from xivcharakit. Same release as 03.

core-legacy-05 REFACTOR FIRST — strip the host half of the parity harness, keep the library half (see section above).

core-legacy-06 REFACTOR FIRST (bot-logic, test) — swatch.test.ts:386,410,454 compute expectations with the legacy
  pipeline (`resolveCharaColors(parseCharaFile(text), new CharacterColorService())`) and compare them with
  `executeSwatch`, which runs the facade (swatch.ts:5, chara-identity.ts). A cross-pipeline oracle: rewrite with
  `resolveCharaForTools(inspectCharaForTools(text), new CharacterColorService())` or literals. Blocks 03 (the imports at
  :8-9 would break). Semver NONE.

core-legacy-07 REMOVE (bot-logic, test) — dead mock wrapper swatch.test.ts:33 `resolveCharaColors:
  vi.fn(actual.resolveCharaColors)`. Proof: `git grep -n -E "mocked\(|mockImplementation" -- packages/bot-logic/src/commands/swatch.test.ts`
  → only :483 (generateSwatchCard) and :524 (resolveCharaForTools); `git grep -n resolveChara -- packages/bot-logic/src/commands/swatch.ts`
  → no call of resolveCharaColors (comments only). Wrapping is not needed to compute expectations. Remove the line and
  the comment clause at :27-28. Independent of 03; can go now.

core-legacy-08 REMOVE (comment) — build-character-colors.ts:18 "Only the `.chara` resolver reads them, to judge a
  float." Wrong since 5.15.0: chara-palette-provider.ts:12,121,136 reads the shader tables through `charaShaderHex`.
  Fix now; after 03 the provider is the ONLY reader.

core-legacy-09 REMOVE (comment) — index.ts:202-203 "the parser emits the keys, nothing in core resolves". In production
  the gear model keys are emitted by `resolveCharaWithProvider` (chara-library.ts:230-241); the parser emission is
  test-only. Fix now.

## KEEP items (with triggers)

- K1 `data/character_colors/shader/{shared,race_specific}.json` + chara-shader-colors.ts: read by the live palette bridge
  (chara-palette-provider.ts:121,136). Duplicates xivcharakit's bundled corpus on purpose (provider test pins equality).
  Trigger: xivcharakit publishes a shader-only palette entry small enough to replace the host tables, or the host
  accepts shipping the library corpus.
- K2 `CharacterColorService` + `data/character_colors/{shared,race_specific}`: all 14 methods have production callers
  (members.py). No trigger.
- K3 `scripts/build-character-colors.ts` + package.json:32 `build:character-colors`: regenerates K1/K2. No trigger.
- K4 the five `.chara` fixtures: also read by apps/web-app/src/services/__tests__/chara-inspection-service.test.ts:54-60
  and workers/__tests__/chara-inspection.worker.test.ts, and by the parity library half. Trigger: none of those remain.
- K5 chara-models.ts `isWornCharaModel`/`isCharaWeaponSlot`: api-worker router.ts:20,117,121. Losing the parser call
  sites in 03 leaves them live.

## Cascade graph and removal order

```
01 MAX_CHARA_FILE_BYTES move ─┐
02 type relocation ───────────┼─► 06 bot-logic oracle rewrite ─► 03 parser+resolver+tests ─► 04 legacy-only public types
07 dead mock (independent)    │                                   └─► 05 parity host half (same PR as 03)
08, 09 comments (independent) ┘
After 03: chara-shader-colors.ts:10-12, packages/core/CLAUDE.md:191 and :230, docs/projects/core/services.md:309-312,
docs/projects/core/overview.md:113, chara-library-types.ts:2-3, swatch.test.ts:66 comment all describe the removed pair
and must be edited in the same PR; utils `clamp` and chara-models stay live (other callers).
Nothing in data/ or scripts/ becomes dead (K1-K3). Order: 07, 08, 09 now -> 01, 02 (NONE) -> 06 -> 03+04+05 in core 6.0.0.
```

## Not covered

- Whether the web-app test glamour-sheet.test.ts:7 typing fixtures as `ResolvedCharaCharacter` (component takes
  `ImportedCharaCharacter`, glamour-block.ts:34,268) is stale: web-app reviewer's scope.
- bot-logic `__fixtures__/chara-fixtures.ts` duplication of core fixtures: bot-logic reviewer's scope.
- Bundle-size effect of 01 on the web-app inspection worker was not measured (no build run).
- Advisor/Fable review skipped: the user-level usage gate could not be read from this worker.

## FILES COVERED

packages/core/src/services/chara/{chara-parser,chara-resolver,chara-shader-colors,chara-palette-provider,chara-library,
chara-library-resolve,chara-library-types,chara-models}.ts, packages/core/src/chara.ts, packages/core/src/index.ts (chara
section), packages/core/src/services/CharacterColorService.ts (members.py), packages/core/scripts/build-character-colors.ts
(header), packages/core/package.json, packages/core/CHANGELOG.md (5.15.0, 5.0.0), packages/core/CLAUDE.md,
packages/core/src/__tests__/chara-entry.test.ts, packages/core/src/services/chara/__tests__/{chara-library-parity,
chara-library (public surface + import graph), chara-palette-provider (header)}.test.ts, packages/bot-logic/src/commands/
{swatch.test.ts, swatch.ts (legacy adapter), glamour.ts (types)}, docs/projects/core/services.md,
docs/research/2026-10-22-xivcharakit-integration.md (status).
