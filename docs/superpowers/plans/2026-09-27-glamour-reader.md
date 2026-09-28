# Glamour Reader Implementation Plan

**Status:** executed 2026-09-27 — B #208, C #209, D #210, R1 exported (files outside the repo); final whole-branch review: 5 Important + 4 re-graded Minor fixed, 11 minors deferred · Native execution, "Everything drawn", the designer's picks adopted

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the user chose Native) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Glamour Reader as the tenth tool — web screen (verdict first, twin picker, export sheet with the Acquisition line), its glyph, its OG card and ten-tool root rail, the `/glamour` bot command, and the Rich Presence art — as drawn in the Claude Design project.

**Architecture:** The reader hosts the DYES ON THIS GLAMOUR block (moved out of the Swatch Matcher) on PR #206's `CharaSessionService`. The prototype's in-game check (core `chara-game-rules`) loses its job test and gains a Grand Company flag and a default-twin rule; api-worker's resolve search follows. A pure twins module decides each piece's named twin and tone; a sheet writes the GPOSERS list with per-piece, device-kept Acquisition edits. The bot reuses the resolve answer through the existing api-worker service binding and draws a new svg row kind.

**Tech Stack:** TypeScript 5.9 (strict, `verbatimModuleSyntax`), Vitest 5, Playwright (web-app e2e + asset export), Lit/DOM (web-app), Hono + resvg (workers), `@xivdyetools/svg`.

**Spec:** [`docs/superpowers/specs/2026-09-27-glamour-reader-design.md`](../specs/2026-09-27-glamour-reader-design.md) · acquisition: [`2026-09-27-glamour-acquisition.md`](2026-09-27-glamour-acquisition.md) (PR A)

## Global Constraints

- Identifier `glamour` everywhere (route `/glamour`, `ToolId`, `TOOL_ICONS`, telemetry, `tool_glamour`).
- Glyph 1a geometry verbatim from the design's `tool-glyph.js` (`TUNIC` outline + `rect F x="12.6" y="15.6" width="6.8" height="6.8" rx="1.6"`; detail adds `M9.9 25 H22.1` and `M16 9.4 V13.4` at 1.2).
- Colours from the design: fix `#7ee08a`, warn/block `#ffd166`, accent `#EA4133`/`#FF6257`, mute `#9C9CA2`/`#6E6B65`, grounds `#0B0B0C`/`#141416`, lime `#BDEE63` (RP only).
- No character name anywhere the reader writes or the bot posts. The `.chara` file never leaves the browser; the bot reads the attachment in memory only.
- Every UI string in all six locales in the same commit; the i18n parity and locale-quality gates must pass.
- Commits in the task's worktree only, `git commit --only -- <paths>`, `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push `main`.
- Single test file: `pnpm --filter <pkg> exec vitest run <file> --coverage.enabled=false`.

## Review Focus

1. **A family whose lowest row fails but no named twin is in the capped alternates** — the default must still be a twin whose name we can print; fall back to the best named twin, never an id without a name. Test: B3 "never defaults to a twin without a name".
2. **An edited acquisition line after a twin pick** — the edit stays, the warning shows, nothing is overwritten. Test: B6 "keeps an edit across a twin pick and flags it".
3. **A file loaded in the Swatch Matcher, then the reader opened** — no second drop; SWAP in either clears both. Test: B5 e2e "one file, two tools".
4. **A GC-locked piece** — flagged, never counted as NO FIX. Test: B1 "flags a Grand Company piece without failing it".
5. **Narrow desktop (769–919 px) with ten chips** — hovering a chip must not clip the rail. Test: B4 e2e at 800 px.

---

## Branches and worktrees

| PR | Branch | Base | Worktree |
|---|---|---|---|
| A | `feat/glamour-acquisition` | `main` | `.claude/worktrees/glamour-acquisition` |
| B | `feat/glamour-reader` | `origin/claude/glamour-check-prototype` (→ #206) | `.claude/worktrees/glamour-reader` |
| C | `feat/glamour-og` | `main` (+ svg glyph from B, rebased when B merges) | `.claude/worktrees/glamour-og` |
| D | `feat/glamour-bot` | B | `.claude/worktrees/glamour-bot` |

PR A follows its own plan (Tasks 1–6). This plan covers B, C, D and the RP export.

---

### Task B1: core — the check without jobs, with Grand Company and a default twin

**Files:** Modify `packages/core/src/services/chara/chara-game-rules.ts`, `packages/core/src/index.ts`; test `packages/core/src/services/chara/__tests__/chara-game-rules.test.ts`.

**Interfaces — Produces:**
- `CharaItemRules { dyeCount: number; glamourable: boolean; wearMask: number | null; grandCompany: number }` (0 = any).
- `CharaPieceCheck { slot; problems: CharaPieceProblem[]; useInstead: {itemId; fixes} | null; needsGrandCompany: number | null }`.
- `CharaLookCheck { pieces: CharaPieceCheck[] }` (no `jobs`).
- `charaTwinProblems(twin, dyedChannel, character): CharaPieceProblem[]` (exported for the web twins module).
- Removed: `CHARA_JOB_COLUMNS`, `CharaJob`, `charaJobsOf`.

- [ ] Tests first: jobs gone from the rule key; GC flag (`needsGrandCompany` set, `problems` empty, still counted as wearable); GC twins grouped separately; existing dye/glamour/wear cases unchanged.
- [ ] Implement; `groupCharaTwinRules` key becomes `dye|glamour|wear|gc`.
- [ ] `pnpm turbo run build type-check lint test --filter=@xivdyetools/core` green; bump core minor + CHANGELOG.
- [ ] Commit `feat(core): the in-game check drops jobs and flags Grand Company gear`.

### Task B2: api-worker — resolve rules follow the check

**Files:** `apps/api-worker/src/chara/xivapi.ts`, `cache.ts`, tests beside them.

- [ ] Tests first: `ITEM_FIELDS` has `GrandCompany.row_id`, no `ClassJobCategory`; `parseItemRow` reads GC (`{ value: 2 }` → 2, absent → rules null); `SHAPE_VERSION` 3.
- [ ] Implement; verify one live call (`/api/sheet/Item/1618?fields=GrandCompany.row_id` → 2).
- [ ] Commit `feat(api-worker): resolve rules carry Grand Company, not jobs`.

### Task B2b: svg — the glamour glyph

**Files:** `packages/svg/src/icons/tool-icons.ts` (+ test), `packages/svg/CHANGELOG.md`, `package.json`.

- [ ] Test: `toolGlyph('glamour','compact')` and `'detail'` render, exactly one filled accent, detail has two 1.2-weight paths.
- [ ] Add `glamour` to `ToolGlyphName`, `TOOL_COMPACT`, `TOOL_DETAIL`. Minor bump. Commit `feat(svg): the Glamour Reader glyph (1a)`.

### Task B3: web-app — twins, the pure module

**Files:** Create `apps/web-app/src/shared/glamour-twins.ts` + `src/shared/__tests__/glamour-twins.test.ts`; extend `chara-resolve-service.ts` types (`acquisition?` on item and alternates, `rules`).

**Interfaces — Produces:**
- `interface GlamourTwin { itemId; names; acquisition?; rules: CharaTwinRules | null; dated: boolean; problems: CharaPieceProblem[]; needsGrandCompany: number | null }`
- `twinsOf(item: CharaResolvedItem, dyedChannel, character): GlamourTwin[]` — named + alternates, row order.
- `defaultTwin(twins): GlamourTwin` — passes → not Dated → lowest row_id; none passes → lowest.
- `pieceTone(item, twins, picked): 'fix' | 'block' | 'choice' | 'unique'`.
- `twinFacts(twin, character, isDefault): Array<{ key: 'best'|'dye'|'tribe'|'dated'|'gc'; kind: 'acc'|'ok'|'warn'|'mute'; n?: number }>`.

- [ ] Tests: Hempen Coif family (372 Dated ×0, 2629 ×1, 2630 ×1) with Snow White → 2629, tone fix, facts; Curtana Zenith (not glamourable) → Replica; Lord's → Lady's for a woman; Augmented pair → choice; Viera Gaskins on a Midlander → block; "never defaults to a twin without a name".
- [ ] Implement; commit.

### Task B4: web-app — the tenth tool's registration

**Files:** `router-service.ts`, `v4-layout.ts`, `v4/v4-app-header.ts` (+ globe drop < 920 px), `shared/tool-icons.ts`, `keyboard-service.ts` (`'0'`), `apps/api-worker/src/telemetry/schema.ts`, locales ×6 (`tools.glamour.*`), every other `ToolId` switch the compiler finds, docs `docs/projects/web-app/tools.md`.

- [ ] Registration tests (router has `/glamour`; header lists ten; keyboard `0`; telemetry allows `glamour`).
- [ ] Implement with a minimal `glamour-tool.ts` shell; e2e at 800 px: hover the last chip, the rail's right edge stays inside the header.
- [ ] Commit `feat(web-app): the Glamour Reader joins the tool rail`.

### Task B5: web-app — the reader screen (1a/1b)

**Files:** `components/glamour-tool.ts`, `components/glamour-block.ts` (hosted by the reader; job spread out; picked names, `+N`, tone, note), `components/glamour-twin-picker.ts`, `components/swatch-tool.ts` (block out, *Glamour Reader →* link), `components/chara-file-card.ts` (cross-tool link + privacy clause), locales ×6.

- [ ] Unit tests: verdict headline/counts from a check; block rows use the picked twin; Swatch no longer mounts the block.
- [ ] Implement desktop 1a + mobile 1b (picker as a bottom sheet under 768 px).
- [ ] e2e: load `stress`-like sample → verdict → pick a twin → row changes; "one file, two tools".
- [ ] Commit.

### Task B6: web-app — the export sheet (2c) and Acquisition edits

**Files:** `shared/acquisition-edits.ts` (+ test), `shared/glamour-markdown.ts` (+ test: acquisition line in all three renderings), `components/glamour-sheet.ts` (+ test), `components/glamour-list-actions.ts`, locales ×6.

- [ ] Tests: `gearHash` stable and independent of the pick; set/get/reset; "keeps an edit across a twin pick and flags it"; markdown writes `Acquisition: <line>`.
- [ ] Implement the sheet (desktop 2-pane over the reader; mobile full height); Copy list / Save .md write the sheet's text.
- [ ] Commit.

### Task B7: PR B — versions, changelogs, docs, gates

- [ ] web-app 5.13.0, api-worker next minor, core/svg minors; `CHANGELOG.md` + `CHANGELOG-laymans.md` (web-app + root); `docs/versions.md`, README table; `docs/projects/web-app/*`; `docs/reference/chara.md` (GC field).
- [ ] Full gate + `test:scripts`, `dead-code:check`, `docs:check-*`; bundle budget (`run build:check`).
- [ ] Push, open PR B (base: `claude/glamour-check-prototype`, noting #206 → prototype → B).

### Task C1: og-worker — the glamour default card and the root pair

**Files:** `og-worker/src/services/svg/default-card.ts` (`DEFAULT_DECK.glamour`), `services/og-strings.ts` ×6 (name, sub, tag), `og-data-generator.ts` (`case 'glamour'` → `toolDefault`), `index.ts` tool list, tests; `apps/web-app/public/og/default.png` + `default-x.png` re-exported (Playwright over the design's export page at ×3).

- [ ] Tests: default card for `glamour` in both frames; strings parity; font coverage.
- [ ] Export the root pair; commit; og-worker version + changelog; PR C.

### Task D1: `/glamour` — card, logic, command

**Files:** `packages/svg/src/glamour-card.ts` (+ test, export), `packages/bot-logic/src/commands/glamour.ts` (+ test), bot-logic locales ×6, `apps/discord-worker/src/handlers/commands/glamour.ts` (+ test), `commands/registry.ts`, `schemas.ts`, `localize.ts`, `/about` and `/manual` entries, docs.

- [ ] svg: card structure tests (≤5 rows, footer counts, no name); implement 2a.
- [ ] bot-logic: `executeGlamour(parsed, resolve, locale)` → `{ svg, embed }`; tests with the stress sample.
- [ ] discord-worker: handler (attachment guards shared with `/swatch`), resolve via `UNIVERSALIS_PROXY.fetch('https://api/v1/chara/resolve')`; registry/schema/localize parity tests.
- [ ] Versions + changelogs; PR D; note: run `register-commands` after deploy.

### Task R1: Rich Presence art

- [ ] Render 2a (1024 × 576), 2b `tool_glamour` (1024 × 1024) and 2c `state_idle` (1024 × 1024) from `Rich Presence Art.dc.html` with Playwright at 1×; hand over the PNGs with the portal steps.
