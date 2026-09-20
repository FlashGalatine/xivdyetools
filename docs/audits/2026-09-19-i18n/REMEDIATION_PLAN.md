# Remediation Plan — 2026-09-19

**Sources:** [I18N_AUDIT_2026-09-19.md](I18N_AUDIT_2026-09-19.md) — 15 findings (`I18N-001…010`, `HC-001`, `TERM-001…004`) · **Status basis:** 15 total — 0 fixed, 15 outstanding, 0 superseded, 0 KEEP, 0 need rotation
**Ordering:** 1. one deploy unit per sprint 2. no P0; the two P1s lead their units 3. wrong text before missing text; fix the generator, not the artifact 4. a package change = one publish sprint, then one sprint per consumer 5. terminal work last — the CJK font re-cut, after every bot-logic string is final

Tiering, ordering and the splits below were set by an `opus` verifier (it raised I18N-001 and I18N-005 to P1 and corrected two semver calls); the maintainer's two decisions of 2026-09-19 were folded in afterwards. Registry check the same day: `types 3.2.0`, `core 5.3.0`, `svg 4.1.0`, `bot-logic 4.3.0` are all **published** at their local versions, so every package change needs a bump (`evidence/versions-vs-registry.txt`).

## Sprint 0 — Decisions (answered 2026-09-19; nothing merges)

| ID | Tier | Decision |
|---|---|---|
| TERM-003 | P3 | **Adopt the KR/CN client terms**: ko `서버` / `데이터 센터`, zh `服务器` / `大区`, on both surfaces. |
| I18N-010 | P3 | **Translate all four policy documents** into ja de fr ko zh (`<STEM>.<locale>.md`, English governing) — not a "(English)" marker. Audit skills updated the same day to check them in every language. |

No out-of-band items; no rotation.

## Sprint 1 — `@xivdyetools/core`: search folding + generator hardening (publish)

The P1 that blocks the most surfaces starts here: core owns the fold that api-worker inherits and bot-logic will import. The two latent core items ride along because they touch the same package and one publish.

| ID | Tier | Locale(s) | Item |
|---|---|---|---|
| I18N-005 *(prerequisite half)* | P1 | de fr ja | Add `foldForSearch()` (NFKC → lower-case → `ß→ss` → strip marks from **Latin only**); use it on both sides in `DyeService.searchByLocalizedName`; export it. Tests: `schneeweiss`, `russschwarz`, `creme`, half-width `ｽﾉｳ`, negative `か`≠`が`. |
| I18N-007 | P3 | all | `build-locales.ts`: collect empty CSV cells and exit 1 (`--allow-missing` escape); `getColorWheelName` ends in `formatKey(id)`. |
| I18N-009 *(prerequisite half)* | P3 | zh | Fix the `extractLocaleCode` JSDoc example (`'zh-CN' // 'zh'`, add `'pt-BR' // null`). |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...@xivdyetools/core` → whole-graph gate + `pnpm test:scripts && pnpm dead-code:check` → bump **core 5.3.0 → 5.4.0 (MINOR** — new public export, observable search change) → root `README.md` + `docs/versions.md` → core `CHANGELOG.md` → merge (path filters redeploy every core consumer) → Actions **Publish Packages to npm** → `@xivdyetools/core`.

## Sprint 2 — `web-app`: wrong text and one name per concept (deploy)

All hand-edited web-app locale work in one pass per locale file, so key order and parity are validated once. No worker font impact (web-app bundles Latin faces only).

| ID | Tier | Locale(s) | Item |
|---|---|---|---|
| I18N-004 | P2 | ko | `comparison.mCiede2000Desc`: `안팡이` → `안팎이`. |
| TERM-001 *(prerequisite half)* | P2 | fr ko zh | Six Market Board keys → fr `Tableau des ventes`, ko `장터`, zh `市场布告板`. Eyeball `m.ff14.co.kr/guide/start/detail.asp?no=8` first. |
| TERM-002 | P2 | de fr ja ko | Delete the seven `resultCard.tools.*` keys (×6); `result-card.ts:1809-1858` renders `tools.<id>.title` (or `.shortName`) via `@shared/tool-handoff`. |
| TERM-003 *(prerequisite half)* | P3 | ko zh | `config.allWorlds` + `marketBoard.allWorlds` → ko `모든 서버`, zh `所有服务器`. |
| TERM-004 | P3 | ja de fr ko zh | One form per concept across the 12 groups (sidebar ↔ panel); fr to sentence case. Add `tool-name-consistency.py --all` with an allow-list to `validate:i18n`. |
| I18N-008 | P3 | all | `budget-tool.ts:658` → `compareDyeNames`; `dye-selector.ts:441` compares localized labels with the app locale (or documents a fixed order). |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app` + `pnpm --filter xivdyetools-web-app run validate:i18n` + `run i18n:unused` + `run build:check` → bump web-app 5.11.0 → 5.12.0 → web-app `CHANGELOG.md` + `CHANGELOG-laymans.md` (the `### ` heading is load-bearing) → versions docs → merge → `deploy-web-app.yml`.

## Sprint 3 — `web-app`: Privacy + Terms of Service in six languages (deploy)

Kept apart from Sprint 2 because legal translations need their own read-through, and a parity failure here must not hold up a typo fix.

| ID | Tier | Locale(s) | Item |
|---|---|---|---|
| I18N-010 *(prerequisite half)* | P3 | ja de fr ko zh | 10 new files: `apps/web-app/PRIVACY.<lc>.md`, `TERMS_OF_SERVICE.<lc>.md`, each opening with the localized English-prevails notice; numbers, commands, hosts, storage names and section numbering verbatim; same `Last updated` date ×6. `about-modal.ts` links the app-locale variant, falling back to English. UI labels the policy names must match that locale's `src/locales/<lc>.json`. List every translation in the commit; flag clauses that needed interpretation (NC governing-law wording). |

**Ends with:** `python <skills>/audit-shared/scripts/policy-locale-parity.py` — the two web-app documents report `ok` ×5 → web-app gate as Sprint 2 (+ a test that the About modal picks the locale variant) → web-app 5.12.0 → 5.13.0 (or fold into 5.12.0 if Sprint 2 has not merged) → both web-app changelogs → merge → `deploy-web-app.yml`.

## Sprint 4 — `api-worker`: locale type + the widened `q=` (deploy)

| ID | Tier | Locale(s) | Item |
|---|---|---|---|
| I18N-009 *(completes)* | P3 | all | `apps/api-worker/src/types.ts:48` → `locale: LocaleCode` via `import type`. |
| I18N-005 *(docs task)* | P1 | de fr ja | VitePress `q=` note: matching is accent-, `ß`- and width-insensitive from core 5.4.0. No code — behaviour arrives with the core publish. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-api-worker` + `pnpm docs:check-versions && pnpm docs:check-links` → api-worker 0.14.3 → 0.14.4 → merge → `deploy-api-worker.yml`.

## Sprint 5 — `@xivdyetools/bot-logic`: plural rules, new keys, official terms (publish — **merges only with Sprints 6 and 7**)

Every bot-logic *text* change of the wave lands here so the fonts are cut once. `deploy-discord-worker.yml` triggers on `packages/bot-logic/**` and `font-coverage.test.ts` reads these JSON files, so this sprint is red on its own by design.

| ID | Tier | Locale(s) | Item |
|---|---|---|---|
| I18N-003 | P2 | fr | `tc()` selects with `new Intl.PluralRules(locale).select(count)`, falls back to `other`; `translator.test.ts` gains fr 0/1/2 and de 0. **First in the sprint.** |
| I18N-005 *(completes)* | P1 | de fr ja | `input-resolution.ts:60-65` imports core's `foldForSearch`. |
| TERM-001 *(completes)* | P2 | zh | bot-logic zh ×4 `市场板` → `市场布告板`; add the Market Board row to `docs/reference/ffxiv-terminology.md`. |
| TERM-003 *(completes)* | P3 | ko zh | ko `월드` → `서버`, `데이터센터` → `데이터 센터`; zh `数据中心` → `大区` across `budget.*`, `preferences.*`, `manual*`; World + Data Center dictionary rows. Option names (`world`) stay ASCII. |
| I18N-001 *(prerequisite half)* | P1 | ja de fr ko zh | `commands.<cmd>.options.<path>.description` keys ×6 (134 strings, ≤ 100 chars each). |
| HC-001 *(prerequisite half)* | P2 | ja de fr ko zh | `about.builtOnBody` ×6, brand names verbatim. |
| I18N-006 *(prerequisite half)* | P3 | en de fr | Add `card.colours_one` / `_other` ×6 and **keep** the bare `card.colours` key (removing a key is a MAJOR). |
| — | guardrail | — | bot-logic identical-to-en allow-list with reasons (report recommendation 3; de `about.poweredBy` is its first entry). |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic` (expect only discord-worker's `font-coverage.test.ts` red) → bump **bot-logic 4.3.0 → 4.4.0 (MINOR)** → hold the merge.

## Sprint 6 — `discord-worker`: picker localization, `/about`, policy documents (deploy — same PR as Sprint 5)

| ID | Tier | Locale(s) | Item |
|---|---|---|---|
| I18N-001 *(completes)* | P1 | ja de fr ko zh | `localizeOption()` walks options and attaches `description_localizations`; `localize.test.ts` flips from "17" to full coverage **and** asserts each command's payload ≤ 8,000 chars including localizations (`/preferences` ≈ 6.6k). Exclude `commands.*.options.*` from `subset-cjk-fonts.py`'s scan and from `font-coverage.test.ts`'s source set — Discord draws those strings, resvg never does. |
| I18N-002 | P2 | ja de fr ko zh | `manual`/`topic` case in `choiceLocalizations()` from `manual5.topics.<topic>.name`, emoji kept. |
| HC-001 *(completes)* | P2 | ja de fr ko zh | `about.ts:136` → `t.t('about.builtOnBody')`. |
| I18N-006 *(completes)* | P3 | en de fr | `extractor.ts:586` → `t.tc('card.colours', n, { n })`. |
| I18N-010 *(completes)* | P3 | ja de fr ko zh | 10 new files: `apps/discord-worker/PRIVACY_POLICY.<lc>.md`, `TERMS_OF_SERVICE.<lc>.md`, same rules as Sprint 3; `/about` (and any policy link the bot emits) points at the resolved-locale variant. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-discord-worker` (font gate still red until Sprint 7) + parity script `ok` ×5 for the two bot documents → discord-worker 5.5.8 → 5.6.0 → hold the merge.

## Sprint 7 — TERMINAL: re-cut the CJK subsets, then the wave's one bot merge

No new IDs. Runs only when every bot-logic string above is final.

| Task | Item |
|---|---|
| fonts | `python apps/discord-worker/scripts/subset-cjk-fonts.py`; compare old/new **by cmap** (`cmap-diff.py`), never md5. `告` (U+544A) is a genuinely new codepoint (surplus was 0). |
| og-worker | Run its `subset-cjk-fonts.py` once and confirm a zero-cmap diff — no finding changes core locale text or `og-strings.ts`, so no og-worker sprint exists. |
| size | `node scripts/check-bundle-size.mjs` under 3,072 KiB gzip (2,632 today; warn band 2,826). |
| changelogs | discord-worker `CHANGELOG.md` + `CHANGELOG-laymans.md` (no `Unreleased` block); **one** root `CHANGELOG-laymans.md` entry for the whole wave — it fires the Discord announcement on push to `main`, so it is written here and nowhere earlier. |

**Ends with:** `font-coverage.test.ts` + `font-faces.test.ts` green in both workers → whole-graph `pnpm turbo run build type-check lint test` + `pnpm test:scripts && pnpm dead-code:check && pnpm docs:check-versions && pnpm docs:check-links` → single merge of Sprints 5–7 → `deploy-discord-worker.yml` (deploys `--env production`, then runs `register-commands`) → Actions **Publish Packages to npm** → `@xivdyetools/bot-logic` → smoke-test the picker in ja and fr, `/about`, a preset card with 0 votes in fr.

## Superseded findings

None. (I18N-001 itself *supersedes* `2026-08-20-discord-worker-i18n/F-03` phase 2.)

## KEEP register

None.

## Standing guidance

- Verify each finding's evidence against the code before fixing — findings are leads. Two fix directions were already corrected at planning (semver on I18N-003/005; the dakuten trap in I18N-005's fold).
- One commit per task (or per sprint when tiny); gate at every sprint boundary; stage only your own paths (`git commit --only -- <paths>`); `git fetch` and compare with `origin/main` before each sprint.
- Add or remove a key in **all six** locale files at once; web-app order via `node scripts/reorder-locales.mjs --check`. Never hand-edit core's generated locale JSON.
- Terminology changes carry a cited source (`evidence/official-terms-research.md`) — this audit's own "fluent guess" for ko Market Board was wrong.
- Policy documents: a change to one language is a change to six, in one commit, with one `Last updated` date (`audit-shared/policy-documents.md`).
- Re-run `evidence/scripts/run-gates.sh` after each sprint (pass `--coverage.enabled=false` to subset vitest runs so green suites do not exit 1).
- Annotate executed sprints in the heading: **✅ COMPLETED <date> <commits>** + **Deploy needs:** — the plan doubles as the tracker; mirror into each finding's `## Status` and the report's status table.
